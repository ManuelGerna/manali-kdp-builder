import type { KdpSectionBlock } from "./section-blocks.ts";
import type { KdpSection } from "./sections.ts";
import { buildEditorialBlockHierarchy, orderEditorialBlocks, readEditorialMap } from "./editorial-hierarchy.ts";

export const EDITORIAL_TEXT_V2_KEY = "editorial_text_v2";
export type LiteralInline = { type: "text"; text: string; marks?: { type: "bold" }[] }
  | { type: "hardBreak"; attrs: { ending: "\n" | "\r\n" | "\r" } };
export type LiteralParagraph = {
  type: "paragraph";
  attrs: { sourceId: string | null; field: "title" | "body" | null; visibility: string; layout: string };
  content?: LiteralInline[];
};
export type LiteralDocument = { type: "doc"; content: LiteralParagraph[] };
export type EditorialTextSegmentV2 = { kind: "text"; id: string; source_ids: string[]; doc: LiteralDocument };
export type EditorialTextNodeV2 = EditorialTextSegmentV2 | { kind: "block"; id: string };
export type EditorialTextGroupV2 = {
  version: 2;
  subsection_id: string | null;
  source: { blocks: KdpSectionBlock[]; section_body?: { id: string; value: string | null };
    marker_body?: { id: string; value: string; visibility: string; layout: string } };
  nodes: EditorialTextNodeV2[];
};
export type EditorialSectionTextV2 = { version: 2; groups: Record<string, EditorialTextGroupV2> };
export type EditorialTextGroupRead = { format: "v1" | "v2"; group: EditorialTextGroupV2 };

const barriers = new Set(["image", "image_prompt", "internal_note", "page_break", "heading"]);
export const textGroupKey = (subsectionId: string | null) => subsectionId ?? "opening";
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export const sameEditorialJson = (left: unknown, right: unknown) => canonicalJson(left) === canonicalJson(right);

export function literalParagraph(value: string, sourceId: string | null = null, field: "title" | "body" | null = null,
  visibility = "print", layout = "default"): LiteralParagraph {
  const content: LiteralInline[] = [];
  // Keep every original terminator, including mixed CR/LF, trailing and blank lines.
  for (const part of value.split(/(\r\n|\r|\n)/)) {
    if (/^(\r\n|\r|\n)$/.test(part)) content.push({ type: "hardBreak", attrs: { ending: part as "\n" | "\r\n" | "\r" } });
    else if (part) content.push({ type: "text", text: part, ...(field === "title" ? { marks: [{ type: "bold" as const }] } : {}) });
  }
  return { type: "paragraph", attrs: { sourceId, field, visibility, layout }, ...(content.length ? { content } : {}) };
}

export function paragraphLiteralText(paragraph: LiteralParagraph) {
  return (paragraph.content ?? []).map(node => node.type === "text" ? node.text : node.attrs.ending).join("");
}
export function documentLiteralText(doc: LiteralDocument) { return doc.content.map(paragraphLiteralText).join("\n\n"); }

export function parseLiteralDocument(value: unknown): LiteralDocument {
  const fail = () => { throw new Error("Documento V2 non valido."); };
  if (!record(value) || value.type !== "doc" || !Array.isArray(value.content) || Object.keys(value).some(k => !["type", "content"].includes(k))) return fail();
  for (const p of value.content) {
    if (!record(p) || p.type !== "paragraph" || Object.keys(p).some(k => !["type", "attrs", "content"].includes(k)) || !record(p.attrs) ||
      Object.keys(p.attrs).sort().join(",") !== "field,layout,sourceId,visibility" ||
      !(p.attrs.sourceId === null || typeof p.attrs.sourceId === "string") || ![null, "title", "body"].includes(p.attrs.field as null) ||
      !["print", "hidden", "internal_only"].includes(String(p.attrs.visibility)) || typeof p.attrs.layout !== "string" ||
      (p.content !== undefined && !Array.isArray(p.content))) return fail();
    for (const node of (p.content ?? []) as unknown[]) {
      if (!record(node)) return fail();
      if (node.type === "text") {
        if (typeof node.text !== "string" || !node.text.length || /[\r\n]/.test(node.text) ||
          Object.keys(node).some(k => !["type", "text", "marks"].includes(k)) ||
          (node.marks !== undefined && (!Array.isArray(node.marks) || node.marks.length !== 1 || !sameEditorialJson(node.marks, [{ type: "bold" }])))) return fail();
      } else if (node.type === "hardBreak") {
        if (!record(node.attrs) || !["\n", "\r\n", "\r"].includes(String(node.attrs.ending)) ||
          Object.keys(node).sort().join(",") !== "attrs,type" || Object.keys(node.attrs).join(",") !== "ending") return fail();
      } else return fail();
    }
  }
  return structuredClone(value) as LiteralDocument;
}

