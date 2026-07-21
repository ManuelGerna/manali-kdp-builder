import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEditorialBlockInserts,
  buildEditorialBookDetails,
  buildEditorialImportRunInsert,
  buildEditorialSectionInserts,
  canPersistEditorialDraft,
  getEditorialPersistenceFailureMessage,
  resolveEditorialPersistenceFailure,
} from "../../editorial-draft-persistence.ts";
import { hashGenericDraftText } from "../../generic-draft-persistence.ts";
import {
  buildEditorialDraftImportReport,
  normalizeDraftImportReport,
} from "../../import-runs.ts";
import type { Json } from "../../../../types/database.ts";
import { ARIES_EDITORIAL_OPENING } from "../__fixtures__/aries-editorial-opening.ts";
import {
  collectEditorialContent,
  KDP_EDITORIAL_DRAFT_V1_HEADER,
  parseKdpEditorialDraftV1,
} from "../kdp-editorial-draft-v1.ts";
import {
  normalizeDraftParserMode,
  parseDraftWithSelectedParser,
} from "../import-selection.ts";
import { importKdpBuilderDraft } from "../parser.ts";

const IMPORTED_AT = "2026-07-16T10:00:00.000Z";
const ACTOR = {
  email: "editor@example.com",
  userId: "00000000-0000-4000-8000-000000000001",
};

const MANUSCRIPT = `${KDP_EDITORIAL_DRAFT_V1_HEADER}
ARIETE: Fuoco vivo
Come ami, lavori & cresci — senza filtri

PAGINA 1
INTRODUZIONE
Non correggermi: è già così; “davvero”.

📖 PAGINA 2
1. AMORE
COME AMI DAVVERO
Tu ami forte, ma non cambi parola.
- Slancio
- Presenza

---

PAGINA 5 (destra)
OMBRA
L'impazienza resta com'è.

2. LAVORO & CARRIERA
POTENZIALE
NOTA: Questa è una nota editoriale.

PAGINA 6 (sinistra)`;

function semanticSourceLines(rawText: string) {
  return rawText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim())
    .filter((line) => line.trim() !== KDP_EDITORIAL_DRAFT_V1_HEADER)
    .filter(
      (line) =>
        !/^(?:📖\s*)?PAGINA\s+\d+(?:\s*\([^\r\n)]*\))?$/iu.test(
          line.trim(),
        ),
    );
}

function integritySourceText(rawText: string) {
  const lines = rawText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim());

  return lines
    .filter(
      (line, index) =>
        !/^(?:📖\s*)?PAGINA\s+\d+(?:\s*\([^\r\n)]*\))?$/iu.test(
          line.trim(),
        ) &&
        !(
          index === firstContentIndex &&
          line.trim() === KDP_EDITORIAL_DRAFT_V1_HEADER
        ),
    )
    .join("\n");
}

function collectPersistedContent(
  project: ReturnType<typeof parseKdpEditorialDraftV1>,
) {
  let sectionId = 0;
  const sections = buildEditorialSectionInserts(project, {
    actor: ACTOR,
    bookId: "book-1",
    createId: () => `section-${++sectionId}`,
  });
  const sectionMap = new Map(
    sections.map((section) => [
      section.sourceSectionId,
      section.insert.id as string,
    ]),
  );
  const blocks = buildEditorialBlockInserts(project, {
    actor: ACTOR,
    bookId: "book-1",
    sectionIdBySourceId: sectionMap,
  });
  const content = project.title ? [project.title] : [];

  for (const section of sections) {
    if (typeof section.insert.title === "string") {
      content.push(section.insert.title);
    }

    for (const block of blocks.filter(
      (item) => item.insert.section_id === section.insert.id,
    )) {
      if (typeof block.insert.title === "string") {
        content.push(block.insert.title);
      }

      if (typeof block.insert.body === "string") {
        content.push(...block.insert.body.split("\n"));
      }
    }
  }

  return { blocks, content, sections };
}

