export type DraftImportBlockType = "image_prompt" | "page_break" | "text";

export type DraftImportBlock = {
  blockType: DraftImportBlockType;
  body: string | null;
  editorNotes: string | null;
  prompt: string | null;
  title: string | null;
};

export type DraftImportSection = {
  blocks: DraftImportBlock[];
  editorNotes: string[];
  includeInToc: boolean;
  title: string;
};

export type DraftImportResult = {
  sections: DraftImportSection[];
  stats: {
    blockCount: number;
    imageCount: number;
    noteCount: number;
    pageBreakCount: number;
    sectionCount: number;
    tocSectionCount: number;
  };
};

const KNOWN_SECTION_TITLES = new Set([
  "introduzione",
  "conclusione",
  "cta finale",
  "specifiche del segno ariete",
]);

const OPENING_BOOK_TITLE_LINES = new Set(["ariete"]);

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isSectionSeparator(line: string) {
  const cleanLine = line.trim();

  return (
    cleanLine === "\u2e3b" ||
    /^-{3,}$/.test(cleanLine) ||
    /^\u2014{3,}$/.test(cleanLine)
  );
}

function getImagePrompt(line: string) {
  const match = line.match(/^\[IMMAGINE:\s*(.+)\]$/i);

  return match?.[1]?.trim() || null;
}

function isPageMarker(line: string) {
  return /^\[PAGINA\s+\d+(?:[^\]]*)\]$/i.test(line.trim());
}

function isInternalNote(line: string) {
  const cleanLine = line.trim();

  return (
    cleanLine.length >= 4 &&
    cleanLine.startsWith("(") &&
    cleanLine.endsWith(")")
  );
}

function isQuotedLine(line: string) {
  const cleanLine = normalizeLine(line);

  return (
    cleanLine.length >= 4 &&
    ((cleanLine.startsWith('"') && cleanLine.endsWith('"')) ||
      (cleanLine.startsWith("'") && cleanLine.endsWith("'")) ||
      (cleanLine.startsWith("\u201c") && cleanLine.endsWith("\u201d")) ||
      (cleanLine.startsWith("\u00ab") && cleanLine.endsWith("\u00bb")))
  );
}

function stripInternalNote(line: string) {
  return line.trim().replace(/^\(/, "").replace(/\)$/, "").trim();
}

function startsWithEmojiLike(line: string) {
  const firstCharacter = Array.from(line.trim())[0];

  if (!firstCharacter) {
    return false;
  }

  const codePoint = firstCharacter.codePointAt(0) ?? 0;

  return codePoint > 900 && !/[A-Za-z0-9]/.test(firstCharacter);
}

function isMostlyUppercaseTitle(line: string) {
  const letters = Array.from(line)
    .filter((character) => /\p{L}/u.test(character))
    .join("");

  if (letters.length < 4) {
    return false;
  }

  return letters === letters.toUpperCase();
}

function isPotentialTitle(line: string) {
  const cleanLine = normalizeLine(line);

  if (cleanLine.length < 2 || cleanLine.length > 80) {
    return false;
  }

  if (/[\].,;:]$/.test(cleanLine)) {
    return false;
  }

  return cleanLine.split(" ").length <= 10;
}

function hasSentencePunctuation(line: string) {
  return /[.!?]/.test(line);
}

function isOpeningBookTitleLine(line: string) {
  const cleanLine = normalizeLine(line);

  return (
    OPENING_BOOK_TITLE_LINES.has(cleanLine.toLowerCase()) &&
    isMostlyUppercaseTitle(cleanLine) &&
    isPotentialTitle(cleanLine)
  );
}

function hasSubstantiveBlock(section: DraftImportSection) {
  return section.blocks.some(
    (block) =>
      block.blockType !== "page_break" && Boolean(block.body || block.prompt),
  );
}

function createTextBlock({
  body,
  editorNotes = null,
  title = null,
}: {
  body: string | null;
  editorNotes?: string | null;
  title?: string | null;
}): DraftImportBlock {
  return {
    blockType: "text",
    body,
    editorNotes,
    prompt: null,
    title,
  };
}

function createInlineHeadingBlock(title: string): DraftImportBlock {
  return createTextBlock({
    body: null,
    title: normalizeLine(title),
  });
}

function createQuoteTextBlock(body: string): DraftImportBlock {
  return createTextBlock({
    body: normalizeLine(body),
  });
}

function shouldTreatAsInlineHeading(
  line: string,
  currentSection: DraftImportSection | null,
  afterSeparator: boolean,
) {
  if (!currentSection || hasSubstantiveBlock(currentSection)) {
    return false;
  }

  return afterSeparator && isPotentialTitle(line) && !hasSentencePunctuation(line);
}

function isSectionTitleLine(
  line: string,
  afterSeparator: boolean,
  currentSection: DraftImportSection | null,
) {
  const cleanLine = normalizeLine(line);
  const lowerLine = cleanLine.toLowerCase();

  if (isQuotedLine(cleanLine) || isOpeningBookTitleLine(cleanLine)) {
    return false;
  }

  if (hasSentencePunctuation(cleanLine)) {
    return false;
  }

  if (KNOWN_SECTION_TITLES.has(lowerLine)) {
    return true;
  }

  if (startsWithEmojiLike(cleanLine) && isPotentialTitle(cleanLine)) {
    return true;
  }

  if (isMostlyUppercaseTitle(cleanLine) && isPotentialTitle(cleanLine)) {
    return true;
  }

  return (
    afterSeparator &&
    isPotentialTitle(cleanLine) &&
    (!currentSection || hasSubstantiveBlock(currentSection))
  );
}

