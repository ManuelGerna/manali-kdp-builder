import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ariesFixture, fixtureId, fixtureBookId as book, fixtureUserId as user } from '../__fixtures__/editorial-fixture.ts';
import { readEditorialSectionText, literalParagraph } from '../editorial-text-v2.ts';
import { planEditorialImagePlacement } from '../editorial-image-placement.ts';

const db = new PGlite();
const fixture = ariesFixture(), sectionId = fixture.sections[1].id;
before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub',auth.uid(),'email','local@example.invalid') $$;
    grant usage on schema auth to authenticated,anon;
    create schema storage; create table storage.objects(id uuid,bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
  const dir = new URL('../../../../supabase/migrations/', import.meta.url);
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.sql')).sort()) {
    if (name === '20260701010000_add_kdp_assets_storage_v1.sql') continue;
    await db.exec(fs.readFileSync(new URL(name, dir), 'utf8').replace('create extension if not exists pgcrypto;', ''));
  }
});
beforeEach(async () => {
  await db.exec(`reset role; drop trigger if exists fail_v2_test on public.kdp_sections; truncate public.kdp_books cascade; delete from auth.users;`);
  await db.query('insert into auth.users(id) values ($1),($2)', [user, fixtureId(3)]);
  await db.query("insert into public.kdp_books(id,title,author_name,book_type,created_by) values ($1,'ARIETE','Local','generic_kdp_book',$2)", [book, user]);
  await db.query("insert into public.kdp_import_runs(book_id,import_token,draft_hash,import_kind,normalized_project) values ($1,$2,'test','editorial_draft_v1',$3)", [book, fixtureId(4), JSON.stringify(fixture.project)]);
  await db.query(`insert into public.kdp_sections(id,book_id,title,section_type,sort_order,settings)
    select id,book_id,title,section_type,sort_order,settings from jsonb_to_recordset($1::jsonb)
    as x(id uuid,book_id uuid,title text,section_type text,sort_order integer,settings jsonb)`, [JSON.stringify(fixture.sections)]);
  await db.query(`insert into public.kdp_section_blocks(id,book_id,section_id,title,body,block_type,sort_order)
    select id,book_id,section_id,title,body,block_type,sort_order from jsonb_to_recordset($1::jsonb)
    as x(id uuid,book_id uuid,section_id uuid,title text,body text,block_type text,sort_order integer)`, [JSON.stringify(fixture.blocks)]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); await db.exec('set role authenticated');
  await db.query('select public.bootstrap_editorial_builder_v1($1)', [book]);
});
after(async () => db.close());
async function state() {
  const section = (await db.query('select to_jsonb(s) data from public.kdp_sections s where id=$1', [sectionId])).rows[0]?.data;
  const blocks = (await db.query('select to_jsonb(b) data from public.kdp_section_blocks b where section_id=$1 order by sort_order,created_at,id', [sectionId])).rows.map(r => r.data);
  return { section, blocks, revision: section?.settings.editorial_builder_v1.revision };
}
function group(s, opening = false) { const read = readEditorialSectionText(s.section, s.blocks); return opening ? read.opening.group : read.subsections[0].text.group; }
function edited(base) { const result = structuredClone(base); result.nodes.find(n => n.kind === 'text').doc.content = [literalParagraph('  Testo nuovo\r\n\n• letterale  '), literalParagraph('')]; return result; }
async function apply(s, change, overrides = {}) {
  return (await db.query('select public.apply_editorial_section_change_v1($1,$2,$3,$4,$5) result', [book, sectionId, overrides.revision ?? s.revision,
    overrides.order ?? s.blocks.map(b => b.id), JSON.stringify(change)])).rows[0].result;
}
const save = (s, expected, proposed = edited(expected), overrides) => apply(s, { operation: 'save_text_v2', subsection_id: expected.subsection_id, expected_group: expected, group: proposed }, overrides);

test('V2 migration installs functions only and first save archives sources without changing rows, UUIDs or imports', async () => {
  const s = await state(); assert.equal(s.section.settings.editorial_text_v2, undefined);
  const imports = (await db.query('select normalized_project from public.kdp_import_runs')).rows;
  const original = group(s), proposed = edited(original), receipt = await save(s, original, proposed);
  assert.equal(receipt.revision, s.revision + 1); assert.equal(receipt.updated, 1); assert.deepEqual(receipt.group, proposed);
  const after = await state(); assert.deepEqual(after.blocks, s.blocks); assert.equal(after.section.body, s.section.body);
  assert.deepEqual(after.section.settings.editorial_builder_v1.subsections, s.section.settings.editorial_builder_v1.subsections);
  assert.equal(after.section.settings.retained_key, 'keep');
  assert.deepEqual(group(after), proposed); assert.deepEqual((await db.query('select normalized_project from public.kdp_import_runs')).rows, imports);
});

