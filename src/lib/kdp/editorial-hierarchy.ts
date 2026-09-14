// Builder metadata only. The import's normalized_project remains immutable.
export const EDITORIAL_MAP_KEY = "editorial_builder_v1";
export type EditorialMap = {
  version: 1;
  revision: number;
  subsections: {
    semantic_id: string;
    kind: "heading" | "numbered" | "key";
    heading_block_id: string;
    order: number;
    original_number?: number;
  }[];
};
export type EditorialBlockLike = {
  block_type: string; body: string | null; created_at: string;
  id: string; sort_order: number; title: string | null;
};
export type EditorialSubsection<T extends EditorialBlockLike> = { marker: T; blocks: T[] };
export type EditorialBlockHierarchy<T extends EditorialBlockLike> = {
  openingBlocks: T[]; subsections: EditorialSubsection<T>[];
};

export function orderEditorialBlocks<T extends EditorialBlockLike>(blocks: T[]) {
  return [...blocks].sort((a, b) => a.sort_order - b.sort_order ||
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export function readEditorialMap(settings: unknown, blocks: EditorialBlockLike[]): EditorialMap {
  const map = (settings as Record<string, unknown> | null)?.[EDITORIAL_MAP_KEY] as EditorialMap | undefined;
  if (!map || map.version !== 1 || !Number.isInteger(map.revision) || map.revision < 0 || !Array.isArray(map.subsections)) {
    throw new Error("Struttura editoriale da inizializzare o non valida. Nessun contenuto è stato modificato.");
  }
  const positions = new Map(orderEditorialBlocks(blocks).map((b, i) => [b.id, i]));
  const ids = new Set<string>(); const semantic = new Set<string>(); let previous = -1;
  for (const [i, item] of map.subsections.entries()) {
    if (!item || typeof item.semantic_id !== "string" || typeof item.heading_block_id !== "string") {
      throw new Error("La mappa editoriale non è valida. Nessuna ricostruzione automatica è stata eseguita.");
    }
    const position = positions.get(item.heading_block_id);
    if (!item.semantic_id || semantic.has(item.semantic_id) || ids.has(item.heading_block_id) ||
        !["heading", "numbered", "key"].includes(item.kind) || item.order !== i ||
        position === undefined || position <= previous) {
      throw new Error("La mappa editoriale non corrisponde ai blocchi. Ricarica il libro; nessuna ricostruzione automatica è stata eseguita.");
    }
    ids.add(item.heading_block_id); semantic.add(item.semantic_id); previous = position;
  }
  return map;
}

export function isEditorialSubsectionMarker(block: EditorialBlockLike, map?: EditorialMap) {
  // Imported editorial books always supply their validated UUID map.
  return map ? map.subsections.some(s => s.heading_block_id === block.id) : block.block_type === "heading";
}

export function buildEditorialBlockHierarchy<T extends EditorialBlockLike>(blocks: T[], map?: EditorialMap): EditorialBlockHierarchy<T> {
  const result: EditorialBlockHierarchy<T> = { openingBlocks: [], subsections: [] };
  const markers = new Set(map?.subsections.map(s => s.heading_block_id) ?? blocks.filter(b => b.block_type === "heading").map(b => b.id));
  let current: EditorialSubsection<T> | undefined;
  for (const block of orderEditorialBlocks(blocks)) {
    if (markers.has(block.id)) {
      current = { marker: block, blocks: [] }; result.subsections.push(current);
    } else (current?.blocks ?? result.openingBlocks).push(block);
  }
  return result;
}

export function isEditorialTextContent(block: EditorialBlockLike) {
  return !["internal_note", "page_break", "image", "image_prompt"].includes(block.block_type) &&
    Boolean(block.title?.trim() || block.body?.trim());
}

export function getEditorialSectionTitle(section: { title: string | null; section_type?: string }, chapterNumber: number | null) {
  const title = section.title?.trim() || (section.section_type === "introduction" ? "Introduzione" : "Senza titolo");
  return chapterNumber && !/^\d+(?:[.)]|\s)/.test(title) ? `${chapterNumber}. ${title}` : title;
}

export function planEditorialSubsectionMove<T extends EditorialBlockLike>(blocks: T[], id: string, direction: "up" | "down", map: EditorialMap): string[] {
  const h = buildEditorialBlockHierarchy(blocks, map);
  const index = h.subsections.findIndex(s => s.marker.id === id);
  if (index < 0) throw new Error("Sottosezione non trovata.");
  const target = index + (direction === "up" ? -1 : 1);
  if (h.subsections[target]) [h.subsections[index], h.subsections[target]] = [h.subsections[target], h.subsections[index]];
  return [...h.openingBlocks, ...h.subsections.flatMap(s => [s.marker, ...s.blocks])].map(b => b.id);
}

export function planEditorialTextPlacement<T extends EditorialBlockLike>(blocks: T[], id: string, targetId: string | null, map: EditorialMap): string[] {
  if (!blocks.some(b => b.id === id) || map.subsections.some(s => s.heading_block_id === id)) throw new Error("Testo non trovato.");
  const h = buildEditorialBlockHierarchy(blocks.filter(b => b.id !== id), map);
  const target = targetId ? h.subsections.find(s => s.marker.id === targetId)?.blocks : h.openingBlocks;
  if (!target) throw new Error("Destinazione non trovata.");
  target.push(blocks.find(b => b.id === id)!);
  return [...h.openingBlocks, ...h.subsections.flatMap(s => [s.marker, ...s.blocks])].map(b => b.id);
}

export function planEditorialTextMove<T extends EditorialBlockLike>(blocks: T[], id: string, direction: "up" | "down", map: EditorialMap): string[] {
  const h = buildEditorialBlockHierarchy(blocks, map);
  const siblings = [h.openingBlocks, ...h.subsections.map(s => s.blocks)].find(g => g.some(b => b.id === id));
  if (!siblings) throw new Error("Testo non trovato.");
  const index = siblings.findIndex(b => b.id === id); const target = index + (direction === "up" ? -1 : 1);
  if (siblings[target]) [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  return [...h.openingBlocks, ...h.subsections.flatMap(s => [s.marker, ...s.blocks])].map(b => b.id);
}

type NormalizedSection = {
  id: string; blocks: { type: string; text: string }[];
  subsections: { id: string; kind: EditorialMap["subsections"][number]["kind"]; title: string; number?: number; blocks: { type: string; text: string }[] }[];
};

// Read-only bootstrap preview. The RPC repeats the comparison under locks and
// persists ALL maps together, never trusting a client-generated map.
export function bootstrapEditorialMaps(
  sections: { id: string; settings: unknown }[],
  blocks: (EditorialBlockLike & { section_id: string })[],
  project: { sections: NormalizedSection[] },
): Map<string, EditorialMap> {
  const maps = new Map<string, EditorialMap>();
  for (const section of sections) {
    const rows = orderEditorialBlocks(blocks.filter(b => b.section_id === section.id));
    const settings = section.settings as Record<string, unknown>;
    if (settings[EDITORIAL_MAP_KEY] !== undefined) { maps.set(section.id, readEditorialMap(settings, rows)); continue; }
    const sourceId = (settings.editorialImporter as { sourceSectionId?: string } | undefined)?.sourceSectionId;
    const source = project.sections.find(s => s.id === sourceId);
    if (!source) throw new Error("Confronto import non completo. Nessuna mappa salvata.");
    const expected = source.blocks.map(b => ({ title: b.type === "editorial" ? b.text : null, body: b.type === "editorial" ? null : b.text }));
    const subsections: EditorialMap["subsections"] = [];
    for (const sub of source.subsections) {
      subsections.push({ semantic_id: sub.id, kind: sub.kind, heading_block_id: rows[expected.length]?.id, order: subsections.length,
        ...(sub.number !== undefined ? { original_number: sub.number } : {}) });
      expected.push({ title: sub.title, body: null }, ...sub.blocks.map(b => ({ title: b.type === "editorial" ? b.text : null, body: b.type === "editorial" ? null : b.text })));
    }
    if (expected.length !== rows.length || expected.some((e, i) => rows[i].block_type !== "text" || e.title !== rows[i].title || e.body !== rows[i].body || rows[i].sort_order !== i + 1)) {
      throw new Error("Confronto import non completo. Nessuna mappa salvata.");
    }
    maps.set(section.id, { version: 1, revision: 0, subsections });
  }
  return maps;
}
