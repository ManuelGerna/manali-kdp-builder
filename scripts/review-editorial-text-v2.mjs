// Local browser harness: synthetic text only, inert storage/DB actions.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { ariesFixture, fixtureId } from '../src/lib/kdp/__fixtures__/editorial-fixture.ts';
import { convertEditorialGroupV2 } from '../src/lib/kdp/editorial-text-v2.ts';

const root = process.cwd(), dir = path.join(root, '.next/editorial-text-v2/browser-review');
fs.mkdirSync(dir, { recursive: true });
const base = ariesFixture().blocks[0];
const blocks = [
  { ...base, id: fixtureId(90001), title: null, body: '  Primo paragrafo\r\nSeconda riga  ' },
  { ...base, id: fixtureId(90002), title: null, body: '• Voce letterale' },
  { ...base, id: fixtureId(90003), block_type: 'image', title: null, body: null, asset_id: 'fixture-image' },
  { ...base, id: fixtureId(90004), title: null, body: 'Dopo immagine' },
];
const group = convertEditorialGroupV2(base.section_id, null, blocks);
fs.writeFileSync(path.join(dir, 'fixture.json'), JSON.stringify({ sectionId: base.section_id, group }));
fs.writeFileSync(path.join(dir, 'actions.cjs'), `exports.saveEditorialTextV2Action=async(_state,form)=>{
  if(document.body.dataset.conflict==='true')return {status:'error',message:'Conflitto simulato. La bozza è conservata.'};
  const saved=JSON.parse(form.get('group')),expected=JSON.parse(form.get('expected_group')),revision=Number(form.get('revision'))+1;
  window.dispatchEvent(new CustomEvent('fixture-saved',{detail:{saved,revision}}));
  return {status:'saved',message:'Testo salvato.',saved,expected,revision};
};`);
fs.writeFileSync(path.join(dir, 'navigation.cjs'), 'exports.useRouter=()=>({refresh(){}});');
fs.writeFileSync(path.join(dir, 'loader.cjs'), "const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText};");
const component = path.join(root, 'src/app/libri/[id]/contenuti/editorial-text-v2-editor').replaceAll('\\', '/');
const provider = path.join(root, 'src/app/libri/[id]/contenuti/editorial-disclosure').replaceAll('\\', '/');
const schema = path.join(root, 'src/lib/kdp/editorial-text-v2-schema').replaceAll('\\', '/');
fs.writeFileSync(path.join(dir, 'entry.jsx'), `import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {EditorialTextV2Editor} from ${JSON.stringify(component)};import {EditorialDraftProvider} from ${JSON.stringify(provider)};
import {EditorContent,useEditor} from '@tiptap/react';import {editorialTextV2Extensions} from ${JSON.stringify(schema)};import data from './fixture.json';
function Empty(){const e=useEditor({extensions:editorialTextV2Extensions(),content:{type:'doc',content:[]},enableInputRules:false,enablePasteRules:false});return <EditorContent editor={e} aria-label="Gruppo vuoto"/>;}
function Demo(){const [saved,setSaved]=useState(data.group),[revision,setRevision]=useState(0),[conflict,setConflict]=useState(false);
useEffect(()=>{const handler=e=>{setSaved(e.detail.saved);setRevision(e.detail.revision)};window.addEventListener('fixture-saved',handler);return()=>window.removeEventListener('fixture-saved',handler)},[]);
return <main style={{maxWidth:760,margin:'2rem auto'}}><h1>Editorial Text Editor V2 · fixture locale</h1><p>Testi sintetici; nessuna connessione a database.</p>
<button onClick={()=>{document.body.dataset.conflict=String(!conflict);setConflict(!conflict)}}>{conflict?'Disattiva conflitto':'Simula conflitto'}</button>
<EditorialDraftProvider><EditorialTextV2Editor bookId="local-v2-fixture" sectionId={data.sectionId} revision={revision} group={saved}
images={{'fixture-image':{url:'/fixture.svg',alt:'Immagine fissa'}}}/></EditorialDraftProvider><h2>Gruppo vuoto</h2><Empty/></main>}
createRoot(document.getElementById('root')).render(<Demo/>);`);
const require = createRequire(import.meta.url), w = require('next/dist/compiled/webpack/webpack'); w.init();
await new Promise((resolve, reject) => w.webpack({
  mode: 'development', devtool: false, entry: path.join(dir, 'entry.jsx'), output: { path: dir, filename: 'bundle.js' },
  resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: { '@': path.join(root, 'src'), 'next/navigation': path.join(dir, 'navigation.cjs') } },
  module: { rules: [{ test: /\.(tsx?|jsx)$/, use: path.join(dir, 'loader.cjs'), exclude: /node_modules/ }] },
  plugins: [new w.webpack.NormalModuleReplacementPlugin(/editorial-actions$/, path.join(dir, 'actions.cjs'))],
}, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
if (process.argv.includes('--build-only')) { console.log('Local V2 browser bundle rebuilt.'); process.exit(0); }
http.createServer((req, res) => {
  const name = new URL(req.url, 'http://127.0.0.1').pathname;
  if (name === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="it"><head><meta charset="utf-8"><link rel="stylesheet" href="/globals.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  else if (name === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(fs.readFileSync(path.join(dir, 'bundle.js'))); }
  else if (name === '/globals.css') { res.setHeader('Content-Type', 'text/css'); res.end(fs.readFileSync(path.join(root, 'src/app/globals.css'))); }
  else if (name === '/fixture.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="100"><rect width="320" height="100" fill="#ded4c2"/><text x="20" y="55" font-size="20">Immagine fissa</text></svg>'); }
  else { res.writeHead(404); res.end(); }
}).listen(3217, '127.0.0.1', () => console.log('Local V2 fixture: http://127.0.0.1:3217 (no DB, synthetic text)'));
