import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { editorialTestRuntime } from './editorial-test-runtime.mjs';
import { ariesFixture, attachMaps } from '../src/lib/kdp/__fixtures__/editorial-fixture.ts';
import { bootstrapEditorialMaps } from '../src/lib/kdp/editorial-hierarchy.ts';
const load=editorialTestRuntime();
const {EditorialBuilder}=load('src/app/libri/[id]/contenuti/editorial-builder.tsx');
const {EditorialPreview}=load('src/app/libri/[id]/anteprima/editorial-preview.tsx');
const {EditorialDisclosure}=load('src/app/libri/[id]/contenuti/editorial-disclosure.tsx');
const {EditEditorialBlockForm}=load('src/app/libri/[id]/contenuti/editorial-builder-forms.tsx');
const f=ariesFixture();const maps=bootstrapEditorialMaps(f.sections,f.blocks,f.project);const sections=attachMaps(f.sections,maps);
const grouped=new Map(sections.map(s=>[s.id,f.blocks.filter(b=>b.section_id===s.id)]));
const render=element=>renderToStaticMarkup(element);

test('RPC errors distinguish confirmed rollback from uncertain network outcomes',()=>{
 const {editorialRpcError}=load('src/lib/kdp/editorial-repository.ts');
 assert.match(editorialRpcError({code:'P0001',message:'injected failure'}),/Nessuna modifica applicata/);
 assert.match(editorialRpcError({code:'40001'}),/Ricarica il libro/);
 assert.match(editorialRpcError({code:'PGRST202'}),/aggiornamento del database/);
 for(const error of [null,{code:'',message:'TypeError: Failed to fetch'},{code:'08007'},{code:'40003'}]) {
  assert.match(editorialRpcError(error),/non confermata/);
  assert.doesNotMatch(editorialRpcError(error),/Nessuna modifica applicata/);
 }
});

test('Closed Ariete Builder renders only 15 headers, no paragraph bodies or hidden editing forms',()=>{
 const html=render(React.createElement(EditorialBuilder,{sections,blocksBySection:grouped}));
 assert.equal((html.match(/editorial-section-node scroll-target/g)||[]).length,15);
 assert.equal((html.match(/<form/g)||[]).length,0);
 assert.doesNotMatch(html,/Testo di prova|editorial-text-node|editorial-subsection-node/);
 assert.ok(Buffer.byteLength(html)<15000);
 assert.match(html,/Introduzione/);assert.doesNotMatch(html,/Senza titolo/);
});

test('Lazy editing disclosure mounts form only when open',()=>{
 const child=React.createElement(EditEditorialBlockForm,{block:f.blocks[0]});
 const closed=render(React.createElement(EditorialDisclosure,{},React.createElement('summary',null,'Modifica'),child));
 const open=render(React.createElement(EditorialDisclosure,{open:true},React.createElement('summary',null,'Modifica'),child));
 assert.doesNotMatch(closed,/<form|textarea/);assert.match(open,/<form/);assert.match(open,/textarea/);
});

test('Preview shows exactly 53 subsections, 68 useful TOC links and all content in order',()=>{
 const html=render(React.createElement(EditorialPreview,{sections,blocks:f.blocks}));
 assert.equal((html.match(/class="book-preview-subsection"/g)||[]).length,53);
 const targets=[...html.matchAll(/href="#([^"]+)"/g)];assert.equal(targets.length,68);
 for(const [,id] of targets)assert.ok(html.includes('id="'+id+'"'));
 assert.doesNotMatch(html,/Senza titolo|sort_order|block_type|Interruzione pagina/);
 for(const label of ['Rito','Frasi di manifestazione','Potere sul corpo','Energia da ricordare']) {
  assert.ok(html.includes('<h4>'+label+'</h4>'));
  assert.ok(!html.includes('>'+label+'</a>'));
 }
});

test('Actual Builder and preview routes send Diario Allenamento to imported pages before loading editorial blocks',async()=>{
 let blockReads=0;
 const client={auth:{getUser:async()=>({data:{user:{id:'test'}},error:null})},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'diary',title:'Diario Allenamento 90 Giorni'},error:null})})};
 const routes=editorialTestRuntime({
  'next/navigation':{redirect:url=>{throw Object.assign(new Error('redirect'),{url,digest:'NEXT_REDIRECT'});}},
  '@/lib/supabase/server':{createClient:async()=>client,hasSupabaseServerConfig:()=>true},
  '@/lib/kdp/editorial-book-mode':{getBookContentMode:async()=> 'pages'},
  '@/lib/kdp/section-blocks':{listSectionBlocks:async()=>{blockReads++;throw new Error('Must not read editorial blocks');}},
 });
 for(const [route,destination] of [['contenuti','pagine-importate'],['anteprima','pagine-importate/anteprima']]) {
  const Page=routes('src/app/libri/[id]/'+route+'/page.tsx').default;
  await assert.rejects(Page({params:Promise.resolve({id:'diary'}),searchParams:Promise.resolve({})}),e=>e.url==='/libri/diary/'+destination);
 }
 assert.equal(blockReads,0);
});
