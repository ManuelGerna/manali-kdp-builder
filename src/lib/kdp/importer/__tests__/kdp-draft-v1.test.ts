import assert from "node:assert/strict";
import test from "node:test";
import {
  parseKdpDraftV1,
  type KdpDraftV1ErrorCode,
} from "../kdp-draft-v1.ts";

function draftWithBody(body: string) {
  return `KDP_DRAFT_V1

${body}`;
}

function minimalBook() {
  return `BOOK
title: Test Book
subtitle: Test Subtitle
language: it
trim_size: 7x10
interior: black_white
theme: print_safe_gray
target_pages: 110
END_BOOK`;
}

function errorCodes(rawText: string) {
  return parseKdpDraftV1(rawText).errors.map((error) => error.code);
}

function assertHasErrors(rawText: string, codes: KdpDraftV1ErrorCode[]) {
  const result = parseKdpDraftV1(rawText);

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((error) => error.code), codes);
}

test("parses KDP_DRAFT_V1 minimal BOOK metadata", () => {
  const result = parseKdpDraftV1(draftWithBody(minimalBook()));

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.document?.version, "KDP_DRAFT_V1");
  assert.deepEqual(result.document?.book, {
    interior: "black_white",
    language: "it",
    subtitle: "Test Subtitle",
    targetPages: 110,
    theme: "print_safe_gray",
    title: "Test Book",
    trimSize: "7x10",
  });
  assert.deepEqual(result.document?.pages, []);
});

test("parses PAGE fields with explicit short medium and long intent", () => {
  const result = parseKdpDraftV1(draftWithBody(`${minimalBook()}

PAGE
id: owner
title: Questo diario appartiene a
type: fields
FIELDS
- Nome | short
- Focus allenamento | medium
- Obiettivo principale | long
END_FIELDS
END_PAGE`));

  assert.equal(result.ok, true);
  assert.equal(result.document?.pages.length, 1);
  assert.deepEqual(result.document?.pages[0]?.blocks, [
    {
      fields: [
        { intent: "short", label: "Nome" },
        { intent: "medium", label: "Focus allenamento" },
        { intent: "long", label: "Obiettivo principale" },
      ],
      type: "fields",
    },
  ]);
});

test("parses PAGE table with open_ended mode and COLUMNS", () => {
  const result = parseKdpDraftV1(draftWithBody(`${minimalBook()}

PAGE
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
END_PAGE`));
  const table = result.document?.pages[0]?.blocks[0];

  assert.equal(result.ok, true);
  assert.equal(table?.type, "table");

  if (table?.type === "table") {
    assert.equal(table.tableMode, "open_ended");
    assert.deepEqual(table.columns, ["Data", "Peso", "Note"]);
    assert.equal(table.rowCount, 8);
    assert.deepEqual(table.rows, []);
  }
});

test("parses PAGE fixed_rows table preserving Lunedì to Domenica rows", () => {
  const result = parseKdpDraftV1(draftWithBody(`${minimalBook()}

PAGE
id: weekly_plan
title: Piano allenamento settimanale
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
END_PAGE`));
  const table = result.document?.pages[0]?.blocks[0];

  assert.equal(result.ok, true);
  assert.equal(table?.type, "table");

  if (table?.type === "table") {
    assert.equal(table.tableMode, "fixed_rows");
    assert.equal(table.rows.length, 7);
    assert.deepEqual(table.rows[0], ["Lunedì", "", "", ""]);
    assert.deepEqual(table.rows[6], ["Domenica", "", "", ""]);
  }
});

test("parses habit_tracker with days and ROWS habits", () => {
  const result = parseKdpDraftV1(draftWithBody(`${minimalBook()}

PAGE
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
END_PAGE`));
  const rows = result.document?.pages[0]?.blocks[0];

  assert.equal(result.ok, true);
  assert.equal(result.document?.pages[0]?.days, 31);
  assert.equal(rows?.type, "rows");

  if (rows?.type === "rows") {
    assert.deepEqual(rows.rows, [
      ["Allenamento"],
      ["Acqua"],
      ["Passi"],
      ["Sonno"],
    ]);
  }
});

