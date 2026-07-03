import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  buildGenericDraftImportRunInsert,
  buildGenericDraftPageInserts,
  buildGenericDraftSectionInserts,
  canPersistGenericDraftProject,
  getGenericDraftBookDetails,
  hashGenericDraftText,
} from "../../generic-draft-persistence.ts";
import {
  buildImportedPagesSummary,
  groupImportedPagesBySection,
  type KdpImportedPage,
  type KdpImportedPageSection,
} from "../../imported-pages.ts";
import {
  generateImportedPagesTechnicalPdf,
  getImportedTechnicalPdfFooterText,
  getImportedTechnicalPdfWritableLineCount,
  getImportedPagesTechnicalPdfSummary,
} from "../../imported-page-pdf.ts";
import { buildImportedPrintRenderModel } from "../../imported-page-print-renderer.ts";
import { buildImportedPagePreviewModel } from "../../imported-page-preview.ts";
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

  assert.equal(project.importReport.status, "success");
  assert.equal(project.importReport.errors.length, 0);
  assert.equal(project.importReport.warnings.length, 0);
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

test("rejects persistence for empty or blocking-error drafts", () => {
  const emptyProject = importDraft("");
  const duplicateProject = importDraft(
    draftWithPages(`* numero_pagina: 1
  template_id: "template_a"

* numero_pagina: 1
  template_id: "template_b"`),
  );

  assert.equal(canPersistGenericDraftProject(emptyProject).ok, false);
  assert.equal(canPersistGenericDraftProject(duplicateProject).ok, false);
});

test("builds generic draft persistence payloads from a valid normalized project", () => {
  const rawDraft = longAiStyleGenericDraft();
  const project = importDraft(rawDraft);
  const actor = {
    email: "owner@example.com",
    userId: "00000000-0000-4000-8000-000000000001",
  };
  let sectionCounter = 0;
  const sectionPlans = buildGenericDraftSectionInserts(project, {
    actor,
    bookId: "00000000-0000-4000-8000-000000000002",
    createId: () => {
      sectionCounter += 1;
      return `00000000-0000-4000-8000-${String(sectionCounter).padStart(
        12,
        "0",
      )}`;
    },
  });
  const sectionIdBySourceId = new Map(
    sectionPlans.map((section) => [
      section.sourceSectionId,
      section.insert.id as string,
    ]),
  );
  const importRun = buildGenericDraftImportRunInsert(project, {
    actor,
    bookId: "00000000-0000-4000-8000-000000000002",
    draftHash: hashGenericDraftText(rawDraft),
    importRunId: "00000000-0000-4000-8000-000000000010",
    importToken: "00000000-0000-4000-8000-000000000011",
  });
  const pagePlans = buildGenericDraftPageInserts(project, {
    bookId: "00000000-0000-4000-8000-000000000002",
    importRunId: "00000000-0000-4000-8000-000000000010",
    sectionIdBySourceId,
  });
  const bookDetails = getGenericDraftBookDetails(project);

  assert.equal(canPersistGenericDraftProject(project).ok, true);
  assert.equal(bookDetails.bookType, "generic_kdp_book");
  assert.equal(bookDetails.title, "Bozza generica lunga");
  assert.equal(sectionPlans.length, 7);
  assert.equal(sectionPlans[0].insert.section_type, "chapter");
  assert.equal(sectionPlans[0].insert.sort_order, 1);
  assert.equal(importRun.import_kind, "generic_draft_v0");
  assert.equal(importRun.parser_version, "0.1.0");
  assert.equal(importRun.source_draft_version, "0.1");
  assert.equal("updated_by_user_id" in importRun, false);
  assert.equal(pagePlans.length, 110);
  assert.equal(pagePlans[0].insert.section_id, sectionPlans[0].insert.id);
  assert.equal(pagePlans[0].insert.status, "imported");
  assert.equal(pagePlans[20].insert.source_type, "generated_interval");
  assert.equal(pagePlans[104].insert.source_ref, "105-110");
});

