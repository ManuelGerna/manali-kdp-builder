import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { importKdpBuilderDraft } from "../index.ts";
import type { ImportOptions, NormalizedKdpProject } from "../index.ts";

const IMPORTED_AT = "2026-07-01T00:00:00.000Z";

function importDraft(rawText: string, options: ImportOptions = {}) {
  return importKdpBuilderDraft(rawText, {
    importedAt: IMPORTED_AT,
    ...options,
  });
}

function issueCodes(project: NormalizedKdpProject) {
  return [
    ...project.importReport.warnings,
    ...project.importReport.errors,
  ].map((issue) => issue.code);
}

function draftWithPages(pageDraft: string, targetPageCount?: number) {
  return `KDP_BUILDER_DRAFT_VERSION: 0.1

TIPO_PROGETTO: KDP_INTERIOR_BOOK
LINGUA_LIBRO: it-IT
TIPO_LIBRO: generic_book

IDEA_LIBRO:
titolo_provvisorio: "Generic Draft"

SPECIFICHE_TECNICHE:
formato: "6 x 9 in"
${targetPageCount ? `numero_pagine_target: ${targetPageCount}` : ""}

SEQUENZA_PAGINE:
${pageDraft}

TEMPLATE_PAGINA:
template_a:
  tipo_layout: "Layout A"
template_b:
  tipo_layout: "Layout B"
`;
}

test("fails with a clear report for empty input", () => {
  const project = importDraft("");

  assert.equal(project.importReport.status, "failed");
  assert.deepEqual(issueCodes(project), ["EMPTY_DRAFT"]);
  assert.equal(project.pages.length, 0);
});

test("detects a present draft version", () => {
  const project = importDraft(
    draftWithPages(`* numero_pagina: 1
  template_id: "template_a"
  titolo: "Page 1"`),
  );

  assert.equal(project.source.draftVersion, "0.1");
  assert.equal(issueCodes(project).includes("DRAFT_VERSION_MISSING"), false);
});

test("imports without a version and emits a warning", () => {
  const project = importDraft(`TIPO_PROGETTO: KDP_INTERIOR_BOOK

SPECIFICHE_TECNICHE:
formato: "6 x 9 in"

SEQUENZA_PAGINE:
* numero_pagina: 1
  template_id: "template_a"

TEMPLATE_PAGINA:
template_a:
  tipo_layout: "Layout A"
`);

  assert.equal(project.importReport.status, "success_with_warnings");
  assert.equal(issueCodes(project).includes("DRAFT_VERSION_MISSING"), true);
});

test("generates fixed single pages", () => {
  const project = importDraft(
    draftWithPages(
      `* numero_pagina: 1
  template_id: "template_a"
  titolo: "First"

* numero_pagina: 2
  template_id: "template_b"
  titolo: "Second"`,
      2,
    ),
  );

  assert.equal(project.importReport.status, "success");
  assert.deepEqual(
    project.pages.map((page) => page.pageNumber),
    [1, 2],
  );
  assert.equal(project.importReport.summary.fixedPageCount, 2);
});

test("expands inclusive page ranges", () => {
  const project = importDraft(
    draftWithPages(`* intervallo_pagine: "4-6"
  template_id: "template_a"
  ripeti: 3
  titolo_pattern: "Repeatable"`),
  );

  assert.deepEqual(
    project.pages.map((page) => page.pageNumber),
    [4, 5, 6],
  );
  assert.equal(project.importReport.summary.expandedPageCount, 3);
});

test("warns when repeat count does not match page range", () => {
  const project = importDraft(
    draftWithPages(`* intervallo_pagine: "1-3"
  template_id: "template_a"
  ripeti: 2`),
  );

  assert.equal(project.pages.length, 3);
  assert.equal(issueCodes(project).includes("PAGE_RANGE_REPEAT_MISMATCH"), true);
});

test("rotates content over generated pages", () => {
  const project = importDraft(
    draftWithPages(`* intervallo_pagine: "1-4"
  template_id: "template_a"
  ripeti: 4
  rotazione_prompt:
  - "Prompt A"
  - "Prompt B"`),
  );

  assert.deepEqual(
    project.pages.map((page) => page.content.prompt),
    ["Prompt A", "Prompt B", "Prompt A", "Prompt B"],
  );
});

test("fails on duplicate page numbers", () => {
  const project = importDraft(
    draftWithPages(`* numero_pagina: 1
  template_id: "template_a"

* numero_pagina: 1
  template_id: "template_b"`),
  );

  assert.equal(project.importReport.status, "failed");
  assert.equal(issueCodes(project).includes("PAGE_DUPLICATE"), true);
  assert.deepEqual(
    project.pages.map((page) => page.status),
    ["error", "error"],
  );
});

test("marks unrecognized template ids as needs_review when a registry is provided", () => {
  const project = importDraft(
    draftWithPages(`* numero_pagina: 1
  template_id: "template_missing"`),
    {
      templateRegistry: ["template_a"],
    },
  );

  assert.equal(project.importReport.status, "success_with_warnings");
  assert.deepEqual(project.templates.missingTemplateIds, ["template_missing"]);
  assert.equal(project.pages[0].status, "needs_review");
  assert.equal(issueCodes(project).includes("TEMPLATE_NOT_FOUND"), true);
});

test("keeps interior pages separate from cover brief and KDP metadata", () => {
  const project = importDraft(`KDP_BUILDER_DRAFT_VERSION: 0.1

IDEA_LIBRO:
titolo_provvisorio: "Interior Title"

SPECIFICHE_TECNICHE:
numero_pagine_target: 1

SEQUENZA_PAGINE:
* numero_pagina: 1
  template_id: "template_a"
  titolo: "Interior Page"

TEMPLATE_PAGINA:
template_a:
  tipo_layout: "Layout A"

BRIEF_COPERTINA:
titolo_copertina: "Cover Title"
direzione_visiva:
- "Clean typography"

METADATI_KDP_DRAFT:
titolo: "KDP Title"
descrizione: "Metadata description."
keyword_seed:
- "generic keyword"
`);

  assert.equal(project.pages.length, 1);
  assert.equal(project.pages[0].title, "Interior Page");
  assert.equal(project.coverBrief?.title, "Cover Title");
  assert.equal(project.kdpMetadata?.title, "KDP Title");
});

test("imports the full generic draft skeleton end to end", () => {
  const rawFixture = readFileSync(
    join(
      process.cwd(),
      "docs/parser-base/docs/examples/generic-draft-skeleton.md",
    ),
    "utf8",
  );
  const project = importDraft(rawFixture);

  assert.notEqual(project.importReport.status, "failed");
  assert.equal(project.importReport.errors.length, 0);
  assert.equal(project.source.draftVersion, "0.1");
  assert.equal(project.project.title, "Titolo provvisorio");
  assert.equal(project.technicalSpecs.targetPageCount, 20);
  assert.equal(project.sections.length, 3);
  assert.equal(project.pages.length, 20);
  assert.equal(project.templates.requestedTemplateIds.length, 5);
  assert.equal(project.coverBrief?.title, "Titolo provvisorio");
  assert.equal(project.kdpMetadata?.keywordSeeds?.length, 2);
  assert.equal(project.qualityChecklist?.interior?.length, 2);
});
