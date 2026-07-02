import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type {
  ImportedPrintBlock,
  ImportedPrintDocumentSettings,
  ImportedPrintPage,
  ImportedPrintRenderModel,
} from "./imported-page-print-renderer.ts";

type PdfFonts = {
  body: PDFFont;
  bodyBold: PDFFont;
  bodyItalic: PDFFont;
  heading: PDFFont;
  headingBold: PDFFont;
};

type PdfLayout = {
  bottomY: number;
  contentWidth: number;
  fonts: PdfFonts;
  overflow: boolean;
  page: PDFPage;
  pageHeight: number;
  pageWidth: number;
  x: number;
  y: number;
};

export type ImportedPagesTechnicalPdfSummary = {
  marginBottomPt: number;
  marginInsidePt: number;
  marginOutsidePt: number;
  marginTopPt: number;
  pageCount: number;
  pageHeightPt: number;
  pageWidthPt: number;
};

const POINTS_PER_INCH = 72;
const FALLBACK_FILE_NAME = "pagine-importate-technical.pdf";
const BODY_SIZE = 8.6;
const DENSE_BODY_SIZE = 7.6;
const TABLE_SIZE = 5.8;
const TABLE_DENSE_SIZE = 5;
const GRAY = rgb(0.15, 0.15, 0.15);
const MID_GRAY = rgb(0.42, 0.42, 0.42);
const LIGHT_GRAY = rgb(0.78, 0.78, 0.78);
const FILL_GRAY = rgb(0.96, 0.96, 0.96);

function toPoints(value: number) {
  return value * POINTS_PER_INCH;
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

function splitLongWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
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
  const words = sanitizePdfText(value).trim().split(/\s+/).filter(Boolean);
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
  return sanitizePdfText(value)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((paragraph) =>
      paragraph.trim() ? wrapLine(paragraph, font, size, maxWidth) : [""],
    );
}

function getPageSize(settings: ImportedPrintDocumentSettings) {
  return {
    height: toPoints(settings.pageSize.heightIn),
    width: toPoints(settings.pageSize.widthIn),
  };
}

function getMarginPoints(settings: ImportedPrintDocumentSettings) {
  return {
    bottom: toPoints(settings.margins.bottomIn),
    inside: toPoints(settings.margins.insideIn),
    outside: toPoints(settings.margins.outsideIn),
    top: toPoints(settings.margins.topIn),
  };
}

function getMarginsForPage(
  settings: ImportedPrintDocumentSettings,
  pageNumber: number,
) {
  const margins = getMarginPoints(settings);
  const isOddPage = pageNumber % 2 === 1;

  return {
    bottom: margins.bottom,
    left: isOddPage ? margins.inside : margins.outside,
    right: isOddPage ? margins.outside : margins.inside,
    top: margins.top,
  };
}

function getContentWeight(blocks: ImportedPrintBlock[]): number {
  return blocks.reduce((total, block) => {
    if (block.type === "group") {
      return total + getContentWeight(block.blocks);
    }

    if (block.type === "tables") {
      return (
        total +
        block.tables.reduce(
          (sum, table) => sum + table.rowCount + table.columns.length,
          0,
        )
      );
    }

    if (block.type === "fields") {
      return total + block.fields.length;
    }

    if (block.type === "list") {
      return total + block.items.length;
    }

    if (block.type === "prompts") {
      return total + block.prompts.length * 2;
    }

    if (block.type === "text") {
      return total + block.text.length;
    }

    return total + block.entries.length;
  }, 0);
}

function ensureRoom(layout: PdfLayout, height: number) {
  if (layout.y - height < layout.bottomY) {
    layout.overflow = true;
    return false;
  }

  return true;
}

function drawLine(
  layout: PdfLayout,
  value: string,
  options?: {
    color?: ReturnType<typeof rgb>;
    font?: PDFFont;
    size?: number;
    x?: number;
  },
) {
  const font = options?.font ?? layout.fonts.body;
  const size = options?.size ?? BODY_SIZE;
  const lineHeight = size * 1.22;

  if (!ensureRoom(layout, lineHeight)) {
    return false;
  }

  if (value) {
    layout.page.drawText(sanitizePdfText(value), {
      color: options?.color ?? GRAY,
      font,
      size,
      x: options?.x ?? layout.x,
      y: layout.y,
    });
  }

  layout.y -= lineHeight;
  return true;
}

