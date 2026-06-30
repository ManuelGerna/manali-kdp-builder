import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { KdpAsset } from "@/lib/kdp/assets";
import type { KdpBook, KdpBookSettings } from "@/lib/kdp/books";
import {
  buildBookPreview,
  type PreviewBlock,
  type PreviewSection,
} from "@/lib/kdp/preview";
import type { KdpSectionBlock } from "@/lib/kdp/section-blocks";
import type { KdpSection } from "@/lib/kdp/sections";

type GenerateTechnicalPdfInput = {
  assets: KdpAsset[];
  blocks: KdpSectionBlock[];
  book: KdpBook;
  sections: KdpSection[];
  settings: KdpBookSettings;
  technicalNotice?: TechnicalPdfNotice;
};

type TechnicalPdfNotice = {
  generatedAt: string;
  readinessLabel: string;
  readinessStatus: string;
};

type PageSize = {
  height: number;
  width: number;
};

type PdfFonts = {
  body: PDFFont;
  bodyBold: PDFFont;
  bodyItalic: PDFFont;
  heading: PDFFont;
  headingBold: PDFFont;
};

type LayoutState = {
  bodyFontSize: number;
  contentWidth: number;
  doc: PDFDocument;
  fonts: PdfFonts;
  lineHeight: number;
  marginBottom: number;
  marginInner: number;
  marginOuter: number;
  marginTop: number;
  page: PDFPage;
  pageHeight: number;
  pageIndex: number;
  pageWidth: number;
  x: number;
  y: number;
};

const POINTS_PER_INCH = 72;
const MIN_CONTENT_WIDTH = 144;
const TECHNICAL_PDF_VERSION = "PDF tecnico V1";