test('No-op leaves every setting, row and revision untouched and does not activate V2', async () => {
  const s = await state(), original = group(s);
  assert.equal((await save(s, original, original)).updated, 0); assert.deepEqual(await state(), s);
});

test('Introductions include the existing section body once, preserve null/empty and save all segments together', async () => {
  await db.query('update public.kdp_sections set body=$1 where id=$2', ['  Introduzione\r\n  ', sectionId]);
  let s = await state(); const expected = group(s, true); assert.equal(expected.source.section_body.value, '  Introduzione\r\n  ');
  await save(s, expected); const after = await state(); assert.equal(after.section.body, s.section.body); assert.deepEqual(after.blocks, s.blocks);
  assert.equal(readEditorialSectionText(after.section, after.blocks).opening.format, 'v2');
  const unchanged = await state(); await assert.rejects(db.query('update public.kdp_sections set body=$1 where id=$2', ['Obsoleto', sectionId]), /legacy_write_rejected/);
  assert.deepEqual(await state(), unchanged);
  s = await state(); const other = group(s); await save(s, other); assert.equal(Object.keys((await state()).section.settings.editorial_text_v2.groups).length, 2);
});

test('Stale revision/order, changed source and mismatched expected document roll back the entire save', async () => {
  const s = await state(), original = group(s);
  await assert.rejects(save(s, original, edited(original), { revision: 99 }), /editorial_conflict/);
  await assert.rejects(save(s, original, edited(original), { order: [...s.blocks.map(b => b.id)].reverse() }), /editorial_conflict/);
  const invalid = structuredClone(original); invalid.source.blocks[0].body = 'Obsoleto';
  await assert.rejects(save(s, invalid), /source_mismatch/); assert.deepEqual(await state(), s);
  await save(s, original); const after = await state();
  await assert.rejects(save(after, original), /editorial_conflict/); assert.deepEqual(await state(), after);
});

test('Malformed documents, duplicated/dropped segments and altered boundary IDs are rejected without activation', async () => {
  const s = await state(), original = group(s);
  for (const corrupt of [p => p.nodes.push(structuredClone(p.nodes[0])), p => { p.nodes[0].doc.content = [{ type: 'image', attrs: { src: 'x' } }]; },
    p => { p.nodes[0].id = 'other'; }, p => { p.nodes[0].source_ids.reverse(); }, p => { p.source.blocks.pop(); }]) {
    const proposed = edited(original); corrupt(proposed); await assert.rejects(save(s, original, proposed), /editorial_v2_/); assert.deepEqual(await state(), s);
  }
});

test('Interleaved images remain fixed and are never rewritten by a multi-segment text save', async () => {
  const s = await state(); const rows = group(s).source.blocks;
  const middle = rows[Math.floor(rows.length / 2)];
  await db.query("update public.kdp_section_blocks set block_type='image',title=null,body=null,editor_notes=$1 where id=$2", ['{"editorial_image_v1":{"size":"medium","align":"center"}}', middle.id]);
  const before = await state(), original = group(before), proposed = edited(original);
  assert.ok(original.nodes.some(n => n.kind === 'block' && n.id === middle.id));
  const last = proposed.nodes.filter(n => n.kind === 'text').at(-1); last.doc.content = [literalParagraph('Dopo immagine')];
  await save(before, original, proposed); const after = await state(); assert.deepEqual(after.blocks, before.blocks); assert.deepEqual(group(after), proposed);
  const bad = structuredClone(proposed); bad.nodes.find(n => n.kind === 'block').id = fixtureId(999999);
  await assert.rejects(save(after, proposed, bad), /boundary_mismatch/); assert.deepEqual(await state(), after);
});

