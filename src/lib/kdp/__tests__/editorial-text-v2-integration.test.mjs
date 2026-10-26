import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { editorialTestRuntime } from '../../../../scripts/editorial-test-runtime.mjs';
import { ariesFixture, attachMaps } from '../__fixtures__/editorial-fixture.ts';
import { bootstrapEditorialMaps } from '../editorial-hierarchy.ts';
import { convertEditorialGroupV2, convertEditorialSectionV2, readEditorialSectionText, literalParagraph } from '../editorial-text-v2.ts';
import { isEditorialTextV2Canary, EDITORIAL_TEXT_V2_CANARY } from '../editorial-text-v2-gate.ts';

const f = ariesFixture(), section = attachMaps(f.sections, bootstrapEditorialMaps(f.sections, f.blocks, f.project))[1];
const blocks = f.blocks.filter(b => b.section_id === section.id);
const base = readEditorialSectionText(section, blocks).subsections[1].text.group;
const proposal = () => { const group = structuredClone(base); group.nodes[0].doc.content = [literalParagraph('  Nuovo <letterale>\r\n• uno  '), literalParagraph(''), literalParagraph('Ultimo')]; return group; };
function setup({ enabled = true, revision = 0, error, uncertain = false, canary = false, converted = false } = {}) {
  const calls = [];
  const selectedSection = canary ? { ...section, id: EDITORIAL_TEXT_V2_CANARY.sectionId, book_id: EDITORIAL_TEXT_V2_CANARY.bookId,
    settings: { ...section.settings, editorial_builder_v1: { ...section.settings.editorial_builder_v1,
      subsections: section.settings.editorial_builder_v1.subsections.map(s => s.heading_block_id === base.subsection_id ? { ...s, heading_block_id: EDITORIAL_TEXT_V2_CANARY.subsectionId } : s) } } } : section;
  const selectedRows = canary ? blocks.map(b => ({ ...b, book_id: selectedSection.book_id, section_id: selectedSection.id,
    id: b.id === base.subsection_id ? EDITORIAL_TEXT_V2_CANARY.subsectionId : b.id })) : blocks;
  const selectedBase = readEditorialSectionText(selectedSection, selectedRows).subsections[1].text.group;
  const selectedProposal = structuredClone(selectedBase); selectedProposal.nodes[0].doc = proposal().nodes[0].doc;
  const storedSection = { ...selectedSection, settings: { ...selectedSection.settings,
    editorial_builder_v1: { ...selectedSection.settings.editorial_builder_v1, revision },
    ...(converted ? { editorial_text_v2: { version: 2, groups: { [selectedBase.subsection_id]: selectedBase } } } : {}) } };
  const load = editorialTestRuntime({
    'next/cache': { revalidatePath: path => calls.push(['refresh', path]) },
    'next/navigation': { redirect() { throw new Error('No redirects from V2'); }, useRouter: () => ({ refresh() {} }) },
    '@/lib/kdp/editorial-text-v2-gate': { editorialTextV2LocalEnabled: () => enabled, isEditorialTextV2Canary },
    '@/lib/supabase/server': { createClient: async () => { calls.push(['client']); return { auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) } }; } },
    '@/lib/kdp/editorial-book-mode': { getBookContentMode: async () => 'editorial' },
    '@/lib/kdp/sections': { listSections: async () => ({ data: [storedSection] }) },
    '@/lib/kdp/section-blocks': { listSectionBlocks: async () => ({ data: selectedRows }) },
    '@/lib/kdp/editorial-repository': { applyEditorialChange: async (_client, input) => {
      calls.push(['rpc', input]); return error ? { error: { code: '40001' }, message: 'Conflitto.' } : { data: uncertain ? null : { revision: 1, updated: 1, group: input.change.group } };
    }, editorialRpcError: () => 'Esito incerto.' },
  });
  const action = load('src/app/libri/[id]/contenuti/editorial-actions.ts').saveEditorialTextV2Action;
  const form = new FormData();
  for (const [key, value] of Object.entries({ book_id: selectedSection.book_id, section_id: selectedSection.id, subsection_id: selectedBase.subsection_id,
    revision: '0', expected_group: JSON.stringify(selectedBase), group: JSON.stringify(selectedProposal) })) form.set(key, value);
  return { action, form, calls, selectedSection, selectedRows, selectedBase, selectedProposal, storedSection };
}

test('V2 action is off for remote books and no-op/malformed local saves do not access Supabase', async () => {
  let s = setup({ enabled: false }); assert.equal((await s.action({}, s.form)).status, 'error'); assert.deepEqual(s.calls, []);
  s = setup(); s.form.set('group', JSON.stringify(base)); assert.equal((await s.action({}, s.form)).status, 'unchanged'); assert.deepEqual(s.calls, []);
  for (const payload of ['{', '{}', JSON.stringify({ ...proposal(), nodes: [] })]) {
    s = setup(); s.form.set('group', payload); assert.equal((await s.action({}, s.form)).status, 'error'); assert.deepEqual(s.calls, []);
  }
});

