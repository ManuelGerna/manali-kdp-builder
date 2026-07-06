import assert from "node:assert/strict";
import test from "node:test";
import { buildImportedPrintRenderModel } from "../../imported-page-print-renderer.ts";
import { adaptKdpDraftV1ToImportedPages } from "../kdp-draft-v1-adapter.ts";
import {
  parseKdpDraftV1,
  type KdpDraftV1Document,
} from "../kdp-draft-v1.ts";

function draftWithBody(body: string) {
  return `KDP_DRAFT_V1

BOOK
title: Test Book
subtitle: Test Subtitle
language: it
trim_size: 7x10
interior: black_white
theme: print_safe_gray
target_pages: 110
END_BOOK

${body}`;
}

function parseValidDraft(body: string) {
  const result = parseKdpDraftV1(draftWithBody(body));

  assert.equal(result.ok, true);
  assert.ok(result.document);
  return result.document;
}

function adaptValidDraft(body: string) {
  const result = adaptKdpDraftV1ToImportedPages(parseValidDraft(body));

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  return result;
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  assert.equal(Array.isArray(value), true);
  return value as unknown[];
}

function firstContentBlock(document: ReturnType<typeof adaptValidDraft>) {
  const content = asRecord(document.model.pages[0]?.content);
  const blocks = asArray(content.blocks);

  return asRecord(blocks[0]);
}

function firstContentExtras(document: ReturnType<typeof adaptValidDraft>) {
  return asRecord(asRecord(document.model.pages[0]?.content).extras);
}

function contentCounts(value: unknown): {
  columns: number;
  fields: number;
  prompts: number;
  rows: number;
} {
  if (Array.isArray(value)) {
    return value.reduce(
      (total, item) => {
        const count = contentCounts(item);

        return {
          columns: total.columns + count.columns,
          fields: total.fields + count.fields,
          prompts: total.prompts + count.prompts,
          rows: total.rows + count.rows,
        };
      },
      { columns: 0, fields: 0, prompts: 0, rows: 0 },
    );
  }

  if (!value || typeof value !== "object") {
    return { columns: 0, fields: 0, prompts: 0, rows: 0 };
  }

  const record = value as Record<string, unknown>;
  const fields = Array.isArray(record.fields) ? record.fields.length : 0;
  const prompts = Array.isArray(record.prompts) ? record.prompts.length : 0;
  const columns = Array.isArray(record.columns) ? record.columns.length : 0;
  const rows = Array.isArray(record.rows) ? record.rows.length : 0;

  return Object.entries(record).reduce(
    (total, [key, item]) => {
      if (key === "extras") {
        return total;
      }

      const count = contentCounts(item);

      return {
        columns: total.columns + count.columns,
        fields: total.fields + count.fields,
        prompts: total.prompts + count.prompts,
        rows: total.rows + count.rows,
      };
    },
    { columns, fields, prompts, rows },
  );
}

test("adapts BOOK metadata into book settings and normalized project", () => {
  const result = adaptValidDraft(`PAGE
id: intro
title: Intro
type: text
TEXT
Benvenuto.
END_TEXT
END_PAGE`);
  const normalizedProject = asRecord(result.model.normalizedProject);
  const project = asRecord(normalizedProject.project);
  const technicalSpecs = asRecord(normalizedProject.technicalSpecs);
  const visualSystem = asRecord(normalizedProject.visualSystem);

  assert.deepEqual(result.model.bookSettings, { trimSize: "7x10" });
  assert.equal(project.title, "Test Book");
  assert.equal(project.subtitle, "Test Subtitle");
  assert.equal(project.language, "it");
  assert.equal(technicalSpecs.trimSize, "7x10");
  assert.equal(technicalSpecs.interiorColor, "black_white");
  assert.equal(technicalSpecs.targetPageCount, 110);
  assert.equal(visualSystem.colorMode, "print_safe_gray");
});

test("adapts fields page preserving short medium and long intents", () => {
  const result = adaptValidDraft(`PAGE
id: owner
title: Questo diario appartiene a
type: fields
FIELDS
- Nome | short
- Focus allenamento | medium
- Obiettivo principale | long
END_FIELDS
END_PAGE`);
  const block = firstContentBlock(result);
  const extras = asRecord(block.extras);

  assert.deepEqual(block.fields, [
    "Nome",
    "Focus allenamento",
    "Obiettivo principale",
  ]);
  assert.deepEqual(extras.fieldIntents, [
    { intent: "short", label: "Nome" },
    { intent: "medium", label: "Focus allenamento" },
    { intent: "long", label: "Obiettivo principale" },
  ]);
  assert.equal(firstContentExtras(result).pageType, "fields");
});

