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

const canonicalAriesTitles = [
 'Introduzione', '1. AMORE', '2. RELAZIONI', '3. LAVORO & CARRIERA',
 '4. DENARO & SICUREZZA MATERIALE', '5. CRESCITA PERSONALE',
 '6. SALUTE & BENESSERE', '7. COMUNICAZIONE & MENTE', '8. SFIDE KARMICHE',
 'MANIFESTAZIONE', 'PIETRE NATURALI', 'I CODICI ENERGETICI DELL’ARIETE',
 'LA TUA MAGIA CONTINUA', 'UN DONO CHE CONTINUA IL VIAGGIO', 'PRIMA DI SALUTARCI…',
];
const visibleTitle = text => text.replaceAll('&amp;', '&').replace(/\s+/g, ' ').trim();

test('Ariete Builder, preview articles and TOC use the same 15 unique section UUIDs and canonical titles', () => {
 const builder = render(React.createElement(EditorialBuilder, { sections, blocksBySection: grouped }));
 const preview = render(React.createElement(EditorialPreview, { sections, blocks: f.blocks }));
 const ids = sections.map(s => s.id);
 assert.equal(ids.length, 15);
 assert.equal(new Set(ids).size, 15);
 const builderIds = [...builder.matchAll(/id="section-([^"]+)"/g)].map(m => m[1]);
 const articleIds = [...preview.matchAll(/<article id="preview-section-([^"]+)"/g)].map(m => m[1]);
 const toc = [...preview.matchAll(/href="#preview-section-([^"]+)">([^<]+)<\/a>/g)];
 assert.deepEqual(builderIds, ids);
 assert.deepEqual(articleIds, ids);
 assert.deepEqual(toc.map(m => m[1]), ids);
 assert.deepEqual([...builder.matchAll(/class="editorial-section-title">([^<]+)<\/span>/g)].map(m => visibleTitle(m[1])), canonicalAriesTitles);
 assert.deepEqual(toc.map(m => visibleTitle(m[2])), canonicalAriesTitles);
 // Includes each final section once; internal headings cannot add a top-level node.
 for (const id of ids) assert.equal(builderIds.filter(value => value === id).length, 1);
 for (const map of maps.values()) for (const sub of map.subsections) {
  assert.ok(!builderIds.includes(sub.heading_block_id));
  assert.ok(!articleIds.includes(sub.heading_block_id));
 }
});

test('Ariete preview preserves all 1167 blocks, the 8/3/2 groups and internal labels', () => {
 const html = render(React.createElement(EditorialPreview, { sections, blocks: f.blocks }));
 const articles = [...html.matchAll(/<article id="preview-section-([^"]+)">([\s\S]*?)<\/article>/g)];
 assert.equal((html.match(/class="book-preview-text"/g) || []).length +
  (html.match(/class="book-preview-subsection"/g) || []).length, 1167);
 for (const [index, expected] of [[9, 8], [10, 3], [11, 2]]) {
  assert.equal((articles[index][2].match(/class="book-preview-subsection"/g) || []).length, expected);
 }
 const stoneTitles = [...articles[10][2].matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => visibleTitle(m[1]));
 assert.deepEqual(stoneTitles, ['PRIMA CHIAVE — CORNIOLA', 'SECONDA CHIAVE — LABRADORITE', 'TERZA CHIAVE — QUARZO FUMÉ']);
 const codeTitles = [...articles[11][2].matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => visibleTitle(m[1]));
 assert.deepEqual(codeTitles, ['I NUMERI CHE RISUONANO CON LA TUA ENERGIA', 'I COLORI CHE ACCENDONO LA TUA ENERGIA']);
 const manifestTitles = [...articles[9][2].matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => visibleTitle(m[1]));
 assert.deepEqual(manifestTitles, ['1. AMORE', '2. RELAZIONI', '3. LAVORO E CARRIERA', '4. DENARO E SICUREZZA MATERIALE', '5. CRESCITA PERSONALE & SPIRITUALE', '6. SALUTE E BENESSERE', '7. COMUNICAZIONE E MENTE', '8. SFIDE KARMICHE']);
 const visibleText = html.replace(/<[^>]*>/g, ' ');
 assert.doesNotMatch(visibleText, /[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|Blocco\s+\d+/i);
});

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
