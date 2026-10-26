import assert from "node:assert/strict";
import test from "node:test";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { splitBlock } from "@tiptap/pm/commands";
import { ariesFixture, attachMaps } from "../__fixtures__/editorial-fixture.ts";
import { bootstrapEditorialMaps } from "../editorial-hierarchy.ts";
import { convertEditorialGroupV2, convertEditorialSectionV2, readEditorialSectionText, restoreEditorialGroupV1,
  sameEditorialJson, parseEditorialGroupV2, parseLiteralDocument, paragraphLiteralText, literalParagraph, editorialSectionTextProjection } from "../editorial-text-v2.ts";
import { editorialTextV2Extensions } from "../editorial-text-v2-schema.ts";
import { createEditorialTextDraftV2, readEditorialTextDraftV2, textDraftV2Dirty, textDraftV2Stale, acknowledgeEditorialTextV2 } from "../editorial-text-v2-draft.ts";
import { editorialTextV2LocalEnabled, isEditorialTextV2Canary, EDITORIAL_TEXT_V2_CANARY } from "../editorial-text-v2-gate.ts";

const fixture = ariesFixture();
const sections = attachMaps(fixture.sections, bootstrapEditorialMaps(fixture.sections, fixture.blocks, fixture.project));
const base = fixture.blocks[0];
const row = (id: string, body: string | null, extra: Partial<typeof base> = {}) => ({ ...base, id, title: null, body, ...extra });

test("V2 converts every Ariete fixture field and UUID exactly once and reverses without mutation", () => {
  const before = structuredClone({ sections, blocks: fixture.blocks });
  const ids: string[] = []; let subsections = 0;
  for (const section of sections) {
    const blocks = fixture.blocks.filter(b => b.section_id === section.id);
    const store = convertEditorialSectionV2(section, blocks);
    assert.deepEqual(store, convertEditorialSectionV2(section, [...blocks].reverse()));
    const read = readEditorialSectionText({ ...section, settings: { ...section.settings as object, editorial_text_v2: store } }, blocks);
    for (const item of [read.opening, ...read.subsections.map(s => s.text)]) {
      assert.equal(item.format, "v2"); ids.push(...restoreEditorialGroupV1(item.group).blocks.map(b => b.id));
    }
    ids.push(...read.subsections.map(s => s.marker.id)); subsections += read.subsections.length;
    const target = read.subsections.find(s => s.marker.title?.trim() === "COME AMI DAVVERO");
    if (target) assert.equal(target.blocks.length, 34);
  }
  assert.equal(subsections, 53); assert.equal(ids.length, 1167); assert.equal(new Set(ids).size, 1167);
  assert.deepEqual(ids.sort(), fixture.blocks.map(b => b.id).sort()); assert.deepEqual({ sections, blocks: fixture.blocks }, before);
});

test("V2 preserves literal punctuation, Unicode, spaces, blank lines, mixed terminators, lists, separators and null/empty", () => {
  const blocks = [row("a", "  <p>& ‘é’ e\u0301\t\u00a0\r\n\r\n• uno\n— due\r⸻\n  ", { title: "  Etichetta  " }), row("b", ""), row("c", null)];
  const group = convertEditorialGroupV2("section", "marker", blocks);
  assert.deepEqual(restoreEditorialGroupV1(group).blocks, blocks);
  const doc = group.nodes[0]; assert.equal(doc.kind, "text");
  if (doc.kind !== "text") return;
  assert.equal(doc.doc.content.length, 3);
  assert.deepEqual(doc.doc.content.map(paragraphLiteralText), [blocks[0].title, blocks[0].body, ""]);
  const schema = getSchema(editorialTextV2Extensions()); const parsed = schema.nodeFromJSON(doc.doc); parsed.check();
  assert.ok(sameEditorialJson(parsed.toJSON(), doc.doc));
  assert.deepEqual(convertEditorialGroupV2("s", null, []).nodes[0], { kind: "text", id: "segment:opening:start", source_ids: [], doc: { type: "doc", content: [] } });
});

