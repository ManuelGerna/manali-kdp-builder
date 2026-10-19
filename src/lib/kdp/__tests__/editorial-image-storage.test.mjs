import assert from 'node:assert/strict';
import test from 'node:test';
import { editorialTestRuntime } from '../../../../scripts/editorial-test-runtime.mjs';

test('Builder cleanup retains its ledger on Storage failure and retries file before asset deletion', async () => {
  const calls = []; let fail = true; let ledger = true; let references = 0;
  const client = {
    rpc: async () => ({ error: null }),
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; }, order() { return query; }, range() { return query; },
        then(resolve) { return Promise.resolve(table === 'kdp_assets'
          ? { data: ledger ? [{ id: 'asset', file_path: 'owner/book/asset/image.png' }] : [], count: ledger ? 1 : 0, error: null }
          : { count: references, error: null }).then(resolve); },
      };
      return query;
    },
    storage: { from: () => ({ remove: async paths => {
      calls.push(['remove', paths]); return { data: fail ? null : paths.map(name => ({ name })), error: fail ? { message: 'offline' } : null };
    } }) },
  };
  const load = editorialTestRuntime({ '@/lib/kdp/assets': { deleteAsset: async () => {
    calls.push(['delete']); ledger = false; return { data: { assetId: 'asset' }, error: null };
  } } });
  const { cleanupEditorialImages } = load('src/lib/kdp/editorial-image-storage.ts');
  assert.equal(await cleanupEditorialImages(client, 'book'), false);
  assert.equal(ledger, true); assert.equal(calls.length, 1);
  fail = false; references = 1;
  assert.equal(await cleanupEditorialImages(client, 'book'), false);
  assert.equal(calls.length, 1);
  references = 0;
  assert.equal(await cleanupEditorialImages(client, 'book'), true);
  assert.deepEqual(calls.map(c => c[0]), ['remove', 'remove', 'delete']);
  assert.equal(ledger, false);
});

test('An empty Storage response retains the tombstone and a late file is removed on retry', async () => {
  let present = false; let ledger = true; const calls = [];
  const client = {
    rpc: async () => ({ error: null }),
    from(table) {
      const query = { select() { return query; }, eq() { return query; }, order() { return query; }, range() { return query; },
        then(resolve) { return Promise.resolve(table === 'kdp_assets'
          ? { data: ledger ? [{ id: 'asset', file_path: 'owner/book/image.png' }] : [], count: ledger ? 1 : 0, error: null }
          : { count: 0, error: null }).then(resolve); } };
      return query;
    },
    storage: { from: () => ({ remove: async paths => {
      calls.push('remove'); return { data: present ? paths.map(name => ({ name })) : [], error: null };
    } }) },
  };
  const { cleanupEditorialImages } = editorialTestRuntime({ '@/lib/kdp/assets': {
    deleteAsset: async () => { calls.push('delete'); ledger = false; return { data: { assetId: 'asset' }, error: null }; },
  } })('src/lib/kdp/editorial-image-storage.ts');
  assert.equal(await cleanupEditorialImages(client, 'book'), false);
  assert.equal(ledger, true);assert.deepEqual(calls, ['remove']);
  present = true;
  assert.equal(await cleanupEditorialImages(client, 'book'), true);
  assert.equal(ledger, false);assert.deepEqual(calls, ['remove', 'remove', 'delete']);
});

test('A collector failure stops cleanup before touching Storage or asset records', async () => {
  const client = { rpc: async () => ({ error: { message: 'offline' } }), from() { throw new Error('must not query'); } };
  const { cleanupEditorialImages } = editorialTestRuntime()('src/lib/kdp/editorial-image-storage.ts');
  assert.equal(await cleanupEditorialImages(client, 'book'), false);
});

test('Capped pages and retained tombstones do not starve later Storage cleanup', async () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({ id: String(i), file_path: `owner/book/${i}.png` }));
  const removed = []; const deleted = []; const pageStarts = [];
  const client = {
    rpc: async () => ({ error: null }),
    from(table) {
      let start = 0;
      const query = { select() { return query; }, eq() { return query; }, order() { return query; },
        range(from) { start = from; pageStarts.push(from); return query; },
        then(resolve) { return Promise.resolve(table === 'kdp_assets'
          ? { data: rows.slice(start, start + 2), count: rows.length, error: null }
          : { count: 0, error: null }).then(resolve); } };
      return query;
    },
    storage: { from: () => ({ remove: async ([path]) => {
      removed.push(path); return { data: path.endsWith('/3.png') ? [{ name: path }] : [], error: null };
    } }) },
  };
  const { cleanupEditorialImages } = editorialTestRuntime({ '@/lib/kdp/assets': {
    deleteAsset: async (_client, _book, id) => { deleted.push(id); return { data: { assetId: id }, error: null }; },
  } })('src/lib/kdp/editorial-image-storage.ts');
  assert.equal(await cleanupEditorialImages(client, 'book'), false);
  assert.deepEqual(pageStarts, [0, 2]);assert.equal(removed.length, 4);assert.deepEqual(deleted, ['3']);
});

test('The recovery inventory includes all dedicated assets despite response caps', async () => {
  const rows = [{ id: 'first' }, { id: 'old-pending' }, { id: 'last' }];
  const client = { from() {
    let start = 0;
    const query = { select() { return query; }, eq() { return query; }, in() { return query; }, order() { return query; },
      range(from) { start = from; return query; },
      then(resolve) { return Promise.resolve({ data: rows.slice(start, start + 1), count: rows.length, error: null }).then(resolve); } };
    return query;
  } };
  const { listEditorialImageAssets } = editorialTestRuntime()('src/lib/kdp/assets.ts');
  assert.deepEqual(await listEditorialImageAssets(client, 'book'), { data: rows, error: null });
});
