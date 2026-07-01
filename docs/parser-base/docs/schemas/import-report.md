# Schema — Import Report

Questo documento descrive il report importazione in forma concettuale.

## ImportReport

```ts
type ImportReport = {
  status: "success" | "success_with_warnings" | "failed";
  summary: ImportSummary;
  warnings: ImportIssue[];
  errors: ImportIssue[];
};
```

## ImportSummary

```ts
type ImportSummary = {
  title?: string;
  draftVersion?: string;
  parserVersion: string;
  targetPageCount?: number;
  generatedPageCount: number;
  sectionCount: number;
  fixedPageCount: number;
  expandedPageCount: number;
  requestedTemplateCount: number;
  missingTemplateCount?: number;
  warningCount: number;
  errorCount: number;
};
```

## ImportIssue

```ts
type ImportIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  path?: string;
  pageNumber?: number;
  templateId?: string;
  rawSnippet?: string;
};
```

## Codici suggeriti

```text
EMPTY_DRAFT
DRAFT_VERSION_MISSING
DRAFT_VERSION_UNSUPPORTED
TOP_LEVEL_BLOCK_MISSING
PAGE_RANGE_INVALID
PAGE_RANGE_REPEAT_MISMATCH
PAGE_DUPLICATE
PAGE_MISSING
TARGET_PAGE_COUNT_MISMATCH
TEMPLATE_ID_MISSING
TEMPLATE_NOT_FOUND
SECTION_PAGE_COUNT_MISMATCH
COVER_BRIEF_MISSING
KDP_METADATA_MISSING
UNKNOWN_FIELD_PRESERVED
```

## Regola

I codici devono essere stabili perché potranno essere usati dalla UI, dai test e dalla telemetria.