test("V2 retains images and structural/hidden records at immutable boundaries, with text on both sides", () => {
  const blocks = [row("a", "Prima"), row("image", null, { block_type: "image", asset_id: "asset", editor_notes: '{"size":"medium"}' }),
    row("b", "Dopo"), row("note", "Nota", { block_type: "internal_note" }), row("break", null, { block_type: "page_break" }),
    row("heading", "Corpo", { title: "Titolo", block_type: "heading" }), row("hidden", "Nascosto", { print_visibility: "hidden" })];
  const group = convertEditorialGroupV2("s", null, blocks, "  Apertura\r\n  ");
  assert.deepEqual(restoreEditorialGroupV1(group), { blocks, section_body: { id: "s", value: "  Apertura\r\n  " } });
  assert.deepEqual(group.nodes.filter(n => n.kind === "block").map(n => n.id), ["image", "note", "break", "heading"]);
  assert.equal(group.nodes.filter(n => n.kind === "text").length, 5);
  const moved = structuredClone(group); moved.nodes.reverse(); assert.throws(() => parseEditorialGroupV2(moved, group));
});

test("ProseMirror edits across old blocks, splits paragraphs and inserts a simple break without adding spaces", () => {
  const schema = getSchema(editorialTextV2Extensions());
  let state = EditorState.create({ schema, doc: schema.nodeFromJSON({ type: "doc", content: [literalParagraph("Primo"), literalParagraph("Secondo")] }) });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3, 12)).insertText("Nuovo"));
  assert.equal(state.doc.childCount, 1); assert.equal(state.doc.textContent, "PrNuovondo");
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3)));
  assert.equal(splitBlock(state, tr => { state = state.apply(tr); }), true); assert.equal(state.doc.childCount, 2);
  state = state.apply(state.tr.replaceSelectionWith(schema.nodes.hardBreak.create({ ending: "\n" })));
  assert.equal(state.doc.childCount, 2); assert.equal(state.doc.child(1).child(0).type.name, "hardBreak");
});

test("Mixed V1/V2 reader and export use the edited document once, preserve UUIDs and reject unknown/corrupt versions", () => {
  const section = sections[1], blocks = fixture.blocks.filter(b => b.section_id === section.id);
  const store = convertEditorialSectionV2(section, blocks); const key = Object.keys(store.groups).find(k => k !== "opening")!;
  const group = store.groups[key]; const node = group.nodes.find(n => n.kind === "text")!;
  if (node.kind !== "text") return;
  const original = paragraphLiteralText(node.doc.content[0]); node.doc.content = [literalParagraph("Unico testo nuovo"), literalParagraph("")];
  const mixed = { version: 2 as const, groups: { [key]: group } };
  const saved = { ...section, settings: { ...section.settings as object, editorial_text_v2: mixed } };
  const read = readEditorialSectionText(saved, blocks);
  assert.equal(read.opening.format, "v1"); assert.equal(read.subsections.find(s => s.marker.id === key)!.text.format, "v2");
  const projection = editorialSectionTextProjection(saved, blocks);
  assert.equal(projection.blocks.filter(b => b.body === "Unico testo nuovo").length, 1);
  assert.equal(projection.blocks.filter(b => b.body === original).length, 0);
  assert.ok(projection.blocks.some(b => b.id === key)); assert.ok(projection.blocks.some(b => b.editorial_text_v2 && b.body === ""));
  assert.throws(() => restoreEditorialGroupV1(group), /modificato/);
  assert.throws(() => readEditorialSectionText({ ...section, settings: { ...section.settings as object, editorial_text_v2: { version: 99 } } }, blocks));
  assert.throws(() => readEditorialSectionText(saved, blocks.map(b => b.id === group.source.blocks[0].id ? { ...b, body: "Conflitto" } : b)));
});

