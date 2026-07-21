export const KDP_EDITORIAL_DRAFT_V1_HEADER = "KDP_EDITORIAL_DRAFT_V1";
export const KDP_EDITORIAL_DRAFT_V1_PARSER_VERSION =
  "kdp_editorial_draft_v1";

export type EditorialIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type EditorialBlockType =
  | "editorial"
  | "list"
  | "paragraph"
  | "separator";

export type EditorialBlock = {
  id: string;
  type: EditorialBlockType;
  text: string;
};

export type EditorialSubsection = {
  id: string;
  kind: "heading" | "key" | "numbered";
  number?: number;
  title: string;
  blocks: EditorialBlock[];
};

export type EditorialSection = {
  id: string;
  kind: "chapter" | "introduction" | "main";
  title: string | null;
  blocks: EditorialBlock[];
  subsections: EditorialSubsection[];
};

export type EditorialDraftProject = {
  kind: "editorial";
  format: typeof KDP_EDITORIAL_DRAFT_V1_HEADER;
  parserVersion: typeof KDP_EDITORIAL_DRAFT_V1_PARSER_VERSION;
  title: string | null;
  subtitle: string | null;
  sections: EditorialSection[];
  summary: {
    annotationCount: number;
    blockCount: number;
    chapterCount: number;
    subsectionCount: number;
  };
  ignoredPageAnnotations: string[];
  warnings: EditorialIssue[];
  errors: EditorialIssue[];
  source: {
    contentText: string;
    importedAt: string;
    rawText: string;
  };
};

type SourceLine = {
  text: string;
  ignored: boolean;
};

const INTRODUCTION_HEADINGS = new Set([
  "INTRODUZIONE",
  "INTRODUCTION",
  "PREFAZIONE",
  "PREFACE",
  "PROLOGO",
  "PROLOGUE",
]);
const MAIN_SECTION_HEADINGS = new Set([
  "CONCLUSIONE",
  "CONCLUSION",
  "EPILOGO",
  "EPILOGUE",
  "APPENDICE",
  "APPENDIX",
  "RINGRAZIAMENTI",
  "ACKNOWLEDGEMENTS",
  "NOTE FINALI",
  "FINAL NOTES",
]);
const MINOR_EDITORIAL_HEADINGS = new Set([
  "OMBRA",
  "POTENZIALE",
  "EVOLUZIONE",
  "ALLERTA",
  "CONSIGLIO",
  "UTILIZZO",
  "RITO",
  "PICCOLO RITO",
  "FRASI DI MANIFESTAZIONE",
  "POTERE SUL CORPO",
  "POTERE SULLA MENTE E SULLO SPIRITO",
  "ENERGIA DEL CHAKRA",
  "ENERGIA DA RICORDARE",
  "SE LA SCEGLI GREZZA",
  "SE LA INDOSSI",
]);

const PAGE_ANNOTATION = /^(?:📖\s*)?PAGINA\s+\d+(?:\s*\([^\r\n)]*\))?$/iu;
const SEPARATOR = /^(?:⸻|(?:[-*_•·=]\s*){3,})$/u;
const BULLET = /^\s*(?:[-*•]\s+|\d+[.)]\s+)/u;
const NUMBERED_HEADING = /^(\d+)[.)]\s+(.+)$/u;
const NAMED_CHAPTER = /^(?:CAPITOLO|CHAPTER)\s+(?:\d+|[IVXLCDM]+)(?:\s*[-:.]\s*|\s+).+$/iu;
const ORDINAL_INTERNAL_HEADING =
  /^(?:(?:PRIM[OA]|SECOND[OA]|TERZ[OA]|QUART[OA]|QUINT[OA])|(?:FIRST|SECOND|THIRD|FOURTH|FIFTH))\s+(?:CHIAVE|PARTE|PASSO|FASE|KEY|PART|STEP|PHASE)\b/iu;

function comparableText(value: string) {
  return value.trim().normalize("NFC").toLocaleUpperCase("it-IT");
}

function isUppercaseHeading(value: string) {
  const clean = value.trim();
  const letters = clean.match(/\p{L}/gu) ?? [];

  return (
    clean.length > 0 &&
    clean.length <= 100 &&
    letters.length >= 2 &&
    clean === clean.toLocaleUpperCase("it-IT")
  );
}

