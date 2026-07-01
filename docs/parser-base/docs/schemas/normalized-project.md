# Schema — Normalized Project

Questo documento descrive l’oggetto normalizzato prodotto dal parser.

## Struttura principale

```ts
type NormalizedKdpProject = {
  source: ImportSource;
  project: ProjectInfo;
  technicalSpecs: TechnicalSpecs;
  visualSystem?: VisualSystem;
  sections: BookSection[];
  pages: BookPage[];
  templates: TemplateUsageSummary;
  coverBrief?: CoverBrief;
  kdpMetadata?: KdpMetadataDraft;
  qualityChecklist?: QualityChecklist;
  importReport: ImportReport;
  extras?: Record<string, unknown>;
};
```

## Requisiti minimi

Un import riuscito deve avere:

- `source.rawText`;
- `source.parserVersion`;
- `project` valorizzato almeno parzialmente;
- `technicalSpecs` valorizzato almeno parzialmente;
- `pages.length > 0`;
- `templates.usageByTemplateId`;
- `importReport.status`.

## Pagine

Ogni pagina deve avere:

```ts
type BookPage = {
  pageNumber: number;
  sourceType: "single" | "expanded_range";
  templateId?: string;
  title?: string;
  content: Record<string, unknown>;
  status: "ready" | "needs_review" | "error";
  warnings?: string[];
  errors?: string[];
};
```

## Stati progetto

Il progetto importato potrà poi essere salvato con uno stato applicativo, ad esempio:

```text
imported_draft
needs_review
ready_for_preview
ready_for_render
exported
```

Questo stato è esterno al parser, ma il parser fornisce i dati per determinarlo.
