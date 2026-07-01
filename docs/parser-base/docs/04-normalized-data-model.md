# 04 — Normalized Data Model

## Scopo

Definire la struttura dati che il parser deve restituire.

Il modello deve essere generico e stabile. Non deve contenere campi legati a un solo tipo di libretto.

## Oggetto principale

```ts
export type NormalizedKdpProject = {
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

## ImportSource

```ts
export type ImportSource = {
  rawText: string;
  draftVersion?: string;
  parserVersion: string;
  importedAt: string;
};
```

## ProjectInfo

```ts
export type ProjectInfo = {
  projectType?: string;
  importMode?: string;
  language?: string;
  targetMarket?: string;
  bookType?: string;
  title?: string;
  subtitle?: string;
  positioning?: string;
  tone?: string;
  notes?: string[];
};
```

## TechnicalSpecs

```ts
export type TechnicalSpecs = {
  trimSize?: string;
  interiorColor?: string;
  paperType?: string;
  bleed?: boolean | string;
  targetPageCount?: number;
  binding?: string;
  orientation?: string;
  visualDensity?: string;
  margins?: {
    inside?: string;
    outside?: string;
    top?: string;
    bottom?: string;
  };
  designGoal?: string;
};
```

## VisualSystem

```ts
export type VisualSystem = {
  styleName?: string;
  mood?: string;
  colorMode?: string;
  typography?: {
    headings?: string;
    body?: string;
    labels?: string;
  };
  recurringElements?: string[];
  avoid?: string[];
};
```

## BookSection

```ts
export type BookSection = {
  id: string;
  title: string;
  expectedPageCount?: number;
  startPage?: number;
  endPage?: number;
  actualPageCount?: number;
  status: "ok" | "warning" | "needs_review";
  warnings?: string[];
};
```

## BookPage

```ts
export type BookPage = {
  pageNumber: number;
  sourceType: "single" | "expanded_range";
  sourceRef?: string;
  sectionId?: string;
  templateId?: string;
  title?: string;
  content: PageContent;
  layoutHints?: Record<string, unknown>;
  status: "ready" | "needs_review" | "error";
  warnings?: string[];
  errors?: string[];
  extras?: Record<string, unknown>;
};
```

## PageContent

`PageContent` deve rimanere flessibile, perché template diversi hanno dati diversi.

```ts
export type PageContent = {
  text?: string;
  fields?: string[];
  prompts?: string[];
  blocks?: unknown[];
  table?: TableContent;
  tables?: TableContent[];
  footerText?: string;
  [key: string]: unknown;
};
```

## TableContent

```ts
export type TableContent = {
  columns: string[];
  rows?: string[] | Record<string, unknown>[];
  rowCount?: number;
  notes?: string;
};
```

## TemplateUsageSummary

```ts
export type TemplateUsageSummary = {
  requestedTemplateIds: string[];
  foundTemplateIds?: string[];
  missingTemplateIds?: string[];
  usageByTemplateId: Record<string, number>;
};
```

## CoverBrief

```ts
export type CoverBrief = {
  title?: string;
  subtitle?: string;
  authorPlaceholder?: string;
  style?: string;
  targetFeeling?: string;
  visualDirection?: string[];
  avoid?: string[];
  prompt?: string;
  thumbnailPriorities?: string[];
  extras?: Record<string, unknown>;
};
```

## KdpMetadataDraft

```ts
export type KdpMetadataDraft = {
  title?: string;
  subtitle?: string;
  description?: string;
  bulletPoints?: string[];
  keywordSeeds?: string[];
  complianceNotes?: string[];
  extras?: Record<string, unknown>;
};
```

## QualityChecklist

```ts
export type QualityChecklist = {
  interior?: string[];
  cover?: string[];
  kdp?: string[];
  extras?: Record<string, string[]>;
};
```

## ImportReport

```ts
export type ImportReport = {
  status: "success" | "success_with_warnings" | "failed";
  summary: ImportSummary;
  warnings: ImportIssue[];
  errors: ImportIssue[];
};
```

## Regola sui campi sconosciuti

Il parser non deve buttare via dati che non capisce. Deve salvarli in `extras` quando non riesce a mapparli su un campo canonico.
