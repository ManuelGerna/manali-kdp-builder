import assert from 'node:assert/strict';
import test from 'node:test';
import { editorialTestRuntime } from '../../../../scripts/editorial-test-runtime.mjs';

function recoveryRuntime({ missing = false, revision = 0 } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    from(table) {
      assert.equal(table, 'kdp_assets');
      const query = { select() { return query; }, eq() { return query; },
        maybeSingle: async () => ({ data: { id: 'asset', file_path: 'owner/book/image.png', title: 'Figure' }, error: null }) };
      return query;
    },
    storage: { from: () => ({ download: async () => {
      calls.push('download');
      return missing ? { data: null, error: { message: 'not found' } }
        : { data: new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], { type: 'image/png' }), error: null };
    } }) },
  };
  const mocks = {
    'next/cache': { revalidatePath: () => {} },
    'next/navigation': { redirect: path => { const error = new Error('redirect'); error.path = path; throw error; } },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/kdp/editorial-book-mode': { getBookContentMode: async () => 'editorial' },
    '@/lib/kdp/sections': { listSections: async () => ({ data: [{ id: 'section', settings: { editorial_builder_v1: { version: 1, revision, subsections: [] } } }], error: null }) },
    '@/lib/kdp/section-blocks': { listSectionBlocks: async () => ({ data: [], error: null }) },
    '@/lib/kdp/editorial-repository': {
      applyEditorialChange: async (_client, input) => { calls.push(input.change); return { data: {}, error: null }; },
      editorialRpcError: () => 'RPC failed',
    },
    '@/lib/kdp/assets': { createAsset: async () => { throw new Error('Recovery must reuse the existing asset'); } },
    '@/lib/kdp/editorial-image-storage': { cleanupEditorialImages: async () => true },
  };
  const action = editorialTestRuntime(mocks)('src/app/libri/[id]/contenuti/editorial-actions.ts').saveEditorialImageAction;
  const form = new FormData();
  for (const [key, value] of Object.entries({ book_id: 'book', section_id: 'section', revision: '0',
    operation: 'add_image', pending_asset_id: 'asset', size: 'medium', align: 'center' })) form.set(key, value);
  return { action, form, calls };
}

test('Recovery validates the stored file and attaches the same asset without a second upload', async () => {
  const { action, form, calls } = recoveryRuntime();
  await assert.rejects(action(form), error => error.path?.includes('status=image_saved'));
  assert.equal(calls[0], 'download');
  assert.equal(calls[1].operation, 'add_image'); assert.equal(calls[1].asset_id, 'asset');
});

test('Incomplete recovery keeps pending untouched; explicit discard works without downloading', async () => {
  const { action, form, calls } = recoveryRuntime({ missing: true });
  await assert.rejects(action(form), error => error.path?.includes('error='));
  assert.deepEqual(calls, ['download']);
  calls.length = 0; form.set('operation', 'discard_image_upload');
  await assert.rejects(action(form), error => error.path?.includes('status=image_saved'));
  assert.equal(calls.length, 1); assert.equal(calls[0].operation, 'discard_image_upload');
});

test('A stale recovery form cannot attach or discard a pending asset', async () => {
  const { action, form, calls } = recoveryRuntime({ revision: 1 });
  await assert.rejects(action(form), error => error.path?.includes('error='));
  assert.deepEqual(calls, []);
});