test("summarizes and groups imported pages by section", () => {
  const sections: KdpImportedPageSection[] = [
    {
      id: "section-a",
      sort_order: 1,
      title: "Sezione A",
    },
  ];
  const pages: KdpImportedPage[] = [
    {
      id: "page-3",
      book_id: "book-1",
      import_run_id: "run-1",
      section_id: null,
      page_number: 3,
      template_id: "template_b",
      title: "Pagina 3",
      source_type: "fixed_page",
      source_ref: null,
      status: "needs_review",
      content: {},
      warnings: ["Da controllare"],
      errors: [],
      created_at: "2026-07-01T00:00:03.000Z",
      updated_at: "2026-07-01T00:00:03.000Z",
    },
    {
      id: "page-1",
      book_id: "book-1",
      import_run_id: "run-1",
      section_id: "section-a",
      page_number: 1,
      template_id: "template_a",
      title: "Pagina 1",
      source_type: "fixed_page",
      source_ref: "1",
      status: "imported",
      content: { text: "Contenuto" },
      warnings: [],
      errors: [],
      created_at: "2026-07-01T00:00:01.000Z",
      updated_at: "2026-07-01T00:00:01.000Z",
    },
    {
      id: "page-2",
      book_id: "book-1",
      import_run_id: "run-1",
      section_id: "section-a",
      page_number: 2,
      template_id: "template_a",
      title: "Pagina 2",
      source_type: "generated_interval",
      source_ref: "2-4",
      status: "imported",
      content: { prompt: "Prompt" },
      warnings: [],
      errors: [],
      created_at: "2026-07-01T00:00:02.000Z",
      updated_at: "2026-07-01T00:00:02.000Z",
    },
    {
      id: "page-4",
      book_id: "book-1",
      import_run_id: "run-1",
      section_id: "missing-section",
      page_number: 4,
      template_id: null,
      title: "Pagina 4",
      source_type: null,
      source_ref: null,
      status: "invalid",
      content: {},
      warnings: [],
      errors: ["Errore"],
      created_at: "2026-07-01T00:00:04.000Z",
      updated_at: "2026-07-01T00:00:04.000Z",
    },
  ];

  const summary = buildImportedPagesSummary(pages, sections);
  const groups = groupImportedPagesBySection(pages, sections);

  assert.equal(summary.pageCount, 4);
  assert.equal(summary.sectionCount, 1);
  assert.equal(summary.templateCount, 2);
  assert.deepEqual(summary.templateIds, ["template_a", "template_b"]);
  assert.equal(summary.unassignedPageCount, 1);
  assert.deepEqual(summary.statusCounts, {
    imported: 2,
    invalid: 1,
    needs_review: 1,
  });
  assert.deepEqual(summary.sourceTypeCounts, {
    fixed_page: 2,
    generated_interval: 1,
    non_rilevato: 1,
  });
  assert.deepEqual(
    groups.map((group) => group.title),
    ["Sezione A", "Sezione non disponibile", "Pagine senza sezione"],
  );
  assert.deepEqual(
    groups[0].pages.map((page) => page.page_number),
    [1, 2],
  );
});

test("handles books without imported pages", () => {
  const summary = buildImportedPagesSummary([], []);
  const groups = groupImportedPagesBySection([], []);

  assert.equal(summary.pageCount, 0);
  assert.equal(summary.sectionCount, 0);
  assert.equal(summary.templateCount, 0);
  assert.equal(summary.unassignedPageCount, 0);
  assert.deepEqual(summary.statusCounts, {});
  assert.deepEqual(groups, []);
});

test("builds a readable preview model for empty imported page content", () => {
  const model = buildImportedPagePreviewModel({});

  assert.equal(model.isEmpty, true);
  assert.deepEqual(model.fields, []);
  assert.deepEqual(model.lists, []);
  assert.deepEqual(model.prompts, []);
  assert.deepEqual(model.tables, []);
});

test("builds preview fields, lists, prompts and text from generic imported content", () => {
  const model = buildImportedPagePreviewModel({
    campi: ["Nome", "Data", { label: "Obiettivo", value: "Nota libera" }],
    lista: ["Punto A", "Punto B"],
    prompt: "Scrivi una risposta sintetica.",
    sottotitolo: "Sottotitolo generico",
    testo: "Testo introduttivo generico.",
  });

  assert.equal(model.isEmpty, false);
  assert.deepEqual(model.fields, ["Nome", "Data", "Obiettivo: Nota libera"]);
  assert.deepEqual(model.lists, [["Punto A", "Punto B"]]);
  assert.deepEqual(model.prompts, ["Scrivi una risposta sintetica."]);
  assert.equal(model.subtitle, "Sottotitolo generico");
  assert.deepEqual(model.text, ["Testo introduttivo generico."]);
});