test("adapts fixed_rows weekly planner without adding rows", () => {
  const result = adaptValidDraft(`PAGE
id: weekly_plan
title: Piano settimanale
type: table
TABLE
table_mode: fixed_rows
COLUMNS
- Giorno
- Focus allenamento
- Orario
- Note
END_COLUMNS
ROWS
- Lunedì | | |
- Martedì | | |
- Mercoledì | | |
- Giovedì | | |
- Venerdì | | |
- Sabato | | |
- Domenica | | |
END_ROWS
END_TABLE
END_PAGE`);
  const table = asRecord(firstContentBlock(result).table);

  assert.deepEqual(table.columns, [
    "Giorno",
    "Focus allenamento",
    "Orario",
    "Note",
  ]);
  assert.equal(table.table_mode, "fixed_rows");
  assert.equal(table.rowCount, 7);
  assert.equal(asArray(table.rows).length, 7);
});

test("adapts open_ended table preserving table mode", () => {
  const result = adaptValidDraft(`PAGE
id: measurements
title: Tracker misure
type: table
TABLE
title: Tracker misure
table_mode: open_ended
COLUMNS
- Data
- Peso
- Note
END_COLUMNS
rows: 8
END_TABLE
END_PAGE`);
  const table = asRecord(firstContentBlock(result).table);

  assert.equal(table.table_mode, "open_ended");
  assert.equal(table.rowCount, 8);
  assert.deepEqual(table.columns, ["Data", "Peso", "Note"]);
});

test("adapts habit tracker preserving 31 days and habit rows", () => {
  const result = adaptValidDraft(`PAGE
id: monthly_habits
title: Habit tracker mensile
type: habit_tracker
days: 31
ROWS
- Allenamento
- Acqua
- Passi
- Sonno
END_ROWS
END_PAGE`);
  const content = asRecord(result.model.pages[0]?.content);
  const renderModel = buildImportedPrintRenderModel(result.model);

  assert.equal(content.days, 31);
  assert.deepEqual(content.abitudini, [
    "Allenamento",
    "Acqua",
    "Passi",
    "Sonno",
  ]);
  assert.equal(renderModel.pages[0]?.blocks[0]?.type, "tables");
  assert.equal(renderModel.pages[0]?.blocks.length, 1);
});

test("adapts worksheet preserving block order", () => {
  const result = adaptValidDraft(`PAGE
id: workout_sheet
title: Scheda allenamento
type: worksheet
FIELDS_GROUP
title: Dati allenamento
FIELDS
- Data | short
- Focus allenamento | medium
END_FIELDS
END_FIELDS_GROUP
TABLE
title: Esercizi
table_mode: fixed_capacity
COLUMNS
- Esercizio
- Serie
- Note
END_COLUMNS
rows: 8
END_TABLE
FIELDS_GROUP
title: Chiusura
FIELDS
- Note finali | long
END_FIELDS
END_FIELDS_GROUP
END_PAGE`);
  const content = asRecord(result.model.pages[0]?.content);
  const blocks = asArray(content.blocks);

  assert.equal(asRecord(blocks[0]).title, "Dati allenamento");
  assert.deepEqual(asRecord(blocks[0]).fields, [
    "Data",
    "Focus allenamento",
  ]);
  assert.equal(asRecord(asRecord(blocks[1]).table).table_mode, "fixed_capacity");
  assert.equal(asRecord(blocks[2]).title, "Chiusura");
});

test("adapts notes preserving prompts", () => {
  const result = adaptValidDraft(`PAGE
id: final_notes
title: Note finali
type: notes
PROMPTS
- Quali risultati ho ottenuto?
- Quale sara il prossimo obiettivo?
END_PROMPTS
END_PAGE`);
  const block = firstContentBlock(result);

  assert.deepEqual(block.prompts, [
    "Quali risultati ho ottenuto?",
    "Quale sara il prossimo obiettivo?",
  ]);
});

test("expands repeat pages with title_pattern", () => {
  const result = adaptValidDraft(`PAGE
id: workout_sheet
type: worksheet
repeat: 3
title_pattern: Scheda {{n}}
PROMPTS
- Note finali
END_PROMPTS
END_PAGE`);

  assert.equal(result.model.pages.length, 3);
  assert.deepEqual(
    result.model.pages.map((page) => page.title),
    ["Scheda 1", "Scheda 2", "Scheda 3"],
  );
  assert.deepEqual(
    result.model.pages.map((page) => page.pageNumber),
    [1, 2, 3],
  );
  assert.deepEqual(
    result.model.pages.map((page) =>
      asRecord(asRecord(page.content).extras).repeatIndex,
    ),
    [1, 2, 3],
  );
  assert.equal(
    asRecord(asRecord(result.model.pages[0]?.content).extras).titlePattern,
    "Scheda {{n}}",
  );
});