test("parses worksheet with field groups table and final field group", () => {
  const result = parseKdpDraftV1(draftWithBody(`${minimalBook()}

PAGE
id: workout_sheet
title: Scheda allenamento
type: worksheet
repeat: 80
title_pattern: Scheda allenamento {{n}}
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
END_PAGE`));
  const page = result.document?.pages[0];

  assert.equal(result.ok, true);
  assert.equal(page?.repeat, 80);
  assert.equal(page?.titlePattern, "Scheda allenamento {{n}}");
  assert.deepEqual(
    page?.blocks.map((block) => block.type),
    ["fields_group", "table", "fields_group"],
  );
});

test("parses notes page prompts", () => {
  const result = parseKdpDraftV1(draftWithBody(`${minimalBook()}

PAGE
id: final_notes
title: Note finali
type: notes
PROMPTS
- Quali risultati ho ottenuto?
- Quale sara il prossimo obiettivo?
END_PROMPTS
END_PAGE`));
  const prompts = result.document?.pages[0]?.blocks[0];

  assert.equal(result.ok, true);
  assert.equal(prompts?.type, "prompts");

  if (prompts?.type === "prompts") {
    assert.deepEqual(prompts.prompts, [
      "Quali risultati ho ottenuto?",
      "Quale sara il prossimo obiettivo?",
    ]);
  }
});

test("reports missing KDP_DRAFT_V1 header", () => {
  assertHasErrors(minimalBook(), ["HEADER_MISSING"]);
});

test("reports missing BOOK block", () => {
  assertHasErrors(`KDP_DRAFT_V1

PAGE
id: page_1
title: Page 1
type: text
TEXT
Content
END_TEXT
END_PAGE`, ["BOOK_MISSING"]);
});

test("reports unclosed BOOK block", () => {
  assertHasErrors(`KDP_DRAFT_V1

BOOK
title: Test Book`, ["BOOK_NOT_CLOSED"]);
});

test("reports PAGE without id", () => {
  assertHasErrors(draftWithBody(`${minimalBook()}

PAGE
title: Page without id
type: text
END_PAGE`), ["PAGE_MISSING_ID"]);
});

test("reports PAGE without title or title_pattern", () => {
  assertHasErrors(draftWithBody(`${minimalBook()}

PAGE
id: page_without_title
type: text
END_PAGE`), ["PAGE_MISSING_TITLE"]);
});

test("reports unclosed PAGE", () => {
  assertHasErrors(draftWithBody(`${minimalBook()}

PAGE
id: page_1
title: Page 1
type: text
TEXT
Content
END_TEXT`), ["PAGE_NOT_CLOSED"]);
});

test("reports unsupported page type", () => {
  assert.equal(
    errorCodes(draftWithBody(`${minimalBook()}

PAGE
id: bad
title: Bad
type: unsupported
END_PAGE`)).includes("PAGE_TYPE_UNSUPPORTED"),
    true,
  );
});

test("reports unsupported table_mode", () => {
  assert.equal(
    errorCodes(draftWithBody(`${minimalBook()}

PAGE
id: table_page
title: Table
type: table
TABLE
table_mode: elastic
END_TABLE
END_PAGE`)).includes("TABLE_MODE_UNSUPPORTED"),
    true,
  );
});

test("reports unsupported field intent", () => {
  assert.equal(
    errorCodes(draftWithBody(`${minimalBook()}

PAGE
id: fields_page
title: Fields
type: fields
FIELDS
- Nome | tiny
END_FIELDS
END_PAGE`)).includes("FIELD_INTENT_UNSUPPORTED"),
    true,
  );
});

test("reports unclosed nested block", () => {
  assert.equal(
    errorCodes(draftWithBody(`${minimalBook()}

PAGE
id: fields_page
title: Fields
type: fields
FIELDS
- Nome | short
END_PAGE`)).includes("BLOCK_NOT_CLOSED"),
    true,
  );
});
