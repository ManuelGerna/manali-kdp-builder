// Read-only UI review of a supplied DB snapshot: { sections, blocks, project }.
// All server actions are inert. This script never reads credentials or connects
// to Supabase. --serve enables local hydration and browser checks on port 3216.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { editorialTestRuntime } from './editorial-test-runtime.mjs';
import { bootstrapEditorialMaps } from '../src/lib/kdp/editorial-hierarchy.ts';

if (!process.argv[2]) throw new Error('Pass a local snapshot JSON path. No database connection is made.');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const root = process.cwd(), dir = path.join(root, 'node_modules/.cache/editorial-builder-review');
fs.mkdirSync(dir, { recursive: true });
const maps = bootstrapEditorialMaps(data.sections, data.blocks, data.project);
const sections = data.sections.map(s => ({ ...s, settings: { ...s.settings, editorial_builder_v1: maps.get(s.id) } }));
const book = { id: sections[0].book_id, title: 'ARIETE', subtitle: null };
const client = { auth: { getUser: async () => ({ data: { user: { id: 'review' } }, error: null }) }, from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: book, error: null }) }) };
const load = editorialTestRuntime({
  '@/lib/supabase/server': { hasSupabaseServerConfig: () => true, createClient: async () => client },
  '@/lib/kdp/editorial-book-mode': { getBookContentMode: async () => 'editorial' },
  '@/lib/kdp/sections': { listSections: async () => ({ data: sections, error: null }) },
  '@/lib/kdp/section-blocks': { listSectionBlocks: async () => ({ data: data.blocks, error: null }) },
  '@/lib/kdp/books': { getBookDetail: async () => ({ data: { book, sections }, error: null }) },
  './content-anchor-scroll': { ContentAnchorScroll: () => null },
});
const { EditorialBuilder } = load('src/app/libri/[id]/contenuti/editorial-builder.tsx');
const grouped = new Map(sections.map(s => [s.id, data.blocks.filter(b => b.section_id === s.id)]));
const builderHTML = renderToStaticMarkup(React.createElement(EditorialBuilder, { sections, blocksBySection: grouped }));
const results = [];
for (const kind of ['builder', 'preview']) {
  const Page = load(`src/app/libri/[id]/${kind === 'builder' ? 'contenuti' : 'anteprima'}/page.tsx`).default;
  const start = performance.now();
  let content = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: book.id }), searchParams: Promise.resolve({}) }));
  const serverRenderMs = Math.round(performance.now() - start);
  if (kind === 'builder') content = content.replace(builderHTML, '<div id="review-builder">' + builderHTML + '</div>');
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><title>ARIETE · fix locale</title></head><body>' + content + (kind === 'builder' ? '<script src="/review-bundle.js" defer></script>' : '') + '</body></html>';
  fs.writeFileSync(path.join(dir, `fixed-${kind}.html`), html);
  results.push({ kind, serverRenderMs, htmlBytes: Buffer.byteLength(html), forms: (html.match(/<form/g) || []).length,
    details: (html.match(/<details/g) || []).length, subsections: [...maps.values()].reduce((n, m) => n + m.subsections.length, 0) });
}
fs.copyFileSync('src/app/globals.css', path.join(dir, 'globals.css'));
fs.writeFileSync(path.join(dir, 'fixed-render-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

if (process.argv.includes('--serve')) {
  fs.writeFileSync(path.join(dir, 'fixed-client-data.json'), JSON.stringify({ sections, blocks: data.blocks }));
  const componentPath = path.join(root, 'src/app/libri/[id]/contenuti/editorial-builder').replaceAll('\\', '/');
  fs.writeFileSync(path.join(dir, 'review-entry.jsx'), `import React from 'react';
import {hydrateRoot} from 'react-dom/client';
import {EditorialBuilder} from ${JSON.stringify(componentPath)};
import data from './fixed-client-data.json';
const grouped=new Map(data.sections.map(s=>[s.id,data.blocks.filter(b=>b.section_id===s.id)]));
hydrateRoot(document.getElementById('review-builder'),<EditorialBuilder sections={data.sections} blocksBySection={grouped}/>);`);
  fs.writeFileSync(path.join(dir, 'review-action-mock.cjs'), 'module.exports=new Proxy({}, {get:()=>async()=>{throw new Error("Fixture in sola lettura");}});');
  fs.writeFileSync(path.join(dir, 'review-ts-loader.cjs'), "const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText};");
  const require = createRequire(import.meta.url);
  const w = require('next/dist/compiled/webpack/webpack'); w.init();
  await new Promise((resolve, reject) => w.webpack({
    mode: 'development', devtool: false, entry: path.join(dir, 'review-entry.jsx'), output: { path: dir, filename: 'review-bundle.js' },
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: { '@': path.join(root, 'src') } },
    module: { rules: [{ test: /\.(tsx?|jsx)$/, use: path.join(dir, 'review-ts-loader.cjs'), exclude: /node_modules[\\/](?!\.cache)/ }] },
    plugins: [new w.webpack.NormalModuleReplacementPlugin(/(?:^|\/)actions$|editorial-actions$/, path.join(dir, 'review-action-mock.cjs'))],
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  const allowed = new Set(['fixed-builder.html', 'fixed-preview.html', 'globals.css', 'review-bundle.js']);
  http.createServer((req, res) => {
    const name = new URL(req.url, 'http://127.0.0.1').pathname.slice(1);
    if (!allowed.has(name) || !fs.existsSync(path.join(dir, name))) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.css') ? 'text/css' : 'application/javascript');
    res.end(fs.readFileSync(path.join(dir, name)));
  }).listen(3216, '127.0.0.1', () => console.log('Read-only review on http://127.0.0.1:3216/fixed-builder.html'));
}