test("imports a reusable editorial manuscript without generating pages", () => {
  const project = parseKdpEditorialDraftV1(MANUSCRIPT, {
    importedAt: IMPORTED_AT,
  });

  assert.equal(project.format, "KDP_EDITORIAL_DRAFT_V1");
  assert.equal(project.title, "ARIETE: Fuoco vivo");
  assert.equal(project.subtitle, null);
  assert.equal(project.summary.chapterCount, 2);
  assert.equal(project.summary.subsectionCount, 3);
  assert.equal(project.summary.annotationCount, 4);
  assert.equal(project.errors.length, 0);
  assert.equal("pages" in project, false);
});

test("the parser may modify document structure, but it must not modify content", () => {
  const project = parseKdpEditorialDraftV1(MANUSCRIPT, {
    importedAt: IMPORTED_AT,
  });
  const outputLines = collectEditorialContent(project).flatMap((value) =>
    value.split("\n"),
  );
  const sourceLines = semanticSourceLines(MANUSCRIPT);

  assert.deepEqual(outputLines, sourceLines);
  assert.ok(outputLines.includes("Non correggermi: è già così; “davvero”."));
  assert.ok(outputLines.includes("L'impazienza resta com'è."));
});

test("recognizes chapters, subsections, lists and separators conservatively", () => {
  const project = parseKdpEditorialDraftV1(MANUSCRIPT);
  const chapter = project.sections.find((section) => section.title === "1. AMORE");

  assert.ok(chapter);
  assert.deepEqual(
    chapter.subsections.map((subsection) => subsection.title),
    ["COME AMI DAVVERO", "OMBRA"],
  );
  assert.ok(
    chapter.subsections.some((subsection) =>
      subsection.blocks.some((block) => block.type === "list"),
    ),
  );
  assert.ok(
    chapter.subsections.some((subsection) =>
      subsection.blocks.some((block) => block.type === "separator"),
    ),
  );

  const withoutSubtitle = parseKdpEditorialDraftV1(`${KDP_EDITORIAL_DRAFT_V1_HEADER}
Titolo solo

1. CAPITOLO
Testo.`);
  assert.equal(withoutSubtitle.subtitle, null);
});

test("parses the natural Aries opening without requiring a technical header", () => {
  const project = parseKdpEditorialDraftV1(ARIES_EDITORIAL_OPENING, {
    importedAt: IMPORTED_AT,
  });
  const outputLines = collectEditorialContent(project).flatMap((value) =>
    value.split("\n"),
  );
  const sourceLines = semanticSourceLines(ARIES_EDITORIAL_OPENING);
  const loveChapter = project.sections.find(
    (section) => section.title === "1. AMORE" && section.kind === "chapter",
  );
  const relationshipChapter = project.sections.find(
    (section) => section.title === "2. RELAZIONI" && section.kind === "chapter",
  );
  const manifestation = project.sections.find(
    (section) => section.title === "MANIFESTAZIONE",
  );
  const stones = project.sections.find(
    (section) => section.title === "PIETRE NATURALI",
  );
  const codes = project.sections.find(
    (section) => section.title === "I CODICI ENERGETICI DELL’ARIETE",
  );

  assert.equal(project.title, "ARIETE");
  assert.equal(project.subtitle, null);
  assert.equal(project.errors.length, 0);
  assert.equal(project.summary.annotationCount, 5);
  assert.deepEqual(project.ignoredPageAnnotations, [
    "PAGINA 1",
    "📖 PAGINA 2",
    "PAGINA 4 (CHIUSURA INTRO + TRANSIZIONE)",
    "PAGINA 5 (destra)",
    "PAGINA 6 (sinistra)",
  ]);
  assert.equal(project.summary.chapterCount, 2);
  assert.deepEqual(
    loveChapter?.subsections.map((subsection) => subsection.title),
    ["OMBRA", "POTENZIALE"],
  );
  assert.deepEqual(
    relationshipChapter?.subsections.map((subsection) => subsection.title),
    ["CONSIGLIO"],
  );
  assert.deepEqual(
    manifestation?.subsections.map((subsection) => subsection.title),
    ["1. AMORE", "2. RELAZIONI"],
  );
  assert.ok(
    manifestation?.subsections.every(
      (subsection) => subsection.kind === "numbered",
    ),
  );
  assert.deepEqual(
    stones?.subsections.map((subsection) => subsection.title),
    [
      "PRIMA CHIAVE — CORNIOLA",
      "SECONDA CHIAVE — LABRADORITE",
      "TERZA CHIAVE — QUARZO FUMÉ",
    ],
  );
  assert.ok(
    stones?.subsections.every((subsection) => subsection.kind === "key"),
  );
  assert.deepEqual(
    codes?.subsections.map((subsection) => subsection.title),
    [
      "I NUMERI CHE RISUONANO CON LA TUA ENERGIA",
      "I COLORI CHE ACCENDONO LA TUA ENERGIA",
    ],
  );
  assert.deepEqual(
    project.sections
      .filter((section) => section.kind === "main")
      .map((section) => section.title),
    [
      "MANIFESTAZIONE",
      "PIETRE NATURALI",
      "I CODICI ENERGETICI DELL’ARIETE",
      "LA TUA MAGIA CONTINUA",
      "UN DONO CHE CONTINUA IL VIAGGIO",
      "PRIMA DI SALUTARCI…",
    ],
  );
  assert.equal(
    project.sections.filter((section) => section.title === "ARIETE").length,
    0,
  );
  assert.equal(
    project.sections.some((section) =>
      section.subsections.some((subsection) => subsection.title === "ARIETE"),
    ),
    false,
  );
  assert.ok(outputLines.includes("Il mondo ti ha insegnato a trattenerti."));
  assert.ok(outputLines.includes("Non sei troppo."));
  assert.ok(outputLines.includes("Con affetto,"));
  assert.ok(outputLines.includes("Alice"));
  assert.ok(outputLines.includes("@alistoneswhisper"));
  assert.equal(outputLines.filter((line) => line === "ARIETE").length, 2);
  assert.deepEqual(outputLines, sourceLines);
  assert.equal(project.source.contentText, integritySourceText(ARIES_EDITORIAL_OPENING));
  assert.equal("pages" in project, false);
});

