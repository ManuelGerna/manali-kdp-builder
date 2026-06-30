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
  };
};

const KNOWN_SECTION_TITLES = new Set([
  "introduzione",
  "conclusione",
  "cta finale",
  "specifiche del segno ariete",
]);

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

function isSectionTitleLine(line: string, afterSeparator: boolean) {
  const cleanLine = normalizeLine(line);
  const lowerLine = cleanLine.toLowerCase();

  if (KNOWN_SECTION_TITLES.has(lowerLine)) {
    return true;
  }

  if (startsWithEmojiLike(cleanLine) && isPotentialTitle(cleanLine)) {
    return true;
  }

  if (isMostlyUppercaseTitle(cleanLine) && isPotentialTitle(cleanLine)) {
    return true;
  }

  return afterSeparator && isPotentialTitle(cleanLine);
}

function createSection(title: string): DraftImportSection {
  return {
    blocks: [],
    editorNotes: [],
    title: normalizeLine(title) || "Sezione importata",
  };
}

export function parseStructuredDraft(value: string): DraftImportResult {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const sections: DraftImportSection[] = [];
  let currentSection: DraftImportSection | null = null;
  let paragraphLines: string[] = [];
  let afterSeparator = false;

  function ensureSection() {
    if (!currentSection) {
      currentSection = createSection("Bozza importata");
      sections.push(currentSection);
    }

    return currentSection;
  }

  function flushParagraph() {
    const body = paragraphLines.join("\n").trim();

    if (body) {
      ensureSection().blocks.push({
        blockType: "text",
        body,
        editorNotes: null,
        prompt: null,
        title: null,
      });
    }

    paragraphLines = [];
  }

  function startSection(title: string) {
    flushParagraph();
    currentSection = createSection(title);
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

    if (isSectionTitleLine(line, afterSeparator)) {
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
      ensureSection().blocks.push({
        blockType: "page_break",
        body: null,
        editorNotes: `Rilevato da import: ${line}`,
        prompt: null,
        title: null,
      });
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

  const nonEmptySections = sections.filter(
    (section) => section.blocks.length > 0 || section.editorNotes.length > 0,
  );
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

  return {
    sections: nonEmptySections,
    stats: {
      blockCount,
      imageCount,
      noteCount,
      pageBreakCount,
      sectionCount: nonEmptySections.length,
    },
  };
}
