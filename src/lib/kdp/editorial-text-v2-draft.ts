import { convertEditorialGroupV2, parseEditorialGroupV2, sameEditorialJson, type EditorialTextGroupV2 } from "./editorial-text-v2.ts";

export type EditorialTextDraftV2 = { version: 2; revision: number; base: EditorialTextGroupV2; group: EditorialTextGroupV2 };
export function createEditorialTextDraftV2(group: EditorialTextGroupV2, revision: number): EditorialTextDraftV2 {
  return { version: 2, revision, base: structuredClone(group), group: structuredClone(group) };
}
export function textDraftV2Dirty(draft: EditorialTextDraftV2) { return !sameEditorialJson(draft.base, draft.group); }
export function textDraftV2Stale(draft: EditorialTextDraftV2, group: EditorialTextGroupV2, revision: number) {
  return draft.revision !== revision || !sameEditorialJson(draft.base, group);
}
export function readEditorialTextDraftV2(json: string | null): EditorialTextDraftV2 | null {
  try {
    const value = JSON.parse(json ?? "null") as EditorialTextDraftV2;
    if (!value || value.version !== 2 || !Number.isSafeInteger(value.revision) || value.revision < 0) return null;
    const source = value.base.source;
    const original = convertEditorialGroupV2(source.section_body?.id ?? "", value.base.subsection_id, source.blocks, source.section_body?.value ?? null, source.marker_body);
    return { version: 2, revision: value.revision, base: parseEditorialGroupV2(value.base, original), group: parseEditorialGroupV2(value.group, original) };
  } catch { return null; }
}
export function acknowledgeEditorialTextV2(draft: EditorialTextDraftV2, expected: EditorialTextGroupV2, saved: EditorialTextGroupV2, revision: number) {
  return sameEditorialJson(draft.base, expected) ? { ...draft, revision, base: structuredClone(saved) } : draft;
}