function drawParagraph(
  layout: PdfLayout,
  value: string,
  options?: {
    color?: ReturnType<typeof rgb>;
    font?: PDFFont;
    maxWidth?: number;
    spacingAfter?: number;
    size?: number;
    x?: number;
  },
) {
  const font = options?.font ?? layout.fonts.body;
  const size = options?.size ?? BODY_SIZE;
  const maxWidth = options?.maxWidth ?? layout.contentWidth;

  for (const line of wrapText(value, font, size, maxWidth)) {
    if (!drawLine(layout, line, {
      color: options?.color,
      font,
      size,
      x: options?.x,
    })) {
      return false;
    }
  }

  layout.y -= options?.spacingAfter ?? size * 0.45;
  return true;
}

function drawCenteredText(
  layout: PdfLayout,
  value: string,
  options: {
    font: PDFFont;
    maxWidth: number;
    size: number;
  },
) {
  for (const line of wrapText(value, options.font, options.size, options.maxWidth)) {
    const lineHeight = options.size * 1.25;

    if (!ensureRoom(layout, lineHeight)) {
      return false;
    }

    const lineWidth = options.font.widthOfTextAtSize(line, options.size);
    layout.page.drawText(sanitizePdfText(line), {
      color: GRAY,
      font: options.font,
      size: options.size,
      x: (layout.pageWidth - lineWidth) / 2,
      y: layout.y,
    });
    layout.y -= lineHeight;
  }

  return true;
}

function drawRule(layout: PdfLayout) {
  if (!ensureRoom(layout, 8)) {
    return false;
  }

  layout.page.drawLine({
    color: LIGHT_GRAY,
    end: {
      x: layout.x + layout.contentWidth,
      y: layout.y,
    },
    start: {
      x: layout.x,
      y: layout.y,
    },
    thickness: 0.45,
  });
  layout.y -= 9;
  return true;
}

function drawFields(layout: PdfLayout, fields: string[], dense: boolean) {
  const gap = dense ? 4 : 6;
  const labelSize = dense ? 6.2 : 7;
  const boxHeight = dense ? 13 : 16;

  for (const field of fields) {
    const labelLines = wrapText(field, layout.fonts.bodyBold, labelSize, layout.contentWidth);
    const height = labelLines.length * labelSize * 1.15 + boxHeight + gap;

    if (!ensureRoom(layout, height)) {
      return false;
    }

    for (const line of labelLines) {
      layout.page.drawText(line, {
        color: MID_GRAY,
        font: layout.fonts.bodyBold,
        size: labelSize,
        x: layout.x,
        y: layout.y,
      });
      layout.y -= labelSize * 1.15;
    }

    layout.page.drawRectangle({
      borderColor: LIGHT_GRAY,
      borderWidth: 0.5,
      color: rgb(1, 1, 1),
      height: boxHeight,
      width: layout.contentWidth,
      x: layout.x,
      y: layout.y - boxHeight,
    });
    layout.y -= boxHeight + gap;
  }

  return true;
}

function drawPrompts(layout: PdfLayout, prompts: string[], dense: boolean) {
  const fontSize = dense ? 7.2 : 8;
  const lineHeight = dense ? 10 : 12;

  for (const prompt of prompts) {
    const promptLines = wrapText(prompt, layout.fonts.bodyItalic, fontSize, layout.contentWidth);
    const noteLines = dense ? 3 : 4;
    const height = promptLines.length * lineHeight + noteLines * lineHeight + 8;

    if (!ensureRoom(layout, height)) {
      return false;
    }

    for (const line of promptLines) {
      layout.page.drawText(line, {
        color: MID_GRAY,
        font: layout.fonts.bodyItalic,
        size: fontSize,
        x: layout.x,
        y: layout.y,
      });
      layout.y -= lineHeight;
    }

    for (let index = 0; index < noteLines; index += 1) {
      layout.page.drawLine({
        color: LIGHT_GRAY,
        end: {
          x: layout.x + layout.contentWidth,
          y: layout.y,
        },
        start: {
          x: layout.x,
          y: layout.y,
        },
        thickness: 0.35,
      });
      layout.y -= lineHeight;
    }

    layout.y -= 5;
  }

  return true;
}