test('Legacy RPC and direct writes cannot overwrite converted sources; unconverted groups retain V1 editing', async () => {
  const s = await state(), original = group(s); await save(s, original); const after = await state(); const id = original.source.blocks[0].id;
  const change = { operation: 'update_text_batch', subsection_id: original.subsection_id, changes: [{ block_id: id, expected_title: original.source.blocks[0].title, expected_body: original.source.blocks[0].body, title: null, body: 'Obsoleto' }] };
  await assert.rejects(apply(after, change), /legacy_write_rejected/);
  await assert.rejects(db.query('update public.kdp_section_blocks set body=$1 where id=$2', ['Obsoleto', id]), /legacy_write_rejected/);
  await assert.rejects(db.query('delete from public.kdp_section_blocks where id=$1', [id]), /structure_locked/);
  await assert.rejects(apply(after, { operation: 'add_text', subsection_id: original.subsection_id, body: 'Nuovo blocco' }), /structure_locked/);
  assert.deepEqual(await state(), after);
  const other = readEditorialSectionText(after.section, after.blocks).subsections[1].text.group, row = other.source.blocks[0];
  await apply(after, { operation: 'update_text_batch', subsection_id: other.subsection_id, changes: [{ block_id: row.id, expected_title: row.title, expected_body: row.body, title: row.title, body: 'V1 non convertito' }] });
  assert.equal(readEditorialSectionText((await state()).section, (await state()).blocks).subsections[1].text.format, 'v1');
});