test("builds preview tables from columns and planned row counts", () => {
  const model = buildImportedPagePreviewModel({
    colonne_tabella: ["Elemento", "Valore"],
    numero_righe: 6,
    righe: [
      {
        Elemento: "Voce A",
        Valore: "Dettaglio A",
      },
    ],
  });

  assert.equal(model.isEmpty, false);
  assert.equal(model.tables.length, 1);
  assert.deepEqual(model.tables[0].columns, ["Elemento", "Valore"]);
  assert.equal(model.tables[0].layout, "standard");
  assert.equal(model.tables[0].rowCount, 6);
  assert.equal(model.tables[0].rows.length, 1);
});

test("builds compact preview tables without losing wide table content", () => {
  const model = buildImportedPagePreviewModel({
    colonne_tabella: [
      "Colonna A",
      "Colonna B",
      "Colonna C",
      "Colonna D",
      "Colonna E",
      "Colonna F",
    ],
    numero_righe: 4,
    righe: [
      {
        "Colonna A": "A1",
        "Colonna B": "B1",
        "Colonna C": "C1",
        "Colonna D": "D1",
        "Colonna E": "E1",
        "Colonna F": "F1",
      },
    ],
  });

  assert.equal(model.tables.length, 1);
  assert.equal(model.tables[0].layout, "compact");
  assert.deepEqual(model.tables[0].columns, [
    "Colonna A",
    "Colonna B",
    "Colonna C",
    "Colonna D",
    "Colonna E",
    "Colonna F",
  ]);
  assert.equal(model.tables[0].rows.length, 1);
});

test("builds preview blocks from nested generic content", () => {
  const model = buildImportedPagePreviewModel({
    blocchi: [
      "Nota libera",
      {
        titolo: "Blocco compilabile",
        tipo: "box",
        campi: ["Campo A"],
        blocchi: [
          {
            titolo: "Sotto blocco",
            prompt_finale: "Prompt finale generico",
          },
        ],
      },
    ],
  });

  assert.equal(model.isEmpty, false);
  assert.equal(model.blocks.length, 2);
  assert.deepEqual(model.blocks[0].text, ["Nota libera"]);
  assert.equal(model.blocks[1].title, "Blocco compilabile");
  assert.deepEqual(model.blocks[1].fields, ["Campo A"]);
  assert.equal(model.blocks[1].blocks[0].title, "Sotto blocco");
  assert.deepEqual(model.blocks[1].blocks[0].prompts, [
    "Prompt finale generico",
  ]);
});

test("keeps unrecognized imported page content as readable fallback entries", () => {
  const model = buildImportedPagePreviewModel({
    campo_custom: "Valore custom",
    gruppo_custom: {
      etichetta: "Voce",
      valore: "Dettaglio",
    },
  });

  assert.equal(model.isEmpty, false);
  assert.deepEqual(model.fallbackEntries, [
    {
      label: "campo custom",
      value: "Valore custom",
    },
    {
      label: "gruppo custom",
      value: "etichetta: Voce | valore: Dettaglio",
    },
  ]);
});

test("keeps technical imported page fields out of the main preview content", () => {
  const model = buildImportedPagePreviewModel({
    errors: [],
    normalizedSectionId: "section-1",
    section_id: "section-db-id",
    source_ref: "21-100",
    sourceType: "generated_interval",
    status: "imported",
    template_id: "template_generic",
    testo: "Contenuto visibile",
    warnings: [],
  });

  assert.equal(model.isEmpty, false);
  assert.deepEqual(model.text, ["Contenuto visibile"]);
  assert.deepEqual(model.fallbackEntries, []);
  assert.deepEqual(
    model.technicalEntries.map((entry) => entry.label),
    [
      "normalizedSectionId",
      "section id",
      "source ref",
      "sourceType",
      "status",
      "template id",
    ],
  );
});

test("builds print renderer settings with safe fallback page size and margins", () => {
  const model = buildImportedPrintRenderModel({
    pages: [],
  });

  assert.equal(model.settings.pageSize.label, "7 x 10 in");
  assert.equal(model.settings.pageSize.widthIn, 7);
  assert.equal(model.settings.pageSize.heightIn, 10);
  assert.equal(model.settings.pageSize.source, "fallback");
  assert.deepEqual(model.settings.margins, {
    bottomIn: 0.5,
    insideIn: 0.65,
    outsideIn: 0.45,
    source: "fallback",
    topIn: 0.45,
  });
});