export function convertEditorialGroupV2(sectionId: string, subsectionId: string | null, blocks: KdpSectionBlock[], sectionBody: string | null = null,
  markerBody?: EditorialTextGroupV2["source"]["marker_body"]): EditorialTextGroupV2 {
  const source = { blocks: structuredClone(blocks), ...(subsectionId === null ? { section_body: { id: sectionId, value: sectionBody } } : {}),
    ...(markerBody ? { marker_body: structuredClone(markerBody) } : {}) };
  const nodes: EditorialTextNodeV2[] = [];
  let segment: EditorialTextSegmentV2;
  const start = (anchor: string) => {
    segment = { kind: "text", id: `segment:${textGroupKey(subsectionId)}:${anchor}`, source_ids: [], doc: { type: "doc", content: [] } };
    nodes.push(segment);
  };
  start("start");
  if (subsectionId === null && sectionBody !== null) segment!.doc.content.push(literalParagraph(sectionBody, sectionId, "body"));
  if (markerBody) segment!.doc.content.push(literalParagraph(markerBody.value, markerBody.id, "body", markerBody.visibility, markerBody.layout));
  for (const block of blocks) {
    if (barriers.has(block.block_type)) {
      nodes.push({ kind: "block", id: block.id }); start(block.id);
    } else {
      segment!.source_ids.push(block.id);
      for (const field of ["title", "body"] as const) {
        const value = block[field];
        if (value !== null) segment!.doc.content.push(literalParagraph(value, block.id, field, block.print_visibility, block.layout_preset));
      }
    }
  }
  return { version: 2, subsection_id: subsectionId, source, nodes };
}

function immutableEnvelope(group: EditorialTextGroupV2) {
  return { ...group, nodes: group.nodes.map(node => node.kind === "text" ? { ...node, doc: null } : node) };
}
export function parseEditorialGroupV2(value: unknown, expected: EditorialTextGroupV2): EditorialTextGroupV2 {
  if (!record(value) || value.version !== 2 || !Array.isArray(value.nodes)) throw new Error("Gruppo V2 non valido.");
  const group = value as EditorialTextGroupV2;
  if (group.nodes.some(node => !record(node) || !["text", "block"].includes(node.kind)) ||
    !sameEditorialJson(immutableEnvelope(group), immutableEnvelope(expected))) throw new Error("I confini o la sorgente V2 sono cambiati.");
  for (const node of group.nodes) if (node.kind === "text") parseLiteralDocument(node.doc);
  return structuredClone(group);
}

export function readEditorialSectionText(section: KdpSection, blocks: KdpSectionBlock[]) {
  const ordered = orderEditorialBlocks(blocks);
  const hierarchy = buildEditorialBlockHierarchy(ordered, readEditorialMap(section.settings, ordered));
  const stored = (section.settings as Record<string, unknown> | null)?.[EDITORIAL_TEXT_V2_KEY];
  if (stored !== undefined && (!record(stored) || stored.version !== 2 || !record(stored.groups) || Object.keys(stored).sort().join(",") !== "groups,version")) {
    throw new Error("Formato V2 sconosciuto: contenuti conservati, lettura interrotta.");
  }
  const groups = (stored as EditorialSectionTextV2 | undefined)?.groups;
  const keys = ["opening", ...hierarchy.subsections.map(s => s.marker.id)];
  if (groups && Object.keys(groups).some(key => !keys.includes(key))) throw new Error("La struttura V2 non corrisponde alle sottosezioni.");
  function read(subsectionId: string | null, rows: KdpSectionBlock[], marker?: KdpSectionBlock): EditorialTextGroupRead {
    const baseline = convertEditorialGroupV2(section.id, subsectionId, rows, section.body, marker?.body !== null && marker?.body !== undefined
      ? { id: marker.id, value: marker.body, visibility: marker.print_visibility, layout: marker.layout_preset } : undefined);
    const value = groups?.[textGroupKey(subsectionId)];
    return value === undefined ? { format: "v1", group: baseline } : { format: "v2", group: parseEditorialGroupV2(value, baseline) };
  }
  return { opening: read(null, hierarchy.openingBlocks), subsections: hierarchy.subsections.map(sub => ({ ...sub, text: read(sub.marker.id, sub.blocks, sub.marker) })) };
}

