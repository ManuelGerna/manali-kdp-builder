import type { KdpAsset } from "@/lib/kdp/assets";
import type { KdpBook, KdpBookSettings } from "@/lib/kdp/books";
import {
  BLOCK_TYPE_LABELS,
  SECTION_LAYOUT_PRESET_LABELS,
  SECTION_TYPE_LABELS,
  type BlockType,
  type SectionLayoutPreset,
  type SectionType,
} from "@/lib/kdp/constants";
import type { KdpSectionBlock } from "@/lib/kdp/section-blocks";
import type { KdpSection } from "@/lib/kdp/sections";

type BuildBookPreviewInput = {
  assets: KdpAsset[];
  blocks: KdpSectionBlock[];
  book: KdpBook;
  sections: KdpSection[];
  settings: KdpBookSettings | null;
};

export type PreviewTocItem = {
  id: string;
  index: number;
  layoutPresetLabel: string;
  sectionTypeLabel: string;
  subtitle: string | null;
  title: string;
};

export type PreviewBlock = {
  assetAltText: string | null;
  assetPrompt: string | null;
  assetTitle: string | null;
  blockType: string;
  blockTypeLabel: string;
  body: string | null;
  id: string;
  isImagePlaceholder: boolean;
  isPageBreak: boolean;
  sortOrder: number;
  title: string | null;
};

export type PreviewSection = {
  blocks: PreviewBlock[];
  body: string | null;
  id: string;
  index: number;
  layoutPresetLabel: string;
  pageBreakBefore: boolean;
  sectionTypeLabel: string;
  subtitle: string | null;
  title: string;
};

export type BookPreview = {
  book: KdpBook;
  sections: PreviewSection[];
  settings: KdpBookSettings | null;
  toc: PreviewTocItem[];
};

const VISIBLE_BLOCK_TYPES = new Set([
  "text",
  "heading",
  "image",
  "image_prompt",
  "page_break",
  "quote",
  "affirmation",
  "benefits",
  "chakra",
  "ritual",
  "number_list",
  "color_meaning",
  "cta",
]);

function formatSectionType(sectionType: string) {
  return (
    SECTION_TYPE_LABELS[sectionType as SectionType] ??
    sectionType.replaceAll("_", " ")
  );
}

function formatLayoutPreset(layoutPreset: string) {
  return (
    SECTION_LAYOUT_PRESET_LABELS[layoutPreset as SectionLayoutPreset] ??
    layoutPreset.replaceAll("_", " ")
  );
}

function formatBlockType(blockType: string) {
  return (
    BLOCK_TYPE_LABELS[blockType as BlockType] ?? blockType.replaceAll("_", " ")
  );
}

function getSectionTitle(section: KdpSection) {
  return section.title || "Senza titolo";
}

function isVisiblePreviewBlock(block: KdpSectionBlock) {
  if (block.print_visibility !== "print") {
    return false;
  }

  if (block.block_type === "internal_note") {
    return false;
  }

  return VISIBLE_BLOCK_TYPES.has(block.block_type);
}

function groupBlocksBySection(blocks: KdpSectionBlock[]) {
  const grouped = new Map<string, KdpSectionBlock[]>();

  for (const block of blocks) {
    const sectionBlocks = grouped.get(block.section_id) ?? [];
    sectionBlocks.push(block);
    grouped.set(block.section_id, sectionBlocks);
  }

  for (const sectionBlocks of grouped.values()) {
    sectionBlocks.sort((first, second) => {
      if (first.sort_order !== second.sort_order) {
        return first.sort_order - second.sort_order;
      }

      return first.created_at.localeCompare(second.created_at);
    });
  }

  return grouped;
}

function toPreviewBlock(
  block: KdpSectionBlock,
  assetById: Map<string, KdpAsset>,
): PreviewBlock {
  const asset = block.asset_id ? assetById.get(block.asset_id) : undefined;

  return {
    assetAltText: asset?.alt_text ?? null,
    assetPrompt: asset?.prompt ?? null,
    assetTitle: asset?.title ?? null,
    blockType: block.block_type,
    blockTypeLabel: formatBlockType(block.block_type),
    body: block.body,
    id: block.id,
    isImagePlaceholder:
      block.block_type === "image_prompt" ||
      Boolean(asset && asset.status === "placeholder"),
    isPageBreak: block.block_type === "page_break",
    sortOrder: block.sort_order,
    title: block.title,
  };
}

export function buildBookPreview({
  assets,
  blocks,
  book,
  sections,
  settings,
}: BuildBookPreviewInput): BookPreview {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const blocksBySection = groupBlocksBySection(blocks);
  const orderedSections = [...sections].sort((first, second) => {
    if (first.sort_order !== second.sort_order) {
      return first.sort_order - second.sort_order;
    }

    return first.created_at.localeCompare(second.created_at);
  });
  const toc = orderedSections
    .filter((section) => section.include_in_toc === true)
    .map((section, index) => ({
      id: section.id,
      index: index + 1,
      layoutPresetLabel: formatLayoutPreset(section.layout_preset),
      sectionTypeLabel: formatSectionType(section.section_type),
      subtitle: section.subtitle,
      title: getSectionTitle(section),
    }));
  const previewSections = orderedSections.map((section, index) => ({
    blocks: (blocksBySection.get(section.id) ?? [])
      .filter(isVisiblePreviewBlock)
      .map((block) => toPreviewBlock(block, assetById)),
    body: section.body,
    id: section.id,
    index: index + 1,
    layoutPresetLabel: formatLayoutPreset(section.layout_preset),
    pageBreakBefore: section.page_break_before,
    sectionTypeLabel: formatSectionType(section.section_type),
    subtitle: section.subtitle,
    title: getSectionTitle(section),
  }));

  return {
    book,
    sections: previewSections,
    settings,
    toc,
  };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatPreviewBlockAsText(block: PreviewBlock) {
  if (block.isPageBreak) {
    return "";
  }

  if (block.isImagePlaceholder) {
    const prompt = block.body || block.assetPrompt || block.assetAltText || "";

    return prompt ? `[Immagine placeholder]\n${prompt}` : "[Immagine placeholder]";
  }

  return [block.title, block.body].filter(Boolean).join("\n");
}

export function getBookPreviewTextFileName(title: string) {
  const slug = slugify(title);

  return slug ? `${slug}-anteprima.txt` : "anteprima-libretto.txt";
}

export function formatBookPreviewAsText(preview: BookPreview) {
  const tocLines =
    preview.toc.length > 0
      ? preview.toc.map((item) =>
          [
            `${item.index}. ${item.title}`,
            item.subtitle ? `   ${item.subtitle}` : null,
            `   ${item.sectionTypeLabel} - ${item.layoutPresetLabel}`,
          ]
            .filter(Boolean)
            .join("\n"),
        )
      : ["Nessuna sezione marcata per l'indice."];
  const sectionLines = preview.sections.flatMap((section) => {
    const blockLines = section.blocks
      .map(formatPreviewBlockAsText)
      .filter(Boolean);

    return [
      `${section.index}. ${section.title}`,
      section.subtitle ?? null,
      section.body ?? null,
      ...blockLines,
    ].filter(Boolean) as string[];
  });

  return [
    preview.book.title,
    preview.book.subtitle ?? null,
    "",
    "INDICE",
    ...tocLines,
    "",
    "CONTENUTO",
    ...sectionLines,
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