function isChapterHeading(value: string) {
  const clean = value.trim();
  const numbered = clean.match(NUMBERED_HEADING);

  return (
    NAMED_CHAPTER.test(clean) ||
    Boolean(numbered && isUppercaseHeading(numbered[2]))
  );
}

function parseNumberedHeading(value: string) {
  const match = value.trim().match(NUMBERED_HEADING);

  if (!match || !isUppercaseHeading(match[2])) {
    return null;
  }

  return {
    number: Number(match[1]),
    title: match[2],
  };
}

function isExplicitChapterHeading(value: string) {
  return NAMED_CHAPTER.test(value.trim());
}

function isIntroductionHeading(value: string) {
  return INTRODUCTION_HEADINGS.has(comparableText(value));
}

function isMainSectionHeading(value: string) {
  return MAIN_SECTION_HEADINGS.has(comparableText(value));
}

function isMinorEditorialHeading(value: string) {
  return MINOR_EDITORIAL_HEADINGS.has(comparableText(value));
}

function isOrdinalInternalHeading(value: string) {
  return ORDINAL_INTERNAL_HEADING.test(value.trim());
}

function isRelativeInternalHeading(value: string) {
  const comparable = comparableText(value);

  return (
    isUppercaseHeading(value) &&
    /^(?:I|LE|GLI|IL|LA|L['’]|THE)\s+.+\s+CHE\s+.+$/u.test(comparable)
  );
}

function isSubsectionHeading(value: string) {
  return (
    isUppercaseHeading(value) &&
    !isChapterHeading(value) &&
    !isIntroductionHeading(value) &&
    !isMainSectionHeading(value) &&
    !SEPARATOR.test(value.trim())
  );
}

function hasNumberedRestartAhead(lines: SourceLine[], start: number) {
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.ignored || !line.text.trim()) {
      continue;
    }

    const numbered = parseNumberedHeading(line.text);

    if (numbered) {
      return numbered.number === 1;
    }

    if (
      isUppercaseHeading(line.text) ||
      isIntroductionHeading(line.text) ||
      isMainSectionHeading(line.text)
    ) {
      return false;
    }
  }

  return false;
}

function classifyBlock(text: string): EditorialBlockType {
  const lines = text.split("\n");

  if (lines.length === 1 && SEPARATOR.test(lines[0].trim())) {
    return "separator";
  }

  if (lines.every((line) => BULLET.test(line))) {
    return "list";
  }

  if (/^(?:NOTA|BOX|FOCUS|ESERCIZIO|RIFLESSIONE)\s*:/iu.test(text.trim())) {
    return "editorial";
  }

  return "paragraph";
}

function findNextContentLine(lines: SourceLine[], start: number) {
  for (let index = start; index < lines.length; index += 1) {
    if (!lines[index].ignored && lines[index].text.trim()) {
      return index;
    }
  }

  return -1;
}

function countBlocks(sections: EditorialSection[]) {
  return sections.reduce(
    (total, section) =>
      total +
      section.blocks.length +
      section.subsections.reduce(
        (subTotal, subsection) => subTotal + subsection.blocks.length,
        0,
      ),
    0,
  );
}