function createSection(title: string): DraftImportSection {
  return {
    blocks: [],
    editorNotes: [],
    includeInToc: true,
    title: normalizeLine(title) || "Sezione importata",
  };
}

function isCarryTitle(title: string) {
  const cleanTitle = normalizeLine(title);

  return cleanTitle && cleanTitle !== "Bozza importata";
}

function normalizeSections(sections: DraftImportSection[]) {
  const normalizedSections: DraftImportSection[] = [];
  let carriedBlocks: DraftImportBlock[] = [];
  let carriedNotes: string[] = [];

  for (const section of sections) {
    if (!hasSubstantiveBlock(section)) {
      if (isCarryTitle(section.title)) {
        carriedBlocks.push(createInlineHeadingBlock(section.title));
      }

      carriedBlocks.push(...section.blocks);
      carriedNotes.push(...section.editorNotes);
      continue;
    }

    normalizedSections.push({
      ...section,
      blocks: [...carriedBlocks, ...section.blocks],
      editorNotes: [...carriedNotes, ...section.editorNotes],
      includeInToc: true,
    });
    carriedBlocks = [];
    carriedNotes = [];
  }

  if (normalizedSections.length > 0) {
    const lastSection = normalizedSections[normalizedSections.length - 1];

    lastSection.blocks.push(...carriedBlocks);
    lastSection.editorNotes.push(...carriedNotes);
  }

  return normalizedSections;
}

export function parseStructuredDraft(value: string): DraftImportResult {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const sections: DraftImportSection[] = [];
  let currentSection: DraftImportSection | null = null;
  let paragraphLines: string[] = [];
  let afterSeparator = false;
  let pendingLeadBlocks: DraftImportBlock[] = [];

  function ensureSection() {
    if (!currentSection) {
      currentSection = createSection("Bozza importata");
      currentSection.blocks.push(...pendingLeadBlocks);
      pendingLeadBlocks = [];
      sections.push(currentSection);
    }

    return currentSection;
  }

  function flushParagraph() {
    const body = paragraphLines.join("\n").trim();

    if (body) {
      ensureSection().blocks.push(createTextBlock({
        body,
      }));
    }

    paragraphLines = [];
  }

  function startSection(title: string) {
    flushParagraph();
    currentSection = createSection(title);
    currentSection.blocks.push(...pendingLeadBlocks);
    pendingLeadBlocks = [];
    sections.push(currentSection);
    afterSeparator = false;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (isSectionSeparator(line)) {
      flushParagraph();
      afterSeparator = true;
      continue;
    }

    if (
      !currentSection &&
      sections.length === 0 &&
      paragraphLines.length === 0 &&
      isOpeningBookTitleLine(line)
    ) {
      pendingLeadBlocks.push(createInlineHeadingBlock(line));
      afterSeparator = false;
      continue;
    }

    if (isQuotedLine(line)) {
      flushParagraph();
      ensureSection().blocks.push(createQuoteTextBlock(line));
      afterSeparator = false;
      continue;
    }

    if (shouldTreatAsInlineHeading(line, currentSection, afterSeparator)) {
      flushParagraph();
      ensureSection().blocks.push(createInlineHeadingBlock(line));
      afterSeparator = false;
      continue;
    }

    if (isSectionTitleLine(line, afterSeparator, currentSection)) {
      startSection(line);
      continue;
    }

    const imagePrompt = getImagePrompt(line);

    if (imagePrompt) {
      flushParagraph();
      ensureSection().blocks.push({
        blockType: "image_prompt",
        body: imagePrompt,
        editorNotes: null,
        prompt: imagePrompt,
        title: "Immagine da inserire",
      });
      afterSeparator = false;
      continue;
    }

    if (isPageMarker(line)) {
      flushParagraph();
      const pageBreakBlock: DraftImportBlock = {
        blockType: "page_break",
        body: null,
        editorNotes: `Rilevato da import: ${line}`,
        prompt: null,
        title: null,
      };

      if (!currentSection) {
        pendingLeadBlocks.push(pageBreakBlock);
      } else {
        ensureSection().blocks.push(pageBreakBlock);
      }

      afterSeparator = false;
      continue;
    }

    if (isInternalNote(line)) {
      flushParagraph();
      ensureSection().editorNotes.push(stripInternalNote(line));
      afterSeparator = false;
      continue;
    }

    paragraphLines.push(rawLine.trimEnd());
    afterSeparator = false;
  }

  flushParagraph();

  const nonEmptySections = normalizeSections(sections);
  const blockCount = nonEmptySections.reduce(
    (total, section) => total + section.blocks.length,
    0,
  );
  const imageCount = nonEmptySections.reduce(
    (total, section) =>
      total +
      section.blocks.filter((block) => block.blockType === "image_prompt")
        .length,
    0,
  );
  const pageBreakCount = nonEmptySections.reduce(
    (total, section) =>
      total +
      section.blocks.filter((block) => block.blockType === "page_break").length,
    0,
  );
  const noteCount = nonEmptySections.reduce(
    (total, section) => total + section.editorNotes.length,
    0,
  );
  const tocSectionCount = nonEmptySections.filter(
    (section) => section.includeInToc,
  ).length;

  return {
    sections: nonEmptySections,
    stats: {
      blockCount,
      imageCount,
      noteCount,
      pageBreakCount,
      sectionCount: nonEmptySections.length,
      tocSectionCount,
    },
  };
}
