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

type DrawBlockOptions = {
  fillAllocations?: WeakMap<ImportedPrintBlock, number>;
  fillPromptLines?: boolean;
};

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

function splitFieldLabelValue(field: string) {
  const [label, ...valueParts] = field.split(":");
  const value = valueParts.join(":").trim();

  return {
    label: label.trim() || field.trim(),
    value,
  };
}

function formatPdfLabel(value: string) {
  const cleanValue = value.replace(/[_\s]+/g, " ").trim();

  return cleanValue ? `${cleanValue[0].toUpperCase()}${cleanValue.slice(1)}` : "";
}

function getFieldColumnCount(fieldCount: number, isGrid: boolean) {
  if (!isGrid) {
    return 1;
  }

  return Math.max(1, Math.min(fieldCount, 5));
}

function drawFields(
  layout: PdfLayout,
  block: Extract<ImportedPrintBlock, { type: "fields" }>,
  dense: boolean,
  extraHeight = 0,
) {
  const fields = block.fields;
  const isGrid = block.layout === "grid" || fields.length >= 2;
  const columns = Math.max(1, getFieldColumnCount(fields.length, isGrid));
  const gap = dense ? 4 : 6;
  const labelSize = dense ? 5.8 : 6.6;
  const valueSize = dense ? 6.2 : 7;
  const rowCount = Math.max(1, Math.ceil(fields.length / columns));
  const baseBoxHeight = dense ? 17 : 21;
  const maxBoxHeight = dense ? 42 : 58;
  const boxHeight = Math.min(
    maxBoxHeight,
    baseBoxHeight + Math.max(0, extraHeight) / rowCount,
  );
  const cellWidth = (layout.contentWidth - gap * (columns - 1)) / columns;

  for (let startIndex = 0; startIndex < fields.length; startIndex += columns) {
    const rowFields = fields.slice(startIndex, startIndex + columns);
    const rowModels = rowFields.map(splitFieldLabelValue);
    const labelLineGroups = rowModels.map((field) =>
      wrapText(formatPdfLabel(field.label), layout.fonts.bodyBold, labelSize, cellWidth),
    );
    const labelHeight =
      Math.max(1, ...labelLineGroups.map((lines) => lines.length)) *
      labelSize *
      1.12;
    const rowHeight = labelHeight + boxHeight + gap;

    if (!ensureRoom(layout, rowHeight)) {
      return false;
    }

    for (const [fieldIndex, field] of rowModels.entries()) {
      const cellX = layout.x + fieldIndex * (cellWidth + gap);
      let labelY = layout.y;

      for (const line of labelLineGroups[fieldIndex]) {
        layout.page.drawText(sanitizePdfText(line), {
          color: MID_GRAY,
          font: layout.fonts.bodyBold,
          size: labelSize,
          x: cellX,
          y: labelY,
        });
        labelY -= labelSize * 1.12;
      }

      const boxY = layout.y - labelHeight - boxHeight + labelSize * 0.25;

      layout.page.drawRectangle({
        borderColor: LIGHT_GRAY,
        borderWidth: 0.45,
        color: rgb(1, 1, 1),
        height: boxHeight,
        width: cellWidth,
        x: cellX,
        y: boxY,
      });

      if (field.value) {
        const valueLines = wrapText(
          field.value,
          layout.fonts.body,
          valueSize,
          cellWidth - 6,
        );

        for (const [lineIndex, line] of valueLines.slice(0, 2).entries()) {
          layout.page.drawText(sanitizePdfText(line), {
            color: GRAY,
            font: layout.fonts.body,
            size: valueSize,
            x: cellX + 3,
            y: boxY + boxHeight - valueSize * (lineIndex + 1) - 3,
          });
        }
      }
    }

    layout.y -= rowHeight;
  }

  layout.y -= dense ? 2 : 4;
  return true;
}

export function getImportedTechnicalPdfWritableLineCount(input: {
  availableHeight: number;
  dense?: boolean;
  fillRemaining?: boolean;
  lineHeight?: number;
  promptLineCount?: number;
}) {
  const dense = input.dense ?? false;
  const lineHeight = input.lineHeight ?? (dense ? 10 : 12);

  if (!input.fillRemaining) {
    return dense ? 3 : 4;
  }

  return Math.max(
    dense ? 8 : 10,
    Math.floor(
      (input.availableHeight -
        (input.promptLineCount ?? 0) * lineHeight -
        12) /
        lineHeight,
    ),
  );
}

