import fs from "node:fs";
import type { Tables } from "../../../types/database.ts";
import type { EditorialMap, bootstrapEditorialMaps } from "../editorial-hierarchy.ts";

export const fixtureId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const fixtureBookId = fixtureId(1);
export const fixtureUserId = fixtureId(2);
type Project = Parameters<typeof bootstrapEditorialMaps>[2] & { kind: string };
export function ariesFixture() {
  // Structural snapshot of the validated import. Prose is replaced with test text;
  // structural IDs, titles, kinds, minor labels and counts are retained verbatim.
  const project = JSON.parse(fs.readFileSync(new URL("./aries-editorial-structure.json", import.meta.url), "utf8")) as Project;
  const blocks: Tables<"kdp_section_blocks">[] = [];
  const sections: Tables<"kdp_sections">[] = project.sections.map((source, i) => {
    const sectionId = fixtureId(100 + i);
    let position = 0;
    const append = (title: string | null, body: string | null) => {
      blocks.push({ id: fixtureId(1000 + blocks.length), book_id: fixtureBookId, section_id: sectionId,
        title, body, sort_order: ++position, block_type: "text", created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z", print_visibility: "print", layout_preset: "default", asset_id: null,
        editor_notes: null, created_by_email: null, created_by_user_id: fixtureUserId, updated_by_email: null, updated_by_user_id: fixtureUserId });
    };
    const add = (b: { text: string; type: string }) => append(b.type === "editorial" ? b.text : null, b.type === "editorial" ? null : b.text);
    source.blocks.forEach(add);
    source.subsections.forEach(sub => { append(sub.title, null); sub.blocks.forEach(add); });
    const info = source as typeof source & { title: string | null; kind: string };
    return { id: sectionId, book_id: fixtureBookId, title: info.title, subtitle: null, body: null,
      section_type: info.kind === "chapter" ? "chapter" : info.kind === "introduction" ? "introduction" : "chapter_text",
      sort_order: i + 1, settings: { editorialImporter: { kind: "editorial_draft_v1", sourceSectionId: source.id }, retained_key: "keep" },
      editor_notes: null, section_status: "ready", include_in_toc: info.kind !== "introduction", layout_preset: "default", page_break_before: false,
      created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", created_by_email: null, created_by_user_id: fixtureUserId, updated_by_email: null, updated_by_user_id: fixtureUserId };
  });
  return { project, blocks, sections };
}
export function attachMaps(sections: Tables<"kdp_sections">[], maps: Map<string, EditorialMap>) {
  return sections.map(s => ({ ...s, settings: { ...(s.settings as object), editorial_builder_v1: maps.get(s.id)! } }));
}