test("keeps representative Aries content identical through persistence plans", () => {
  const project = parseKdpEditorialDraftV1(ARIES_EDITORIAL_OPENING);
  const persistence = collectPersistedContent(project);

  assert.deepEqual(
    persistence.content,
    semanticSourceLines(ARIES_EDITORIAL_OPENING),
  );
  assert.ok(
    persistence.sections.every(
      (section) =>
        section.insert.layout_preset === "default" &&
        section.insert.page_break_before === false,
    ),
  );
  assert.ok(
    persistence.blocks.every((block) => block.insert.block_type === "text"),
  );
  assert.equal(
    persistence.blocks.some(
      (block) => block.insert.block_type === "page_break",
    ),
    false,
  );
});

test("recognizes the real divider and explicit bullet list without changing text", () => {
  const project = parseKdpEditorialDraftV1(ARIES_EDITORIAL_OPENING);
  const blocks = project.sections.flatMap((section) => [
    ...section.blocks,
    ...section.subsections.flatMap((subsection) => subsection.blocks),
  ]);
  const divider = blocks.find((block) => block.text === "⸻");
  const list = blocks.find((block) => block.type === "list");

  assert.equal(divider?.type, "separator");
  assert.equal(
    list?.text,
    "• Amore & relazioni\n• Lavoro & carriera\n• Denaro & sicurezza materiale",
  );
});

test("distinguishes conservative non-numbered main sections from subsections", () => {
  const project = parseKdpEditorialDraftV1(`Titolo

ARIETE
Testo di apertura.

1. AMORE
OMBRA
Testo ombra.

CONCLUSIONE
Testo finale.`);

  assert.equal(
    project.sections.some(
      (section) => section.kind === "main" && section.title === "CONCLUSIONE",
    ),
    true,
  );
  assert.equal(
    project.sections.some((section) =>
      section.subsections.some(
        (subsection) => subsection.title === "CONCLUSIONE",
      ),
    ),
    false,
  );
  assert.ok(
    collectEditorialContent(project).some((value) => value.includes("ARIETE")),
  );
});