function drawPrompts(
  layout: PdfLayout,
  prompts: string[],
  dense: boolean,
  options: {
    extraHeight?: number;
    fillRemaining?: boolean;
  } = {},
) {
  const fontSize = dense ? 7.2 : 8;
  const lineHeight = dense ? 10 : 12;
  const boxPadding = dense ? 5 : 6;
  const boxGap = dense ? 4 : 6;
  const writableWidth = layout.contentWidth - boxPadding * 2;
  const baseNoteLines = dense ? 3 : 4;
  const promptLineGroups = prompts.map((prompt) =>
    wrapText(prompt, layout.fonts.bodyItalic, fontSize, writableWidth),
  );
  const fillTargetHeight = options.fillRemaining
    ? layout.y - layout.bottomY
    : Math.max(0, options.extraHeight ?? 0) +
      promptLineGroups.reduce(
        (total, lines) =>
          total +
          boxPadding * 2 +
          lines.length * lineHeight +
          baseNoteLines * lineHeight +
          boxGap,
        0,
      );
  const availableForNotes =
    fillTargetHeight -
    promptLineGroups.reduce(
      (total, lines) =>
        total + boxPadding * 2 + lines.length * lineHeight + boxGap,
      0,
    );
  const targetNoteLines =
    options.fillRemaining || (options.extraHeight ?? 0) > 0
      ? Math.max(
          baseNoteLines * prompts.length,
          Math.floor(availableForNotes / lineHeight),
        )
      : baseNoteLines * prompts.length;
  const extraNoteLines = Math.max(
    0,
    targetNoteLines - baseNoteLines * prompts.length,
  );
  const noteLineCounts = promptLineGroups.map((_, index) => {
    const sharedExtra = Math.floor(extraNoteLines / Math.max(1, prompts.length));
    const remainder = index < extraNoteLines % Math.max(1, prompts.length) ? 1 : 0;

    return baseNoteLines + sharedExtra + remainder;
  });

  for (const [promptIndex, promptLines] of promptLineGroups.entries()) {
    const noteLines = noteLineCounts[promptIndex] ?? baseNoteLines;
    const height =
      boxPadding * 2 +
      promptLines.length * lineHeight +
      noteLines * lineHeight +
      boxGap;

    if (!ensureRoom(layout, height)) {
      return false;
    }

    const boxTop = layout.y;
    const boxHeight = height - boxGap;
    const boxBottom = boxTop - boxHeight;

    layout.page.drawRectangle({
      borderColor: LIGHT_GRAY,
      borderWidth: 0.45,
      color: rgb(1, 1, 1),
      height: boxHeight,
      width: layout.contentWidth,
      x: layout.x,
      y: boxBottom,
    });

    let lineY = boxTop - boxPadding - fontSize;

    for (const line of promptLines) {
      layout.page.drawText(sanitizePdfText(line), {
        color: MID_GRAY,
        font: layout.fonts.bodyItalic,
        size: fontSize,
        x: layout.x + boxPadding,
        y: lineY,
      });
      lineY -= lineHeight;
    }

    for (let index = 0; index < noteLines; index += 1) {
      layout.page.drawLine({
        color: LIGHT_GRAY,
        end: {
          x: layout.x + layout.contentWidth - boxPadding,
          y: lineY,
        },
        start: {
          x: layout.x + boxPadding,
          y: lineY,
        },
        thickness: 0.35,
      });
      lineY -= lineHeight;
    }

    layout.y = boxBottom - boxGap;
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

function normalizeTableColumn(value: string) {
  return value.replace(/[\s_-]/g, "").toLowerCase();
}

function isHabitTrackerTable(
  table: Extract<ImportedPrintBlock, { type: "tables" }>["tables"][number],
) {
  const [firstColumn, ...dayColumns] = table.columns;
  const normalizedFirstColumn = normalizeTableColumn(firstColumn ?? "");

  return (
    ["abitudine", "elemento", "habit"].includes(normalizedFirstColumn) &&
    dayColumns.length >= 28 &&
    dayColumns.length <= 31 &&
    table.rowCount >= 3
  );
}

function drawCenteredCellText({
  color = GRAY,
  font,
  page,
  size,
  text,
  width,
  x,
  y,
}: {
  color?: ReturnType<typeof rgb>;
  font: PDFFont;
  page: PDFPage;
  size: number;
  text: string;
  width: number;
  x: number;
  y: number;
}) {
  const cleanText = sanitizePdfText(text);
  const textWidth = font.widthOfTextAtSize(cleanText, size);

  page.drawText(cleanText, {
    color,
    font,
    size,
    x: x + Math.max(1, (width - textWidth) / 2),
    y,
  });
}

function drawHabitTrackerTable(
  layout: PdfLayout,
  table: Extract<ImportedPrintBlock, { type: "tables" }>["tables"][number],
  extraHeight = 0,
) {
  const columns = table.columns;
  const dayColumns = columns.slice(1);
  const rows = Array.from({ length: Math.max(table.rowCount, table.rows.length) });
  const titleSize = 6.2;
  const titleHeight = table.title ? 12 : 0;
  const headerHeight = 12;
  const baseRowHeight = rows.length >= 8 ? 15 : 17;
  const availableTableHeight = Math.max(0, layout.y - layout.bottomY - 8);
  const targetTableHeight = Math.min(
    availableTableHeight,
    titleHeight + headerHeight + baseRowHeight * rows.length + extraHeight,
  );
  const rowHeight = Math.min(
    48,
    Math.max(
      baseRowHeight,
      (targetTableHeight - titleHeight - headerHeight) /
        Math.max(1, rows.length),
    ),
  );
  const firstColumnWidth = Math.min(layout.contentWidth * 0.28, 86);
  const dayWidth = (layout.contentWidth - firstColumnWidth) / dayColumns.length;
  const tableHeight = titleHeight + headerHeight + rowHeight * rows.length + 8;

  if (!ensureRoom(layout, tableHeight)) {
    return false;
  }

  if (table.title) {
    layout.page.drawText(sanitizePdfText(table.title), {
      color: MID_GRAY,
      font: layout.fonts.bodyBold,
      size: titleSize,
      x: layout.x,
      y: layout.y,
    });
    layout.y -= titleHeight;
  }

  const tableTop = layout.y;
  const tableBottom = tableTop - headerHeight - rowHeight * rows.length;

  layout.page.drawRectangle({
    borderColor: LIGHT_GRAY,
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
    height: headerHeight + rowHeight * rows.length,
    width: layout.contentWidth,
    x: layout.x,
    y: tableBottom,
  });
  layout.page.drawRectangle({
    borderColor: LIGHT_GRAY,
    borderWidth: 0,
    color: FILL_GRAY,
    height: headerHeight,
    width: layout.contentWidth,
    x: layout.x,
    y: tableTop - headerHeight,
  });

  layout.page.drawText("Abitudine", {
    color: GRAY,
    font: layout.fonts.bodyBold,
    size: 5.2,
    x: layout.x + 3,
    y: tableTop - headerHeight + 3.2,
  });

  let dayX = layout.x + firstColumnWidth;
  for (const day of dayColumns) {
    drawCenteredCellText({
      font: layout.fonts.bodyBold,
      page: layout.page,
      size: dayWidth < 9 ? 3.4 : 4,
      text: day,
      width: dayWidth,
      x: dayX,
      y: tableTop - headerHeight + 3.3,
    });
    dayX += dayWidth;
  }

  layout.page.drawLine({
    color: LIGHT_GRAY,
    end: { x: layout.x + layout.contentWidth, y: tableTop - headerHeight },
    start: { x: layout.x, y: tableTop - headerHeight },
    thickness: 0.35,
  });
  layout.page.drawLine({
    color: LIGHT_GRAY,
    end: { x: layout.x + firstColumnWidth, y: tableBottom },
    start: { x: layout.x + firstColumnWidth, y: tableTop },
    thickness: 0.35,
  });

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const rowTop = tableTop - headerHeight - rowHeight * rowIndex;
    const rowBottom = rowTop - rowHeight;
    const habitLabel =
      getCellText(table.rows[rowIndex], columns[0] ?? "Elemento", 0) ||
      `Abitudine ${rowIndex + 1}`;
    const labelLines = wrapText(
      habitLabel,
      layout.fonts.body,
      5.7,
      firstColumnWidth - 6,
    );

    layout.page.drawLine({
      color: LIGHT_GRAY,
      end: { x: layout.x + layout.contentWidth, y: rowBottom },
      start: { x: layout.x, y: rowBottom },
      thickness: 0.35,
    });

    for (const [lineIndex, line] of labelLines.slice(0, 2).entries()) {
      layout.page.drawText(sanitizePdfText(line), {
        color: GRAY,
        font: layout.fonts.body,
        size: 5.7,
        x: layout.x + 3,
        y: rowTop - 7 - lineIndex * 6,
      });
    }
  }

  dayX = layout.x + firstColumnWidth;
  for (let dayIndex = 0; dayIndex <= dayColumns.length; dayIndex += 1) {
    layout.page.drawLine({
      color: LIGHT_GRAY,
      end: { x: dayX, y: tableBottom },
      start: { x: dayX, y: tableTop },
      thickness: dayIndex === 0 ? 0.35 : 0.25,
    });
    dayX += dayWidth;
  }

  layout.y = tableBottom - 8;
  return true;
}

function getTableColumnWidths(columns: string[], contentWidth: number) {
  if (columns.length <= 1) {
    return [contentWidth];
  }

  if (columns.length >= 8) {
    const firstColumnWidth = Math.min(contentWidth * 0.28, 92);
    const otherColumnWidth = (contentWidth - firstColumnWidth) / (columns.length - 1);

    return [
      firstColumnWidth,
      ...Array.from({ length: columns.length - 1 }, () => otherColumnWidth),
    ];
  }

  return Array.from({ length: columns.length }, () => contentWidth / columns.length);
}

function canAddWritableTableRows(
  table: Extract<ImportedPrintBlock, { type: "tables" }>["tables"][number],
) {
  if (table.rows.length === 0 || table.rowCount > table.rows.length) {
    return true;
  }

  return table.rows.every((row) =>
    table.columns.every((column, columnIndex) =>
      columnIndex === 0 ? true : !getCellText(row, column, columnIndex),
    ),
  );
}

function getTableDrawingMetrics({
  canAddRows,
  columns,
  extraHeight = 0,
  layout,
  requestedRows,
  tableLayout,
}: {
  canAddRows: boolean;
  columns: string[];
  extraHeight?: number;
  layout: PdfLayout;
  requestedRows: number;
  tableLayout: "compact" | "standard";
}) {
  const isWide = columns.length >= 5;
  const isVeryWide = columns.length >= 8;
  const compact = tableLayout === "compact" || isWide || requestedRows >= 10;
  const size = isVeryWide ? 4.4 : compact ? 5.3 : 6.4;
  const headerHeight = isVeryWide ? 13 : compact ? 15 : 17;
  const preferredRowHeight = isVeryWide ? 12 : compact ? 14 : 18;
  const minRowHeight = isVeryWide ? 9.5 : compact ? 11 : 14;
  const maxRowHeight = isVeryWide ? 24 : compact ? 30 : 38;
  const availableHeight = Math.max(0, layout.y - layout.bottomY - 8);
  const preferredTableHeight = headerHeight + preferredRowHeight * requestedRows;
  const targetTableHeight = Math.min(
    availableHeight,
    preferredTableHeight + Math.max(0, extraHeight),
  );
  let rowHeight = preferredRowHeight;
  let visibleRows = requestedRows;
  let overflow = false;

  if (canAddRows && targetTableHeight > preferredTableHeight + preferredRowHeight) {
    const expandedRows = Math.floor(
      (targetTableHeight - headerHeight) / preferredRowHeight,
    );

    visibleRows = Math.max(requestedRows, Math.min(expandedRows, 24));
  }

  if (targetTableHeight > headerHeight + rowHeight * visibleRows) {
    rowHeight = Math.min(
      maxRowHeight,
      (targetTableHeight - headerHeight) / Math.max(1, visibleRows),
    );
  }

  if (headerHeight + rowHeight * visibleRows > availableHeight) {
    const fittedRowHeight =
      (availableHeight - headerHeight) / Math.max(1, visibleRows);

    rowHeight = Math.max(minRowHeight, Math.min(preferredRowHeight, fittedRowHeight));
  }

  if (headerHeight + rowHeight * visibleRows > availableHeight) {
    visibleRows = Math.max(
      1,
      Math.floor((availableHeight - headerHeight) / rowHeight),
    );
    overflow = visibleRows < requestedRows;
  }

  return {
    headerHeight,
    overflow,
    rowHeight,
    size,
    visibleRows,
  };
}

function drawTable(
  layout: PdfLayout,
  table: Extract<ImportedPrintBlock, { type: "tables" }>["tables"][number],
  extraHeight = 0,
) {
  if (isHabitTrackerTable(table)) {
    return drawHabitTrackerTable(layout, table, extraHeight);
  }

  const columns = table.columns.length > 0 ? table.columns : ["Spazio", "Contenuto", "Note"];
  const requestedRows = Math.max(table.rowCount, table.rows.length, 4);
  const titleSize = columns.length >= 5 ? TABLE_DENSE_SIZE + 0.6 : TABLE_SIZE + 0.6;
  const titleHeight = table.title ? titleSize * 1.8 : 0;
  const metrics = getTableDrawingMetrics({
    canAddRows: canAddWritableTableRows(table),
    columns,
    extraHeight,
    layout: {
      ...layout,
      y: layout.y - titleHeight,
    },
    requestedRows,
    tableLayout: table.layout,
  });
  const tableHeight =
    titleHeight +
    metrics.headerHeight +
    metrics.rowHeight * metrics.visibleRows +
    8;

  if (!ensureRoom(layout, tableHeight)) {
    return false;
  }

  if (metrics.overflow) {
    layout.overflow = true;
  }

  if (table.title) {
    layout.page.drawText(sanitizePdfText(table.title), {
      color: MID_GRAY,
      font: layout.fonts.bodyBold,
      size: titleSize,
      x: layout.x,
      y: layout.y,
    });
    layout.y -= titleHeight;
  }

  const columnWidths = getTableColumnWidths(columns, layout.contentWidth);
  const tableTop = layout.y;

  layout.page.drawRectangle({
    borderColor: LIGHT_GRAY,
    borderWidth: 0.5,
    color: FILL_GRAY,
    height: metrics.headerHeight,
    width: layout.contentWidth,
    x: layout.x,
    y: tableTop - metrics.headerHeight,
  });

  let columnX = layout.x;
  for (const [index, column] of columns.entries()) {
    const columnWidth = columnWidths[index] ?? 0;
    const x = columnX;
    const headerLine =
      wrapText(
        column.replaceAll("_", " "),
        layout.fonts.bodyBold,
        metrics.size,
        Math.max(4, columnWidth - 4),
      )[0] ?? "";

    layout.page.drawText(sanitizePdfText(headerLine), {
      color: GRAY,
      font: layout.fonts.bodyBold,
      size: metrics.size,
      x: x + 2,
      y: tableTop - metrics.headerHeight + metrics.size * 0.78,
    });
    layout.page.drawLine({
      color: LIGHT_GRAY,
      end: {
        x,
        y: tableTop - metrics.headerHeight - metrics.rowHeight * metrics.visibleRows,
      },
      start: { x, y: tableTop },
      thickness: 0.35,
    });
    columnX += columnWidth;
  }

  layout.page.drawLine({
    color: LIGHT_GRAY,
    end: {
      x: layout.x + layout.contentWidth,
      y: tableTop - metrics.headerHeight - metrics.rowHeight * metrics.visibleRows,
    },
    start: {
      x: layout.x + layout.contentWidth,
      y: tableTop,
    },
    thickness: 0.35,
  });
  layout.page.drawLine({
    color: LIGHT_GRAY,
    end: { x: layout.x + layout.contentWidth, y: tableTop },
    start: { x: layout.x, y: tableTop },
    thickness: 0.35,
  });

  for (let rowIndex = 0; rowIndex < metrics.visibleRows; rowIndex += 1) {
    const row = table.rows[rowIndex];
    const rowTop = tableTop - metrics.headerHeight - metrics.rowHeight * rowIndex;

    layout.page.drawLine({
      color: LIGHT_GRAY,
      end: { x: layout.x + layout.contentWidth, y: rowTop },
      start: { x: layout.x, y: rowTop },
      thickness: 0.35,
    });

    let cellX = layout.x;
    for (const [columnIndex, column] of columns.entries()) {
      const text = getCellText(row, column, columnIndex);
      const columnWidth = columnWidths[columnIndex] ?? 0;

      if (!text) {
        cellX += columnWidth;
        continue;
      }

      const clipped =
        wrapText(
          text,
          layout.fonts.body,
          metrics.size,
          Math.max(4, columnWidth - 4),
        )[0] ?? "";

      layout.page.drawText(clipped, {
        color: GRAY,
        font: layout.fonts.body,
        size: metrics.size,
        x: cellX + 2,
        y: rowTop - metrics.rowHeight + metrics.size * 0.78,
      });
      cellX += columnWidth;
    }
  }

  layout.page.drawLine({
    color: LIGHT_GRAY,
    end: {
      x: layout.x + layout.contentWidth,
      y: tableTop - metrics.headerHeight - metrics.rowHeight * metrics.visibleRows,
    },
    start: {
      x: layout.x,
      y: tableTop - metrics.headerHeight - metrics.rowHeight * metrics.visibleRows,
    },
    thickness: 0.35,
  });
  layout.y = tableTop - metrics.headerHeight - metrics.rowHeight * metrics.visibleRows - 8;
  return true;
}

function drawGroup(
  layout: PdfLayout,
  block: Extract<ImportedPrintBlock, { type: "group" }>,
  dense: boolean,
  options: DrawBlockOptions = {},
) {
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
    if (!drawBlock(layout, child, dense, {
      fillAllocations: options.fillAllocations,
      fillPromptLines: false,
    })) {
      return false;
    }
  }

  return true;
}

