import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
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
  assert.equal(model.tables[0].rowCount, 6);
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
