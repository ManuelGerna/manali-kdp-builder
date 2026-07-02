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

function longAiStyleGenericDraft() {
  const sectionPlan = [
    ["front", "Apertura", 1, 2, 2],
    ["overview", "Panoramica", 3, 8, 6],
    ["setup", "Preparazione", 9, 20, 12],
    ["repeatable", "Modulo ripetuto", 21, 100, 80],
    ["synthesis", "Sintesi", 101, 102, 2],
    ["appendix", "Appendice", 103, 104, 2],
    ["closing", "Chiusura", 105, 110, 6],
  ];
  const sections = sectionPlan
    .map(
      ([id, title, startPage, endPage, pageCount]) => `- id_sezione: "${id}"
  titolo_sezione: "${title}"
  pagina_inizio: ${startPage}
  pagina_fine: ${endPage}
  pagine: ${pageCount}`,
    )
    .join("\n");
  const earlyPages = Array.from({ length: 7 }, (_, index) => {
    const pageNumber = index + 1;
    const bullet = pageNumber % 2 === 0 ? "*" : "-";

    return `${bullet} numero_pagina: ${pageNumber}
  template_id: "template_fixed"
  titolo: "Pagina ${pageNumber}"
  prompt: "Contenuto generico per pagina ${pageNumber}"`;
  }).join("\n\n");
  const middlePages = Array.from({ length: 12 }, (_, index) => {
    const pageNumber = index + 9;

    return `- numero_pagina: ${pageNumber}
  template_id: "template_note"
  titolo: "Pagina ${pageNumber}"
  blocchi:
  - "Blocco introduttivo ${pageNumber}"
  - "Blocco operativo ${pageNumber}"
  prompt_finale: "Chiudi la pagina ${pageNumber} con una nota generica"`;
  }).join("\n\n");

  return `KDP_BUILDER_DRAFT_VERSION: 0.1

TIPO_PROGETTO: KDP_INTERIOR_BOOK
MODALITA_IMPORTAZIONE: preview
LINGUA_LIBRO: it-IT
MERCATO_TARGET: generico
TIPO_LIBRO: generic_book

IDEA_LIBRO:
titolo_provvisorio: "Bozza generica lunga"
sottotitolo: "Struttura di prova"
pubblico_target: "Lettori generici"
promessa_principale: "Organizzare informazioni in modo chiaro"

SPECIFICHE_TECNICHE:
formato: "6 x 9 in"
interno: "bianco e nero"
carta: "white"
numero_pagine_target: 110

SISTEMA_VISIVO:
nome_stile: "Sistema neutro"
elementi_ricorrenti:
- "Titoli chiari"
- "Spaziature regolari"

PIANO_PAGINE:
totale_pagine: 110
sezioni:
${sections}

SEQUENZA_PAGINE:
${earlyPages}

- numero_pagina: 8
  template_id: "template_table"
  titolo: "Tabella generica"
  tabella:
  colonne_tabella:
- "Parametro"
- "Valore"
  righe:
- campo: "Voce A"
  valore: "Dettaglio A"
- campo: "Voce B"
  valore: "Dettaglio B"
  numero_righe: 12
  prompt_finale: "Sintetizza la tabella con una nota generica"

${middlePages}

- intervallo_pagine: "21-100"
  template_id: "template_repeat"
  ripeti: 80
  titolo_pattern: "Modulo {page}"
  rotazione_prompt:
  - "Prompt A"
  - "Prompt B"
  - "Prompt C"

- numero_pagina: 101
  template_id: "template_summary"
  titolo: "Sintesi 101"

- numero_pagina: 102
  template_id: "template_summary"
  titolo: "Sintesi 102"

* numero_pagina: 103
  template_id: "template_summary"
  titolo: "Appendice 103"

* numero_pagina: 104
  template_id: "template_summary"
  titolo: "Appendice 104"

* intervallo_pagine: "105-110"
  template_id: "template_final"
  ripeti: 6
  titolo_pattern: "Chiusura {page}"
  rotazione_prompt:
  - "Finale A"
  - "Finale B"

TEMPLATE_PAGINA:
template_fixed:
  tipo_layout: "Pagina fissa"
template_table:
  tipo_layout: "Tabella"
template_note:
  tipo_layout: "Nota"
template_repeat:
  tipo_layout: "Modulo ripetuto"
template_summary:
  tipo_layout: "Sintesi"
template_final:
  tipo_layout: "Chiusura"

BRIEF_COPERTINA:
titolo_copertina: "Bozza generica lunga"
direzione_visiva:
- "Composizione pulita"

METADATI_KDP_DRAFT:
titolo: "Bozza generica lunga"
descrizione: "Descrizione generica per test parser."
keyword_seed:
- "parola generica"

CHECKLIST_QUALITA_PRIMA_EXPORT:
interno:
- "Pagine controllate"
copertina:
- "Brief separato"
kdp:
- "Metadati separati"
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

test("warns when target page numbers are missing", () => {
  const project = importDraft(
    draftWithPages(
      `* numero_pagina: 1
  template_id: "template_a"

* numero_pagina: 3
  template_id: "template_b"`,
      3,
    ),
  );

  assert.equal(project.importReport.status, "success_with_warnings");
  assert.deepEqual(
    project.pages.map((page) => page.pageNumber),
    [1, 3],
  );
  assert.equal(issueCodes(project).includes("PAGE_MISSING"), true);
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

test("does not stop parsing long AI-style drafts with ambiguous nested lists", () => {
  const project = importDraft(longAiStyleGenericDraft());
  const codes = issueCodes(project);

  assert.equal(project.importReport.errors.length, 0);
  assert.equal(project.importReport.summary.targetPageCount, 110);
  assert.equal(project.importReport.summary.generatedPageCount, 110);
  assert.equal(project.importReport.summary.sectionCount, 7);
  assert.equal(project.pages.length, 110);
  assert.equal(project.sections.length, 7);
  assert.equal(codes.includes("TARGET_PAGE_COUNT_MISMATCH"), false);
  assert.equal(codes.includes("PAGE_MISSING"), false);
  assert.equal(project.pages.some((page) => page.pageNumber === 9), true);
  assert.equal(project.pages.at(-1)?.pageNumber, 110);
  assert.deepEqual(
    project.pages
      .filter((page) => page.pageNumber >= 21 && page.pageNumber <= 100)
      .map((page) => page.sourceType),
    Array.from({ length: 80 }, () => "expanded_range"),
  );
  assert.deepEqual(
    project.pages
      .filter((page) => page.pageNumber >= 105 && page.pageNumber <= 110)
      .map((page) => page.content.prompt),
    ["Finale A", "Finale B", "Finale A", "Finale B", "Finale A", "Finale B"],
  );
  assert.deepEqual(project.pages[7].content.colonne_tabella, [
    "Parametro",
    "Valore",
  ]);
  assert.equal(project.pages[7].content.numero_righe, 12);
  assert.equal(project.coverBrief?.title, "Bozza generica lunga");
  assert.equal(project.kdpMetadata?.title, "Bozza generica lunga");
  assert.equal(project.qualityChecklist?.interior?.length, 1);
});
