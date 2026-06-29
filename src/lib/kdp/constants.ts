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
  "crystal_card",
  "journal_page",
  "affirmation",
  "notes",
  "conclusion",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  title_page: "Pagina titolo",
  disclaimer: "Disclaimer",
  introduction: "Introduzione",
  chapter: "Capitolo",
  crystal_card: "Scheda cristallo",
  journal_page: "Pagina diario",
  affirmation: "Affermazione",
  notes: "Note",
  conclusion: "Conclusione",
};

export const SECTION_TYPE_OPTIONS = SECTION_TYPES.map((value) => ({
  value,
  label: SECTION_TYPE_LABELS[value],
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