const PAGE_SIZES: Record<string, PageSize> = {
  "5x8": {
    height: 8 * POINTS_PER_INCH,
    width: 5 * POINTS_PER_INCH,
  },
  "6x9": {
    height: 9 * POINTS_PER_INCH,
    width: 6 * POINTS_PER_INCH,
  },
  "8.5x11": {
    height: 11 * POINTS_PER_INCH,
    width: 8.5 * POINTS_PER_INCH,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toPoints(value: number | null | undefined, fallback: number) {
  const inches = Number.isFinite(value) ? Number(value) : fallback;

  return clamp(inches, 0.25, 1.5) * POINTS_PER_INCH;
}

function getPageSize(trimSize: string) {
  return PAGE_SIZES[trimSize] ?? PAGE_SIZES["6x9"];
}

function sanitizePdfText(value: string) {
  return value
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff]/g, "");
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

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let current = "";

  for (const character of word) {
    const candidate = `${current}${character}`;

    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function wrapLine(value: string, font: PDFFont, size: number, maxWidth: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      const splitLines = splitLongWord(word, font, size, maxWidth);
      const lastLine = splitLines.pop();

      lines.push(...splitLines);
      current = lastLine ?? "";
    } else {
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const cleanValue = sanitizePdfText(value);
  const paragraphs = cleanValue.replace(/\r\n/g, "\n").split("\n");

  return paragraphs.flatMap((paragraph) => {
    if (!paragraph.trim()) {
      return [""];
    }

    return wrapLine(paragraph, font, size, maxWidth);
  });
}

function resolveHorizontalMargins(state: Pick<LayoutState, "marginInner" | "marginOuter" | "pageIndex">) {
  const isOddPage = state.pageIndex % 2 === 1;

  return {
    left: isOddPage ? state.marginInner : state.marginOuter,
    right: isOddPage ? state.marginOuter : state.marginInner,
  };
}

function applyPageMargins(state: LayoutState) {
  const { left, right } = resolveHorizontalMargins(state);
  const usableWidth = state.pageWidth - left - right;

  if (usableWidth >= MIN_CONTENT_WIDTH) {
    state.x = left;
    state.contentWidth = usableWidth;
    return;
  }

  const fallbackMargin = Math.max(24, (state.pageWidth - MIN_CONTENT_WIDTH) / 2);
  state.x = fallbackMargin;
  state.contentWidth = state.pageWidth - fallbackMargin * 2;
}

function addPage(state: LayoutState) {
  state.page = state.doc.addPage([state.pageWidth, state.pageHeight]);
  state.pageIndex += 1;
  applyPageMargins(state);
  state.y = state.pageHeight - state.marginTop;
}

function isAtPageTop(state: LayoutState) {
  return Math.abs(state.y - (state.pageHeight - state.marginTop)) < 1;
}

function ensureSpace(state: LayoutState, height: number) {
  if (state.y - height < state.marginBottom) {
    addPage(state);
  }
}

function drawTextLine(
  state: LayoutState,
  line: string,
  options?: {
    color?: ReturnType<typeof rgb>;
    font?: PDFFont;
    lineHeight?: number;
    size?: number;
    x?: number;
  },
) {
  const font = options?.font ?? state.fonts.body;
  const size = options?.size ?? state.bodyFontSize;
  const lineHeight = options?.lineHeight ?? state.lineHeight;
  const x = options?.x ?? state.x;

  ensureSpace(state, lineHeight);

  if (line) {
    state.page.drawText(sanitizePdfText(line), {
      color: options?.color ?? rgb(0.12, 0.12, 0.12),
      font,
      size,
      x,
      y: state.y,
    });
  }

  state.y -= lineHeight;
}

function drawParagraph(
  state: LayoutState,
  value: string,
  options?: {
    color?: ReturnType<typeof rgb>;
    font?: PDFFont;
    maxWidth?: number;
    paragraphSpacing?: number;
    size?: number;
    x?: number;
  },
) {
  const font = options?.font ?? state.fonts.body;
  const size = options?.size ?? state.bodyFontSize;
  const maxWidth = options?.maxWidth ?? state.contentWidth;
  const lineHeight = size * (state.lineHeight / state.bodyFontSize);
  const lines = wrapText(value, font, size, maxWidth);

  for (const line of lines) {
    drawTextLine(state, line, {
      color: options?.color,
      font,
      lineHeight,
      size,
      x: options?.x,
    });
  }

  state.y -= options?.paragraphSpacing ?? lineHeight * 0.45;
}

function drawCenteredParagraph(
  state: LayoutState,
  value: string,
  options: {
    font: PDFFont;
    maxWidth: number;
    paragraphSpacing?: number;
    size: number;
  },
) {
  const lines = wrapText(value, options.font, options.size, options.maxWidth);
  const lineHeight = options.size * 1.25;

  for (const line of lines) {
    ensureSpace(state, lineHeight);

    const lineWidth = options.font.widthOfTextAtSize(line, options.size);
    state.page.drawText(sanitizePdfText(line), {
      color: rgb(0.1, 0.1, 0.1),
      font: options.font,
      size: options.size,
      x: (state.pageWidth - lineWidth) / 2,
      y: state.y,
    });
    state.y -= lineHeight;
  }

  state.y -= options.paragraphSpacing ?? lineHeight * 0.5;
}

function drawTechnicalTestNotice(
  state: LayoutState,
  notice: TechnicalPdfNotice,
) {
  const padding = 12;
  const titleSize = 11;
  const bodySize = 9;
  const bodyLineHeight = 12;
  const bodyLines = [
    "Non pronto per Amazon KDP.",
    "Usare solo per controllo interno di contenuti, margini e layout.",
    `Stato validazione: ${notice.readinessStatus} (${notice.readinessLabel})`,
    `Data generazione: ${notice.generatedAt}`,
  ].flatMap((line) =>
    wrapText(line, state.fonts.body, bodySize, state.contentWidth - padding * 2),
  );
  const boxHeight =
    padding * 2 + titleSize + 8 + bodyLines.length * bodyLineHeight;

  ensureSpace(state, boxHeight + 18);

  const topY = state.y;
  state.page.drawRectangle({
    borderColor: rgb(0.74, 0.22, 0.16),
    borderWidth: 1,
    color: rgb(1, 0.95, 0.92),
    height: boxHeight,
    width: state.contentWidth,
    x: state.x,
    y: topY - boxHeight,
  });

  state.page.drawText("PDF TECNICO DI PROVA", {
    color: rgb(0.54, 0.08, 0.05),
    font: state.fonts.bodyBold,
    size: titleSize,
    x: state.x + padding,
    y: topY - padding - titleSize,
  });

  let textY = topY - padding - titleSize - 8 - bodySize;

  for (const line of bodyLines) {
    state.page.drawText(sanitizePdfText(line), {
      color: rgb(0.22, 0.12, 0.1),
      font: state.fonts.body,
      size: bodySize,
      x: state.x + padding,
      y: textY,
    });
    textY -= bodyLineHeight;
  }

  state.y -= boxHeight + 18;
}

function drawHeading(state: LayoutState, value: string, size: number) {
  ensureSpace(state, size * 2.6);
  drawParagraph(state, value, {
    font: state.fonts.headingBold,
    paragraphSpacing: size * 0.5,
    size,
  });
}

function drawMutedLabel(state: LayoutState, value: string) {
  drawParagraph(state, value, {
    color: rgb(0.42, 0.42, 0.42),
    font: state.fonts.bodyBold,
    paragraphSpacing: 4,
    size: Math.max(8, state.bodyFontSize - 2),
  });
}

function getImagePrompt(block: PreviewBlock) {
  return block.body || block.assetPrompt || block.assetAltText || "";
}

function drawImagePlaceholder(state: LayoutState, block: PreviewBlock) {
  const prompt = getImagePrompt(block);
  const label = prompt
    ? `[IMMAGINE DA INSERIRE: ${prompt}]`
    : "[IMMAGINE DA INSERIRE]";
  const padding = 12;
  const innerWidth = state.contentWidth - padding * 2;
  const lines = wrapText(label, state.fonts.bodyItalic, state.bodyFontSize, innerWidth);
  const lineHeight = state.bodyFontSize * (state.lineHeight / state.bodyFontSize);
  const boxHeight = Math.max(72, lines.length * lineHeight + padding * 2);

  ensureSpace(state, boxHeight + 12);

  const topY = state.y;
  state.page.drawRectangle({
    borderColor: rgb(0.58, 0.58, 0.58),
    borderWidth: 1,
    color: rgb(0.96, 0.96, 0.94),
    height: boxHeight,
    width: state.contentWidth,
    x: state.x,
    y: topY - boxHeight,
  });

  let textY = topY - padding - state.bodyFontSize;

  for (const line of lines) {
    state.page.drawText(sanitizePdfText(line), {
      color: rgb(0.2, 0.2, 0.2),
      font: state.fonts.bodyItalic,
      size: state.bodyFontSize,
      x: state.x + padding,
      y: textY,
    });
    textY -= lineHeight;
  }

  state.y -= boxHeight + 12;
}

function drawBlock(state: LayoutState, block: PreviewBlock) {
  if (block.isPageBreak) {
    if (!isAtPageTop(state)) {
      addPage(state);
    }
    return;
  }

  if (block.isImagePlaceholder) {
    drawImagePlaceholder(state, block);
    return;
  }

  if (block.blockType === "heading") {
    drawHeading(state, block.title || block.body || block.blockTypeLabel, 15);
    return;
  }

  if (block.title) {
    drawParagraph(state, block.title, {
      font: state.fonts.bodyBold,
      paragraphSpacing: 4,
      size: state.bodyFontSize + 1,
    });
  }

  if (!block.body) {
    return;
  }

  drawParagraph(state, block.body, {
    font: block.blockType === "quote" ? state.fonts.bodyItalic : state.fonts.body,
  });
}

function drawTitlePage(
  state: LayoutState,
  book: KdpBook,
  settings: KdpBookSettings,
  technicalNotice?: TechnicalPdfNotice,
) {
  state.y = state.pageHeight * 0.66;

  drawCenteredParagraph(state, book.title, {
    font: state.fonts.headingBold,
    maxWidth: state.contentWidth,
    paragraphSpacing: 18,
    size: 24,
  });

  if (book.subtitle) {
    drawCenteredParagraph(state, book.subtitle, {
      font: state.fonts.heading,
      maxWidth: state.contentWidth,
      paragraphSpacing: 28,
      size: 15,
    });
  }

  if (book.author_name) {
    drawCenteredParagraph(state, book.author_name, {
      font: state.fonts.body,
      maxWidth: state.contentWidth,
      size: 12,
    });
  }

  if (technicalNotice) {
    drawTechnicalTestNotice(state, technicalNotice);
  }

  state.y = state.marginBottom + 36;
  drawCenteredParagraph(state, TECHNICAL_PDF_VERSION, {
    font: state.fonts.bodyItalic,
    maxWidth: state.contentWidth,
    paragraphSpacing: 8,
    size: 8,
  });

  if (settings.bleed) {
    drawCenteredParagraph(
      state,
      "Nota tecnica: bleed attivo nelle impostazioni. Il PDF V1 non applica abbondanza grafica avanzata.",
      {
        font: state.fonts.bodyItalic,
        maxWidth: state.contentWidth,
        size: 8,
      },
    );
  }
}

function drawIndexPage(state: LayoutState, preview: ReturnType<typeof buildBookPreview>) {
  addPage(state);
  drawHeading(state, "Indice", 18);

  if (preview.toc.length === 0) {
    drawParagraph(state, "Nessuna sezione marcata per l'indice.");
    return;
  }

  for (const item of preview.toc) {
    drawParagraph(state, `${item.index}. ${item.title}`, {
      font: state.fonts.bodyBold,
      paragraphSpacing: 2,
      size: state.bodyFontSize,
    });

    if (item.subtitle) {
      drawParagraph(state, item.subtitle, {
        color: rgb(0.36, 0.36, 0.36),
        paragraphSpacing: 2,
        size: Math.max(9, state.bodyFontSize - 1),
      });
    }

    drawParagraph(state, `${item.sectionTypeLabel} - ${item.layoutPresetLabel}`, {
      color: rgb(0.48, 0.48, 0.48),
      paragraphSpacing: 6,
      size: Math.max(8, state.bodyFontSize - 2),
    });
  }
}

function drawSection(state: LayoutState, section: PreviewSection) {
  if (section.pageBreakBefore && !isAtPageTop(state)) {
    addPage(state);
  }

  drawMutedLabel(
    state,
    `${section.index}. ${section.sectionTypeLabel} - ${section.layoutPresetLabel}`,
  );
  drawHeading(state, section.title, 16);

  if (section.subtitle) {
    drawParagraph(state, section.subtitle, {
      color: rgb(0.32, 0.32, 0.32),
      font: state.fonts.heading,
      paragraphSpacing: 10,
      size: state.bodyFontSize + 1,
    });
  }

  if (section.body) {
    drawParagraph(state, section.body);
  }

  for (const block of section.blocks) {
    drawBlock(state, block);
  }
}

async function createLayoutState(settings: KdpBookSettings) {
  const doc = await PDFDocument.create();
  const pageSize = getPageSize(settings.trim_size);
  const useSansHeading = settings.heading_font === "sans";
  const fonts = {
    body: await doc.embedFont(StandardFonts.TimesRoman),
    bodyBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    bodyItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    heading: await doc.embedFont(
      useSansHeading ? StandardFonts.Helvetica : StandardFonts.TimesRoman,
    ),
    headingBold: await doc.embedFont(
      useSansHeading ? StandardFonts.HelveticaBold : StandardFonts.TimesRomanBold,
    ),
  };
  const bodyFontSize = settings.body_font_size;
  const state: LayoutState = {
    bodyFontSize,
    contentWidth: 0,
    doc,
    fonts,
    lineHeight: bodyFontSize * settings.line_height,
    marginBottom: toPoints(settings.margin_bottom, 0.75),
    marginInner: toPoints(settings.margin_inner, 0.75),
    marginOuter: toPoints(settings.margin_outer, 0.6),
    marginTop: toPoints(settings.margin_top, 0.75),
    page: doc.addPage([pageSize.width, pageSize.height]),
    pageHeight: pageSize.height,
    pageIndex: 1,
    pageWidth: pageSize.width,
    x: 0,
    y: 0,
  };

  applyPageMargins(state);
  state.y = state.pageHeight - state.marginTop;

  return state;
}

export function getTechnicalPdfFileName(title: string) {
  const slug = slugify(title);

  return slug ? `${slug}-pdf-tecnico.pdf` : "libretto-pdf-tecnico.pdf";
}

export async function generateTechnicalKdpPdf({
  assets,
  blocks,
  book,
  sections,
  settings,
  technicalNotice,
}: GenerateTechnicalPdfInput) {
  const preview = buildBookPreview({
    assets,
    blocks,
    book,
    sections,
    settings,
  });
  const state = await createLayoutState(settings);

  drawTitlePage(state, book, settings, technicalNotice);
  drawIndexPage(state, preview);
  addPage(state);

  if (preview.sections.length === 0) {
    drawParagraph(state, "Nessuna sezione disponibile per il contenuto.");
  } else {
    for (const section of preview.sections) {
      drawSection(state, section);
    }
  }

  return state.doc.save();
}