test("builds print renderer settings from normalized technical specs", () => {
  const model = buildImportedPrintRenderModel({
    bookSettings: {
      trimSize: "6x9",
    },
    normalizedProject: {
      technicalSpecs: {
        margins: {
          bottom: "0.52 in",
          inside: "0.72 in",
          outside: "0.48 in",
          top: "0.42 in",
        },
        trimSize: "7\u00d710 in",
      },
    },
    pages: [],
  });

  assert.equal(model.settings.pageSize.label, "7 x 10 in");
  assert.equal(model.settings.pageSize.source, "technical_specs");
  assert.deepEqual(model.settings.margins, {
    bottomIn: 0.52,
    insideIn: 0.72,
    outsideIn: 0.48,
    source: "technical_specs",
    topIn: 0.42,
  });
});

test("builds and orders a print renderer model with 110 imported pages", () => {
  const pages = Array.from({ length: 110 }, (_, index) => ({
    content: {
      text: `Pagina ${110 - index}`,
    },
    pageNumber: 110 - index,
    templateId: "template_generic",
    title: `Pagina ${110 - index}`,
  }));
  const model = buildImportedPrintRenderModel({
    pages,
  });

  assert.equal(model.pages.length, 110);
  assert.equal(model.pages[0].pageNumber, 1);
  assert.equal(model.pages.at(-1)?.pageNumber, 110);
});

test("adds print warnings for empty content, unknown template and dense tables", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {},
        pageNumber: 1,
        templateId: null,
      },
      {
        content: {
          colonne_tabella: [
            "Colonna A",
            "Colonna B",
            "Colonna C",
            "Colonna D",
            "Colonna E",
          ],
          numero_righe: 12,
        },
        pageNumber: 2,
        templateId: "template_table",
      },
    ],
  });

  assert.deepEqual(
    model.warnings.map((warning) => warning.code),
    ["EMPTY_CONTENT", "UNKNOWN_TEMPLATE", "TABLE_DENSE"],
  );
  assert.equal(model.pages[1].blocks[0].type, "tables");
});

test("keeps fields, prompts and tables in the print render model", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          campi: ["Campo A", "Campo B"],
          colonne_tabella: ["Voce", "Valore"],
          prompt: "Annota una risposta.",
          righe: [
            {
              Valore: "Dettaglio",
              Voce: "Elemento",
            },
          ],
          text: "Introduzione",
        },
        pageNumber: 1,
        templateId: "template_generic",
      },
    ],
  });

  assert.deepEqual(
    model.pages[0].blocks.map((block) => block.type),
    ["text", "fields", "tables", "prompts"],
  );
});

test("keeps title-only print pages from showing empty content fallback", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          sottotitolo: "Sottotitolo generico",
          titolo: "Titolo generico",
        },
        pageNumber: 1,
        templateId: "template_title",
      },
    ],
  });

  assert.equal(model.pages[0].title, "Titolo generico");
  assert.equal(model.pages[0].subtitle, "Sottotitolo generico");
  assert.equal(model.pages[0].hasPrintableHeader, true);
  assert.equal(model.pages[0].blocks.length, 0);
  assert.deepEqual(model.warnings.map((warning) => warning.code), []);
});

test("keeps title-only PDF pages free from technical footers", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          sottotitolo: "Sottotitolo generico",
          titolo: "Titolo generico",
        },
        pageNumber: 1,
        templateId: "template_title",
      },
      {
        content: {
          testo: "Pagina interna",
        },
        pageNumber: 2,
        templateId: "template_internal",
      },
    ],
  });

  assert.equal(getImportedTechnicalPdfFooterText(model.pages[0]), null);
  assert.equal(getImportedTechnicalPdfFooterText(model.pages[1]), "2");
});

test("orders nested structured print blocks without flattening them as pipe text", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          blocco_secondario: {
            passaggi: ["Preparazione", "Verifica", "Chiusura"],
          },
          campi_finali: {
            firma: "",
            nota_finale: "Spazio conclusivo",
          },
          intestazione: {
            campi: ["Data", "Nome"],
          },
          stato_iniziale: {
            stato: "",
          },
          tabella_principale: {
            colonne_tabella: ["Voce", "Valore"],
            numero_righe: 3,
          },
        },
        pageNumber: 1,
        templateId: "template_structured",
      },
    ],
  });

  const blocks = model.pages[0].blocks;

  assert.deepEqual(
    blocks.map((block) => block.type),
    ["group", "group", "tables", "group", "group"],
  );
  assert.deepEqual(
    blocks.map((block) => (block.type === "group" ? block.title : block.type)),
    [
      "intestazione",
      "stato iniziale",
      "tables",
      "blocco secondario",
      "campi finali",
    ],
  );
  assert.equal(blocks[4].type, "group");

  if (blocks[4].type === "group") {
    assert.deepEqual(
      blocks[4].blocks.map((block) => block.type),
      ["fields", "prompts"],
    );
  }
});

