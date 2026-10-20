import assert from 'node:assert/strict';
import test from 'node:test';
import { editorialTestRuntime } from '../../../../scripts/editorial-test-runtime.mjs';

const initial={status:'idle',message:null};
const change={block_id:'text',title:null,body:'  Nuovo\r\ntesto\n\n• voce  ',expected_title:null,expected_body:'Originale'};
function setup({ revision=0, rpcError=false, uncertain=false }={}) {
 const calls=[];
 const load=editorialTestRuntime({
  'next/cache':{revalidatePath:path=>calls.push(['refresh',path])},
  'next/navigation':{redirect:()=>{throw new Error('Batch save must never redirect');}},
  '@/lib/supabase/server':{createClient:async()=>{calls.push(['client']);return {auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})}};}},
  '@/lib/kdp/editorial-book-mode':{getBookContentMode:async()=>'editorial'},
  '@/lib/kdp/sections':{listSections:async()=>({data:[{id:'section',settings:{editorial_builder_v1:{version:1,revision,subsections:[{semantic_id:'original',kind:'heading',heading_block_id:'marker',order:0}]}}}],error:null})},
  '@/lib/kdp/section-blocks':{listSectionBlocks:async()=>({data:[
   {id:'marker',section_id:'section',block_type:'text',title:'Titolo',body:null,sort_order:0,created_at:''},
   {id:'text',section_id:'section',block_type:'text',title:null,body:'Originale',sort_order:1,created_at:''},
  ],error:null})},
  '@/lib/kdp/editorial-repository':{applyEditorialChange:async(_client,input)=>{calls.push(['rpc',input]);return rpcError
   ? {error:{code:'40001'},message:'Il contenuto è cambiato.'}
   : {error:null,data:uncertain?null:{revision:1,updated:1}};},editorialRpcError:()=> 'Salvataggio non confermato.'},
 });
 const action=load('src/app/libri/[id]/contenuti/editorial-actions.ts').saveEditorialSubsectionTextAction;
 const form=new FormData();
 for(const [key,value] of Object.entries({book_id:'book',section_id:'section',subsection_id:'marker',revision:'0',changes:JSON.stringify([change])}))form.set(key,value);
 return {action,form,calls};
}

test('Unchanged subsection skips client, RPC, refresh and cleanup entirely',async()=>{
 const {action,form,calls}=setup();
 for(const changes of [[],[{...change,body:change.expected_body}]]) {
  form.set('changes',JSON.stringify(changes));assert.equal((await action(initial,form)).status,'unchanged');
 }
 assert.deepEqual(calls,[]);
});

test('A subsection is sent once as an atomic delta with exact fields and acknowledged without redirect',async()=>{
 const {action,form,calls}=setup();const result=await action(initial,form);
 assert.equal(result.status,'saved');assert.equal(result.revision,1);assert.equal(result.expectedRevision,0);
 assert.deepEqual(result.saved,[change]);
 const input=calls.find(([operation])=>operation==='rpc')[1];
 assert.deepEqual(input.change,{operation:'update_text_batch',subsection_id:'marker',changes:[change]});
 assert.deepEqual(input.order,['marker','text']);assert.equal(calls.filter(([operation])=>operation==='rpc').length,1);
 assert.equal(calls.filter(([operation])=>operation==='refresh').length,3);
});

test('Stale forms, RPC conflicts and uncertain responses preserve the draft by returning errors without refresh',async()=>{
 for(const options of [{revision:1},{rpcError:true},{uncertain:true}]) {
  const {action,form,calls}=setup(options);const before=form.get('changes');const result=await action(initial,form);
  assert.equal(result.status,'error');assert.match(result.message,/bozza è conservata/);
  assert.equal(form.get('changes'),before);assert.equal(calls.filter(([operation])=>operation==='refresh').length,0);
 }
});

test('Malformed and duplicate batch payloads fail before any database access',async()=>{
 const {action,form,calls}=setup();
 for(const payload of ['{}','{',JSON.stringify([change,change]),JSON.stringify([{block_id:'text',body:'No'}])]) {
  form.set('changes',payload);assert.equal((await action(initial,form)).status,'error');
 }
 assert.deepEqual(calls,[]);
});

test('Introductory saves reuse one batch with null subsection, exact fields and no-op skips all writes',async()=>{
 const {action,form,calls}=setup();form.set('subsection_id','');
 form.set('changes','[]');assert.equal((await action(initial,form)).status,'unchanged');assert.deepEqual(calls,[]);
 const bodyChange={...change,block_id:'section',body:'  Apertura\r\n\r\nNuova  ',expected_body:'Prima'};
 form.set('changes',JSON.stringify([bodyChange]));const result=await action(initial,form);
 assert.equal(result.status,'saved');assert.equal(result.message,'Testo salvato.');
 assert.deepEqual(calls.find(([op])=>op==='rpc')[1].change,{operation:'update_text_batch',subsection_id:null,changes:[bodyChange]});
 assert.deepEqual(result.saved,[bodyChange]);assert.equal(calls.filter(([op])=>op==='rpc').length,1);
});

test('Introductory conflicts and uncertain saves retain payload and do not acknowledge or refresh',async()=>{
 for(const options of [{revision:1},{rpcError:true},{uncertain:true}]) {
  const {action,form,calls}=setup(options);form.set('subsection_id','');const before=form.get('changes');
  const result=await action(initial,form);assert.equal(result.status,'error');assert.equal(result.saved,undefined);
  assert.equal(form.get('changes'),before);assert.match(result.message,/bozza è conservata/);
  assert.equal(calls.filter(([op])=>op==='refresh').length,0);
 }
});

test('Section metadata updates omit introductory body while explicit body updates remain supported',async()=>{
 const load=editorialTestRuntime();const {updateSection}=load('src/lib/kdp/sections.ts');
 for(const body of [undefined,null,'  Structured body\n  ']) {
  let payload;const client={from:()=>({update(value){payload=value;return this;},eq(){return this;},select(){return this;},maybeSingle:async()=>({data:{id:'section'},error:null})})};
  const result=await updateSection(client,{bookId:'book',sectionId:'section',body,actor:{userId:'owner',email:'owner@example.invalid'}});
  assert.equal(result.error,null);
  assert.equal(Object.hasOwn(payload,'body'),body!==undefined);
  if(body!==undefined)assert.equal(payload.body,body);
 }
});