export function convertEditorialSectionV2(section: KdpSection, blocks: KdpSectionBlock[]): EditorialSectionTextV2 {
  const read = readEditorialSectionText(section, blocks);
  if (read.opening.format === "v2" || read.subsections.some(s => s.text.format === "v2")) throw new Error("Conversione già presente: preservare le modifiche V2.");
  return { version: 2, groups: Object.fromEntries([read.opening, ...read.subsections.map(s => s.text)].map(item => [textGroupKey(item.group.subsection_id), item.group])) };
}

// Reversing the conversion is exact. Reversing subsequent edits is deliberately
// rejected: arbitrary joins/deletions cannot be mapped back to the old fields.
export function restoreEditorialGroupV1(group: EditorialTextGroupV2) {
  const body = group.source.section_body;
  const original = convertEditorialGroupV2(body?.id ?? "", group.subsection_id, group.source.blocks, body?.value ?? null, group.source.marker_body);
  if (!sameEditorialJson(group, original)) throw new Error("Il documento è stato modificato: esportare la bozza V2 prima di ripristinare V1.");
  for (const node of group.nodes) if (node.kind === "text") {
    for (const p of node.doc.content) {
      const raw = p.attrs.sourceId === body?.id ? body.value : p.attrs.sourceId === group.source.marker_body?.id ? group.source.marker_body.value
        : group.source.blocks.find(b => b.id === p.attrs.sourceId)?.[p.attrs.field ?? "body"];
      if (paragraphLiteralText(p) !== raw) throw new Error("Confronto letterale V2/V1 fallito.");
    }
  }
  return structuredClone(group.source);
}

// Projection for legacy preview/PDF consumers. Only converted groups replace
// their archived rows; structural UUIDs and image records are passed through.
export function editorialSectionTextProjection(section: KdpSection, blocks: KdpSectionBlock[]) {
  const read = readEditorialSectionText(section, blocks);
  const result: (KdpSectionBlock & { editorial_text_v2?: boolean })[] = [];
  function append(item: EditorialTextGroupRead) {
    if (item.format === "v1") { result.push(...item.group.source.blocks); return; }
    const byId = new Map(item.group.source.blocks.map(b => [b.id, b]));
    for (const node of item.group.nodes) {
      if (node.kind === "block") { result.push(byId.get(node.id)!); continue; }
      for (const [index, p] of node.doc.content.entries()) {
        const original = byId.get(p.attrs.sourceId ?? "");
        result.push({ ...(original ?? blocks[0] ?? {}), id: `v2:${node.id}:${index}`, book_id: section.book_id, section_id: section.id,
          block_type: "text", title: null, body: paragraphLiteralText(p), print_visibility: p.attrs.visibility, editorial_text_v2: true,
          layout_preset: p.attrs.layout, asset_id: null, editor_notes: null, sort_order: result.length + 1,
          created_at: original?.created_at ?? section.created_at, updated_at: original?.updated_at ?? section.updated_at,
          created_by_email: null, created_by_user_id: null, updated_by_email: null, updated_by_user_id: null });
      }
    }
  }
  append(read.opening);
  for (const sub of read.subsections) { result.push(sub.text.format === "v2" ? { ...sub.marker, body: null } : sub.marker); append(sub.text); }
  return { body: read.opening.format === "v2" ? null : section.body, blocks: result, converted: read.opening.format === "v2" || read.subsections.some(s => s.text.format === "v2") };
}
