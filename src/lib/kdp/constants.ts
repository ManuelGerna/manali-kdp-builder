export const BOOK_STATUSES = [
  "draft",
  "in_review",
  "ready_for_export",
  "exported",
  "uploaded_to_kdp",
  "published",
  "archived",
] as const;

export type BookStatus = (typeof BOOK_STATUSES)[number];

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  draft: "Bozza",
  in_review: "In revisione",
  ready_for_export: "Pronto export",
  exported: "Esportato",
  uploaded_to_kdp: "Caricato KDP",
  published: "Pubblicato",
  archived: "Archiviato",
};

export const BOOK_STATUS_OPTIONS = BOOK_STATUSES.map((value) => ({
  value,
  label: BOOK_STATUS_LABELS[value],
}));

export const AI_USAGE_TYPES = [
  "none",
  "ai_assisted",
  "ai_generated",
  "mixed",
] as const;

export type AiUsageType = (typeof AI_USAGE_TYPES)[number];

export const AI_USAGE_LABELS: Record<AiUsageType, string> = {
  none: "Nessun uso AI",
  ai_assisted: "AI assistita",
  ai_generated: "AI generata",
  mixed: "Misto",
};

export const AI_USAGE_OPTIONS = AI_USAGE_TYPES.map((value) => ({
  value,
  label: AI_USAGE_LABELS[value],
}));

export const BOOK_TYPE_OPTIONS = [
  {
    value: "crystal_guide_journal",
    label: "Crystal guide journal",
  },
] as const;

export const LANGUAGE_OPTIONS = [
  {
    value: "it",
    label: "Italiano",
  },
  {
    value: "en",
    label: "English",
  },
] as const;

export const SECTION_TYPES = [
  "title_page",
  "disclaimer",
  "introduction",
  "chapter",
  "chapter_text",
  "crystal_card",
  "journal_page",
  "journaling_page",
  "affirmation",
  "affirmation_page",
  "notes",
  "notes_page",
  "conclusion",
  "summary_table",
  "blank_page",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  title_page: "Pagina titolo",
  disclaimer: "Disclaimer",
  introduction: "Introduzione",
  chapter: "Capitolo",
  chapter_text: "Testo capitolo",
  crystal_card: "Scheda cristallo",
  journal_page: "Pagina diario",
  journaling_page: "Pagina journaling",
  affirmation: "Affermazione",
  affirmation_page: "Pagina affermazione",
  notes: "Note",
  notes_page: "Pagina note",
  conclusion: "Conclusione",
  summary_table: "Tabella riepilogo",
  blank_page: "Pagina bianca",
};

export const SECTION_TYPE_OPTIONS = SECTION_TYPES.map((value) => ({
  value,
  label: SECTION_TYPE_LABELS[value],
}));

export const SECTION_STATUSES = [
  "draft",
  "needs_review",
  "ready",
  "archived",
] as const;

export type SectionStatus = (typeof SECTION_STATUSES)[number];

export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  draft: "Bozza",
  needs_review: "Da revisionare",
  ready: "Pronta",
  archived: "Archiviata",
};

export const SECTION_STATUS_OPTIONS = SECTION_STATUSES.map((value) => ({
  value,
  label: SECTION_STATUS_LABELS[value],
}));

export const SECTION_LAYOUT_PRESETS = [
  "default",
  "title_page",
  "chapter_opening",
  "image_text",
  "crystal_profile",
  "journal",
  "ritual",
  "list",
] as const;

export type SectionLayoutPreset = (typeof SECTION_LAYOUT_PRESETS)[number];

export const SECTION_LAYOUT_PRESET_LABELS: Record<
  SectionLayoutPreset,
  string
> = {
  default: "Default",
  title_page: "Pagina titolo",
  chapter_opening: "Apertura capitolo",
  image_text: "Immagine e testo",
  crystal_profile: "Profilo cristallo",
  journal: "Journal",
  ritual: "Rituale",
  list: "Lista",
};

export const SECTION_LAYOUT_PRESET_OPTIONS = SECTION_LAYOUT_PRESETS.map(
  (value) => ({
    value,
    label: SECTION_LAYOUT_PRESET_LABELS[value],
  }),
);

export const BLOCK_TYPES = [
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
  "internal_note",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  text: "Testo",
  heading: "Titolo",
  image: "Immagine",
  image_prompt: "Prompt immagine",
  page_break: "Interruzione pagina",
  quote: "Citazione",
  affirmation: "Affermazione",
  benefits: "Benefici",
  chakra: "Chakra",
  ritual: "Rituale",
  number_list: "Lista numeri",
  color_meaning: "Significato colori",
  cta: "CTA",
  internal_note: "Nota interna",
};

export const BLOCK_TYPE_OPTIONS = BLOCK_TYPES.map((value) => ({
  value,
  label: BLOCK_TYPE_LABELS[value],
}));

export const BLOCK_LAYOUT_PRESETS = SECTION_LAYOUT_PRESETS;

export type BlockLayoutPreset = (typeof BLOCK_LAYOUT_PRESETS)[number];

export const BLOCK_LAYOUT_PRESET_LABELS = SECTION_LAYOUT_PRESET_LABELS;

export const BLOCK_LAYOUT_PRESET_OPTIONS = BLOCK_LAYOUT_PRESETS.map(
  (value) => ({
    value,
    label: BLOCK_LAYOUT_PRESET_LABELS[value],
  }),
);

export const IMAGE_PDF_LAYOUT_PRESETS = [
  "image_text",
  "title_page",
  "journal",
  "crystal_profile",
] as const;

export type ImagePdfLayoutPreset = (typeof IMAGE_PDF_LAYOUT_PRESETS)[number];