test('V2 action sends one atomic save and acknowledges only an exact confirmed document and revision', async () => {
  const { action, form, calls } = setup(); const result = await action({}, form);
  assert.equal(result.status, 'saved'); assert.equal(result.revision, 1); assert.deepEqual(result.saved, proposal());
  assert.equal(calls.filter(([type]) => type === 'rpc').length, 1); assert.equal(calls.filter(([type]) => type === 'refresh').length, 3);
  const input = calls.find(([type]) => type === 'rpc')[1]; assert.equal(input.change.operation, 'save_text_v2');
  assert.deepEqual(input.order, blocks.map(b => b.id)); assert.deepEqual(input.change.expected_group, base);
});

test('V2 action preserves the draft on conflicts, uncertain responses and stale revisions', async () => {
  for (const options of [{ revision: 1 }, { error: true }, { uncertain: true }]) {
    const { action, form, calls } = setup(options); const json = form.get('group'); const result = await action({}, form);
    assert.equal(result.status, 'error'); assert.equal(result.saved, undefined); assert.match(result.message, /bozza è conservata/);
    assert.equal(form.get('group'), json); assert.equal(calls.filter(([type]) => type === 'refresh').length, 0);
  }
});

test('Production V2 save requires the exact canary and a conversion already stored in the database', async () => {
  const pending = setup({ enabled: false, canary: true });
  const denied = await pending.action({}, pending.form); assert.equal(denied.status, 'error'); assert.match(denied.message, /non è attivato/);
  assert.equal(pending.calls.filter(([type]) => type === 'rpc').length, 0);
  const active = setup({ enabled: false, canary: true, converted: true });
  const saved = await active.action({}, active.form); assert.equal(saved.status, 'saved'); assert.deepEqual(saved.saved, active.selectedProposal);
  assert.equal(active.calls.filter(([type]) => type === 'rpc').length, 1);
  const other = setup({ enabled: false, converted: true });
  assert.equal((await other.action({}, other.form)).status, 'error'); assert.deepEqual(other.calls, []);
});

test('Production Builder opens only the converted canary in Tiptap and leaves the other groups on V1', () => {
  const fixture = setup({ enabled: false, canary: true, converted: true });
  const defaults = editorialTestRuntime(); const disclosure = defaults('src/app/libri/[id]/contenuti/editorial-disclosure.tsx');
  const load = editorialTestRuntime({
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    './editorial-disclosure': { ...disclosure, EditorialDisclosure: props => React.createElement('details', { open: true }, props.children) },
  });
  const Builder = load('src/app/libri/[id]/contenuti/editorial-builder.tsx').EditorialBuilder;
  function renderSection(value) {
    return renderToStaticMarkup(React.createElement(Builder, { sections: [value], blocksBySection: new Map([[value.id, fixture.selectedRows]]) }));
  }
  const before = renderSection(fixture.selectedSection); assert.equal((before.match(/aria-label="Editor testo continuo V2"/g) ?? []).length, 0);
  const after = renderSection(fixture.storedSection); assert.equal((after.match(/aria-label="Editor testo continuo V2"/g) ?? []).length, 1);
  assert.equal((after.match(/aria-label="Editor testo della sottosezione"/g) ?? []).length, fixture.selectedSection.settings.editorial_builder_v1.subsections.length - 1);
  assert.equal((after.match(/aria-label="Editor testo introduttivo"/g) ?? []).length, 1);
});

test('Builder mounts continuous Tiptap segments with one save and no legacy editors per subsection/opening', () => {
  const defaults = editorialTestRuntime(); const disclosure = defaults('src/app/libri/[id]/contenuti/editorial-disclosure.tsx');
  const load = editorialTestRuntime({
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    './editorial-disclosure': { ...disclosure, EditorialDisclosure: props => React.createElement('details', { open: true }, props.children) },
  });
  const Builder = load('src/app/libri/[id]/contenuti/editorial-builder.tsx').EditorialBuilder;
  const html = renderToStaticMarkup(React.createElement(Builder, { sections: [section], blocksBySection: new Map([[section.id, blocks]]), textEditorV2Enabled: true }));
  const groups = section.settings.editorial_builder_v1.subsections.length + 1;
  assert.equal((html.match(/aria-label="Editor testo continuo V2"/g) ?? []).length, groups);
  const editors = html.match(/<section class="editorial-text-editor editorial-text-v2-editor"[\s\S]*?<\/section>/g) ?? [];
  assert.equal(editors.length, groups);
  for (const editor of editors) {
    assert.equal((editor.match(/>Salva<\/button>/g) ?? []).length, 1);
    assert.equal((editor.match(/name="expected_group"/g) ?? []).length, 1);
    assert.match(editor, /Carica immagine/);
  }
  assert.doesNotMatch(html, /<textarea|Organizza paragrafi|Organizza testo|Modifica testo<|Aggiungi testo|Testo introduttivo<\/summary>/);
  assert.equal((html.match(/Aggiungi immagine tra sottosezioni/g) ?? []).length, groups);
  assert.match(html, /Prima del testo/); assert.match(html, /Dopo il testo/);
});

