import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { generateImportedPagesTechnicalPdf } from "../../imported-page-pdf.ts";
import {
  buildImportedPrintRenderModel,
  type ImportedPrintBlock,
} from "../../imported-page-print-renderer.ts";
import { adaptKdpDraftV1ToImportedPages } from "../kdp-draft-v1-adapter.ts";
import { parseKdpDraftV1 } from "../kdp-draft-v1.ts";

const PIPELINE_DRAFT = `KDP_DRAFT_V1

BOOK
title: Diario Allenamento 90 Giorni
subtitle: Logbook fitness
language: it
trim_size: 7x10
interior: black_white
theme: minimal
target_pages: 9
END_BOOK

PAGE
id: intro
title: Come usare questo diario
type: intro
TEXT
Compila poche informazioni ogni giorno e usa le tabelle per controllare i progressi.
END_TEXT
END_PAGE

PAGE
id: owner
title: Dati iniziali
type: fields
FIELDS
- Nome | short
- Focus principale | medium
- Obiettivo dei 90 giorni | long
END_FIELDS
END_PAGE

PAGE
id: weekly_plan
title: Piano settimanale
type: table
TABLE
title: Piano settimanale
table_mode: fixed_rows
COLUMNS
- Giorno
- Focus
- Orario
- Note
END_COLUMNS
ROWS
- Lunedi | | |
- Martedi | | |
- Mercoledi | | |
- Giovedi | | |
- Venerdi | | |
- Sabato | | |
- Domenica | | |
END_ROWS
END_TABLE
END_PAGE

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
- Vita
- Note
END_COLUMNS
rows: 8
END_TABLE
END_PAGE

PAGE
id: habits
title: Habit tracker mensile
type: habit_tracker
days: 31
ROWS
- Allenamento
- Acqua
- Sonno
END_ROWS
END_PAGE

PAGE
id: notes
title: Note e riflessioni
type: notes
PROMPTS
- Cosa sta funzionando?
- Cosa voglio migliorare?
END_PROMPTS
END_PAGE

PAGE
id: workout
type: worksheet
repeat: 3
title_pattern: Scheda {{n}}
FIELDS_GROUP
title: Dati allenamento
FIELDS
- Data | short
- Focus | medium
END_FIELDS
END_FIELDS_GROUP
TABLE
title: Esercizi
table_mode: fixed_capacity
COLUMNS
- Esercizio
- Serie
- Ripetizioni
- Note
END_COLUMNS
rows: 4
END_TABLE
PROMPTS
- Note finali
END_PROMPTS
END_PAGE`;

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

function collectBlocks(blocks: ImportedPrintBlock[]): ImportedPrintBlock[] {
  return blocks.flatMap((block) =>
    block.type === "group" ? [block, ...collectBlocks(block.blocks)] : [block],
  );
}

function hasBlockType(
  blocks: ImportedPrintBlock[],
  type: ImportedPrintBlock["type"],
) {
  return collectBlocks(blocks).some((block) => block.type === type);
}

test("generates a technical PDF from KDP_DRAFT_V1 parser and adapter pipeline", async () => {
  const parseResult = parseKdpDraftV1(PIPELINE_DRAFT);

  assert.equal(parseResult.ok, true);
  assert.ok(parseResult.document);
  assert.equal(parseResult.document.book.title, "Diario Allenamento 90 Giorni");
  assert.equal(parseResult.document.book.targetPages, 9);

  const adapterResult = adaptKdpDraftV1ToImportedPages(parseResult.document);

  assert.equal(adapterResult.ok, true);
  assert.deepEqual(adapterResult.errors, []);
  assert.equal(adapterResult.model.bookSettings?.trimSize, "7x10");
  assert.equal(adapterResult.model.pages.length, 9);
  assert.deepEqual(
    adapterResult.model.pages.map((page) => page.title),
    [
      "Come usare questo diario",
      "Dati iniziali",
      "Piano settimanale",
      "Tracker misure",
      "Habit tracker mensile",
      "Note e riflessioni",
      "Scheda 1",
      "Scheda 2",
      "Scheda 3",
    ],
  );
  assert.deepEqual(
    adapterResult.model.pages.map((page) => page.pageNumber),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );

  const fieldsContent = asRecord(adapterResult.model.pages[1]?.content);
  const fieldsBlock = asRecord(asArray(fieldsContent.blocks)[0]);
  assert.deepEqual(fieldsBlock.fields, [
    "Nome",
    "Focus principale",
    "Obiettivo dei 90 giorni",
  ]);

  const fixedRowsContent = asRecord(adapterResult.model.pages[2]?.content);
  const fixedRowsTable = asRecord(asRecord(asArray(fixedRowsContent.blocks)[0]).table);
  const fixedRows = asArray(fixedRowsTable.rows);
  assert.equal(fixedRowsTable.table_mode, "fixed_rows");
  assert.equal(fixedRows.length, 7);
  assert.deepEqual(
    fixedRows.map((row) => asArray(row)[0]),
    ["Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato", "Domenica"],
  );
  assert.deepEqual(fixedRowsTable.columns, ["Giorno", "Focus", "Orario", "Note"]);

  const openEndedContent = asRecord(adapterResult.model.pages[3]?.content);
  const openEndedTable = asRecord(asRecord(asArray(openEndedContent.blocks)[0]).table);
  assert.equal(openEndedTable.table_mode, "open_ended");
  assert.equal(openEndedTable.rowCount, 8);
  assert.deepEqual(openEndedTable.columns, ["Data", "Peso", "Vita", "Note"]);

  const habitContent = asRecord(adapterResult.model.pages[4]?.content);
  assert.equal(habitContent.days, 31);
  assert.deepEqual(habitContent.abitudini, ["Allenamento", "Acqua", "Sonno"]);

  const notesContent = asRecord(adapterResult.model.pages[5]?.content);
  const notesBlock = asRecord(asArray(notesContent.blocks)[0]);
  assert.deepEqual(notesBlock.prompts, [
    "Cosa sta funzionando?",
    "Cosa voglio migliorare?",
  ]);

  const renderModel = buildImportedPrintRenderModel(adapterResult.model);

  assert.equal(renderModel.pages.length, 9);
  assert.equal(renderModel.settings.pageSize.widthIn, 7);
  assert.equal(renderModel.settings.pageSize.heightIn, 10);
  assert.equal(hasBlockType(renderModel.pages[2]?.blocks ?? [], "tables"), true);
  assert.equal(hasBlockType(renderModel.pages[3]?.blocks ?? [], "tables"), true);
  assert.equal(hasBlockType(renderModel.pages[4]?.blocks ?? [], "tables"), true);
  assert.equal(hasBlockType(renderModel.pages[5]?.blocks ?? [], "prompts"), true);
  assert.equal(hasBlockType(renderModel.pages[6]?.blocks ?? [], "fields"), true);
  assert.equal(hasBlockType(renderModel.pages[6]?.blocks ?? [], "tables"), true);

  const bytes = await generateImportedPagesTechnicalPdf(renderModel, {
    title: parseResult.document.book.title,
  });
  const pdf = await PDFDocument.load(bytes);

  assert.equal(pdf.getPageCount(), 9);
  assert.ok(bytes.length > 1000);
});