function drawList(layout: PdfLayout, block: Extract<ImportedPrintBlock, { type: "list" }>, dense: boolean) {
  const size = dense ? DENSE_BODY_SIZE : BODY_SIZE;
  const bulletWidth = block.ordered ? 17 : 10;
  const textWidth = layout.contentWidth - bulletWidth;

  for (const [index, item] of block.items.entries()) {
    const prefix = block.ordered ? `${index + 1}.` : "-";
    const lines = wrapText(item, layout.fonts.body, size, textWidth);
    const height = Math.max(1, lines.length) * size * 1.22;

    if (!ensureRoom(layout, height)) {
      return false;
    }

    layout.page.drawText(prefix, {
      color: GRAY,
      font: layout.fonts.bodyBold,
      size,
      x: layout.x,
      y: layout.y,
    });

    for (const [lineIndex, line] of lines.entries()) {
      layout.page.drawText(line, {
        color: GRAY,
        font: layout.fonts.body,
        size,
        x: layout.x + bulletWidth,
        y: layout.y - lineIndex * size * 1.22,
      });
    }

    layout.y -= height + 2;
  }

  layout.y -= 3;
  return true;
}

function getCellText(row: unknown, column: string, columnIndex: number) {
  if (Array.isArray(row)) {
    return String(row[columnIndex] ?? "");
  }

  if (typeof row === "string") {
    return columnIndex === 0 ? row : "";
  }

  if (row && typeof row === "object") {
    const record = row as Record<string, string>;
    return record[column] ?? record[column.replaceAll("_", " ")] ?? "";
  }

  return "";
}

function drawTable(layout: PdfLayout, table: Extract<ImportedPrintBlock, { type: "tables" }>["tables"][number]) {
  const columns = table.columns.length > 0 ? table.columns : ["Spazio", "Contenuto", "Note"];
  const size = table.layout === "compact" || columns.length >= 5 ? TABLE_DENSE_SIZE : TABLE_SIZE;
  const rowHeight = size * 1.75;
  const titleHeight = table.title ? size * 1.8 : 0;
  const requestedRows = Math.max(table.rowCount, table.rows.length);
  const visibleRows = Math.min(requestedRows, 18);
  const tableHeight = titleHeight + rowHeight * (visibleRows + 1) + 6;

  if (!ensureRoom(layout, tableHeight)) {
    return false;
  }

  if (requestedRows > visibleRows) {
    layout.overflow = true;
  }

  if (table.title) {
    layout.page.drawText(sanitizePdfText(table.title), {
      color: MID_GRAY,
      font: layout.fonts.bodyBold,
      size: size + 0.4,
      x: layout.x,
      y: layout.y,
    });
    layout.y -= titleHeight;
  }

  const columnWidth = layout.contentWidth / columns.length;
  const tableTop = layout.y;

  layout.page.drawRectangle({
    borderColor: LIGHT_GRAY,
    borderWidth: 0.5,
    color: FILL_GRAY,
    height: rowHeight,
    width: layout.contentWidth,
    x: layout.x,
    y: tableTop - rowHeight,
  });

  for (const [index, column] of columns.entries()) {
    const x = layout.x + index * columnWidth;
    layout.page.drawText(sanitizePdfText(column.replaceAll("_", " ")), {
      color: GRAY,
      font: layout.fonts.bodyBold,
      size,
      x: x + 2,
      y: tableTop - rowHeight + size * 0.55,
    });
    layout.page.drawLine({
      color: LIGHT_GRAY,
      end: { x, y: tableTop - rowHeight * (visibleRows + 1) },
      start: { x, y: tableTop },
      thickness: 0.35,
    });
  }

  layout.page.drawLine({
    color: LIGHT_GRAY,
    end: { x: layout.x + layout.contentWidth, y: tableTop },
    start: { x: layout.x, y: tableTop },
    thickness: 0.35,
  });

  for (let rowIndex = 0; rowIndex < visibleRows; rowIndex += 1) {
    const row = table.rows[rowIndex];
    const rowTop = tableTop - rowHeight * (rowIndex + 1);

    layout.page.drawLine({
      color: LIGHT_GRAY,
      end: { x: layout.x + layout.contentWidth, y: rowTop },
      start: { x: layout.x, y: rowTop },
      thickness: 0.35,
    });

    for (const [columnIndex, column] of columns.entries()) {
      const text = getCellText(row, column, columnIndex);

      if (!text) {
        continue;
      }

      const cellX = layout.x + columnIndex * columnWidth + 2;
      const clipped = wrapText(text, layout.fonts.body, size, columnWidth - 4)[0] ?? "";

      layout.page.drawText(clipped, {
        color: GRAY,
        font: layout.fonts.body,
        size,
        x: cellX,
        y: rowTop - rowHeight + size * 0.55,
      });
    }
  }

  layout.page.drawLine({
    color: LIGHT_GRAY,
    end: {
      x: layout.x + layout.contentWidth,
      y: tableTop - rowHeight * (visibleRows + 1),
    },
    start: {
      x: layout.x,
      y: tableTop - rowHeight * (visibleRows + 1),
    },
    thickness: 0.35,
  });
  layout.y = tableTop - rowHeight * (visibleRows + 1) - 8;
  return true;
}

