import type { KdpAsset } from "@/lib/kdp/assets";
import type { KdpBook, KdpBookSettings } from "@/lib/kdp/books";
import {
  BODY_FONT_SIZES,
  LINE_HEIGHTS,
  type BodyFontSize,
  type LineHeight,
} from "@/lib/kdp/constants";
import { buildBookPreview, type PreviewBlock } from "@/lib/kdp/preview";
import type { KdpSectionBlock } from "@/lib/kdp/section-blocks";
import type { KdpSection } from "@/lib/kdp/sections";

export const VALIDATION_CATEGORIES = [
  "dati_libro",
  "impostazioni_kdp",
  "contenuti",
  "indice",
  "immagini",
  "pdf_futuro",
] as const;

export type ValidationCategory = (typeof VALIDATION_CATEGORIES)[number];

export type ValidationStatus = "failed" | "passed" | "warning";

export type ValidationCheck = {
  action?: {
    href: string;
    label: string;
  };
  category: ValidationCategory;
  description: string;
  id: string;
  label: string;
  status: ValidationStatus;
};

export type ValidationSummary = {
  failed: number;
  finalMessage: "Non pronto" | "Pronto per il prossimo step" | "Quasi pronto";
  passed: number;
  warning: number;
};

export type ExportReadinessStatus =
  | "available_with_warnings"
  | "blocked"
  | "ready";

export type ExportReadiness = {
  description: string;
  label: string;
  status: ExportReadinessStatus;
};

export type PreExportValidationReport = {
  checks: ValidationCheck[];
  summary: ValidationSummary;
};

type BuildPreExportValidationInput = {
  assets: KdpAsset[];
  blocks: KdpSectionBlock[];
  book: KdpBook;
  sections: KdpSection[];
  settings: KdpBookSettings | null;
};

type ActionKind = "anteprima" | "contenuti" | "impostazioni";

export const VALIDATION_CATEGORY_LABELS: Record<ValidationCategory, string> = {
  dati_libro: "Dati libro",
  impostazioni_kdp: "Impostazioni KDP",
  contenuti: "Contenuti",
  indice: "Indice",
  immagini: "Immagini",
  pdf_futuro: "PDF futuro",
};

const SHORT_BOOK_WORD_THRESHOLD = 500;

function getAction(bookId: string, kind: ActionKind) {
  if (kind === "impostazioni") {
    return {
      href: `/libri/${bookId}/impostazioni`,
      label: "Modifica impostazioni",
    };
  }

  if (kind === "anteprima") {
    return {
      href: `/libri/${bookId}/anteprima`,
      label: "Vedi anteprima",
    };
  }

  return {
    href: `/libri/${bookId}/contenuti`,
    label: "Modifica contenuti",
  };
}