export const IMAGE_PDF_LAYOUT_PRESET_LABELS: Record<
  ImagePdfLayoutPreset,
  string
> = {
  crystal_profile: "Piccola",
  image_text: "Larga - consigliata",
  journal: "Media",
  title_page: "Pagina immagine",
};

export const IMAGE_PDF_LAYOUT_OPTIONS = IMAGE_PDF_LAYOUT_PRESETS.map(
  (value) => ({
    value,
    label: IMAGE_PDF_LAYOUT_PRESET_LABELS[value],
  }),
);

export const PRINT_VISIBILITIES = [
  "print",
  "internal_only",
  "hidden",
] as const;

export type PrintVisibility = (typeof PRINT_VISIBILITIES)[number];

export const PRINT_VISIBILITY_LABELS: Record<PrintVisibility, string> = {
  print: "Stampabile",
  internal_only: "Solo interno",
  hidden: "Nascosto",
};

export const PRINT_VISIBILITY_OPTIONS = PRINT_VISIBILITIES.map((value) => ({
  value,
  label: PRINT_VISIBILITY_LABELS[value],
}));

export const ASSET_TYPES = [
  "image",
  "cover_image",
  "icon",
  "background",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  image: "Immagine",
  cover_image: "Copertina",
  icon: "Icona",
  background: "Sfondo",
};

export const ASSET_TYPE_OPTIONS = ASSET_TYPES.map((value) => ({
  value,
  label: ASSET_TYPE_LABELS[value],
}));

export const ASSET_STATUSES = [
  "placeholder",
  "uploaded",
  "generated_future",
  "approved",
  "rejected",
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  placeholder: "Placeholder",
  uploaded: "Caricata",
  generated_future: "Generazione futura",
  approved: "Approvata",
  rejected: "Scartata",
};

export const ASSET_STATUS_OPTIONS = ASSET_STATUSES.map((value) => ({
  value,
  label: ASSET_STATUS_LABELS[value],
}));

export const EXPORT_TYPES = [
  "interior_pdf",
  "kdp_fields_txt",
  "validation_report_txt",
  "preview_images",
] as const;

export type ExportType = (typeof EXPORT_TYPES)[number];

export const VALIDATION_STATUSES = [
  "not_checked",
  "passed",
  "warning",
  "failed",
] as const;

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const TRIM_SIZES = ["6x9", "5x8", "8.5x11"] as const;

export type TrimSize = (typeof TRIM_SIZES)[number];

export const TRIM_SIZE_LABELS: Record<TrimSize, string> = {
  "6x9": "6 x 9 in",
  "5x8": "5 x 8 in",
  "8.5x11": "8.5 x 11 in",
};

export const TRIM_SIZE_OPTIONS = TRIM_SIZES.map((value) => ({
  value,
  label: TRIM_SIZE_LABELS[value],
}));

export const BLEED_OPTIONS = [
  {
    value: "false",
    label: "No bleed",
  },
  {
    value: "true",
    label: "Bleed",
  },
] as const;

export const INTERIOR_TYPES = [
  "black_and_white",
  "standard_color",
  "premium_color",
] as const;

export type InteriorType = (typeof INTERIOR_TYPES)[number];

export const INTERIOR_TYPE_LABELS: Record<InteriorType, string> = {
  black_and_white: "Bianco e nero",
  standard_color: "Colore standard",
  premium_color: "Colore premium",
};

export const INTERIOR_TYPE_OPTIONS = INTERIOR_TYPES.map((value) => ({
  value,
  label: INTERIOR_TYPE_LABELS[value],
}));

export const PAPER_TYPES = ["white", "cream"] as const;

export type PaperType = (typeof PAPER_TYPES)[number];

export const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  white: "Carta bianca",
  cream: "Carta crema",
};

export const PAPER_TYPE_OPTIONS = PAPER_TYPES.map((value) => ({
  value,
  label: PAPER_TYPE_LABELS[value],
}));

export const BODY_FONTS = ["Lora", "Georgia", "serif"] as const;

export type BodyFont = (typeof BODY_FONTS)[number];

export const BODY_FONT_OPTIONS = BODY_FONTS.map((value) => ({
  value,
  label: value,
}));

export const HEADING_FONTS = [
  "Cormorant Garamond",
  "Georgia",
  "sans",
] as const;

export type HeadingFont = (typeof HEADING_FONTS)[number];

export const HEADING_FONT_OPTIONS = HEADING_FONTS.map((value) => ({
  value,
  label: value,
}));

export const BODY_FONT_SIZES = [10, 11, 12, 13] as const;

export type BodyFontSize = (typeof BODY_FONT_SIZES)[number];

export const BODY_FONT_SIZE_OPTIONS = BODY_FONT_SIZES.map((value) => ({
  value,
  label: `${value} pt`,
}));

export const LINE_HEIGHTS = [1.35, 1.5, 1.65] as const;

export type LineHeight = (typeof LINE_HEIGHTS)[number];

export const LINE_HEIGHT_OPTIONS = LINE_HEIGHTS.map((value) => ({
  value,
  label: String(value),
}));

export const DEFAULT_BOOK_SETTINGS = {
  trimSize: "6x9",
  bleed: false,
  interiorType: "black_and_white",
  paperType: "white",
  bodyFont: "Lora",
  headingFont: "Cormorant Garamond",
  bodyFontSize: 11,
  lineHeight: 1.5,
  marginTop: 0.75,
  marginBottom: 0.75,
  marginInner: 0.75,
  marginOuter: 0.6,
  pageNumbering: true,
  headerEnabled: false,
  footerEnabled: true,
} as const;