function drawGroup(layout: PdfLayout, block: Extract<ImportedPrintBlock, { type: "group" }>, dense: boolean) {
  if (block.title) {
    if (!drawParagraph(layout, block.title, {
      color: MID_GRAY,
      font: layout.fonts.bodyBold,
      size: dense ? 7 : 8,
      spacingAfter: 3,
    })) {
      return false;
    }
  }

  if (block.subtitle) {
    drawParagraph(layout, block.subtitle, {
      color: MID_GRAY,
      font: layout.fonts.bodyItalic,
      size: dense ? 7 : 8,
      spacingAfter: 3,
    });
  }

  for (const child of block.blocks) {
    if (!drawBlock(layout, child, dense)) {
      return false;
    }
  }

  return true;
}

function drawBlock(layout: PdfLayout, block: ImportedPrintBlock, dense: boolean): boolean {
  if (block.type === "text") {
    for (const text of block.text) {
      if (!drawParagraph(layout, text, {
        size: dense ? DENSE_BODY_SIZE : BODY_SIZE,
      })) {
        return false;
      }
    }

    return true;
  }

  if (block.type === "fields") {
    return drawFields(layout, block.fields, dense);
  }

  if (block.type === "prompts") {
    return drawPrompts(layout, block.prompts, dense);
  }

  if (block.type === "list") {
    return drawList(layout, block, dense);
  }

  if (block.type === "tables") {
    for (const table of block.tables) {
      if (!drawTable(layout, table)) {
        return false;
      }
    }

    return true;
  }

  if (block.type === "group") {
    return drawGroup(layout, block, dense);
  }

  for (const entry of block.entries) {
    if (!drawParagraph(layout, `${entry.label}: ${entry.value}`, {
      size: dense ? DENSE_BODY_SIZE : BODY_SIZE,
    })) {
      return false;
    }
  }

  return true;
}

function drawPageFooter(layout: PdfLayout, page: ImportedPrintPage) {
  const footer = `Pagina ${page.pageNumber}${page.templateId ? ` - ${page.templateId}` : ""}`;
  const footerSize = 6.5;

  layout.page.drawText(sanitizePdfText(footer), {
    color: MID_GRAY,
    font: layout.fonts.body,
    size: footerSize,
    x: layout.x,
    y: Math.max(12, layout.bottomY * 0.45),
  });

  if (layout.overflow) {
    const warning = "Contenuto tecnico da verificare: possibile overflow.";
    const warningWidth = layout.fonts.bodyItalic.widthOfTextAtSize(warning, footerSize);

    layout.page.drawText(warning, {
      color: rgb(0.55, 0.25, 0.05),
      font: layout.fonts.bodyItalic,
      size: footerSize,
      x: Math.max(layout.x, layout.pageWidth - layout.x - warningWidth),
      y: Math.max(12, layout.bottomY * 0.45),
    });
  }
}

async function createFonts(doc: PDFDocument): Promise<PdfFonts> {
  return {
    body: await doc.embedFont(StandardFonts.Helvetica),
    bodyBold: await doc.embedFont(StandardFonts.HelveticaBold),
    bodyItalic: await doc.embedFont(StandardFonts.HelveticaOblique),
    heading: await doc.embedFont(StandardFonts.TimesRoman),
    headingBold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };
}