function drawBlock(
  layout: PdfLayout,
  block: ImportedPrintBlock,
  dense: boolean,
  options: DrawBlockOptions = {},
): boolean {
  const extraHeight = options.fillAllocations?.get(block) ?? 0;

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
    return drawFields(layout, block, dense, extraHeight);
  }

  if (block.type === "prompts") {
    return drawPrompts(layout, block.prompts, dense, {
      extraHeight,
      fillRemaining: options.fillPromptLines,
    });
  }

  if (block.type === "list") {
    return drawList(layout, block, dense);
  }

  if (block.type === "tables") {
    const tableExtraHeight = extraHeight / Math.max(1, block.tables.length);

    for (const table of block.tables) {
      if (!drawTable(layout, table, tableExtraHeight)) {
        return false;
      }
    }

    return true;
  }

  if (block.type === "group") {
    return drawGroup(layout, block, dense, options);
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

function estimateParagraphHeight(
  layout: PdfLayout,
  value: string,
  size: number,
  options?: {
    maxWidth?: number;
    spacingAfter?: number;
  },
) {
  const lines = wrapText(
    value,
    layout.fonts.body,
    size,
    options?.maxWidth ?? layout.contentWidth,
  );

  return lines.length * size * 1.22 + (options?.spacingAfter ?? size * 0.45);
}

function estimateFieldsHeight(
  layout: PdfLayout,
  block: Extract<ImportedPrintBlock, { type: "fields" }>,
  dense: boolean,
) {
  const fields = block.fields;
  const isGrid = block.layout === "grid" || fields.length >= 2;
  const columns = Math.max(1, getFieldColumnCount(fields.length, isGrid));
  const gap = dense ? 4 : 6;
  const labelSize = dense ? 5.8 : 6.6;
  const boxHeight = dense ? 17 : 21;
  const cellWidth = (layout.contentWidth - gap * (columns - 1)) / columns;
  let height = 0;

  for (let startIndex = 0; startIndex < fields.length; startIndex += columns) {
    const rowFields = fields.slice(startIndex, startIndex + columns);
    const labelLineGroups = rowFields.map((field) =>
      wrapText(
        formatPdfLabel(splitFieldLabelValue(field).label),
        layout.fonts.bodyBold,
        labelSize,
        cellWidth,
      ),
    );
    const labelHeight =
      Math.max(1, ...labelLineGroups.map((lines) => lines.length)) *
      labelSize *
      1.12;

    height += labelHeight + boxHeight + gap;
  }

  return height + (dense ? 2 : 4);
}

function estimatePromptsHeight(
  layout: PdfLayout,
  block: Extract<ImportedPrintBlock, { type: "prompts" }>,
  dense: boolean,
) {
  const fontSize = dense ? 7.2 : 8;
  const lineHeight = dense ? 10 : 12;
  const boxPadding = dense ? 5 : 6;
  const boxGap = dense ? 4 : 6;
  const writableWidth = layout.contentWidth - boxPadding * 2;
  const noteLines = dense ? 3 : 4;

  return block.prompts.reduce((total, prompt) => {
    const promptLines = wrapText(
      prompt,
      layout.fonts.bodyItalic,
      fontSize,
      writableWidth,
    );

    return (
      total +
      boxPadding * 2 +
      promptLines.length * lineHeight +
      noteLines * lineHeight +
      boxGap
    );
  }, 0);
}

function estimateTableHeight(
  layout: PdfLayout,
  table: Extract<ImportedPrintBlock, { type: "tables" }>["tables"][number],
) {
  if (isHabitTrackerTable(table)) {
    const rows = Math.max(table.rowCount, table.rows.length);
    const rowHeight = rows >= 8 ? 15 : 17;

    return (table.title ? 12 : 0) + 12 + rowHeight * rows + 8;
  }

  const columns = table.columns.length > 0
    ? table.columns
    : ["Spazio", "Contenuto", "Note"];
  const requestedRows = Math.max(table.rowCount, table.rows.length, 4);
  const titleSize = columns.length >= 5 ? TABLE_DENSE_SIZE + 0.6 : TABLE_SIZE + 0.6;
  const titleHeight = table.title ? titleSize * 1.8 : 0;
  const metrics = getTableDrawingMetrics({
    canAddRows: false,
    columns,
    layout: {
      ...layout,
      y: layout.y - titleHeight,
    },
    requestedRows,
    tableLayout: table.layout,
  });

  return titleHeight + metrics.headerHeight + metrics.rowHeight * metrics.visibleRows + 8;
}

function estimateBlockHeight(
  layout: PdfLayout,
  block: ImportedPrintBlock,
  dense: boolean,
): number {
  if (block.type === "text") {
    return block.text.reduce(
      (total, text) =>
        total + estimateParagraphHeight(layout, text, dense ? DENSE_BODY_SIZE : BODY_SIZE),
      0,
    );
  }

  if (block.type === "fields") {
    return estimateFieldsHeight(layout, block, dense);
  }

  if (block.type === "prompts") {
    return estimatePromptsHeight(layout, block, dense);
  }

  if (block.type === "list") {
    const size = dense ? DENSE_BODY_SIZE : BODY_SIZE;

    return block.items.reduce((total, item) => {
      const lines = wrapText(item, layout.fonts.body, size, layout.contentWidth - 10);

      return total + Math.max(1, lines.length) * size * 1.22 + 2;
    }, 3);
  }

  if (block.type === "tables") {
    return block.tables.reduce(
      (total, table) => total + estimateTableHeight(layout, table),
      0,
    );
  }

  if (block.type === "group") {
    const titleHeight = block.title
      ? estimateParagraphHeight(layout, block.title, dense ? 7 : 8, {
          spacingAfter: 3,
        })
      : 0;
    const subtitleHeight = block.subtitle
      ? estimateParagraphHeight(layout, block.subtitle, dense ? 7 : 8, {
          spacingAfter: 3,
        })
      : 0;

    return (
      titleHeight +
      subtitleHeight +
      block.blocks.reduce(
        (total, child) => total + estimateBlockHeight(layout, child, dense),
        0,
      )
    );
  }

  return block.entries.reduce(
    (total, entry) =>
      total +
      estimateParagraphHeight(
        layout,
        `${entry.label}: ${entry.value}`,
        dense ? DENSE_BODY_SIZE : BODY_SIZE,
      ),
    0,
  );
}

function getExpandableBlockWeight(block: ImportedPrintBlock) {
  if (block.type === "tables") {
    return block.tables.some(isHabitTrackerTable) ? 9 : 8;
  }

  if (block.type === "prompts") {
    return 3.5;
  }

  if (block.type === "fields") {
    return 1.4;
  }

  return 0;
}

function collectExpandableBlocks(
  blocks: ImportedPrintBlock[],
  targets: Array<{ block: ImportedPrintBlock; weight: number }> = [],
) {
  for (const block of blocks) {
    if (block.type === "group") {
      collectExpandableBlocks(block.blocks, targets);
      continue;
    }

    const weight = getExpandableBlockWeight(block);

    if (weight > 0) {
      targets.push({ block, weight });
    }
  }

  return targets;
}

function getFillPageAllocations(
  layout: PdfLayout,
  blocks: ImportedPrintBlock[],
  dense: boolean,
) {
  const allocations = new WeakMap<ImportedPrintBlock, number>();
  const targets = collectExpandableBlocks(blocks);

  if (targets.length === 0) {
    return allocations;
  }

  const availableHeight = Math.max(0, layout.y - layout.bottomY - 6);
  const estimatedHeight = blocks.reduce(
    (total, block) => total + estimateBlockHeight(layout, block, dense),
    0,
  );
  const targetHeight = availableHeight * 0.9;
  const extraHeight = Math.max(0, targetHeight - estimatedHeight);

  if (extraHeight < 24) {
    return allocations;
  }

  const totalWeight = targets.reduce((total, target) => total + target.weight, 0);

  for (const target of targets) {
    allocations.set(target.block, (extraHeight * target.weight) / totalWeight);
  }

  return allocations;
}

export function getImportedTechnicalPdfFooterText(page: ImportedPrintPage) {
  if (page.pageNumber === 1 && page.blocks.length === 0 && page.hasPrintableHeader) {
    return null;
  }

  return String(page.pageNumber);
}

function drawPageFooter(layout: PdfLayout, page: ImportedPrintPage) {
  const footer = getImportedTechnicalPdfFooterText(page);

  if (!footer) {
    return;
  }

  const footerSize = 6.5;
  const footerWidth = layout.fonts.body.widthOfTextAtSize(footer, footerSize);

  layout.page.drawText(sanitizePdfText(footer), {
    color: MID_GRAY,
    font: layout.fonts.body,
    size: footerSize,
    x: (layout.pageWidth - footerWidth) / 2,
    y: Math.max(12, layout.bottomY * 0.45),
  });
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
    layout.y = layout.pageHeight * 0.64;
    drawCenteredText(layout, page.title, {
      font: layout.fonts.headingBold,
      maxWidth: layout.contentWidth,
      size: 28,
    });

    if (page.subtitle) {
      layout.y -= 10;
      drawCenteredText(layout, page.subtitle, {
        font: layout.fonts.heading,
        maxWidth: layout.contentWidth,
        size: 13,
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

function hasBlockType(blocks: ImportedPrintBlock[], type: ImportedPrintBlock["type"]): boolean {
  return blocks.some((block) => {
    if (block.type === type) {
      return true;
    }

    return block.type === "group" ? hasBlockType(block.blocks, type) : false;
  });
}

function shouldFillPromptLines(page: ImportedPrintPage) {
  return (
    hasBlockType(page.blocks, "prompts") &&
    !hasBlockType(page.blocks, "tables") &&
    !hasBlockType(page.blocks, "fields") &&
    getContentWeight(page.blocks) <= 8
  );
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
  const fillPromptLines = shouldFillPromptLines(page);

  drawPageHeader(layout, page);
  const fillAllocations = getFillPageAllocations(layout, page.blocks, dense);

  if (page.blocks.length === 0 && !page.hasPrintableHeader) {
    drawParagraph(layout, "Contenuto stampabile non disponibile.", {
      color: MID_GRAY,
      font: layout.fonts.bodyItalic,
      size: 8,
    });
  }

  for (const block of page.blocks) {
    if (!drawBlock(layout, block, dense, {
      fillAllocations,
      fillPromptLines,
    })) {
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
