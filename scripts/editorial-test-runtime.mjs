// Test-only loader: real TS/TSX components, inert server actions, no credentials.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const native = createRequire(import.meta.url);
export function editorialTestRuntime(mocks = {}) {
  const root = process.cwd(); const cache = new Map();
  const inert = new Proxy({}, { get: () => async () => { throw new Error('Read-only UI fixture'); } });
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} }; cache.set(file, loadedModule);
    const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    const require = name => {
      if (name in mocks) return mocks[name];
      if (!name.startsWith('.') && !name.startsWith('@/')) return native(name);
      const base = name.startsWith('@/') ? path.join(root,'src',name.slice(2)) : path.resolve(path.dirname(file),name);
      const resolved = [base,base+'.tsx',base+'.ts'].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
      if (!resolved) throw new Error(`Cannot resolve ${name}`);
      if (/actions\.tsx?$/.test(resolved) && !resolved.endsWith('section-actions.tsx')) return inert;
      return load(resolved);
    };
    new Function('require','module','exports',code)(require,loadedModule,loadedModule.exports);
    return loadedModule.exports;
  }
  return file => load(path.resolve(root,file));
}