function createPageLayout({
  doc,
  fonts,
  model,
  page,
}: {
  doc: PDFDocument;
  fonts: PdfFonts;
  model: ImportedPrintRenderModel;
  page: ImportedPrintPage;
}): PdfLayout {
  const pageSize = getPageSize(model.settings);
  const margins = getMarginsForPage(model.settings, page.pageNumber);
  const pdfPage = doc.addPage([pageSize.width, pageSize.height]);
  const contentWidth = Math.max(120, pageSize.width - margins.left - margins.right);
  const topY = pageSize.height - margins.top;

  return {
    bottomY: margins.bottom,
    contentWidth,
    fonts,
    overflow: false,
    page: pdfPage,
    pageHeight: pageSize.height,
    pageWidth: pageSize.width,
    x: margins.left,
    y: topY,
  };
}

function drawPageHeader(layout: PdfLayout, page: ImportedPrintPage) {
  if (page.pageNumber === 1 && page.blocks.length === 0 && page.hasPrintableHeader) {
    layout.y = layout.pageHeight * 0.62;
    drawCenteredText(layout, page.title, {
      font: layout.fonts.headingBold,
      maxWidth: layout.contentWidth,
      size: 22,
    });

    if (page.subtitle) {
      layout.y -= 8;
      drawCenteredText(layout, page.subtitle, {
        font: layout.fonts.heading,
        maxWidth: layout.contentWidth,
        size: 12,
      });
    }

    return;
  }

  drawParagraph(layout, page.title, {
    font: layout.fonts.headingBold,
    size: page.pageNumber === 1 ? 15 : 11,
    spacingAfter: page.subtitle ? 3 : 7,
  });

  if (page.subtitle) {
    drawParagraph(layout, page.subtitle, {
      color: MID_GRAY,
      font: layout.fonts.heading,
      size: 8.5,
      spacingAfter: 5,
    });
  }

  drawRule(layout);
}

function drawImportedPage({
  doc,
  fonts,
  model,
  page,
}: {
  doc: PDFDocument;
  fonts: PdfFonts;
  model: ImportedPrintRenderModel;
  page: ImportedPrintPage;
}) {
  const layout = createPageLayout({ doc, fonts, model, page });
  const dense =
    getContentWeight(page.blocks) > 24 ||
    page.warnings.some((warning) => warning.code === "CONTENT_MAY_OVERFLOW");

  drawPageHeader(layout, page);

  if (page.blocks.length === 0 && !page.hasPrintableHeader) {
    drawParagraph(layout, "Contenuto stampabile non disponibile.", {
      color: MID_GRAY,
      font: layout.fonts.bodyItalic,
      size: 8,
    });
  }

  for (const block of page.blocks) {
    if (!drawBlock(layout, block, dense)) {
      break;
    }
  }

  drawPageFooter(layout, page);
}

export function getImportedPagesTechnicalPdfSummary(
  model: ImportedPrintRenderModel,
): ImportedPagesTechnicalPdfSummary {
  const pageSize = getPageSize(model.settings);
  const margins = getMarginPoints(model.settings);

  return {
    marginBottomPt: margins.bottom,
    marginInsidePt: margins.inside,
    marginOutsidePt: margins.outside,
    marginTopPt: margins.top,
    pageCount: model.pages.length,
    pageHeightPt: pageSize.height,
    pageWidthPt: pageSize.width,
  };
}

export function getImportedPagesTechnicalPdfFileName(title: string) {
  const slug = slugify(title);

  return slug ? `${slug}-imported-pages-technical.pdf` : FALLBACK_FILE_NAME;
}

export async function generateImportedPagesTechnicalPdf(
  model: ImportedPrintRenderModel,
  input: {
    title?: string | null;
  } = {},
) {
  if (model.pages.length === 0) {
    throw new Error("Cannot generate imported pages PDF without pages.");
  }

  const doc = await PDFDocument.create();
  const fonts = await createFonts(doc);

  for (const page of model.pages) {
    drawImportedPage({
      doc,
      fonts,
      model,
      page,
    });
  }

  doc.setTitle(sanitizePdfText(input.title || "PDF tecnico pagine importate"));
  doc.setSubject("Imported pages technical PDF");
  doc.setCreator("KDP Builder");
  doc.setProducer("KDP Builder");
  doc.setKeywords([
    "technical",
    "imported-pages",
    `page-count:${model.pages.length}`,
  ]);

  return doc.save();
}
