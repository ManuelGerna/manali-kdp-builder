import type { Tables } from "../../types/database.ts";

export type TextFields = { title: string | null; body: string | null };
export type TextSnapshot = Pick<Tables<"kdp_section_blocks">, "id" | "block_type" | "title" | "body" | "asset_id" | "editor_notes">;
export type TextChange = TextFields & { block_id: string; expected_title: string | null; expected_body: string | null };
export type SubsectionTextDraft = {
  version: 1; revision: number; blocks: TextSnapshot[]; values: Record<string, TextFields>;
};

export function isEditableTextBlock(block: { block_type: string }) {
  return !["image", "image_prompt", "page_break", "internal_note"].includes(block.block_type);
}

export function createSubsectionTextDraft(blocks: TextSnapshot[], revision: number): SubsectionTextDraft {
  const snapshots = blocks.map(({ id, block_type, title, body, asset_id, editor_notes }) =>
    ({ id, block_type, title, body, asset_id, editor_notes }));
  return { version: 1, revision, blocks: snapshots,
    values: Object.fromEntries(snapshots.filter(isEditableTextBlock).map(b => [b.id, { title: b.title, body: b.body }])) };
}

export function changedSubsectionTexts(draft: SubsectionTextDraft): TextChange[] {
  return draft.blocks.filter(isEditableTextBlock).flatMap(block => {
    const value = draft.values[block.id];
    return value && (value.title !== block.title || value.body !== block.body)
      ? [{ block_id: block.id, expected_title: block.title, expected_body: block.body, ...value }] : [];
  });
}

export function editSubsectionTextDraft(draft: SubsectionTextDraft, id: string, field: keyof TextFields, input: string): SubsectionTextDraft {
  const baseline = draft.blocks.find(block => block.id === id);
  const current = draft.values[id];
  if (!baseline || !current || !isEditableTextBlock(baseline)) return draft;
  const original = baseline[field];
  const value = input.replace(/\r\n?/g, "\n") === (original ?? "").replace(/\r\n?/g, "\n")
    ? original : preserveTextNewlines(current[field] ?? "", input);
  return { ...draft, values: { ...draft.values, [id]: { ...current, [field]: value } } };
}

export function textDraftIsStale(draft: SubsectionTextDraft, blocks: TextSnapshot[], revision: number) {
  return draft.revision !== revision || draft.blocks.length !== blocks.length || draft.blocks.some((before, i) => {
    const after = blocks[i];
    return !after || before.id !== after.id || before.title !== after.title || before.body !== after.body ||
      before.asset_id !== after.asset_id || before.editor_notes !== after.editor_notes || before.block_type !== after.block_type;
  });
}

export function parseTextChanges(value: unknown): TextChange[] {
  if (!Array.isArray(value)) throw new Error("Modifiche testo non valide.");
  const ids = new Set<string>();
  return value.map(item => {
    const text = (key: string) => item && (item[key] === null || typeof item[key] === "string");
    if (!item || typeof item.block_id !== "string" || !item.block_id || ids.has(item.block_id) ||
        !["title", "body", "expected_title", "expected_body"].every(text)) throw new Error("Modifiche testo non valide.");
    ids.add(item.block_id);
    return { block_id: item.block_id, title: item.title, body: item.body,
      expected_title: item.expected_title, expected_body: item.expected_body };
  });
}

// Textarea values use LF. Keep the original byte sequences in the unchanged
// prefix/suffix, and use the field's existing convention only for inserted lines.
export function preserveTextNewlines(previous: string, input: string) {
  const normalized = previous.replace(/\r\n?/g, "\n");
  const next = input.replace(/\r\n?/g, "\n");
  if (normalized === next) return previous;
  const boundaries = [0];
  for (let i = 0; i < previous.length; i++) {
    if (previous[i] === "\r" && previous[i + 1] === "\n") i++;
    boundaries.push(i + 1);
  }
  let prefix = 0; let suffix = 0;
  while (prefix < normalized.length && prefix < next.length && normalized[prefix] === next[prefix]) prefix++;
  while (suffix < normalized.length - prefix && suffix < next.length - prefix &&
    normalized[normalized.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
  const ending = previous.match(/\r\n|\r|\n/)?.[0] ?? "\n";
  return previous.slice(0, boundaries[prefix]) +
    next.slice(prefix, next.length - suffix).replace(/\n/g, ending) +
    previous.slice(boundaries[normalized.length - suffix]);
}

export function acknowledgeTextDraft(draft: SubsectionTextDraft, revision: number, saved: TextChange[]): SubsectionTextDraft {
  const byId = new Map(saved.map(change => [change.block_id, change]));
  // Keep any newer local edits; acknowledge only what the server received.
  return { ...draft, revision, blocks: draft.blocks.map(block => {
    const change = byId.get(block.id);
    return change ? { ...block, title: change.title, body: change.body } : block;
  }) };
}

export function readSubsectionTextDraft(json: string | null): SubsectionTextDraft | null {
  try {
    const value = JSON.parse(json ?? "null");
    if (!value || value.version !== 1 || !Number.isInteger(value.revision) || value.revision < 0 ||
        !Array.isArray(value.blocks) || !value.values || typeof value.values !== "object") return null;
    const ids = new Set<string>();
    for (const block of value.blocks) {
      if (!block || typeof block.id !== "string" || ids.has(block.id) || typeof block.block_type !== "string" ||
          ![block.title, block.body, block.asset_id, block.editor_notes].every(v => v === null || typeof v === "string")) return null;
      ids.add(block.id);
      if (isEditableTextBlock(block)) parseTextChanges([{ block_id: block.id, expected_title: block.title,
        expected_body: block.body, title: value.values[block.id]?.title, body: value.values[block.id]?.body }]);
    }
    return value;
  } catch { return null; }
}
