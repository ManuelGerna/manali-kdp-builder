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


test('Image node renders private preview with original proportions and upload/replace/move/delete controls',()=>{
 const {EditorialImageNode}=load('src/app/libri/[id]/contenuti/editorial-image-forms.tsx');
 const block={...f.blocks[0],id:'image-fixture',block_type:'image',asset_id:'asset',editor_notes:JSON.stringify({size:'medium',align:'right'})};
 const html=render(React.createElement(EditorialImageNode,{block,url:'https://example.invalid/private-signed.png',alt:'Figura esterna',canMoveUp:true,canMoveDown:true}));
 assert.match(html,/width:66%/);assert.match(html,/height:auto/);assert.match(html,/alt="Figura esterna"/);
 for(const label of ['Immagine su','Immagine giù','Elimina immagine','Sostituisci immagine','Salva formato','image/png,image/jpeg']) assert.ok(html.includes(label),label);
 assert.ok(!html.includes('object-fit:cover'));
});

test('Pending recovery exposes attach/discard with the destination revision and without another file upload',()=>{
 const {EditorialImageRecovery}=load('src/app/libri/[id]/contenuti/editorial-image-recovery.tsx');
 const html=render(React.createElement(EditorialImageRecovery,{bookId:'book',assets:[{id:'pending',title:'Figura interrotta'}],
  destinations:[{sectionId:'section',subsectionId:'marker',revision:7,title:'Capitolo / Sottosezione'}]}));
 assert.match(html,/Upload da recuperare \(1\)/);assert.match(html,/Figura interrotta/);
 assert.match(html,/name="pending_asset_id" value="pending"/);assert.match(html,/name="revision" value="7"/);
 assert.match(html,/name="subsection_id" value="marker"/);
 assert.match(html,/value="add_image"/);assert.match(html,/value="discard_image_upload"/);
 assert.ok(!html.includes('type="file"'));
});

