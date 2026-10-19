import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ariesFixture, fixtureId, fixtureBookId as book, fixtureUserId as user } from '../__fixtures__/editorial-fixture.ts';
import { planEditorialSubsectionMove, planEditorialTextPlacement, planEditorialTextMove } from '../editorial-hierarchy.ts';

const db = new PGlite();
const migrationDir = new URL('../../../../supabase/migrations/', import.meta.url);
const fixture = ariesFixture();
const section = fixture.sections[1].id;
before(async () => {
  // Supabase platform stubs only; application tables, constraints and RLS are
  // replayed from the repository's real migrations. No network/database URL.
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub',auth.uid(),'email','test@example.invalid') $$;
    grant usage on schema auth to authenticated,anon;
    create schema storage; create table storage.objects(id uuid, bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
  `);
  for (const name of fs.readdirSync(migrationDir).filter(n => n.endsWith('.sql')).sort()) {
    if (name === '20260701010000_add_kdp_assets_storage_v1.sql') continue;
    let sql = fs.readFileSync(new URL(name, migrationDir), 'utf8');
    // gen_random_uuid is built into this local Postgres; pgcrypto is not needed.
    sql = sql.replace('create extension if not exists pgcrypto;', '');
    await db.exec(sql);
  }
});
beforeEach(async () => {
  await db.exec(`reset role; drop trigger if exists fail_editorial_test on public.kdp_sections;
    drop trigger if exists fail_editorial_delete_test on public.kdp_section_blocks;
    delete from public.kdp_books; delete from auth.users;`);
  await db.query('insert into auth.users(id) values ($1),($2)', [user,fixtureId(3)]);
  await db.query(`insert into public.kdp_books(id,title,author_name,book_type,created_by) values ($1,'ARIETE','Test','generic_kdp_book',$2)`,[book,user]);
  await db.query(`insert into public.kdp_import_runs(book_id,import_token,draft_hash,import_kind,normalized_project)
    values ($1,$2,'test','editorial_draft_v1',$3)`,[book,fixtureId(4),JSON.stringify(fixture.project)]);
  await db.query(`insert into public.kdp_sections(id,book_id,title,section_type,sort_order,settings)
    select id,book_id,title,section_type,sort_order,settings from jsonb_to_recordset($1::jsonb)
    as x(id uuid,book_id uuid,title text,section_type text,sort_order integer,settings jsonb)`,[JSON.stringify(fixture.sections)]);
  await db.query(`insert into public.kdp_section_blocks(id,book_id,section_id,title,body,block_type,sort_order)
    select id,book_id,section_id,title,body,block_type,sort_order from jsonb_to_recordset($1::jsonb)
    as x(id uuid,book_id uuid,section_id uuid,title text,body text,block_type text,sort_order integer)`,[JSON.stringify(fixture.blocks)]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  await db.exec('set role authenticated');
});
after(async () => db.close());
const bootstrap = () => db.query('select public.bootstrap_editorial_builder_v1($1) result',[book]);
async function state(id=section) {
  const rows=(await db.query('select * from public.kdp_section_blocks where section_id=$1 order by sort_order,created_at,id',[id])).rows;
  const settings=(await db.query('select settings from public.kdp_sections where id=$1',[id])).rows[0].settings;
  return {rows,settings,map:settings.editorial_builder_v1};
}
async function apply(change, observed, id=section) {
  const s=observed??await state(id);
  return db.query('select public.apply_editorial_section_change_v1($1,$2,$3,$4,$5) result',
    [book,id,s.map.revision,s.rows.map(b=>b.id),JSON.stringify(change)]);
}
function coherent(s) {
  assert.deepEqual(s.rows.map(b=>b.sort_order),s.rows.map((_,i)=>i+1));
  assert.equal(new Set(s.rows.map(b=>b.sort_order)).size,s.rows.length);
  const positions=new Map(s.rows.map((b,i)=>[b.id,i]));
  const ordered=[...s.map.subsections].sort((a,b)=>positions.get(a.heading_block_id)-positions.get(b.heading_block_id));
  assert.deepEqual(s.map.subsections,ordered);
  assert.deepEqual(ordered.map(s=>s.order),ordered.map((_,i)=>i));
}

test('RPC bootstrap: real 1167-row structure maps 53/8/3/2, preserves settings and text, is idempotent',async()=>{
  const initial=await state();const result=await bootstrap();assert.equal(result.rows[0].result.initialized,15);
  const all=(await db.query("select settings->'editorial_builder_v1' m,title from public.kdp_sections order by sort_order")).rows;
  assert.equal(all.reduce((n,s)=>n+s.m.subsections.length,0),53);
  for(const [title,n] of [['MANIFESTAZIONE',8],['PIETRE NATURALI',3],["I CODICI ENERGETICI DELL’ARIETE",2]]) assert.equal(all.find(s=>s.title===title).m.subsections.length,n);
  const s=await state();assert.deepEqual(s.rows,initial.rows);assert.equal(s.settings.retained_key,'keep');
  assert.equal((await bootstrap()).rows[0].result.initialized,0);assert.deepEqual(await state(),s);
});
test('RPC bootstrap mismatch in last section rolls back all 15 maps',async()=>{
  await db.query('update public.kdp_section_blocks set body=$1 where id=$2',['changed',fixture.blocks.at(-1).id]);
  await assert.rejects(bootstrap(),/editorial_bootstrap_mismatch/);
  assert.equal((await db.query("select count(*)::int n from public.kdp_sections where settings ? 'editorial_builder_v1'")).rows[0].n,0);
});
test('RPC bootstrap missing row refuses partial map',async()=>{
  await db.query('delete from public.kdp_section_blocks where id=$1',[fixture.blocks.at(-1).id]);
  await assert.rejects(bootstrap(),/editorial_bootstrap_mismatch/);
  assert.equal((await db.query("select count(*)::int n from public.kdp_sections where settings ? 'editorial_builder_v1'")).rows[0].n,0);
});
test('Rename preserves semantic ID and UUID; repeated bootstrap preserves edited map',async()=>{
  await bootstrap();const s=await state();const marker=s.map.subsections[0];
  await apply({operation:'update_text',block_id:marker.heading_block_id,title:'Nuovo titolo',body:null},s);
  const after=await state();assert.deepEqual(after.map.subsections,s.map.subsections);
  assert.equal(after.rows.find(b=>b.id===marker.heading_block_id).title,'Nuovo titolo');
  assert.equal((await bootstrap()).rows[0].result.initialized,0);assert.deepEqual(await state(),after);
});
test('Atomic reorder keeps complete groups and map ordering coherent',async()=>{
  await bootstrap();const s=await state();const id=s.map.subsections[1].heading_block_id;
  const order=planEditorialSubsectionMove(s.rows,id,'up',s.map);
  await apply({operation:'reorder',order},s);const after=await state();coherent(after);
  assert.deepEqual(after.rows.map(b=>b.id),order);assert.equal(after.map.subsections[0].heading_block_id,id);
});
test('Failed map UPDATE after reorder rolls back every block UPDATE',async()=>{
  await bootstrap();const s=await state();
  await db.exec(`reset role; create or replace function public.fail_editorial_test() returns trigger language plpgsql as $$ begin raise exception 'injected_map_failure'; end $$;
    create trigger fail_editorial_test before update on public.kdp_sections for each row execute function public.fail_editorial_test(); set role authenticated;`);
  await assert.rejects(apply({operation:'reorder',order:planEditorialSubsectionMove(s.rows,s.map.subsections[1].heading_block_id,'up',s.map)},s),/injected_map_failure/);
  assert.deepEqual(await state(),s);
});
test('Atomic delete removes heading, every group row and only its map entry',async()=>{
  await bootstrap();const s=await state();const first=s.map.subsections[0],second=s.map.subsections[1];
  const start=s.rows.findIndex(b=>b.id===first.heading_block_id),end=s.rows.findIndex(b=>b.id===second.heading_block_id);
  await apply({operation:'delete_subsection',block_id:first.heading_block_id},s);
  const after=await state();coherent(after);assert.equal(after.rows.length,s.rows.length-(end-start));
  assert.equal(after.map.subsections.length,s.map.subsections.length-1);
  assert.deepEqual(after.rows.map(b=>b.id),s.rows.filter((_,i)=>i<start||i>=end).map(b=>b.id));
});
test('Error during multi-row DELETE rolls back all deleted rows and map',async()=>{
  await bootstrap();const s=await state();const heading=s.map.subsections[0].heading_block_id;
  const second=s.rows[s.rows.findIndex(b=>b.id===heading)+2].id;
  await db.exec(`reset role; create or replace function public.fail_editorial_delete_test() returns trigger language plpgsql as $$ begin if old.id='${second}'::uuid then raise exception 'injected_delete_failure'; end if; return old; end $$;
    create trigger fail_editorial_delete_test before delete on public.kdp_section_blocks for each row execute function public.fail_editorial_delete_test(); set role authenticated;`);
  await assert.rejects(apply({operation:'delete_subsection',block_id:heading},s),/injected_delete_failure/);
  assert.deepEqual(await state(),s);
});
test('New subsection atomically obtains stable builder semantic ID and map entry',async()=>{
  await bootstrap();const s=await state();const result=await apply({operation:'add_subsection',title:'Nuova'},s);
  const after=await state();coherent(after);const entry=after.map.subsections.at(-1);
  assert.match(entry.semantic_id,/^builder:/);assert.equal(entry.heading_block_id,result.rows[0].result.block_id);
  await apply({operation:'update_text',block_id:entry.heading_block_id,title:'Rinominata'},after);
  assert.deepEqual((await state()).map.subsections.at(-1),entry);
});
test('New text is inserted at destination boundary atomically',async()=>{
  await bootstrap();const s=await state();const marker=s.map.subsections[0].heading_block_id;
  const result=await apply({operation:'add_text',subsection_id:marker,body:'Nuovo testo'},s);const after=await state();coherent(after);
  const next=after.rows.findIndex(b=>b.id===s.map.subsections[1].heading_block_id);
  assert.equal(after.rows[next-1].id,result.rows[0].result.block_id);
});
test('Old revision is rejected on retry without overwriting successful operation',async()=>{
  await bootstrap();const s=await state();await apply({operation:'add_text',body:'Una sola aggiunta'},s);const after=await state();
  await assert.rejects(apply({operation:'add_text',body:'Una sola aggiunta'},s),/editorial_conflict/);assert.deepEqual(await state(),after);
});
test('Foreign, duplicated and incomplete reorder IDs fail with no writes',async()=>{
  await bootstrap();const s=await state();
  for(const order of [s.rows.map(b=>b.id).slice(1),s.rows.map((b,i)=>i===1?s.rows[0].id:b.id),s.rows.map((b,i)=>i===1?fixtureId(999999):b.id)]) {
    await assert.rejects(apply({operation:'reorder',order},s),/editorial_invalid_order/);assert.deepEqual(await state(),s);
  }
});
test('RLS denies inaccessible private book and anonymous execution',async()=>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[fixtureId(3)]);
  await assert.rejects(bootstrap(),/editorial_access_denied/);
  await db.exec('reset role; set role anon');await assert.rejects(bootstrap(),/permission denied/);
});
test('Structured books refuse bootstrap and receive no map',async()=>{
  await db.query("update public.kdp_import_runs set import_kind='generic_draft_v0' where book_id=$1",[book]);
  await assert.rejects(bootstrap(),/editorial_book_required/);
  assert.equal((await db.query("select count(*)::int n from public.kdp_sections where settings ? 'editorial_builder_v1'")).rows[0].n,0);
});

test('Move text between subsections preserves every semantic identity and unique order',async()=>{
  await bootstrap();const s=await state();const first=s.map.subsections[0],second=s.map.subsections[1];
  const text=s.rows[s.rows.findIndex(b=>b.id===first.heading_block_id)+1];
  const order=planEditorialTextPlacement(s.rows,text.id,second.heading_block_id,s.map);
  await apply({operation:'reorder',order},s);const after=await state();coherent(after);
  assert.deepEqual(after.map.subsections,s.map.subsections);assert.deepEqual(after.rows.map(b=>b.id),order);
});
test('Failed map update while adding a subsection rolls back the inserted heading',async()=>{
  await bootstrap();const s=await state();
  await db.exec(`reset role; create or replace function public.fail_editorial_test() returns trigger language plpgsql as $$ begin raise exception 'injected_map_failure'; end $$;
    create trigger fail_editorial_test before update on public.kdp_sections for each row execute function public.fail_editorial_test(); set role authenticated;`);
  await assert.rejects(apply({operation:'add_subsection',title:'Must roll back'},s),/injected_map_failure/);
  assert.deepEqual(await state(),s);
});
test('Malformed existing map is never replaced by bootstrap heuristics',async()=>{
  await bootstrap();await db.query("update public.kdp_sections set settings=jsonb_set(settings,'{editorial_builder_v1,version}','999'::jsonb) where id=$1",[section]);
  const s=await state();await assert.rejects(bootstrap(),/editorial_map_invalid/);assert.deepEqual(await state(),s);
});
test('New book part starts with an empty valid map and preserves introduction null title',async()=>{
  await bootstrap();const result=await db.query("select public.create_editorial_section_v1($1,'Nuovo capitolo','chapter') id",[book]);
  const s=await state(result.rows[0].id);coherent(s);assert.deepEqual(s.map.subsections,[]);
  assert.equal((await db.query('select title from public.kdp_sections where id=$1',[fixture.sections[0].id])).rows[0].title,null);
});
test('Visibility policy still allows another authenticated user to edit a public book',async()=>{
  await db.query("update public.kdp_books set visibility='public' where id=$1",[book]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[fixtureId(3)]);
  assert.equal((await bootstrap()).rows[0].result.initialized,15);
});

async function pendingImage(n=800001) {
 const id=fixtureId(n);
 await db.query("insert into public.kdp_assets(id,book_id,asset_type,prompt,status,file_path) values ($1,$2,'image','editorial-image-v1:pending','placeholder',$3)",[id,book,user+'/'+book+'/'+id+'/image.png']);
 return id;
}
test('Images: atomic insertion, replacement, style, cleanup ledger and stale rejection',async()=>{
 await bootstrap();const s=await state();const asset=await pendingImage();
 const added=await apply({operation:'add_image',asset_id:asset,subsection_id:s.map.subsections[0].heading_block_id,size:'medium',align:'center'},s);
 const id=added.rows[0].result.block_id;let current=await state();coherent(current);
 assert.deepEqual(current.map.subsections,s.map.subsections);
 assert.equal(current.rows.find(b=>b.id===id).block_type,'image');
 const next=current.rows.findIndex(b=>b.id===s.map.subsections[1].heading_block_id);
 assert.equal(current.rows[next-1].id,id);
 await assert.rejects(apply({operation:'style_image',block_id:id,size:'small',align:'left'},s),/editorial_conflict/);
 assert.deepEqual(await state(),current);
 const replacement=await pendingImage(800002);
 await apply({operation:'replace_image',block_id:id,asset_id:replacement,size:'small',align:'right'});
 current=await state();assert.equal(current.rows.find(b=>b.id===id).asset_id,replacement);
 assert.equal((await db.query('select prompt from public.kdp_assets where id=$1',[asset])).rows[0].prompt,'editorial-image-v1:garbage');
 await apply({operation:'style_image',block_id:id,size:'text',align:'left'});
 assert.deepEqual(JSON.parse((await state()).rows.find(b=>b.id===id).editor_notes),{size:'text',align:'left'});
 await apply({operation:'delete_subsection',block_id:s.map.subsections[0].heading_block_id});
 assert.equal((await db.query('select prompt from public.kdp_assets where id=$1',[replacement])).rows[0].prompt,'editorial-image-v1:garbage');
 coherent(await state());
});
test('Images reject foreign assets, invalid style, invalid destinations and rollback pending activation',async()=>{
 await bootstrap();const asset=await pendingImage();const s=await state();
 for(const change of [
  {asset_id:fixtureId(900000),size:'small',align:'left'},
  {asset_id:asset,size:'crop',align:'left'},
  {asset_id:asset,size:'small',align:'left',subsection_id:fixtureId(900001)},
 ]) {await assert.rejects(apply({operation:'add_image',...change}),/editorial_invalid_target/);assert.deepEqual(await state(),s);}
 assert.equal((await db.query('select prompt from public.kdp_assets where id=$1',[asset])).rows[0].prompt,'editorial-image-v1:pending');
});


test('Images: failed asset activation rolls back inserted block, revision and semantic map',async()=>{
 await bootstrap();const asset=await pendingImage();const s=await state();
 await db.exec(`reset role; create or replace function public.fail_image_activation_test() returns trigger language plpgsql as $$ begin raise exception 'injected_image_failure'; end $$;
 create trigger fail_image_activation_test before update on public.kdp_assets for each row execute function public.fail_image_activation_test();set role authenticated;`);
 try {
  await assert.rejects(apply({operation:'add_image',asset_id:asset,size:'small',align:'left'}),/injected_image_failure/);
  assert.deepEqual(await state(),s);
  assert.equal((await db.query('select prompt from public.kdp_assets where id=$1',[asset])).rows[0].prompt,'editorial-image-v1:pending');
 } finally { await db.exec('reset role;drop trigger fail_image_activation_test on public.kdp_assets;set role authenticated'); }
});

test('Pending images: recovery reuses the asset; expiry collects only abandoned uploads and blocks late finalization',async()=>{
 await bootstrap();const recovered=await pendingImage();const expired=await pendingImage(800002);const recent=await pendingImage(800003);
 const initial=await state();
 await apply({operation:'add_image',asset_id:recovered,size:'medium',align:'center'});
 await db.query("update public.kdp_assets set created_at=now()-interval '2 hours' where id=any($1::uuid[])",[[recovered,expired]]);
 assert.equal((await db.query('select public.collect_editorial_image_uploads_v1($1) n',[book])).rows[0].n,1);
 const prompts=(await db.query('select id,prompt from public.kdp_assets order by id')).rows;
 assert.equal(prompts.find(a=>a.id===recovered).prompt,'editorial-image-v1:active');
 assert.equal(prompts.find(a=>a.id===expired).prompt,'editorial-image-v1:garbage');
 assert.equal(prompts.find(a=>a.id===recent).prompt,'editorial-image-v1:pending');
 const before=await state();
 await assert.rejects(apply({operation:'add_image',asset_id:expired,size:'medium',align:'center'}),/editorial_invalid_target/);
 assert.deepEqual(await state(),before);assert.deepEqual(before.map.subsections,initial.map.subsections);coherent(before);
 assert.equal((await db.query('select public.collect_editorial_image_uploads_v1($1) n',[book])).rows[0].n,0);
});

test('Pending images: explicit discard is revision checked, preserves content, and refuses active assets',async()=>{
 await bootstrap();const pending=await pendingImage();const initial=await state();
 await apply({operation:'discard_image_upload',asset_id:pending},initial);
 const content=rows=>rows.map(({id,title,body,block_type,asset_id,sort_order})=>({id,title,body,block_type,asset_id,sort_order}));
 assert.deepEqual(content((await state()).rows),content(initial.rows));
 assert.equal((await db.query('select prompt from public.kdp_assets where id=$1',[pending])).rows[0].prompt,'editorial-image-v1:garbage');
 const second=await pendingImage(800002);
 await assert.rejects(apply({operation:'discard_image_upload',asset_id:second},initial),/editorial_conflict/);
 assert.equal((await db.query('select prompt from public.kdp_assets where id=$1',[second])).rows[0].prompt,'editorial-image-v1:pending');
 await apply({operation:'add_image',asset_id:second,size:'small',align:'left'});
 const current=await state();
 await assert.rejects(apply({operation:'discard_image_upload',asset_id:second}),/editorial_invalid_target/);
 assert.deepEqual(await state(),current);
});

test('Shared images: replacement and deletion retain the asset until its last reference disappears',async()=>{
 await bootstrap();const asset=await pendingImage();
 const first=(await apply({operation:'add_image',asset_id:asset,size:'medium',align:'center'})).rows[0].result.block_id;
 const shared=fixtureId(800010);
 await db.query("insert into public.kdp_section_blocks(id,book_id,section_id,block_type,asset_id,sort_order) values ($1,$2,$3,'image',$4,9999)",[shared,book,section,asset]);
 const replacement=await pendingImage(800002);
 await apply({operation:'replace_image',block_id:first,asset_id:replacement,size:'small',align:'left'});
 assert.equal((await db.query('select prompt from public.kdp_assets where id=$1',[asset])).rows[0].prompt,'editorial-image-v1:active');
 await apply({operation:'delete_text',block_id:first});
 assert.equal((await db.query('select prompt from public.kdp_assets where id=$1',[asset])).rows[0].prompt,'editorial-image-v1:active');
 await apply({operation:'delete_text',block_id:shared});
 assert.equal((await db.query('select prompt from public.kdp_assets where id=$1',[asset])).rows[0].prompt,'editorial-image-v1:garbage');
 await assert.rejects(db.query("insert into public.kdp_section_blocks(book_id,section_id,block_type,asset_id) values ($1,$2,'image',$3)",[book,section,asset]),/editorial_invalid_target/);
 coherent(await state());
});

test('Pending collector denies other private-book users, anonymous calls and structured books',async()=>{
 await pendingImage();
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[fixtureId(3)]);
 await assert.rejects(db.query('select public.collect_editorial_image_uploads_v1($1)',[book]),/editorial_access_denied/);
 await db.exec('reset role;set role anon');
 await assert.rejects(db.query('select public.collect_editorial_image_uploads_v1($1)',[book]),/permission denied/);
 await db.exec('reset role;set role authenticated');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.query("update public.kdp_import_runs set import_kind='generic_draft_v0' where book_id=$1",[book]);
 await assert.rejects(db.query('select public.collect_editorial_image_uploads_v1($1)',[book]),/editorial_book_required/);
});

test('Image moves through the RPC preserve semantic groups, text and shared asset identity',async()=>{
 await bootstrap();const asset=await pendingImage();const initial=await state();const marker=initial.map.subsections[0].heading_block_id;
 const id=(await apply({operation:'add_image',asset_id:asset,subsection_id:marker,size:'medium',align:'center'})).rows[0].result.block_id;
 let current=await state();
 const boundary=planEditorialTextMove(current.rows,id,'down',current.map);
 assert.deepEqual(boundary,current.rows.map(b=>b.id));
 await apply({operation:'reorder',order:planEditorialTextMove(current.rows,id,'up',current.map)});
 current=await state();assert.deepEqual(current.map.subsections,initial.map.subsections);coherent(current);
 const order=planEditorialSubsectionMove(current.rows,marker,'down',current.map);
 await apply({operation:'reorder',order});current=await state();coherent(current);
 assert.deepEqual(current.rows.map(b=>b.id),order);
 assert.equal(current.rows.find(b=>b.id===id).asset_id,asset);
 const original=new Map(initial.rows.map(b=>[b.id,[b.title,b.body]]));
 for(const row of current.rows.filter(b=>b.id!==id)) assert.deepEqual([row.title,row.body],original.get(row.id));
 assert.deepEqual(new Set(current.map.subsections.map(s=>s.semantic_id)),new Set(initial.map.subsections.map(s=>s.semantic_id)));
});