test("preserves fill and page table mode as non-printing extras", () => {
  const result = adaptValidDraft(`PAGE
id: table_page
title: Tabella
type: table
table_mode: open_ended
fill: page
TABLE
table_mode: open_ended
COLUMNS
- Data
- Note
END_COLUMNS
rows: 8
END_TABLE
END_PAGE`);
  const content = asRecord(result.model.pages[0]?.content);
  const extras = asRecord(content.extras);
  const renderModel = buildImportedPrintRenderModel(result.model);

  assert.equal(content.fill, undefined);
  assert.equal(content.table_mode, undefined);
  assert.equal(extras.fill, "page");
  assert.equal(extras.tableMode, "open_ended");
  assert.equal(
    renderModel.pages[0]?.blocks.some((block) => block.type === "fields"),
    false,
  );
});

test("keeps supported field column row and prompt counts", () => {
  const document = parseValidDraft(`PAGE
id: no_content_loss
title: Pagina completa
type: worksheet
FIELDS
- Nome | short
- Obiettivo | long
END_FIELDS
TABLE
table_mode: fixed_rows
COLUMNS
- Giorno
- Note
END_COLUMNS
ROWS
- Lunedì |
- Martedì |
END_ROWS
END_TABLE
PROMPTS
- Cosa migliorare?
- Quale piano seguire?
END_PROMPTS
END_PAGE`);
  const result = adaptKdpDraftV1ToImportedPages(document);

  assert.equal(result.ok, true);
  assert.deepEqual(contentCounts(document.pages[0]?.blocks), {
    columns: 2,
    fields: 2,
    prompts: 2,
    rows: 2,
  });
  assert.deepEqual(contentCounts(result.model.pages[0]?.content), {
    columns: 2,
    fields: 2,
    prompts: 2,
    rows: 2,
  });
});

test("reports table without columns", () => {
  const document = parseValidDraft(`PAGE
id: bad_table
title: Tabella incompleta
type: table
TABLE
table_mode: open_ended
rows: 8
END_TABLE
END_PAGE`);
  const result = adaptKdpDraftV1ToImportedPages(document);

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "TABLE_COLUMNS_MISSING");
});

test("reports habit tracker without days", () => {
  const document = parseValidDraft(`PAGE
id: bad_habits
title: Habit tracker
type: habit_tracker
ROWS
- Allenamento
END_ROWS
END_PAGE`);
  const result = adaptKdpDraftV1ToImportedPages(document);

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "HABIT_TRACKER_DAYS_MISSING");
});

test("reports habit tracker without rows", () => {
  const document = parseValidDraft(`PAGE
id: bad_habits
title: Habit tracker
type: habit_tracker
days: 31
END_PAGE`);
  const result = adaptKdpDraftV1ToImportedPages(document);

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "HABIT_TRACKER_ROWS_MISSING");
});

test("reports empty fields prompts and rows blocks", () => {
  const document = parseValidDraft(`PAGE
id: empty_blocks
title: Empty blocks
type: worksheet
FIELDS
END_FIELDS
PROMPTS
END_PROMPTS
ROWS
END_ROWS
END_PAGE`);
  const result = adaptKdpDraftV1ToImportedPages(document);

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["FIELDS_MISSING", "PROMPTS_MISSING", "ROWS_MISSING"],
  );
});

test("reports unsupported block type", () => {
  const document: KdpDraftV1Document = {
    book: { title: "Test" },
    pages: [
      {
        blocks: [{ type: "unknown" } as never],
        id: "bad_block",
        title: "Bad block",
        type: "worksheet",
      },
    ],
    version: "KDP_DRAFT_V1",
  };
  const result = adaptKdpDraftV1ToImportedPages(document);

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "BLOCK_TYPE_UNSUPPORTED");
});

test("reports unsupported page type", () => {
  const document: KdpDraftV1Document = {
    book: { title: "Test" },
    pages: [
      {
        blocks: [],
        id: "bad_page",
        title: "Bad page",
        type: "unknown" as never,
      },
    ],
    version: "KDP_DRAFT_V1",
  };
  const result = adaptKdpDraftV1ToImportedPages(document);

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "PAGE_TYPE_UNSUPPORTED");
  assert.equal(result.model.pages.length, 0);
});

test("reports invalid repeat values", () => {
  const document: KdpDraftV1Document = {
    book: { title: "Test" },
    pages: [
      {
        blocks: [],
        id: "bad_repeat",
        repeat: 0,
        title: "Bad repeat",
        type: "divider",
      },
    ],
    version: "KDP_DRAFT_V1",
  };
  const result = adaptKdpDraftV1ToImportedPages(document);

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "REPEAT_INVALID");
  assert.equal(result.model.pages.length, 0);
});