test("keeps the first progressive numbering as main chapters and a restart internal", () => {
  const project = parseKdpEditorialDraftV1(`Titolo

Introduzione.

1. UNO
Testo.
2. DUE
Testo.
3. TRE
Testo.
4. QUATTRO
Testo.
5. CINQUE
Testo.
6. SEI
Testo.
7. SETTE
Testo.
8. OTTO
Testo.

SEZIONE TEMATICA
Testo.
1. PRIMA PARTE
Testo.
2. SECONDA PARTE
Testo.`);
  const chapters = project.sections.filter(
    (section) => section.kind === "chapter",
  );
  const thematic = project.sections.find(
    (section) => section.title === "SEZIONE TEMATICA",
  );

  assert.deepEqual(
    chapters.map((chapter) => chapter.title),
    [
      "1. UNO",
      "2. DUE",
      "3. TRE",
      "4. QUATTRO",
      "5. CINQUE",
      "6. SEI",
      "7. SETTE",
      "8. OTTO",
    ],
  );
  assert.deepEqual(
    thematic?.subsections.map((subsection) => subsection.title),
    ["1. PRIMA PARTE", "2. SECONDA PARTE"],
  );
});

test("keeps the optional technical header compatible and out of book content", () => {
  const withHeader = `${KDP_EDITORIAL_DRAFT_V1_HEADER}\n${ARIES_EDITORIAL_OPENING}`;
  const project = parseKdpEditorialDraftV1(withHeader);

  assert.equal(project.title, "ARIETE");
  assert.equal(project.errors.length, 0);
  assert.equal(
    collectEditorialContent(project).some(
      (value) => value === KDP_EDITORIAL_DRAFT_V1_HEADER,
    ),
    false,
  );
  assert.deepEqual(
    collectEditorialContent(project).flatMap((value) => value.split("\n")),
    semanticSourceLines(withHeader),
  );
  assert.equal(project.source.contentText, integritySourceText(withHeader));
});

test("uses the parser explicitly selected by the import UI flow", () => {
  const editorial = parseDraftWithSelectedParser(
    ARIES_EDITORIAL_OPENING,
    "editorial",
    { importedAt: IMPORTED_AT },
  );
  const structured = parseDraftWithSelectedParser(
    ARIES_EDITORIAL_OPENING,
    "structured",
    { importedAt: IMPORTED_AT },
  );

  assert.equal(normalizeDraftParserMode("editorial"), "editorial");
  assert.equal(normalizeDraftParserMode("structured"), "structured");
  assert.equal("kind" in editorial && editorial.kind, "editorial");
  assert.equal("importReport" in editorial, false);
  assert.equal("importReport" in structured, true);
});

test("creates editable section and text-block persistence plans", () => {
  const project = parseKdpEditorialDraftV1(MANUSCRIPT);
  const ids = [
    "section-opening",
    "section-intro",
    "section-love",
    "section-work",
  ];
  const sections = buildEditorialSectionInserts(project, {
    actor: ACTOR,
    bookId: "book-1",
    createId: () => ids.shift() as string,
  });
  const sectionMap = new Map(
    sections.map((section) => [section.sourceSectionId, section.insert.id as string]),
  );
  const blocks = buildEditorialBlockInserts(project, {
    actor: ACTOR,
    bookId: "book-1",
    sectionIdBySourceId: sectionMap,
  });

  assert.equal(canPersistEditorialDraft(project).ok, true);
  assert.equal(sections.length, 4);
  assert.ok(sections.every((section) => section.insert.page_break_before === false));
  assert.ok(blocks.length > project.summary.blockCount);
  assert.ok(blocks.every((block) => block.insert.block_type === "text"));
  assert.ok(blocks.every((block) => block.insert.print_visibility === "print"));
  assert.equal(blocks.some((block) => block.insert.body === "PAGINA 1"), false);
});

test("stores the full editorial structure in the import run", () => {
  const project = parseKdpEditorialDraftV1(MANUSCRIPT, {
    importedAt: IMPORTED_AT,
  });
  const insert = buildEditorialImportRunInsert(project, {
    actor: ACTOR,
    bookId: "book-1",
    draftHash: hashGenericDraftText(MANUSCRIPT),
    importRunId: "run-1",
    importToken: "token-1",
  });

  assert.equal(insert.import_kind, "editorial_draft_v1");
  assert.equal(insert.parser_version, "kdp_editorial_draft_v1");
  assert.equal(insert.source_draft_version, "KDP_EDITORIAL_DRAFT_V1");
  assert.deepEqual(insert.normalized_project, project);
  assert.equal(
    (insert.report as Record<string, Json>).format,
    "KDP_EDITORIAL_DRAFT_V1",
  );
});