test('Image form uses the KDP upload card with optional description, PNG/JPG limit, format and purple primary action', () => {
  const load = editorialTestRuntime();
  const Form = load('src/app/libri/[id]/contenuti/editorial-image-forms.tsx').EditorialImageForm;
  const html = renderToStaticMarkup(React.createElement(Form, { bookId: section.book_id, sectionId: section.id, v2: true }));
  assert.match(html, /accept="image\/png,image\/jpeg"/);
  assert.match(html, /massimo 3 MB/); assert.match(html, /Descrizione immagine \(facoltativa\)/);
  assert.match(html, /Dimensione/); assert.match(html, /Allineamento/);
  assert.match(html, /class="button editorial-image-submit"[^>]*>Carica immagine/);
  assert.match(html, /name="edge"/); assert.doesNotMatch(html, /<textarea/);
});

test('An image before/after an empty introduction keeps exactly one Tiptap surface on the selected side', () => {
  const load = editorialTestRuntime({ 'next/navigation': { useRouter: () => ({ refresh() {} }) } });
  const Editor = load('src/app/libri/[id]/contenuti/editorial-text-v2-editor.tsx').EditorialTextV2Editor;
  for (const edge of ['before', 'after']) {
    const image = { ...blocks[0], id: 'empty-group-image', block_type: 'image', title: null, body: null,
      editor_notes: JSON.stringify({ placement: { scope: 'group', subsection_id: null, edge } }) };
    const group = convertEditorialGroupV2(section.id, null, [image]);
    const html = renderToStaticMarkup(React.createElement(Editor, { bookId: section.book_id, sectionId: section.id, revision: 0, group }));
    assert.equal((html.match(/class="editorial-v2-segment"/g) ?? []).length, 1);
    const textPosition = html.indexOf('class="editorial-v2-segment"'), imagePosition = html.indexOf('id="block-empty-group-image"');
    assert.equal(imagePosition < textPosition, edge === 'before');
    assert.doesNotMatch(html, /Organizza testo|Organizza paragrafi/);
  }
});

test('Builder, editorial preview and TXT/PDF projection render the edited V2 content once, with V1 fallback', () => {
  const store = convertEditorialSectionV2(section, blocks); store.groups[base.subsection_id] = proposal();
  const saved = { ...section, settings: { ...section.settings, editorial_text_v2: { version: 2, groups: { [base.subsection_id]: store.groups[base.subsection_id] } } } };
  const load = editorialTestRuntime({ 'next/navigation': { useRouter: () => ({ refresh() {} }) } });
  const Preview = load('src/app/libri/[id]/anteprima/editorial-preview.tsx').EditorialPreview;
  const html = renderToStaticMarkup(React.createElement(Preview, { sections: [saved], blocks }));
  assert.equal((html.match(/Nuovo &lt;letterale&gt;/g) ?? []).length, 1); assert.match(html, /<br\/>/); assert.match(html, /<p><br\/><\/p>/);
  const { buildBookPreview, formatBookPreviewAsText } = load('src/lib/kdp/preview.ts');
  const preview = buildBookPreview({ sections: [saved], blocks, assets: [], settings: null, book: { id: section.book_id, title: 'Locale', subtitle: null } });
  const text = formatBookPreviewAsText(preview);
  assert.equal(text.split('Nuovo <letterale>').length - 1, 1); assert.ok(text.includes('  Nuovo <letterale>\r\n• uno  \n\nUltimo'));
  assert.ok(preview.sections[0].blocks.some(b => b.editorialTextV2 && b.body === ''));
  assert.ok(!text.includes(base.source.blocks[0].body));
  const legacy = buildBookPreview({ sections: [section], blocks, assets: [], settings: null, book: { id: section.book_id, title: 'Locale' } });
  assert.equal(legacy.sections[0].blocks.length, blocks.length); assert.equal(legacy.sections[0].blocks.some(b => b.editorialTextV2), false);
});

test('V2 preview shows image records between two editable runs and never copies them into the JSON text', () => {
  const image = { ...blocks[0], id: 'image-fixture', block_type: 'image', title: null, body: null, sort_order: blocks[0].sort_order + 0.5, asset_id: 'asset' };
  const rows = [...blocks, image]; const store = convertEditorialSectionV2(section, rows);
  const saved = { ...section, settings: { ...section.settings, editorial_text_v2: store } };
  const load = editorialTestRuntime(); const Preview = load('src/app/libri/[id]/anteprima/editorial-preview.tsx').EditorialPreview;
  const html = renderToStaticMarkup(React.createElement(Preview, { sections: [saved], blocks: rows, images: { asset: { url: 'https://example.invalid/image.png', alt: 'Figura originale' } } }));
  assert.equal((html.match(/<img /g) ?? []).length, 1); assert.match(html, /Figura originale/);
});