test("V2 document validation rejects embedded HTML nodes, scripts, extra attrs and invalid breaks", () => {
  for (const value of [{ type: "doc", content: [{ type: "image", attrs: { src: "x" } }] },
    { type: "doc", content: [{ ...literalParagraph("Testo"), content: [{ type: "hardBreak", attrs: { ending: "BAD" } }] }] },
    { type: "doc", content: [{ ...literalParagraph("Testo"), attrs: { ...literalParagraph("").attrs, onclick: "x" } }] }]) assert.throws(() => parseLiteralDocument(value));
});

test("Existing structural-marker body enters the document once while its title and UUID stay separate", () => {
  const section = sections[1], rows = fixture.blocks.filter(b => b.section_id === section.id);
  const markerId = section.settings.editorial_builder_v1.subsections[0].heading_block_id;
  const blocks = rows.map(b => b.id === markerId ? { ...b, body: "  Corpo del titolo\r\n  " } : b);
  const store = convertEditorialSectionV2(section, blocks);
  const saved = { ...section, settings: { ...section.settings as object, editorial_text_v2: store } };
  const group = readEditorialSectionText(saved, blocks).subsections[0].text.group;
  assert.equal(group.source.marker_body?.id, markerId);
  assert.equal(restoreEditorialGroupV1(group).marker_body?.value, "  Corpo del titolo\r\n  ");
  const projection = editorialSectionTextProjection(saved, blocks);
  assert.equal(projection.blocks.find(b => b.id === markerId)?.title, blocks.find(b => b.id === markerId)?.title);
  assert.equal(projection.blocks.find(b => b.id === markerId)?.body, null);
  assert.equal(projection.blocks.filter(b => b.body === "  Corpo del titolo\r\n  ").length, 1);
});

test("V2 drafts survive restore/conflicts and acknowledge only submitted edits", () => {
  const group = convertEditorialGroupV2("s", "m", [row("a", "Prima")]);
  const draft = createEditorialTextDraftV2(group, 1); const segment = draft.group.nodes[0];
  if (segment.kind !== "text") return;
  segment.doc.content[0] = literalParagraph("Bozza"); assert.ok(textDraftV2Dirty(draft));
  assert.deepEqual(readEditorialTextDraftV2(JSON.stringify(draft)), draft); assert.ok(textDraftV2Stale(draft, group, 2));
  const submitted = structuredClone(draft.group); segment.doc.content[0] = literalParagraph("Più recente");
  const acknowledged = acknowledgeEditorialTextV2(draft, group, submitted, 2);
  assert.equal(acknowledged.revision, 2); assert.ok(textDraftV2Dirty(acknowledged));
  assert.ok(!textDraftV2Stale(acknowledged, submitted, 2)); assert.equal(readEditorialTextDraftV2('{"version":1}'), null);
});

test("Phase 1 opt-in requires a loopback database and refuses production/remote URLs", () => {
  const env = { NODE_ENV: "development", EDITORIAL_TEXT_V2_LOCAL: "1", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
  assert.ok(editorialTextV2LocalEnabled(env));
  for (const overrides of [{ NODE_ENV: "production" }, { EDITORIAL_TEXT_V2_LOCAL: undefined }, { NEXT_PUBLIC_SUPABASE_URL: "https://sppsgnhnloumfdldosbe.supabase.co" }, { NEXT_PUBLIC_SUPABASE_URL: "invalid" }]) assert.equal(editorialTextV2LocalEnabled({ ...env, ...overrides }), false);
});

test("Production phase 2 allowlist is limited to the original Ariete/section/marker UUIDs", () => {
  const { bookId, sectionId, subsectionId } = EDITORIAL_TEXT_V2_CANARY;
  assert.ok(isEditorialTextV2Canary(bookId, sectionId, subsectionId));
  assert.equal(isEditorialTextV2Canary(bookId, sectionId, null), false);
  assert.equal(isEditorialTextV2Canary("other-book", sectionId, subsectionId), false);
  assert.equal(isEditorialTextV2Canary(bookId, "other-section", subsectionId), false);
  assert.equal(isEditorialTextV2Canary(bookId, sectionId, "other-marker"), false);
});