test("builds and reads the new editorial post-import report", () => {
  const project = parseKdpEditorialDraftV1(ARIES_EDITORIAL_OPENING);
  const report = buildEditorialDraftImportReport(project);
  const normalized = normalizeDraftImportReport(report as unknown as Json);

  assert.equal(normalized.format, "KDP_EDITORIAL_DRAFT_V1");
  assert.equal(normalized.sectionCount, project.sections.length);
  assert.equal(normalized.chapterCount, 2);
  assert.equal(normalized.subsectionCount, project.summary.subsectionCount);
  assert.equal(normalized.annotationCount, 5);
  assert.equal(normalized.blockCount, report.blockCount);
  assert.equal(normalized.errorCount, 0);
});

test("keeps historical import reports compatible", () => {
  const normalized = normalizeDraftImportReport({
    blockCount: 7,
    duplicate: true,
    imagePlaceholderCount: 2,
    sectionCount: 3,
    warningCount: 1,
    warnings: ["Warning storico"],
  });

  assert.equal(normalized.blockCount, 7);
  assert.equal(normalized.sectionCount, 3);
  assert.equal(normalized.duplicate, true);
  assert.deepEqual(normalized.warnings, ["Warning storico"]);
  assert.equal(normalized.format, null);
  assert.equal(normalized.chapterCount, 0);
});

test("reads the previously prepared nested editorial report shape", () => {
  const normalized = normalizeDraftImportReport({
    errors: [],
    status: "success_with_warnings",
    summary: {
      annotationCount: 4,
      blockCount: 12,
      chapterCount: 2,
      subsectionCount: 5,
    },
    warnings: [
      {
        code: "OLD_WARNING",
        message: "Warning editoriale storico",
        severity: "warning",
      },
    ],
  });

  assert.equal(normalized.annotationCount, 4);
  assert.equal(normalized.blockCount, 12);
  assert.equal(normalized.chapterCount, 2);
  assert.equal(normalized.subsectionCount, 5);
  assert.deepEqual(normalized.warnings, ["Warning editoriale storico"]);
});

test("runs successful cleanup after a persistence failure", async () => {
  let cleanupCalls = 0;
  const message = await resolveEditorialPersistenceFailure(async () => {
    cleanupCalls += 1;

    return { data: { cleaned: true }, error: null };
  }, "Errore inserimento sezioni.");

  assert.equal(cleanupCalls, 1);
  assert.equal(
    message,
    "Errore inserimento sezioni.",
  );
});

test("runs failed cleanup and reports a possible partial book", async () => {
  let cleanupCalls = 0;
  const message = await resolveEditorialPersistenceFailure(async () => {
    cleanupCalls += 1;

    return {
      data: null,
      error:
        "Il libretto e' stato creato, ma il salvataggio non e' stato completato.",
    };
  }, "Errore inserimento blocchi.");

  assert.equal(cleanupCalls, 1);
  assert.equal(
    message,
    "Il libretto e' stato creato, ma il salvataggio non e' stato completato.",
  );
  assert.match(
    getEditorialPersistenceFailureMessage(
      { data: null, error: null },
      "Errore inserimento blocchi.",
    ),
    /potrebbe essere rimasto parziale/,
  );
});

test("supports private and public editorial book imports", () => {
  const project = parseKdpEditorialDraftV1(MANUSCRIPT);

  assert.equal(buildEditorialBookDetails(project, "private").visibility, "private");
  assert.equal(buildEditorialBookDetails(project, "public").visibility, "public");
  assert.equal(buildEditorialBookDetails(project, "private").aiUsageType, "none");
});

test("keeps the existing KDP_DRAFT_V1 importer behavior unchanged", () => {
  const existing = importKdpBuilderDraft(`KDP_DRAFT_V1

BOOK
title: Existing parser
language: it
trim_size: 6x9
interior: black_white
END_BOOK

PAGE
id: existing
title: Testo esistente
type: notes
PROMPTS
- Prompt esistente
END_PROMPTS
END_PAGE`);

  assert.equal(existing.source.draftVersion, "KDP_DRAFT_V1");
  assert.equal(existing.source.parserVersion, "kdp_draft_v1");
  assert.equal(existing.pages.length, 1);
});
