import type { KdpSectionBlock } from "./section-blocks.ts";
import type { KdpSection } from "./sections.ts";
import { buildEditorialBlockHierarchy, orderEditorialBlocks, readEditorialMap } from "./editorial-hierarchy.ts";
import { convertEditorialGroupV2, readEditorialSectionText, type EditorialTextGroupV2 } from "./editorial-text-v2.ts";

export type ImagePlacement = { scope: "group" | "chapter"; subsection_id: string | null; edge: "before" | "after" };
export function readImagePlacement(notes: string | null): ImagePlacement | null {
  try {
    const p = JSON.parse(notes ?? "{}").placement;
    return p && ["group", "chapter"].includes(p.scope) && ["before", "after"].includes(p.edge) &&
      (p.subsection_id === null || typeof p.subsection_id === "string") ? p : null;
  } catch { return null; }
}

// Only images move. Text rows, structural markers and semantic identifiers keep their order.
export function planEditorialImagePlacement(section: KdpSection, blocks: KdpSectionBlock[], image: KdpSectionBlock, placement: ImagePlacement | null, beforeImageId: string | null = null) {
  const map = readEditorialMap(section.settings, blocks);
  const current = readEditorialSectionText(section, blocks);
  const remaining = blocks.filter(b => b.id !== image.id);
  const hierarchy = buildEditorialBlockHierarchy(remaining, map);
  if (placement) {
    if (placement.scope === "chapter" && section.section_type !== "chapter") throw new Error("Posizione disponibile solo nei capitoli.");
    const rows = placement.subsection_id === null ? hierarchy.openingBlocks : hierarchy.subsections.find(s => s.marker.id === placement.subsection_id)?.blocks;
    if (!rows) throw new Error("Destinazione immagine non disponibile.");
    // Chapter images live at the end of the preceding group, without becoming a subsection.
    if (beforeImageId) {
      const index = rows.findIndex(b => b.id === beforeImageId);
      if (index < 0) throw new Error("Destinazione immagine non disponibile.");
      rows.splice(index, 0, image);
    } else if (placement.scope === "group" && placement.edge === "after") {
      const chapterStart = rows.findIndex(b => readImagePlacement(b.editor_notes)?.scope === "chapter");
      rows.splice(chapterStart < 0 ? rows.length : chapterStart, 0, image);
    } else if (placement.scope === "chapter") rows.push(image); else rows.unshift(image);
  }
  const ordered = [...hierarchy.openingBlocks, ...hierarchy.subsections.flatMap(s => [s.marker, ...s.blocks])];
  const next = buildEditorialBlockHierarchy(ordered.map((b, i) => ({ ...b, sort_order: i + 1 })), map);
  const groups: Record<string, EditorialTextGroupV2> = {};
  for (const item of [current.opening, ...current.subsections.map(s => s.text)]) {
    if (item.format !== "v2") continue;
    const old = item.group;
    const rows = old.subsection_id === null ? next.openingBlocks : next.subsections.find(s => s.marker.id === old.subsection_id)!.blocks;
    const template = convertEditorialGroupV2(section.id, old.subsection_id, rows, section.body, old.source.marker_body);
    const targets = template.nodes.filter(n => n.kind === "text");
    for (const target of targets) target.doc = { type: "doc", content: [] };
    for (const node of old.nodes) {
      if (node.kind !== "text" || !node.doc.content.length) continue;
      const insertedBefore = placement?.scope === "group" && placement.edge === "before" &&
        placement.subsection_id === old.subsection_id && rows[0]?.id === image.id;
      const target = node.source_ids.length ? targets.find(t => node.source_ids.every(id => t.source_ids.includes(id))) :
        (insertedBefore && node.id.endsWith(":start") ? targets.find(t => t.id.endsWith(`:${image.id}`)) : targets.find(t => t.id === node.id)) ??
        targets.find(t => t.source_ids.length) ?? targets[0];
      if (!target) throw new Error("Questo spostamento dividerebbe il documento. Scegli prima o dopo il testo.");
      target.doc.content.push(...structuredClone(node.doc.content));
    }
    groups[old.subsection_id ?? "opening"] = template;
  }
  return { order: ordered.map(b => b.id), groups };
}

export function chapterImages(blocks: KdpSectionBlock[], after: string | null) {
  return orderEditorialBlocks(blocks).filter(b => {
    const p = readImagePlacement(b.editor_notes);
    return b.block_type === "image" && p?.scope === "chapter" && p.subsection_id === after;
  });
}
