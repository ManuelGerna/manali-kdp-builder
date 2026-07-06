import assert from "node:assert/strict";
import test from "node:test";
import {
  FITNESS_LOGBOOK_IT_DRAFT_V1,
  FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT,
} from "../__fixtures__/fitness-logbook-it.kdp-draft-v1.ts";
import {
  buildImportedDraftPreviewSummary,
  canCreateBookFromImportedDraftPreview,
  importKdpBuilderDraft,
} from "../index.ts";

const IMPORTED_AT = "2026-07-01T00:00:00.000Z";

function importDraft(rawText: string) {
  return importKdpBuilderDraft(rawText, { importedAt: IMPORTED_AT });
}

function issueCodes(project: ReturnType<typeof importDraft>) {
  return [
    ...project.importReport.warnings,
    ...project.importReport.errors,
  ].map((issue) => issue.code);
}

function legacyDraft() {
  return `KDP_BUILDER_DRAFT_VERSION: 0.1

TIPO_PROGETTO: KDP_INTERIOR_BOOK
LINGUA_LIBRO: it-IT
TIPO_LIBRO: generic_book

IDEA_LIBRO:
titolo_provvisorio: "Legacy Draft UI"

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

test("builds UI preview summary for KDP_DRAFT_V1 fitness fixture", () => {
  const project = importDraft(FITNESS_LOGBOOK_IT_DRAFT_V1);
  const summary = buildImportedDraftPreviewSummary(project);

  assert.equal(summary.formatLabel, "KDP_DRAFT_V1");
  assert.equal(summary.title, "Diario Allenamento 90 Giorni");
  assert.equal(summary.trimSize, "7x10");
  assert.equal(summary.generatedPageCount, FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT);
  assert.equal(summary.targetPageCount, FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT);
  assert.equal(canCreateBookFromImportedDraftPreview(project), true);
});

test("builds UI preview summary for legacy drafts without changing behavior", () => {
  const project = importDraft(legacyDraft());
  const summary = buildImportedDraftPreviewSummary(project);

  assert.equal(summary.formatLabel, "Legacy 0.1");
  assert.equal(summary.title, "Legacy Draft UI");
  assert.equal(summary.trimSize, "6 x 9 in");
  assert.equal(summary.generatedPageCount, 1);
  assert.equal(canCreateBookFromImportedDraftPreview(project), true);
});

test("keeps malformed KDP_DRAFT_V1 blocked in the UI preview summary", () => {
  const project = importDraft(`KDP_DRAFT_V1

PAGE
id: orphan
title: Orphan page
type: text
TEXT
Manca il blocco BOOK.
END_TEXT
END_PAGE`);
  const summary = buildImportedDraftPreviewSummary(project);

  assert.equal(summary.formatLabel, "KDP_DRAFT_V1");
  assert.equal(summary.status, "failed");
  assert.equal(summary.generatedPageCount, 0);
  assert.equal(canCreateBookFromImportedDraftPreview(project), false);
  assert.equal(issueCodes(project).includes("KDP_DRAFT_V1_BOOK_MISSING"), true);
  assert.equal(issueCodes(project).includes("DRAFT_VERSION_MISSING"), false);
});
