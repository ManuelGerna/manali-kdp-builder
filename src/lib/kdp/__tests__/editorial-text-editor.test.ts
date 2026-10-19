import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeTextDraft, changedSubsectionTexts, createSubsectionTextDraft, editSubsectionTextDraft,
  parseTextChanges, preserveTextNewlines, readSubsectionTextDraft, textDraftIsStale } from "../editorial-text-editor.ts";

const text = { id: "text", block_type: "text", title: null, body: "  Primo\r\nsecondo\n\n• voce  \r\nFine", asset_id: null, editor_notes: null };
const image = { ...text, id: "image", block_type: "image", body: null, asset_id: "asset" };
const label = { ...text, id: "label", title: "Titoletto", body: null };

test("Opening, focusing and reverting text is byte-exact and produces no changes", () => {
  const initial = createSubsectionTextDraft([text, image, label], 4);
  assert.deepEqual(changedSubsectionTexts(initial), []);
  const focused = editSubsectionTextDraft(initial, "text", "body", text.body.replace(/\r\n/g, "\n"));
  assert.equal(focused.values.text.body, text.body);
  assert.deepEqual(changedSubsectionTexts(focused), []);
  const edited = editSubsectionTextDraft(focused, "text", "body", text.body.replace("Primo", "Nuovo"));
  assert.equal(edited.values.text.body, text.body.replace("Primo", "Nuovo"));
  const reverted = editSubsectionTextDraft(edited, "text", "body", text.body.replace(/\r\n/g, "\n"));
  assert.deepEqual(changedSubsectionTexts(reverted), []);
  assert.equal(reverted.values.text.body, text.body);
});

test("Editing and clearing one field retains IDs, null fields, whitespace, lists and image boundaries", () => {
  const initial = createSubsectionTextDraft([text, image, label], 2);
  const edited = editSubsectionTextDraft(initial, "label", "title", "  Nuovo titoletto  ");
  assert.deepEqual(changedSubsectionTexts(edited), [{ block_id: "label", expected_title: "Titoletto", expected_body: null, title: "  Nuovo titoletto  ", body: null }]);
  assert.deepEqual(edited.blocks, initial.blocks);
  assert.deepEqual(Object.keys(edited.values), ["text", "label"]);
  assert.equal(editSubsectionTextDraft(edited, "image", "body", "cannot merge"), edited);
  const cleared = editSubsectionTextDraft(initial, "text", "body", "");
  assert.equal(cleared.values.text.body, "");assert.deepEqual(cleared.blocks.map(b => b.id), ["text", "image", "label"]);
});

test("Inserted lines use the field convention without rewriting unchanged endings", () => {
  assert.equal(preserveTextNewlines("a\r\nb\nc", "a\nb\nc!"), "a\r\nb\nc!");
  assert.equal(preserveTextNewlines("a\r\nb", "a\nnuovo\nb"), "a\r\nnuovo\r\nb");
  assert.equal(preserveTextNewlines("a\rb", "a\nb!"), "a\rb!");
  assert.equal(preserveTextNewlines("a", "a\n\nb"), "a\n\nb");
});

test("A conflict, remote image move or reload retains the original draft and its base revision", () => {
  const initial = createSubsectionTextDraft([text, image, label], 7);
  const edited = editSubsectionTextDraft(initial, "text", "body", "Bozza\ncon a capo");
  const restored = readSubsectionTextDraft(JSON.stringify(edited))!;
  assert.deepEqual(restored, edited);
  assert.equal(textDraftIsStale(restored, [text, image, label], 8), true);
  assert.equal(textDraftIsStale(restored, [text, label, image], 7), true);
  assert.equal(textDraftIsStale(restored, [{ ...text, body: "Altra versione" }, image, label], 7), true);
  assert.equal(restored.revision, 7);assert.equal(restored.values.text.body, "Bozza\r\ncon a capo");
});

test("Acknowledgement clears only saved edits and retains any newer local input", () => {
  const initial = createSubsectionTextDraft([text, image, label], 7);
  const sent = editSubsectionTextDraft(initial, "text", "body", "Testo inviato");
  const changes = changedSubsectionTexts(sent);
  assert.deepEqual(changedSubsectionTexts(acknowledgeTextDraft(sent, 8, changes)), []);
  const newer = editSubsectionTextDraft(sent, "text", "body", "Testo ancora più recente");
  const acknowledged = acknowledgeTextDraft(newer, 8, changes);
  assert.equal(acknowledged.revision, 8);
  assert.equal(acknowledged.values.text.body, "Testo ancora più recente");
  assert.equal(changedSubsectionTexts(acknowledged)[0].expected_body, "Testo inviato");
});

test("Malformed payloads and corrupt session drafts are rejected", () => {
  assert.throws(() => parseTextChanges({}));
  assert.throws(() => parseTextChanges([{ block_id: "text", title: null, body: "x" }]));
  const change = { block_id: "text", title: null, body: "x", expected_title: null, expected_body: "old" };
  assert.throws(() => parseTextChanges([change, change]));
  assert.throws(() => parseTextChanges([{ ...change, body: {} }]));
  assert.equal(readSubsectionTextDraft("{"), null);
  assert.equal(readSubsectionTextDraft(JSON.stringify({ version: 2 })), null);
  const draft = createSubsectionTextDraft([text], 0);
  assert.equal(readSubsectionTextDraft(JSON.stringify({ ...draft, blocks: [text, text] })), null);
});