test('A failure on settings update rolls back V2 activation and revision; other users cannot save', async () => {
  const s = await state(), original = group(s);
  await db.exec(`reset role; create or replace function public.fail_v2_test() returns trigger language plpgsql as $$ begin raise exception 'injected_v2_failure'; end $$;
    create trigger fail_v2_test before update on public.kdp_sections for each row execute function public.fail_v2_test(); set role authenticated;`);
  await assert.rejects(save(s, original), /injected_v2_failure/); assert.deepEqual(await state(), s);
  await db.exec('reset role; drop trigger fail_v2_test on public.kdp_sections; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [fixtureId(3)]);
  await assert.rejects(save(s, original), /access_denied/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); assert.deepEqual(await state(), s);
});

test('A structural-marker body is archived and edited as prose without changing the structural title', async () => {
  let s = await state(); const id = s.section.settings.editorial_builder_v1.subsections[0].heading_block_id;
  await db.query('update public.kdp_section_blocks set body=$1 where id=$2', ['  Corpo strutturale\r\n  ', id]);
  s = await state(); const expected = group(s); assert.equal(expected.source.marker_body.value, '  Corpo strutturale\r\n  ');
  await save(s, expected); const after = await state(); assert.deepEqual(after.blocks, s.blocks); assert.deepEqual(group(after), edited(expected));
  await assert.rejects(db.query('update public.kdp_section_blocks set body=$1 where id=$2', ['Obsoleto', id]), /legacy_write_rejected/);
});

async function imageChange(s, operation, image, placement, assetId) {
  const plan = planEditorialImagePlacement(s.section, s.blocks, image, operation === 'delete_image' ? null : placement);
  return apply(s, { operation: 'image_v2', image_operation: operation, block_id: image.id, asset_id: assetId,
    placement, size: 'medium', align: 'center', ...plan });
}
async function pendingImage(index) {
  const id = fixtureId(index);
  await db.query("insert into public.kdp_assets(id,book_id,asset_type,title,prompt,status,file_path) values($1,$2,'image','Local','editorial-image-v1:pending','placeholder','local/image.png')", [id, book]);
  return id;
}
test('V2 images: before/after text and every chapter boundary preserve edited docs, UUIDs, semantic map and cleanup', async () => {
  let s = await state(); await save(s, group(s)); s = await state();
  const original = group(s), docs = original.nodes.filter(n => n.kind === 'text' && n.doc.content.length).map(n => n.doc);
  const semantic = s.section.settings.editorial_builder_v1.subsections;
  const asset = await pendingImage(900001);
  const image = { ...s.blocks[0], id: fixtureId(900002), block_type: 'image', asset_id: asset, body: null, title: null };
  const before = { scope: 'group', subsection_id: original.subsection_id, edge: 'before' };
  await imageChange(s, 'add_image', image, before, asset); s = await state();
  assert.deepEqual(group(s).nodes.filter(n => n.kind === 'text' && n.doc.content.length).map(n => n.doc), docs);
  assert.equal(group(s).source.blocks[0].id, image.id);
  for (const subsection_id of [null, ...semantic.map(g => g.heading_block_id)]) {
    const placement = { scope: 'chapter', subsection_id, edge: 'after' };
    await imageChange(s, 'move_image', s.blocks.find(b => b.id === image.id), placement); s = await state();
    assert.deepEqual(s.section.settings.editorial_builder_v1.subsections, semantic);
    assert.deepEqual(group(s).nodes.filter(n => n.kind === 'text' && n.doc.content.length).map(n => n.doc), docs);
    assert.equal(s.blocks.filter(b => b.id === image.id).length, 1);
  }
  const after = { ...before, edge: 'after' };
  await imageChange(s, 'move_image', s.blocks.find(b => b.id === image.id), after); s = await state();
  assert.equal(group(s).source.blocks.at(-1).id, image.id);
  await imageChange(s, 'delete_image', s.blocks.find(b => b.id === image.id), after);
  s = await state(); assert.equal(s.blocks.some(b => b.id === image.id), false);
  assert.equal((await db.query('select prompt from public.kdp_assets where id=$1', [asset])).rows[0].prompt, 'editorial-image-v1:garbage');
  assert.deepEqual(group(s).nodes.filter(n => n.kind === 'text' && n.doc.content.length).map(n => n.doc), docs);
});

test('V2 image RPC rejects stale orders, text tampering and failed map writes atomically', async () => {
  let s = await state(); await save(s, group(s)); s = await state();
  const asset = await pendingImage(900003), image = { ...s.blocks[0], id: fixtureId(900004), block_type: 'image', body: null, title: null };
  const placement = { scope: 'group', subsection_id: group(s).subsection_id, edge: 'after' };
  const plan = planEditorialImagePlacement(s.section, s.blocks, image, placement);
  const change = { operation: 'image_v2', image_operation: 'add_image', block_id: image.id, asset_id: asset, placement, size: 'text', align: 'center', ...plan };
  await assert.rejects(apply(s, change, { revision: 999 }), /editorial_conflict/);
  const bad = structuredClone(change); Object.values(bad.groups)[0].nodes.find(n => n.kind === 'text').doc.content = [literalParagraph('forged')];
  await assert.rejects(apply(s, bad), /image_text_changed/); assert.deepEqual(await state(), s);
  await db.exec(`reset role; create or replace function public.fail_v2_test() returns trigger language plpgsql as $$ begin raise exception 'injected_v2_failure'; end $$;
    create trigger fail_v2_test before update on public.kdp_sections for each row execute function public.fail_v2_test(); set role authenticated;`);
  await assert.rejects(apply(s, change), /injected_v2_failure/); assert.deepEqual(await state(), s);
  assert.equal((await db.query('select prompt from public.kdp_assets where id=$1', [asset])).rows[0].prompt, 'editorial-image-v1:pending');
});

test('V2 opening images retain the whole introductory document; reorder, format and replace keep the block UUID', async () => {
  await db.query('update public.kdp_sections set body=$1 where id=$2', ['  Introduzione\r\n\nletterale  ', sectionId]);
  let s = await state(); await save(s, group(s, true)); s = await state();
  const doc = group(s, true).nodes.filter(n => n.kind === 'text').flatMap(n => n.doc.content);
  const asset = await pendingImage(900005), secondAsset = await pendingImage(900006);
  const first = { ...s.blocks[0], id: fixtureId(900007), block_type: 'image', body: null, title: null };
  const second = { ...first, id: fixtureId(900008) };
  const placement = { scope: 'group', subsection_id: null, edge: 'before' };
  await imageChange(s, 'add_image', first, placement, asset); s = await state();
  await imageChange(s, 'add_image', second, placement, secondAsset); s = await state();
  const plan = planEditorialImagePlacement(s.section, s.blocks, s.blocks.find(b => b.id === first.id), placement, second.id);
  await apply(s, { operation: 'image_v2', image_operation: 'move_image', block_id: first.id, placement, ...plan }); s = await state();
  assert.deepEqual(group(s, true).source.blocks.filter(b => b.block_type === 'image').map(b => b.id), [first.id, second.id]);
  const replacement = await pendingImage(900009);
  for (const operation of ['style_image', 'replace_image']) {
    const read = readEditorialSectionText(s.section, s.blocks);
    const groups = Object.fromEntries([read.opening, ...read.subsections.map(g => g.text)].filter(g => g.format === 'v2').map(g => [g.group.subsection_id ?? 'opening', g.group]));
    await apply(s, { operation: 'image_v2', image_operation: operation, block_id: first.id, asset_id: replacement,
      order: s.blocks.map(b => b.id), groups, size: 'small', align: 'right' }); s = await state();
    assert.deepEqual(group(s, true).nodes.filter(n => n.kind === 'text').flatMap(n => n.doc.content), doc);
    assert.equal(s.section.body, '  Introduzione\r\n\nletterale  ');
    assert.equal(JSON.parse(s.blocks.find(b => b.id === first.id).editor_notes).size, 'small');
  }
  assert.equal(s.blocks.find(b => b.id === first.id).asset_id, replacement);
  assert.equal((await db.query('select prompt from public.kdp_assets where id=$1', [asset])).rows[0].prompt, 'editorial-image-v1:garbage');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [fixtureId(3)]);
  await assert.rejects(imageChange(s, 'delete_image', s.blocks.find(b => b.id === first.id), placement), /access_denied/);
});
