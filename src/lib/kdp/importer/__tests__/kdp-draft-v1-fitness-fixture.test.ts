import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  FITNESS_LOGBOOK_IT_DRAFT_V1,
  FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT,
  FITNESS_LOGBOOK_IT_EXPECTED_TITLES,
} from "../__fixtures__/fitness-logbook-it.kdp-draft-v1.ts";
import { generateImportedPagesTechnicalPdf } from "../../imported-page-pdf.ts";
import {
  buildImportedPrintRenderModel,
  type ImportedPrintBlock,
} from "../../imported-page-print-renderer.ts";
import { adaptKdpDraftV1ToImportedPages } from "../kdp-draft-v1-adapter.ts";
import { parseKdpDraftV1 } from "../kdp-draft-v1.ts";

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

function firstBlock(content: unknown) {
  return asRecord(asArray(asRecord(content).blocks)[0]);
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

test("parses and renders the Italian fitness logbook KDP_DRAFT_V1 fixture", async () => {
  const parseResult = parseKdpDraftV1(FITNESS_LOGBOOK_IT_DRAFT_V1);

  assert.equal(parseResult.ok, true);
  assert.ok(parseResult.document);
  assert.deepEqual(parseResult.errors, []);
  assert.equal(parseResult.document.book.title, "Diario Allenamento 90 Giorni");
  assert.equal(
    parseResult.document.book.subtitle,
    "Traccia progressi, esercizi, abitudini e risultati",
  );
  assert.equal(parseResult.document.book.language, "it");
  assert.equal(parseResult.document.book.trimSize, "7x10");
  assert.equal(parseResult.document.book.interior, "black_white");
  assert.equal(parseResult.document.book.theme, "minimal_premium");
  assert.equal(
    parseResult.document.book.targetPages,
    FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT,
  );
  assert.equal(parseResult.document.pages.length, 8);

  const adapterResult = adaptKdpDraftV1ToImportedPages(parseResult.document);

  assert.equal(adapterResult.ok, true);
  assert.deepEqual(adapterResult.errors, []);
  assert.equal(
    adapterResult.model.pages.length,
    FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT,
  );
  assert.deepEqual(
    adapterResult.model.pages.map((page) => page.title),
    [...FITNESS_LOGBOOK_IT_EXPECTED_TITLES],
  );

  const normalizedProject = asRecord(adapterResult.model.normalizedProject);
  const project = asRecord(normalizedProject.project);

  assert.equal(project.title, "Diario Allenamento 90 Giorni");
  assert.equal(adapterResult.model.bookSettings?.trimSize, "7x10");

  const initialFields = firstBlock(adapterResult.model.pages[1]?.content);
  assert.deepEqual(initialFields.fields, [
    "Nome",
    "Data inizio",
    "Obiettivo principale",
    "Ricompensa finale",
  ]);

  const measurementFields = firstBlock(adapterResult.model.pages[2]?.content);
  assert.deepEqual(measurementFields.fields, [
    "Peso iniziale",
    "Girovita",
    "Petto",
    "Fianchi",
    "Note iniziali",
  ]);

  const plannerTable = asRecord(firstBlock(adapterResult.model.pages[3]?.content).table);
  const plannerRows = asArray(plannerTable.rows);

  assert.equal(plannerTable.table_mode, "fixed_rows");
  assert.deepEqual(plannerTable.columns, [
    "Giorno",
    "Allenamento",
    "Focus",
    "Note",
  ]);
  assert.equal(plannerRows.length, 7);
  assert.deepEqual(
    plannerRows.map((row) => asArray(row)[0]),
    ["Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato", "Domenica"],
  );

  const workoutPages = adapterResult.model.pages.slice(4, 8);

  assert.deepEqual(
    workoutPages.map((page) => page.title),
    [
      "Scheda allenamento 1",
      "Scheda allenamento 2",
      "Scheda allenamento 3",
      "Scheda allenamento 4",
    ],
  );

  const workoutBlocks = asArray(asRecord(workoutPages[0]?.content).blocks);
  const workoutHeader = asRecord(workoutBlocks[0]);
  const workoutTable = asRecord(asRecord(workoutBlocks[1]).table);
  const workoutFooter = asRecord(workoutBlocks[2]);

  assert.deepEqual(workoutHeader.fields, [
    "Data",
    "Gruppo muscolare",
    "Energia prima",
  ]);
  assert.equal(workoutTable.table_mode, "open_ended");
  assert.deepEqual(workoutTable.columns, [
    "Esercizio",
    "Serie",
    "Ripetizioni",
    "Peso",
    "Recupero",
    "Note",
  ]);
  assert.equal(workoutTable.rowCount, 8);
  assert.deepEqual(workoutFooter.fields, ["Energia dopo", "Cosa migliorare"]);

  const habitContent = asRecord(adapterResult.model.pages[8]?.content);

  assert.equal(habitContent.days, 31);
  assert.deepEqual(habitContent.abitudini, [
    "Allenamento",
    "Acqua",
    "Sonno regolare",
    "Stretching",
    "Proteine",
  ]);

  const reviewPrompts = firstBlock(adapterResult.model.pages[9]?.content);

  assert.deepEqual(reviewPrompts.prompts, [
    "Cosa ha funzionato meglio?",
    "Dove ho mollato?",
    "Cosa cambio dalla prossima settimana?",
  ]);

  const finalPrompts = firstBlock(adapterResult.model.pages[10]?.content);

  assert.deepEqual(finalPrompts.prompts, [
    "Risultati raggiunti",
    "Progressi piu importanti",
    "Prossimo obiettivo",
  ]);

  const renderModel = buildImportedPrintRenderModel(adapterResult.model);

  assert.equal(renderModel.pages.length, FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT);
  assert.equal(renderModel.settings.pageSize.widthIn, 7);
  assert.equal(renderModel.settings.pageSize.heightIn, 10);
  assert.equal(hasBlockType(renderModel.pages[0]?.blocks ?? [], "text"), true);
  assert.equal(hasBlockType(renderModel.pages[1]?.blocks ?? [], "fields"), true);
  assert.equal(hasBlockType(renderModel.pages[2]?.blocks ?? [], "fields"), true);
  assert.equal(hasBlockType(renderModel.pages[3]?.blocks ?? [], "tables"), true);
  assert.equal(hasBlockType(renderModel.pages[4]?.blocks ?? [], "fields"), true);
  assert.equal(hasBlockType(renderModel.pages[4]?.blocks ?? [], "tables"), true);
  assert.equal(hasBlockType(renderModel.pages[8]?.blocks ?? [], "tables"), true);
  assert.equal(hasBlockType(renderModel.pages[9]?.blocks ?? [], "prompts"), true);
  assert.equal(hasBlockType(renderModel.pages[10]?.blocks ?? [], "prompts"), true);

  const bytes = await generateImportedPagesTechnicalPdf(renderModel, {
    title: parseResult.document.book.title,
  });
  const pdf = await PDFDocument.load(bytes);

  assert.equal(pdf.getPageCount(), FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT);
  assert.ok(bytes.length > 1000);
});