export function isEditorialDraft(rawText: string) {
  const firstContentLine = String(rawText ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .find((line) => line.trim());

  return firstContentLine?.trim() === KDP_EDITORIAL_DRAFT_V1_HEADER;
}

/**
 * Structural invariant: the parser may modify document structure, but it must
 * not modify content. Every stored title and block is copied from source lines.
 */
export function parseKdpEditorialDraftV1(
  rawText: string,
  options: { importedAt?: string } = {},
): EditorialDraftProject {
  const sourceText = String(rawText ?? "");
  const normalizedLines = sourceText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const ignoredPageAnnotations: string[] = [];
  const lines: SourceLine[] = normalizedLines.map((text) => {
    const ignored = PAGE_ANNOTATION.test(text.trim());

    if (ignored) {
      ignoredPageAnnotations.push(text);
    }

    return { ignored, text };
  });
  const errors: EditorialIssue[] = [];
  const warnings: EditorialIssue[] = [];
  const firstContentIndex = findNextContentLine(lines, 0);
  const hasOptionalHeader =
    firstContentIndex >= 0 &&
    lines[firstContentIndex].text.trim() === KDP_EDITORIAL_DRAFT_V1_HEADER;
  const contentText = normalizedLines
    .filter(
      (_text, index) =>
        !lines[index].ignored &&
        !(hasOptionalHeader && index === firstContentIndex),
    )
    .join("\n");
  const titleIndex = findNextContentLine(
    lines,
    hasOptionalHeader ? firstContentIndex + 1 : Math.max(0, firstContentIndex),
  );
  const title = titleIndex >= 0 ? lines[titleIndex].text : null;

  if (!title) {
    errors.push({
      code: "EDITORIAL_TITLE_MISSING",
      message: "Titolo editoriale non rilevato.",
      severity: "error",
    });
  }

  let cursor = titleIndex >= 0 ? titleIndex + 1 : lines.length;
  const subtitle: string | null = null;

  const sections: EditorialSection[] = [];
  let activeSection: EditorialSection | null = null;
  let activeSubsection: EditorialSubsection | null = null;
  let paragraphLines: string[] = [];
  let sectionSequence = 0;
  let subsectionSequence = 0;
  let blockSequence = 0;
  let primaryNumberingStarted = false;
  let expectedPrimaryNumber = 1;
  let mainSectionMode = false;

  function ensureIntroduction() {
    if (!activeSection) {
      sectionSequence += 1;
      activeSection = {
        blocks: [],
        id: `editorial-section-${sectionSequence}`,
        kind: "introduction",
        subsections: [],
        title: null,
      };
      sections.push(activeSection);
    }

    return activeSection;
  }

  function appendBlock(text: string, type: EditorialBlockType = classifyBlock(text)) {
    const section = ensureIntroduction();
    blockSequence += 1;
    const block: EditorialBlock = {
      id: `editorial-block-${blockSequence}`,
      text,
      type,
    };

    if (activeSubsection) {
      activeSubsection.blocks.push(block);
    } else {
      section.blocks.push(block);
    }
  }

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      appendBlock(paragraphLines.join("\n"));
      paragraphLines = [];
    }
  }

  function openSection(
    kind: EditorialSection["kind"],
    sectionTitle: string | null,
  ) {
    flushParagraph();
    sectionSequence += 1;
    activeSection = {
      blocks: [],
      id: `editorial-section-${sectionSequence}`,
      kind,
      subsections: [],
      title: sectionTitle,
    };
    sections.push(activeSection);
    activeSubsection = null;
  }

  function openSubsection(input: {
    kind: EditorialSubsection["kind"];
    number?: number;
    title: string;
  }) {
    const section = activeSection;

    if (!section) {
      return false;
    }

    flushParagraph();
    subsectionSequence += 1;
    activeSubsection = {
      blocks: [],
      id: `editorial-subsection-${subsectionSequence}`,
      kind: input.kind,
      ...(input.number === undefined ? {} : { number: input.number }),
      title: input.title,
    };
    section.subsections.push(activeSubsection);

    return true;
  }

  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];

    if (line.ignored) {
      continue;
    }

    if (!line.text.trim()) {
      flushParagraph();
      continue;
    }

    if (title !== null && line.text === title) {
      paragraphLines.push(line.text);
      continue;
    }

    if (isIntroductionHeading(line.text)) {
      openSection("introduction", line.text);
      continue;
    }

    if (isExplicitChapterHeading(line.text)) {
      openSection("chapter", line.text);
      primaryNumberingStarted = true;
      continue;
    }

    if (isMainSectionHeading(line.text)) {
      openSection("main", line.text);
      mainSectionMode = primaryNumberingStarted;
      continue;
    }

    const currentSection = activeSection as EditorialSection | null;
    const numberedHeading = parseNumberedHeading(line.text);

    if (numberedHeading) {
      const continuesPrimarySequence =
        primaryNumberingStarted &&
        !mainSectionMode &&
        numberedHeading.number === expectedPrimaryNumber;
      const startsPrimarySequence =
        !primaryNumberingStarted &&
        !mainSectionMode &&
        numberedHeading.number === 1;

      if (startsPrimarySequence || continuesPrimarySequence) {
        openSection("chapter", line.text);
        primaryNumberingStarted = true;
        expectedPrimaryNumber = numberedHeading.number + 1;
      } else if (
        currentSection?.kind === "main" ||
        mainSectionMode ||
        primaryNumberingStarted
      ) {
        openSubsection({
          kind: "numbered",
          number: numberedHeading.number,
          title: line.text,
        });
      } else {
        paragraphLines.push(line.text);
      }

      continue;
    }

    const opensFirstContextualMainSection =
      primaryNumberingStarted &&
      !mainSectionMode &&
      isSubsectionHeading(line.text) &&
      !isMinorEditorialHeading(line.text) &&
      hasNumberedRestartAhead(lines, cursor);

    if (opensFirstContextualMainSection) {
      openSection("main", line.text);
      mainSectionMode = true;
      continue;
    }

    if (mainSectionMode && isSubsectionHeading(line.text)) {
      if (isOrdinalInternalHeading(line.text)) {
        openSubsection({ kind: "key", title: line.text });
      } else if (
        isRelativeInternalHeading(line.text) ||
        isMinorEditorialHeading(line.text)
      ) {
        if (isMinorEditorialHeading(line.text) && activeSubsection) {
          flushParagraph();
          appendBlock(line.text, "editorial");
        } else {
          openSubsection({ kind: "heading", title: line.text });
        }
      } else {
        openSection("main", line.text);
      }

      continue;
    }

    if (currentSection?.kind === "chapter" && isSubsectionHeading(line.text)) {
      openSubsection({ kind: "heading", title: line.text });
      continue;
    }

    if (
      currentSection?.kind === "main" &&
      isOrdinalInternalHeading(line.text)
    ) {
      openSubsection({ kind: "key", title: line.text });
      continue;
    }

    if (currentSection?.kind === "main" && isMinorEditorialHeading(line.text)) {
      if (activeSubsection) {
        flushParagraph();
        appendBlock(line.text, "editorial");
      } else {
        openSubsection({ kind: "heading", title: line.text });
      }

      continue;
    }

    if (SEPARATOR.test(line.text.trim())) {
      flushParagraph();
      appendBlock(line.text);
      continue;
    }

    if (BULLET.test(line.text)) {
      flushParagraph();
      const listLines = [line.text];

      while (cursor + 1 < lines.length) {
        if (lines[cursor + 1].ignored) {
          cursor += 1;
          continue;
        }

        if (!BULLET.test(lines[cursor + 1].text)) break;
        cursor += 1;
        listLines.push(lines[cursor].text);
      }

      appendBlock(listLines.join("\n"));
      continue;
    }

    paragraphLines.push(line.text);
  }

  flushParagraph();

  if (sections.filter((section) => section.kind === "chapter").length === 0) {
    warnings.push({
      code: "EDITORIAL_CHAPTERS_NOT_DETECTED",
      message: "Nessun capitolo numerato o dichiarato e' stato rilevato.",
      severity: "warning",
    });
  }

  return {
    errors,
    format: KDP_EDITORIAL_DRAFT_V1_HEADER,
    ignoredPageAnnotations,
    kind: "editorial",
    parserVersion: KDP_EDITORIAL_DRAFT_V1_PARSER_VERSION,
    sections,
    source: {
      contentText,
      importedAt: options.importedAt ?? new Date().toISOString(),
      rawText: sourceText,
    },
    subtitle,
    summary: {
      annotationCount: ignoredPageAnnotations.length,
      blockCount: countBlocks(sections),
      chapterCount: sections.filter((section) => section.kind === "chapter").length,
      subsectionCount: sections.reduce(
        (total, section) => total + section.subsections.length,
        0,
      ),
    },
    title,
    warnings,
  };
}

export function collectEditorialContent(project: EditorialDraftProject) {
  const content: string[] = [];

  if (project.title !== null) content.push(project.title);
  if (project.subtitle !== null) content.push(project.subtitle);

  for (const section of project.sections) {
    if (section.title !== null) content.push(section.title);
    content.push(...section.blocks.map((block) => block.text));

    for (const subsection of section.subsections) {
      content.push(subsection.title);
      content.push(...subsection.blocks.map((block) => block.text));
    }
  }

  return content;
}