test("renders structured fillable sheets as field grids and tables", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          blocco_secondario: {
            campi: ["Tipo", "Durata"],
          },
          campi_finali: {
            note_finali: "",
            valutazione: "",
          },
          intestazione: {
            data: "",
            durata: "",
            focus: "",
            giorno: "",
            ora_inizio: "",
          },
          stato_iniziale: {
            energia: "",
            preparazione: "",
            sonno: "",
            umore: "",
          },
          tabella_principale: {
            colonne_tabella: ["Voce", "Serie", "Ripetizioni", "Carico", "Note"],
            numero_righe: 8,
          },
        },
        pageNumber: 21,
        templateId: "template_structured",
      },
    ],
  });
  const [headerGroup, stateGroup, tableBlock] = model.pages[0].blocks;

  assert.equal(headerGroup.type, "group");
  assert.equal(stateGroup.type, "group");
  assert.equal(tableBlock.type, "tables");

  if (headerGroup.type === "group") {
    assert.equal(headerGroup.blocks[0].type, "fields");

    if (headerGroup.blocks[0].type === "fields") {
      assert.equal(headerGroup.blocks[0].layout, "grid");
      assert.deepEqual(headerGroup.blocks[0].fields, [
        "data",
        "durata",
        "focus",
        "giorno",
        "ora inizio",
      ]);
    }
  }

  assert.equal(model.pages[0].blocks.some((block) => block.type === "list"), false);
});

test("renders workout field arrays as writable fields instead of bullet lists", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          campi_finali: ["Note finali", "Feedback", "Prossima correzione"],
          campi_iniziali: [
            "Data",
            "Giorno",
            "Focus allenamento",
            "Ora inizio",
            "Durata",
          ],
          stato_iniziale: [
            "Energia 1-5",
            "Umore",
            "Sonno",
            "Riscaldamento completato",
          ],
        },
        pageNumber: 21,
        templateId: "template_workout",
      },
    ],
  });
  const blocks = model.pages[0].blocks;
  const fieldGroups = blocks.filter((block) => block.type === "group");

  assert.equal(blocks.some((block) => block.type === "list"), false);
  assert.deepEqual(
    fieldGroups.map((block) => (block.type === "group" ? block.title : "")),
    ["campi iniziali", "stato iniziale", "campi finali"],
  );

  const headerGroup = fieldGroups[0];
  const stateGroup = fieldGroups[1];

  if (headerGroup?.type === "group") {
    const [fields] = headerGroup.blocks;

    assert.equal(fields?.type, "fields");

    if (fields?.type === "fields") {
      assert.deepEqual(fields.fields, [
        "Data",
        "Giorno",
        "Focus allenamento",
        "Ora inizio",
        "Durata",
      ]);
    }
  }

  if (stateGroup?.type === "group") {
    const [fields] = stateGroup.blocks;

    assert.equal(fields?.type, "fields");

    if (fields?.type === "fields") {
      assert.deepEqual(fields.fields, [
        "Energia 1-5",
        "Umore",
        "Sonno",
        "Riscaldamento completato",
      ]);
    }
  }
});

test("renders question-style progress notes as writable prompts", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          punti: [
            "Quali cambiamenti noto?",
            "Cosa mi sembra piu facile rispetto all'inizio?",
            "Cosa devo ancora migliorare?",
            "Cosa posso correggere nel mio piano?",
          ],
        },
        pageNumber: 14,
        templateId: "template_progress_notes",
      },
    ],
  });
  const [block] = model.pages[0].blocks;

  assert.equal(block.type, "prompts");

  if (block.type === "prompts") {
    assert.equal(block.prompts.length, 4);
  }
});

test("plans extended writable lines for note-style imported PDF pages", () => {
  const defaultLines = getImportedTechnicalPdfWritableLineCount({
    availableHeight: 420,
  });
  const extendedLines = getImportedTechnicalPdfWritableLineCount({
    availableHeight: 420,
    fillRemaining: true,
    promptLineCount: 1,
  });

  assert.equal(defaultLines, 4);
  assert.ok(extendedLines > 25);
});