function check(input: ValidationCheck) {
  return input;
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function isAllowedBodyFontSize(value: number) {
  return BODY_FONT_SIZES.includes(value as BodyFontSize);
}

function isAllowedLineHeight(value: number) {
  return LINE_HEIGHTS.includes(value as LineHeight);
}

function hasMargins(settings: KdpBookSettings) {
  return [
    settings.margin_top,
    settings.margin_bottom,
    settings.margin_inner,
    settings.margin_outer,
  ].every((value) => Number.isFinite(value));
}

function countWords(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function getBlockText(block: PreviewBlock) {
  if (block.isPageBreak) {
    return "";
  }

  return [
    block.title,
    block.body,
    block.assetPrompt,
    block.assetAltText,
    block.assetTitle,
  ]
    .filter(Boolean)
    .join(" ");
}

function hasRenderableBlockContent(block: PreviewBlock) {
  return hasText(getBlockText(block));
}

function getInternalNotesCount(sections: KdpSection[], blocks: KdpSectionBlock[]) {
  const sectionNotes = sections.filter((section) =>
    hasText(section.editor_notes),
  ).length;
  const blockNotes = blocks.filter((block) => hasText(block.editor_notes))
    .length;
  const internalNoteBlocks = blocks.filter(
    (block) => block.block_type === "internal_note",
  ).length;

  return sectionNotes + blockNotes + internalNoteBlocks;
}

function summarize(checks: ValidationCheck[]): ValidationSummary {
  const failed = checks.filter((item) => item.status === "failed").length;
  const warning = checks.filter((item) => item.status === "warning").length;
  const passed = checks.filter((item) => item.status === "passed").length;
  const finalMessage =
    failed > 0
      ? "Non pronto"
      : warning > 0
        ? "Quasi pronto"
        : "Pronto per il prossimo step";

  return {
    failed,
    finalMessage,
    passed,
    warning,
  };
}

export function getExportReadiness(
  report: PreExportValidationReport,
): ExportReadiness {
  if (report.summary.failed > 0) {
    return {
      description: "Risolvi gli elementi da sistemare nella validazione.",
      label: "Bloccato",
      status: "blocked",
    };
  }

  if (report.summary.warning > 0) {
    return {
      description:
        "Sono presenti attenzioni. Controlla la validazione prima dell'export.",
      label: "Disponibile con avvisi",
      status: "available_with_warnings",
    };
  }

  return {
    description: "Il libretto e' pronto per il prossimo step PDF.",
    label: "Pronto",
    status: "ready",
  };
}

export function buildPreExportValidation({
  assets,
  blocks,
  book,
  sections,
  settings,
}: BuildPreExportValidationInput): PreExportValidationReport {
  const preview = buildBookPreview({
    assets,
    blocks,
    book,
    sections,
    settings,
  });
  const bookId = book.id;
  const tocSections = sections.filter((section) => section.include_in_toc);
  const sectionsWithoutTitle = sections.filter(
    (section) => !hasText(section.title),
  );
  const sectionsWithoutContent = preview.sections.filter(
    (section) =>
      !hasText(section.body) && !section.blocks.some(hasRenderableBlockContent),
  );
  const sectionsWithPrintableContent = preview.sections.filter(
    (section) =>
      hasText(section.body) || section.blocks.some(hasRenderableBlockContent),
  );
  const needsReviewSections = sections.filter(
    (section) => section.section_status === "needs_review",
  );
  const internalNotesCount = getInternalNotesCount(sections, blocks);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const imagePromptBlocks = blocks.filter(
    (block) => block.block_type === "image_prompt",
  );
  const imagePromptBlocksWithoutReadyAsset = imagePromptBlocks.filter((block) => {
    const asset = block.asset_id ? assetById.get(block.asset_id) : null;

    return !asset || (asset.status !== "approved" && asset.status !== "uploaded");
  });
  const draftImageAssets = assets.filter(
    (asset) =>
      asset.status === "placeholder" || asset.status === "generated_future",
  );
  const internalNoteBlocks = blocks.filter(
    (block) => block.block_type === "internal_note",
  );
  const nonPrintableBlocks = blocks.filter(
    (block) =>
      block.print_visibility === "hidden" ||
      block.print_visibility === "internal_only",
  );
  const printableWordCount = preview.sections.reduce((total, section) => {
    const sectionWords = countWords(section.body ?? "");
    const blockWords = section.blocks.reduce(
      (blockTotal, block) => blockTotal + countWords(getBlockText(block)),
      0,
    );

    return total + sectionWords + blockWords;
  }, 0);
  const checks = [
    check({
      category: "dati_libro",
      description: hasText(book.title)
        ? "Il titolo e' presente."
        : "Aggiungi un titolo prima di preparare il PDF.",
      id: "book-title",
      label: "Titolo libro",
      status: hasText(book.title) ? "passed" : "failed",
    }),
    check({
      category: "dati_libro",
      description: hasText(book.author_name)
        ? "Il nome autore e' presente."
        : "Aggiungi autore o pen name.",
      id: "book-author",
      label: "Autore",
      status: hasText(book.author_name) ? "passed" : "failed",
    }),
    check({
      category: "dati_libro",
      description: hasText(book.language)
        ? "La lingua del libretto e' valorizzata."
        : "Seleziona la lingua del libretto.",
      id: "book-language",
      label: "Lingua",
      status: hasText(book.language) ? "passed" : "failed",
    }),
    check({
      category: "dati_libro",
      description: hasText(book.ai_usage_type)
        ? "La dichiarazione uso AI e' valorizzata."
        : "Imposta il valore uso AI per tenere chiaro il workflow KDP.",
      id: "book-ai-usage",
      label: "Uso AI",
      status: hasText(book.ai_usage_type) ? "passed" : "failed",
    }),
    check({
      action: getAction(bookId, "impostazioni"),
      category: "impostazioni_kdp",
      description: settings
        ? "Le impostazioni KDP del libretto sono presenti."
        : "Manca il record impostazioni KDP collegato al libretto.",
      id: "settings-present",
      label: "Settings presenti",
      status: settings ? "passed" : "failed",
    }),
    check({
      action: getAction(bookId, "impostazioni"),
      category: "impostazioni_kdp",
      description:
        settings && hasText(settings.trim_size)
          ? "Il trim size e' valorizzato."
          : "Scegli un formato pagina.",
      id: "settings-trim-size",
      label: "Trim size",
      status: settings && hasText(settings.trim_size) ? "passed" : "failed",
    }),
    check({
      action: getAction(bookId, "impostazioni"),
      category: "impostazioni_kdp",
      description:
        settings && hasText(settings.interior_type)
          ? "Il tipo interno e' valorizzato."
          : "Scegli il tipo interno.",
      id: "settings-interior-type",
      label: "Tipo interno",
      status:
        settings && hasText(settings.interior_type) ? "passed" : "failed",
    }),
    check({
      action: getAction(bookId, "impostazioni"),
      category: "impostazioni_kdp",
      description:
        settings && hasText(settings.paper_type)
          ? "Il tipo carta e' valorizzato."
          : "Scegli il tipo carta.",
      id: "settings-paper-type",
      label: "Carta",
      status: settings && hasText(settings.paper_type) ? "passed" : "failed",
    }),
    check({
      action: getAction(bookId, "impostazioni"),
      category: "impostazioni_kdp",
      description:
        settings && isAllowedBodyFontSize(settings.body_font_size)
          ? "La dimensione font corpo e' tra i valori ammessi."
          : "Scegli una dimensione font corpo guidata.",
      id: "settings-body-font-size",
      label: "Dimensione font corpo",
      status:
        settings && isAllowedBodyFontSize(settings.body_font_size)
          ? "passed"
          : "failed",
    }),
    check({
      action: getAction(bookId, "impostazioni"),
      category: "impostazioni_kdp",
      description:
        settings && isAllowedLineHeight(settings.line_height)
          ? "La line height e' tra i valori ammessi."
          : "Scegli una line height guidata.",
      id: "settings-line-height",
      label: "Line height",
      status:
        settings && isAllowedLineHeight(settings.line_height)
          ? "passed"
          : "failed",
    }),
    check({
      action: getAction(bookId, "impostazioni"),
      category: "impostazioni_kdp",
      description:
        settings && hasMargins(settings)
          ? "I margini principali sono valorizzati."
          : "Completa i margini del libretto.",
      id: "settings-margins",
      label: "Margini",
      status: settings && hasMargins(settings) ? "passed" : "failed",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "contenuti",
      description:
        sections.length > 0
          ? `Il libretto contiene ${sections.length} sezion${
              sections.length === 1 ? "e" : "i"
            }.`
          : "Aggiungi almeno una sezione.",
      id: "content-section-count",
      label: "Sezioni presenti",
      status: sections.length > 0 ? "passed" : "failed",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "contenuti",
      description:
        sections.length >= 3
          ? "Il libretto ha una struttura minima articolata."
          : "Aggiungi almeno tre sezioni per una struttura piu' completa.",
      id: "content-minimum-structure",
      label: "Struttura minima",
      status: sections.length >= 3 ? "passed" : "warning",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "contenuti",
      description:
        sectionsWithPrintableContent.length > 0
          ? "Almeno una sezione contiene contenuto stampabile."
          : "Aggiungi testo o blocchi stampabili ad almeno una sezione.",
      id: "content-printable-section",
      label: "Contenuto stampabile",
      status: sectionsWithPrintableContent.length > 0 ? "passed" : "failed",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "contenuti",
      description:
        sectionsWithoutTitle.length === 0
          ? "Tutte le sezioni hanno un titolo."
          : `${sectionsWithoutTitle.length} sezion${
              sectionsWithoutTitle.length === 1 ? "e" : "i"
            } senza titolo.`,
      id: "content-section-titles",
      label: "Titoli sezioni",
      status: sectionsWithoutTitle.length === 0 ? "passed" : "warning",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "contenuti",
      description:
        sectionsWithoutContent.length === 0
          ? "Le sezioni hanno testo o blocchi stampabili."
          : `${sectionsWithoutContent.length} sezion${
              sectionsWithoutContent.length === 1 ? "e" : "i"
            } senza testo e senza blocchi stampabili.`,
      id: "content-empty-sections",
      label: "Sezioni vuote",
      status: sectionsWithoutContent.length === 0 ? "passed" : "warning",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "contenuti",
      description:
        internalNotesCount > 3
          ? `${internalNotesCount} note interne ancora presenti. Verifica prima del PDF.`
          : "Le note interne sono sotto controllo.",
      id: "content-internal-notes",
      label: "Note interne",
      status: internalNotesCount > 3 ? "warning" : "passed",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "contenuti",
      description:
        needsReviewSections.length === 0
          ? "Nessuna sezione e' marcata da revisionare."
          : `${needsReviewSections.length} sezion${
              needsReviewSections.length === 1 ? "e" : "i"
            } ancora da revisionare.`,
      id: "content-needs-review",
      label: "Stato editoriale sezioni",
      status: needsReviewSections.length === 0 ? "passed" : "warning",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "indice",
      description:
        tocSections.length > 0
          ? `${tocSections.length} sezion${
              tocSections.length === 1 ? "e" : "i"
            } inclusa nell'indice.`
          : "Includi almeno una sezione nell'indice.",
      id: "toc-has-sections",
      label: "Indice automatico",
      status: tocSections.length > 0 ? "passed" : "failed",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "indice",
      description:
        sections.length > 0 && tocSections.length === 0
          ? "Tutte le sezioni sono escluse dall'indice."
          : "La selezione indice e' coerente.",
      id: "toc-not-all-excluded",
      label: "Sezioni in indice",
      status:
        sections.length > 0 && tocSections.length === 0 ? "warning" : "passed",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "immagini",
      description:
        imagePromptBlocksWithoutReadyAsset.length === 0
          ? "I prompt immagine non hanno blocchi scoperti da asset pronto."
          : `${imagePromptBlocksWithoutReadyAsset.length} prompt immagin${
              imagePromptBlocksWithoutReadyAsset.length === 1 ? "e" : "i"
            } senza asset approvato o caricato.`,
      id: "images-prompts-ready-assets",
      label: "Prompt immagine",
      status:
        imagePromptBlocksWithoutReadyAsset.length === 0 ? "passed" : "warning",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "immagini",
      description:
        draftImageAssets.length === 0
          ? "Nessun asset immagine in stato provvisorio."
          : `${draftImageAssets.length} asset ancora placeholder o generazione futura.`,
      id: "images-draft-assets",
      label: "Asset provvisori",
      status: draftImageAssets.length === 0 ? "passed" : "warning",
    }),
    check({
      action: getAction(bookId, "contenuti"),
      category: "pdf_futuro",
      description:
        internalNoteBlocks.length === 0
          ? "Nessun blocco nota interna tra i contenuti."
          : `${internalNoteBlocks.length} blocch${
              internalNoteBlocks.length === 1 ? "o" : "i"
            } nota interna non destinati alla stampa.`,
      id: "future-pdf-internal-note-blocks",
      label: "Blocchi nota interna",
      status: internalNoteBlocks.length === 0 ? "passed" : "warning",
    }),
    check({
      action: getAction(bookId, "anteprima"),
      category: "pdf_futuro",
      description:
        nonPrintableBlocks.length === 0
          ? "Nessun blocco nascosto o solo interno."
          : `${nonPrintableBlocks.length} blocch${
              nonPrintableBlocks.length === 1 ? "o" : "i"
            } non saranno stampati.`,
      id: "future-pdf-non-printable-blocks",
      label: "Blocchi non stampabili",
      status: nonPrintableBlocks.length === 0 ? "passed" : "warning",
    }),
    check({
      action: getAction(bookId, "anteprima"),
      category: "pdf_futuro",
      description:
        printableWordCount >= SHORT_BOOK_WORD_THRESHOLD
          ? `Contenuto stimato: ${printableWordCount} parole.`
          : `Contenuto stimato: ${printableWordCount} parole. Potrebbe essere troppo corto per un libretto.`,
      id: "future-pdf-content-length",
      label: "Lunghezza contenuto",
      status:
        printableWordCount >= SHORT_BOOK_WORD_THRESHOLD ? "passed" : "warning",
    }),
  ];

  return {
    checks,
    summary: summarize(checks),
  };
}
