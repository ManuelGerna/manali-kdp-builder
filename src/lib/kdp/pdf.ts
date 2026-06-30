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

type BookPreview = ReturnType<typeof buildBookPreview>;
type SectionPageMap = Map<string, number>;

type RenderTechnicalPdfDocumentInput = {
  book: KdpBook;
  preview: BookPreview;
  settings: KdpBookSettings;
  tocPageMap?: SectionPageMap;
};

type RenderTechnicalPdfDocumentResult = {
  pageCount: number;
  pageMap: SectionPageMap;
  state: LayoutState;
};

const POINTS_PER_INCH = 72;
const MIN_CONTENT_WIDTH = 144;
const MIN_CONTENT_TOP = 42;
const MIN_CONTENT_BOTTOM = 36;
const TOC_PAGE_NUMBER_RESERVED_WIDTH = 34;

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

function normalizeComparableText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return sanitizePdfText(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasSameEditorialTitle(
  first: string | null | undefined,
  second: string | null | undefined,
) {
  const firstTitle = normalizeComparableText(first);
  const secondTitle = normalizeComparableText(second);

  return Boolean(firstTitle && secondTitle && firstTitle === secondTitle);
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

function truncateToWidth(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const cleanValue = sanitizePdfText(value).replace(/\s+/g, " ").trim();

  if (font.widthOfTextAtSize(cleanValue, size) <= maxWidth) {
    return cleanValue;
  }

  const suffix = "...";
  let truncated = cleanValue;

  while (
    truncated.length > 0 &&
    font.widthOfTextAtSize(`${truncated}${suffix}`, size) > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }

  return truncated ? `${truncated.trimEnd()}${suffix}` : suffix;
}

function resolveHorizontalMargins(state: Pick<LayoutState, "marginInner" | "marginOuter" | "pageIndex">) {
  const isOddPage = state.pageIndex % 2 === 1;

  return {
    left: isOddPage ? state.marginInner : state.marginOuter,
    right: isOddPage ? state.marginOuter : state.marginInner,
  };
}

function resolveContentBox(
  state: Pick<
    LayoutState,
    "marginInner" | "marginOuter" | "pageIndex" | "pageWidth"
  >,
) {
  const { left, right } = resolveHorizontalMargins(state);
  const usableWidth = state.pageWidth - left - right;

  if (usableWidth >= MIN_CONTENT_WIDTH) {
    return {
      contentWidth: usableWidth,
      x: left,
    };
  }

  const fallbackMargin = Math.max(24, (state.pageWidth - MIN_CONTENT_WIDTH) / 2);

  return {
    contentWidth: state.pageWidth - fallbackMargin * 2,
    x: fallbackMargin,
  };
}

function getContentTopY(state: LayoutState) {
  return state.pageHeight - Math.max(state.marginTop, MIN_CONTENT_TOP);
}

function getContentBottomY(state: LayoutState) {
  return Math.max(state.marginBottom, MIN_CONTENT_BOTTOM);
}

function applyPageMargins(state: LayoutState) {
  const { contentWidth, x } = resolveContentBox(state);

  state.x = x;
  state.contentWidth = contentWidth;
}

function addPage(state: LayoutState) {
  state.page = state.doc.addPage([state.pageWidth, state.pageHeight]);
  state.pageIndex += 1;
  applyPageMargins(state);
  state.y = getContentTopY(state);
}

function isAtPageTop(state: LayoutState) {
  return Math.abs(state.y - getContentTopY(state)) < 1;
}

function getManuscriptPageNumber(state: LayoutState) {
  return Math.max(0, state.pageIndex - 2);
}

function ensureSpace(state: LayoutState, height: number) {
  if (state.y - height < getContentBottomY(state)) {
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
    color?: ReturnType<typeof rgb>;
    font: PDFFont;
    lineHeightFactor?: number;
    maxWidth: number;
    paragraphSpacing?: number;
    size: number;
  },
) {
  const lines = wrapText(value, options.font, options.size, options.maxWidth);
  const lineHeight = options.size * (options.lineHeightFactor ?? 1.25);

  for (const line of lines) {
    ensureSpace(state, lineHeight);

    const lineWidth = options.font.widthOfTextAtSize(line, options.size);
    state.page.drawText(sanitizePdfText(line), {
      color: options.color ?? rgb(0.1, 0.1, 0.1),
      font: options.font,
      size: options.size,
      x: (state.pageWidth - lineWidth) / 2,
      y: state.y,
    });
    state.y -= lineHeight;
  }

  state.y -= options.paragraphSpacing ?? lineHeight * 0.5;
}

function drawHorizontalRule(
  state: LayoutState,
  y: number,
  options?: {
    color?: ReturnType<typeof rgb>;
    endX?: number;
    startX?: number;
    thickness?: number;
  },
) {
  state.page.drawLine({
    color: options?.color ?? rgb(0.78, 0.78, 0.78),
    end: {
      x: options?.endX ?? state.x + state.contentWidth,
      y,
    },
    start: {
      x: options?.startX ?? state.x,
      y,
    },
    thickness: options?.thickness ?? 0.5,
  });
}

function drawDottedLeader(
  state: LayoutState,
  startX: number,
  endX: number,
  y: number,
) {
  const leader = ". ";
  const size = Math.max(7, state.bodyFontSize - 3);
  const leaderWidth = state.fonts.body.widthOfTextAtSize(leader, size);
  const count = Math.floor((endX - startX) / leaderWidth);

  if (count <= 0) {
    return;
  }

  state.page.drawText(leader.repeat(count), {
    color: rgb(0.68, 0.68, 0.68),
    font: state.fonts.body,
    size,
    x: startX,
    y,
  });
}

function drawHeading(state: LayoutState, value: string, size: number) {
  ensureSpace(state, size * 3.2);
  drawParagraph(state, value, {
    font: state.fonts.headingBold,
    paragraphSpacing: size * 0.65,
    size,
  });
}

function getImagePrompt(block: PreviewBlock) {
  return block.body || block.assetPrompt || block.assetAltText || "";
}

function drawImagePlaceholder(
  state: LayoutState,
  block: PreviewBlock,
  sectionTitle: string,
) {
  const prompt = getImagePrompt(block);
  const padding = 12;
  const label = "[Immagine da inserire]";
  const title =
    !hasSameEditorialTitle(block.title, sectionTitle) &&
    !hasSameEditorialTitle(block.assetTitle, sectionTitle)
      ? block.title || block.assetTitle
      : null;
  const innerWidth = state.contentWidth - padding * 2;
  const labelSize = Math.max(8, state.bodyFontSize - 2);
  const detailSize = Math.max(8, state.bodyFontSize - 1);
  const lineHeight = detailSize * 1.25;
  const detailLines = [
    title ? `Titolo: ${title}` : null,
    prompt ? `Prompt: ${prompt}` : "Prompt non specificato.",
  ].flatMap((line) =>
    line ? wrapText(line, state.fonts.bodyItalic, detailSize, innerWidth) : [],
  );
  const boxHeight = Math.max(
    88,
    padding * 2 + labelSize + 10 + detailLines.length * lineHeight,
  );

  ensureSpace(state, boxHeight + 16);

  const topY = state.y;
  state.page.drawRectangle({
    borderColor: rgb(0.44, 0.44, 0.44),
    borderWidth: 1,
    color: rgb(0.97, 0.97, 0.95),
    height: boxHeight,
    width: state.contentWidth,
    x: state.x,
    y: topY - boxHeight,
  });

  state.page.drawText(label, {
    color: rgb(0.16, 0.16, 0.16),
    font: state.fonts.bodyBold,
    size: labelSize,
    x: state.x + padding,
    y: topY - padding - labelSize,
  });

  drawHorizontalRule(state, topY - padding - labelSize - 8, {
    color: rgb(0.68, 0.68, 0.66),
    endX: state.x + state.contentWidth - padding,
    startX: state.x + padding,
  });

  let textY = topY - padding - labelSize - 10 - detailSize;

  for (const line of detailLines) {
    state.page.drawText(sanitizePdfText(line), {
      color: rgb(0.24, 0.24, 0.24),
      font: state.fonts.bodyItalic,
      size: detailSize,
      x: state.x + padding,
      y: textY,
    });
    textY -= lineHeight;
  }

  state.y -= boxHeight + 16;
}

function drawBlock(
  state: LayoutState,
  block: PreviewBlock,
  sectionTitle: string,
) {
  if (block.isPageBreak) {
    if (!isAtPageTop(state)) {
      addPage(state);
    }
    return;
  }

  if (block.isImagePlaceholder) {
    drawImagePlaceholder(state, block, sectionTitle);
    return;
  }

  if (block.blockType === "heading") {
    const headingText = hasSameEditorialTitle(block.title, sectionTitle)
      ? block.body
      : block.title || block.body;

    if (headingText && !hasSameEditorialTitle(headingText, sectionTitle)) {
      drawHeading(state, headingText, 15);
    }

    return;
  }

  if (block.title && !hasSameEditorialTitle(block.title, sectionTitle)) {
    ensureSpace(state, state.lineHeight * 2.4);
    drawParagraph(state, block.title, {
      font: state.fonts.bodyBold,
      paragraphSpacing: 5,
      size: state.bodyFontSize + 1,
    });
  }

  if (!block.body) {
    return;
  }

  drawParagraph(state, block.body, {
    font: block.blockType === "quote" ? state.fonts.bodyItalic : state.fonts.body,
    paragraphSpacing: state.lineHeight * 0.65,
  });
}

function drawTitlePage(state: LayoutState, book: KdpBook) {
  const titleSize = clamp(state.pageWidth / 16, 22, 28);
  const subtitleSize = clamp(titleSize * 0.56, 13, 16);

  state.y = state.pageHeight * 0.69;

  drawCenteredParagraph(state, book.title, {
    font: state.fonts.headingBold,
    maxWidth: state.contentWidth,
    paragraphSpacing: book.subtitle ? 18 : 30,
    size: titleSize,
  });

  if (book.subtitle) {
    drawCenteredParagraph(state, book.subtitle, {
      color: rgb(0.28, 0.28, 0.28),
      font: state.fonts.heading,
      maxWidth: state.contentWidth,
      paragraphSpacing: 32,
      size: subtitleSize,
    });
  }

  if (book.author_name) {
    drawCenteredParagraph(state, book.author_name, {
      color: rgb(0.18, 0.18, 0.18),
      font: state.fonts.bodyBold,
      maxWidth: state.contentWidth,
      size: 12,
    });
  }
}

function drawIndexItem(
  state: LayoutState,
  item: BookPreview["toc"][number],
  pageMap?: SectionPageMap,
) {
  const numberText = `${item.index}.`;
  const pageNumber = pageMap?.get(item.id);
  const pageNumberText = pageNumber ? String(pageNumber) : "";
  const titleSize = state.bodyFontSize;
  const smallSize = Math.max(8, state.bodyFontSize - 2);
  const titleLineHeight = titleSize * 1.28;
  const smallLineHeight = smallSize * 1.25;
  const numberX = state.x;
  const titleX = state.x + 26;
  const pageColumnWidth = Math.max(
    TOC_PAGE_NUMBER_RESERVED_WIDTH,
    state.fonts.body.widthOfTextAtSize("0000", titleSize),
  );
  const pageColumnX = state.x + state.contentWidth - pageColumnWidth;
  const titleMaxWidth = Math.max(96, pageColumnX - titleX - 12);
  const titleLines = wrapText(
    item.title,
    state.fonts.bodyBold,
    titleSize,
    titleMaxWidth,
  );
  const subtitleLines = item.subtitle
    ? wrapText(item.subtitle, state.fonts.body, smallSize, titleMaxWidth)
    : [];
  const itemHeight =
    titleLines.length * titleLineHeight +
    subtitleLines.length * smallLineHeight +
    10;

  ensureSpace(state, itemHeight);

  let textY = state.y;
  const firstTitleLine = titleLines[0] ?? item.title;

  state.page.drawText(numberText, {
    color: rgb(0.16, 0.16, 0.16),
    font: state.fonts.bodyBold,
    size: titleSize,
    x: numberX,
    y: textY,
  });
  state.page.drawText(sanitizePdfText(firstTitleLine), {
    color: rgb(0.16, 0.16, 0.16),
    font: state.fonts.bodyBold,
    size: titleSize,
    x: titleX,
    y: textY,
  });

  if (pageNumberText) {
    const pageNumberWidth = state.fonts.body.widthOfTextAtSize(
      pageNumberText,
      titleSize,
    );

    state.page.drawText(pageNumberText, {
      color: rgb(0.18, 0.18, 0.18),
      font: state.fonts.body,
      size: titleSize,
      x: state.x + state.contentWidth - pageNumberWidth,
      y: textY,
    });

    const firstTitleWidth = state.fonts.bodyBold.widthOfTextAtSize(
      firstTitleLine,
      titleSize,
    );
    drawDottedLeader(
      state,
      titleX + firstTitleWidth + 6,
      pageColumnX - 8,
      textY + 1,
    );
  }

  textY -= titleLineHeight;

  for (const line of titleLines.slice(1)) {
    state.page.drawText(sanitizePdfText(line), {
      color: rgb(0.16, 0.16, 0.16),
      font: state.fonts.bodyBold,
      size: titleSize,
      x: titleX,
      y: textY,
    });
    textY -= titleLineHeight;
  }

  for (const line of subtitleLines) {
    state.page.drawText(sanitizePdfText(line), {
      color: rgb(0.38, 0.38, 0.38),
      font: state.fonts.body,
      size: smallSize,
      x: titleX,
      y: textY,
    });
    textY -= smallLineHeight;
  }

  state.y = textY - 8;
}

function drawIndexPage(
  state: LayoutState,
  preview: BookPreview,
  pageMap?: SectionPageMap,
) {
  addPage(state);
  drawParagraph(state, "Indice", {
    font: state.fonts.headingBold,
    paragraphSpacing: 8,
    size: 20,
  });
  drawHorizontalRule(state, state.y + 3, {
    color: rgb(0.72, 0.72, 0.72),
  });
  state.y -= 18;

  if (preview.toc.length === 0) {
    drawParagraph(state, "Nessuna sezione marcata per l'indice.");
    return;
  }

  for (const item of [...preview.toc].sort((first, second) => first.index - second.index)) {
    drawIndexItem(state, item, pageMap);
  }
}

function prepareSectionStart(state: LayoutState, section: PreviewSection) {
  if (section.pageBreakBefore && !isAtPageTop(state)) {
    addPage(state);
  }

  ensureSpace(state, state.lineHeight * 4.5);
}

function drawSection(
  state: LayoutState,
  section: PreviewSection,
  pageMap?: SectionPageMap,
) {
  prepareSectionStart(state, section);
  pageMap?.set(section.id, getManuscriptPageNumber(state));

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
    drawBlock(state, block, section.title);
  }

  state.y -= state.lineHeight * 0.25;
}

function drawPageFurniture(
  state: LayoutState,
  book: KdpBook,
  settings: KdpBookSettings,
) {
  const pages = state.doc.getPages();
  const footerSize = 10;
  const headerSize = 8;

  pages.forEach((page, index) => {
    if (index <= 1) {
      return;
    }

    const pageIndex = index + 1;
    const { contentWidth, x } = resolveContentBox({
      marginInner: state.marginInner,
      marginOuter: state.marginOuter,
      pageIndex,
      pageWidth: state.pageWidth,
    });

    if (settings.header_enabled) {
      const headerText = truncateToWidth(
        book.title,
        state.fonts.bodyItalic,
        headerSize,
        contentWidth,
      );
      const headerWidth = state.fonts.bodyItalic.widthOfTextAtSize(
        headerText,
        headerSize,
      );
      const headerY =
        state.pageHeight - Math.max(18, Math.min(state.marginTop * 0.52, 30));

      page.drawText(headerText, {
        color: rgb(0.48, 0.48, 0.48),
        font: state.fonts.bodyItalic,
        size: headerSize,
        x: x + (contentWidth - headerWidth) / 2,
        y: headerY,
      });
      page.drawLine({
        color: rgb(0.84, 0.84, 0.84),
        end: {
          x: x + contentWidth,
          y: headerY - 8,
        },
        start: {
          x,
          y: headerY - 8,
        },
        thickness: 0.4,
      });
    }

    if (!settings.footer_enabled || !settings.page_numbering) {
      return;
    }

    const footerText = String(index - 1);
    const footerWidth = state.fonts.body.widthOfTextAtSize(
      footerText,
      footerSize,
    );
    const footerY = Math.max(24, Math.min(state.marginBottom * 0.55, 36));

    page.drawText(footerText, {
      color: rgb(0.32, 0.32, 0.32),
      font: state.fonts.body,
      size: footerSize,
      x: x + (contentWidth - footerWidth) / 2,
      y: footerY,
    });
  });
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
  state.y = getContentTopY(state);

  return state;
}

function applyPdfMetadata(
  state: LayoutState,
  book: KdpBook,
  pageCount: number,
) {
  state.doc.setTitle(sanitizePdfText(book.title));

  if (book.author_name) {
    state.doc.setAuthor(sanitizePdfText(book.author_name));
  }

  state.doc.setSubject("Interior manuscript export");
  state.doc.setKeywords([`page-count:${pageCount}`]);
  state.doc.setCreator("KDP Builder");
  state.doc.setProducer("KDP Builder");
}

async function renderTechnicalPdfDocument({
  book,
  preview,
  settings,
  tocPageMap,
}: RenderTechnicalPdfDocumentInput): Promise<RenderTechnicalPdfDocumentResult> {
  const state = await createLayoutState(settings);
  const pageMap: SectionPageMap = new Map();

  drawTitlePage(state, book);
  drawIndexPage(state, preview, tocPageMap);
  addPage(state);

  if (preview.sections.length === 0) {
    drawParagraph(state, "Nessuna sezione disponibile per il contenuto.");
  } else {
    for (const section of preview.sections) {
      drawSection(state, section, pageMap);
    }
  }

  drawPageFurniture(state, book, settings);

  return {
    pageCount: state.doc.getPageCount(),
    pageMap,
    state,
  };
}

export function getTechnicalPdfFileName(title: string) {
  const slug = slugify(title);

  return slug
    ? `${slug}-interior-technical.pdf`
    : "libretto-interior-technical.pdf";
}

export async function generateTechnicalKdpPdf(input: GenerateTechnicalPdfInput) {
  const { assets, blocks, book, sections, settings } = input;
  const preview = buildBookPreview({
    assets,
    blocks,
    book,
    sections,
    settings,
  });
  const firstPass = await renderTechnicalPdfDocument({
    book,
    preview,
    settings,
  });
  const finalPass = await renderTechnicalPdfDocument({
    book,
    preview,
    settings,
    tocPageMap: firstPass.pageMap,
  });

  applyPdfMetadata(finalPass.state, book, finalPass.pageCount);

  return finalPass.state.doc.save();
}