test('Subsection text editor is one continuous surface with one save, immutable image boundaries and literal text',()=>{
 const editorLoad=editorialTestRuntime({'next/navigation':{useRouter:()=>({refresh(){}})}});
 const {EditorialSubsectionTextEditor}=editorLoad('src/app/libri/[id]/contenuti/editorial-text-editor.tsx');
 const base={...f.blocks[0],title:null,asset_id:null,editor_notes:null};
 const blocks=[{...base,id:'p1',block_type:'text',body:'  Primo\nsecondo\n\n• voce  '},
  {...base,id:'image',block_type:'image',body:null,asset_id:'asset'},
  {...base,id:'label',block_type:'text',title:'Titoletto <letterale>',body:null},
  {...base,id:'p2',block_type:'text',body:'Ultimo paragrafo'}];
 const html=render(React.createElement(EditorialSubsectionTextEditor,{bookId:'book',sectionId:'section',subsectionId:'marker',revision:3,blocks,
  images:{asset:{url:'https://example.invalid/signed.png',alt:'Figura'}}}));
 assert.equal((html.match(/<form/g)||[]).length,1);
 assert.equal((html.match(/>Salva sottosezione</g)||[]).length,1);
 assert.equal((html.match(/<textarea/g)||[]).length,3);
 assert.deepEqual([...html.matchAll(/data-editorial-block="([^"]+)"/g)].map(m=>m[1]),['p1','image','label','p2']);
 assert.ok(html.includes('  Primo\nsecondo\n\n• voce  '));assert.match(html,/Titoletto &lt;letterale&gt;/);
 assert.match(html,/contentEditable="false"/i);assert.match(html,/height:auto/);
 assert.doesNotMatch(html,/Modifica testo|contentEditable="true"/i);
 assert.match(html,/name="changes" value="\[\]"/);
});

test('Every introductory group in the real Builder uses one unified save with no legacy text edit forms',()=>{
 const disclosure=load('src/app/libri/[id]/contenuti/editorial-disclosure.tsx');
 const openLoad=editorialTestRuntime({
  'next/navigation':{useRouter:()=>({refresh(){}})},
  './editorial-disclosure':{...disclosure,EditorialDisclosure:props=>{
   const open=/editorial-section-node|editorial-opening-node/.test(props.className??'');
   return React.createElement('details',{className:props.className,open},open?props.children:React.Children.toArray(props.children).filter(c=>c.type==='summary'));
  }},
 });
 const Builder=openLoad('src/app/libri/[id]/contenuti/editorial-builder.tsx').EditorialBuilder;
 const html=render(React.createElement(Builder,{sections,blocksBySection:grouped}));
 assert.equal((html.match(/aria-label="Editor testo introduttivo"/g)||[]).length,15);
 assert.equal((html.match(/>Salva testo</g)||[]).length,15);
 assert.doesNotMatch(html,/Modifica testo<|Modifica testo introduttivo|>Salva sottosezione</);
 assert.equal((html.match(/name="subsection_id" value=""/g)||[]).length,30); // one text batch and one image-upload form per opening
 const nodeIds=[...html.matchAll(/data-editorial-block="([^"]+)"/g)].map(m=>m[1]);
 const expected=sections.flatMap(section=>{
  const markers=new Set(section.settings.editorial_builder_v1.subsections.map(s=>s.heading_block_id));
  const blocks=grouped.get(section.id);const end=blocks.findIndex(b=>markers.has(b.id));
  return blocks.slice(0,end<0?undefined:end).map(b=>b.id);
 });
 assert.deepEqual(nodeIds,expected);
 for(const section_type of ['introduction','chapter','chapter_text']) {
  const empty={...sections[0],section_type,body:null};
  const emptyHtml=render(React.createElement(Builder,{sections:[empty],blocksBySection:new Map([[empty.id,[]]])}));
  assert.equal((emptyHtml.match(/>Salva testo</g)||[]).length,1);
  assert.match(emptyHtml,/\+ Aggiungi immagine/);
  assert.match(emptyHtml,/name="changes" value="\[\]"/);
 }
});

test('General, chapter and special-section editors keep existing section body and interleaved images in one surface',()=>{
 const editorLoad=editorialTestRuntime({'next/navigation':{useRouter:()=>({refresh(){}})}});
 const {EditorialOpeningTextEditor}=editorLoad('src/app/libri/[id]/contenuti/editorial-builder.tsx');
 for(const index of [0,1,9]) {
  const section={...sections[index],body:'  Apertura\n\nOriginale  '};
  const base={...f.blocks[0],section_id:section.id,title:null};
  const blocks=[{...base,id:'p1',body:'Primo'}, {...base,id:'image',block_type:'image',asset_id:'asset',body:null}, {...base,id:'p2',body:'Ultimo'}];
  const html=render(React.createElement(EditorialOpeningTextEditor,{section,blocks,revision:2,destinations:[],images:{asset:{url:'https://example.invalid/signed.png',alt:'Figura'}}}));
  assert.equal((html.match(/>Salva testo</g)||[]).length,1);assert.equal((html.match(/<form/g)||[]).length,2); // text batch and image upload
  assert.deepEqual([...html.matchAll(/data-editorial-block="([^"]+)"/g)].map(m=>m[1]),[section.id,'p1','image','p2']);
  assert.match(html,/  Apertura\n\nOriginale  /);assert.match(html,/height:auto/);
  assert.doesNotMatch(html,/Modifica testo|>Organizza testo</);
 }
});

test('Editorial section metadata form omits body instead of resubmitting or trimming introductory text',()=>{
 const {EditEditorialSectionForm}=load('src/app/libri/[id]/contenuti/editorial-builder-forms.tsx');
 const section={...sections[0],body:'  Opening\r\n  '};
 const html=render(React.createElement(EditEditorialSectionForm,{section,hideBody:true}));
 assert.doesNotMatch(html,/name="body"|Testo introduttivo/);
 const legacy=render(React.createElement(EditEditorialSectionForm,{section}));assert.match(legacy,/name="body"/);
});
