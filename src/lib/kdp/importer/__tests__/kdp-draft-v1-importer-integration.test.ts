import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  FITNESS_LOGBOOK_IT_DRAFT_V1,
  FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT,
} from "../__fixtures__/fitness-logbook-it.kdp-draft-v1.ts";
import { generateImportedPagesTechnicalPdf } from "../../imported-page-pdf.ts";
import { buildImportedPrintRenderModel } from "../../imported-page-print-renderer.ts";
import {
  detectKdpDraftFormat,
  importKdpBuilderDraft,
  KDP_DRAFT_V1_IMPORTER_VERSION,
  type NormalizedKdpProject,
} from "../index.ts";
import type { Json } from "../../../../types/database.ts";

const IMPORTED_AT = "2026-07-01T00:00:00.000Z";

function importDraft(rawText: string) {
  return importKdpBuilderDraft(rawText, { importedAt: IMPORTED_AT });
}

function issueCodes(project: NormalizedKdpProject) {
  return [
    ...project.importReport.warnings,
    ...project.importReport.errors,
  ].map((issue) => issue.code);
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

function legacyDraft() {
  return `KDP_BUILDER_DRAFT_VERSION: 0.1

TIPO_PROGETTO: KDP_INTERIOR_BOOK
LINGUA_LIBRO: it-IT
TIPO_LIBRO: generic_book

IDEA_LIBRO:
titolo_provvisorio: "Legacy Draft"

SPECIFICHE_TECNICHE:
formato: "6 x 9 in"
numero_pagine_target: 1

SEQUENZA_PAGINE:
- numero_pagina: 1
  titolo: "Pagina legacy"
  template_id: "template_legacy"
  testo: "Contenuto legacy"
`;
}

test("detects KDP_DRAFT_V1 and imports the fitness fixture through the existing entrypoint", async () => {
  assert.equal(detectKdpDraftFormat(FITNESS_LOGBOOK_IT_DRAFT_V1), "kdp_draft_v1");

  const project = importDraft(FITNESS_LOGBOOK_IT_DRAFT_V1);

  assert.equal(project.importReport.status, "success");
  assert.deepEqual(project.importReport.errors, []);
  assert.equal(project.source.draftVersion, "KDP_DRAFT_V1");
  assert.equal(project.source.parserVersion, KDP_DRAFT_V1_IMPORTER_VERSION);
  assert.equal(project.project.title, "Diario Allenamento 90 Giorni");
  assert.equal(project.project.subtitle, "Traccia progressi, esercizi, abitudini e risultati");
  assert.equal(project.project.language, "it");
  assert.equal(project.technicalSpecs.trimSize, "7x10");
  assert.equal(project.technicalSpecs.targetPageCount, FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT);
  assert.equal(project.importReport.summary.generatedPageCount, FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT);
  assert.equal(project.pages.length, FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT);

  const extras = asRecord(project.extras);
  const kdpDraftV1 = asRecord(extras.kdpDraftV1);

  assert.equal(kdpDraftV1.format, "KDP_DRAFT_V1");
  assert.equal(kdpDraftV1.adapterPageCount, FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT);

  const plannerContent = asRecord(project.pages[3]?.content);
  const plannerBlocks = asArray(plannerContent.blocks);
  const plannerTable = asRecord(asRecord(plannerBlocks[0]).table);

  assert.equal(plannerTable.table_mode, "fixed_rows");
  assert.equal(asArray(plannerTable.rows).length, 7);

  const workoutContent = asRecord(project.pages[4]?.content);
  const workoutBlocks = asArray(workoutContent.blocks);
  const workoutTable = asRecord(asRecord(workoutBlocks[1]).table);

  assert.equal(workoutTable.table_mode, "open_ended");
  assert.deepEqual(workoutTable.columns, [
    "Esercizio",
    "Serie",
    "Ripetizioni",
    "Peso",
    "Recupero",
    "Note",
  ]);

  const habitContent = asRecord(project.pages[8]?.content);

  assert.equal(habitContent.days, 31);
  assert.deepEqual(habitContent.abitudini, [
    "Allenamento",
    "Acqua",
    "Sonno regolare",
    "Stretching",
    "Proteine",
  ]);

  const reviewContent = asRecord(project.pages[9]?.content);
  const reviewBlocks = asArray(reviewContent.blocks);

  assert.deepEqual(asRecord(reviewBlocks[0]).prompts, [
    "Cosa ha funzionato meglio?",
    "Dove ho mollato?",
    "Cosa cambio dalla prossima settimana?",
  ]);

  const renderModel = buildImportedPrintRenderModel({
    bookSettings: {
      trimSize: project.technicalSpecs.trimSize,
    },
    normalizedProject: project as unknown as Json,
    pages: project.pages.map((page) => ({
      content: page.content as unknown as Json,
      pageNumber: page.pageNumber,
      sourceType: page.sourceType,
      status: page.status,
      templateId: page.templateId,
      title: page.title,
    })),
  });

  assert.equal(renderModel.pages.length, FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT);

  const bytes = await generateImportedPagesTechnicalPdf(renderModel, {
    title: project.project.title,
  });
  const pdf = await PDFDocument.load(bytes);

  assert.equal(pdf.getPageCount(), FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT);
  assert.ok(bytes.length > 1000);
});

test("keeps legacy non KDP_DRAFT_V1 input on the previous importer path", () => {
  const project = importDraft(legacyDraft());

  assert.equal(detectKdpDraftFormat(legacyDraft()), "legacy");
  assert.equal(detectKdpDraftFormat("KDP_DRAFT_V10\n\nBOOK"), "legacy");
  assert.equal(project.source.draftVersion, "0.1");
  assert.equal(project.source.parserVersion, "0.1.0");
  assert.equal(project.project.title, "Legacy Draft");
  assert.equal(project.technicalSpecs.trimSize, "6 x 9 in");
  assert.equal(project.pages.length, 1);
  assert.equal(project.pages[0]?.title, "Pagina legacy");
  assert.equal(issueCodes(project).includes("DRAFT_VERSION_MISSING"), false);
});

test("reports malformed KDP_DRAFT_V1 without falling back to the legacy parser", () => {
  const project = importDraft(`KDP_DRAFT_V1

PAGE
id: orphan
title: Orphan page
type: text
TEXT
Questa bozza non ha il blocco BOOK.
END_TEXT
END_PAGE`);

  assert.equal(project.importReport.status, "failed");
  assert.equal(project.source.draftVersion, "KDP_DRAFT_V1");
  assert.equal(project.source.parserVersion, KDP_DRAFT_V1_IMPORTER_VERSION);
  assert.equal(project.pages.length, 0);
  assert.equal(issueCodes(project).includes("KDP_DRAFT_V1_BOOK_MISSING"), true);
  assert.equal(issueCodes(project).includes("DRAFT_VERSION_MISSING"), false);
});