test("renders simple separated steps as an ordered print list", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          passaggi: "1. Primo passaggio | 2. Secondo passaggio",
        },
        pageNumber: 1,
        templateId: "template_steps",
      },
    ],
  });
  const [block] = model.pages[0].blocks;

  assert.equal(block.type, "list");

  if (block.type === "list") {
    assert.equal(block.ordered, true);
    assert.deepEqual(block.items, ["Primo passaggio", "Secondo passaggio"]);
  }
});

test("renders days and habits as a compact print grid", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          abitudini: ["Elemento A", "Elemento B"],
          giorni: ["Lun", "Mar", "Mer"],
        },
        pageNumber: 1,
        templateId: "template_grid",
      },
    ],
  });
  const [block] = model.pages[0].blocks;

  assert.equal(block.type, "tables");

  if (block.type === "tables") {
    assert.deepEqual(block.tables[0].columns, ["Elemento", "Lun", "Mar", "Mer"]);
    assert.equal(block.tables[0].rowCount, 2);
  }
});

test("expands numeric habit tracker day counts into daily columns", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          abitudini: [
            "Allenamento",
            "Acqua",
            "Passi",
            "Sonno",
            "Stretching",
            "Alimentazione",
          ],
          giorni: 31,
        },
        pageNumber: 18,
        templateId: "template_habit_tracker",
      },
    ],
  });
  const [block] = model.pages[0].blocks;

  assert.equal(block.type, "tables");

  if (block.type === "tables") {
    assert.equal(block.tables[0].columns.length, 32);
    assert.equal(block.tables[0].columns[1], "1");
    assert.equal(block.tables[0].columns[31], "31");
    assert.equal(block.tables[0].rowCount, 6);
  }
});

test("still warns when a print page has no printable content at all", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {},
        pageNumber: 1,
        templateId: "template_empty",
      },
    ],
  });

  assert.deepEqual(model.warnings.map((warning) => warning.code), [
    "EMPTY_CONTENT",
  ]);
  assert.equal(model.pages[0].hasPrintableHeader, false);
});

test("summarizes imported technical PDF fallback size and margins", () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          testo: "Pagina tecnica",
        },
        pageNumber: 1,
        templateId: "template_generic",
      },
    ],
  });
  const summary = getImportedPagesTechnicalPdfSummary(model);

  assert.equal(summary.pageCount, 1);
  assert.equal(summary.pageWidthPt, 7 * 72);
  assert.equal(summary.pageHeightPt, 10 * 72);
  assert.equal(summary.marginInsidePt, 0.65 * 72);
  assert.equal(summary.marginOutsidePt, 0.45 * 72);
  assert.equal(summary.marginTopPt, 0.45 * 72);
  assert.equal(summary.marginBottomPt, 0.5 * 72);
});

test("generates imported technical PDF with one page for each imported page", async () => {
  const model = buildImportedPrintRenderModel({
    pages: [
      {
        content: {
          titolo: "Titolo",
        },
        pageNumber: 1,
        templateId: "template_title",
      },
      {
        content: {
          campi: ["Campo A"],
          prompt: "Nota finale",
        },
        pageNumber: 2,
        templateId: "template_fields",
      },
      {
        content: {},
        pageNumber: 3,
        templateId: "template_empty",
      },
    ],
  });
  const bytes = await generateImportedPagesTechnicalPdf(model, {
    title: "Documento tecnico",
  });
  const doc = await PDFDocument.load(bytes);

  assert.equal(doc.getPageCount(), 3);

  const firstPage = doc.getPage(0);
  assert.equal(firstPage.getWidth(), 7 * 72);
  assert.equal(firstPage.getHeight(), 10 * 72);
});

test("generates imported technical PDF for 110 simulated imported pages", async () => {
  const model = buildImportedPrintRenderModel({
    pages: Array.from({ length: 110 }, (_, index) => {
      const pageNumber = index + 1;

      return {
        content: {
          testo: `Contenuto tecnico pagina ${pageNumber}`,
        },
        pageNumber,
        templateId: "template_generic",
        title: `Pagina ${pageNumber}`,
      };
    }),
  });
  const bytes = await generateImportedPagesTechnicalPdf(model, {
    title: "Documento tecnico lungo",
  });
  const doc = await PDFDocument.load(bytes);

  assert.equal(doc.getPageCount(), 110);
});

test("rejects imported technical PDF generation without imported pages", async () => {
  const model = buildImportedPrintRenderModel({
    pages: [],
  });

  await assert.rejects(
    () => generateImportedPagesTechnicalPdf(model),
    /without pages/,
  );
});
