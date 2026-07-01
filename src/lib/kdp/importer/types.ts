export type ImportStatus = "failed" | "success" | "success_with_warnings";

export type ImportIssueSeverity = "error" | "info" | "warning";

export type ImportIssue = {
  code: string;
  severity: ImportIssueSeverity;
  message: string;
  path?: string;
  pageNumber?: number;
  templateId?: string;
  rawSnippet?: string;
};

export type ImportSummary = {
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

export type ImportReport = {
  status: ImportStatus;
  summary: ImportSummary;
  warnings: ImportIssue[];
  errors: ImportIssue[];
};

export type ImportSource = {
  rawText: string;
  draftVersion?: string;
  parserVersion: string;
  importedAt: string;
};

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

export type BookSectionStatus = "needs_review" | "ok" | "warning";

export type BookSection = {
  id: string;
  title: string;
  expectedPageCount?: number;
  startPage?: number;
  endPage?: number;
  actualPageCount?: number;
  status: BookSectionStatus;
  warnings?: string[];
};

export type TableContent = {
  columns: string[];
  rows?: Array<Record<string, unknown> | string>;
  rowCount?: number;
  notes?: string;
};

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

export type BookPageStatus = "error" | "needs_review" | "ready";

export type BookPage = {
  pageNumber: number;
  sourceType: "expanded_range" | "single";
  sourceRef?: string;
  sectionId?: string;
  templateId?: string;
  title?: string;
  content: PageContent;
  layoutHints?: Record<string, unknown>;
  status: BookPageStatus;
  warnings?: string[];
  errors?: string[];
  extras?: Record<string, unknown>;
};

export type TemplateDefinition = {
  id: string;
  name?: string;
  version?: string;
  category?: string;
  acceptedContentShape?: string;
  rendererKey?: string;
  previewComponentKey?: string;
  requiredFields?: string[];
  optionalFields?: string[];
  rawDefinition?: Record<string, unknown>;
};

export type TemplateRegistryInput =
  | readonly string[]
  | readonly TemplateDefinition[]
  | Record<string, TemplateDefinition>;

export type TemplateUsageSummary = {
  requestedTemplateIds: string[];
  foundTemplateIds?: string[];
  missingTemplateIds?: string[];
  usageByTemplateId: Record<string, number>;
  definedTemplateIds?: string[];
};

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

export type KdpMetadataDraft = {
  title?: string;
  subtitle?: string;
  description?: string;
  bulletPoints?: string[];
  keywordSeeds?: string[];
  complianceNotes?: string[];
  extras?: Record<string, unknown>;
};

export type QualityChecklist = {
  interior?: string[];
  cover?: string[];
  kdp?: string[];
  extras?: Record<string, string[]>;
};

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

export type ImportOptions = {
  importedAt?: string;
  requireCompletePageSequence?: boolean;
  supportedDraftVersions?: readonly string[];
  templateRegistry?: TemplateRegistryInput;
};

export type TopLevelBlocks = {
  rootFields: Record<string, unknown>;
  rawBlocks: Record<string, string>;
  orphanText: string[];
};

export type ParsedDraft = {
  rootFields: Record<string, unknown>;
  rawBlocks: Record<string, string>;
  parsedBlocks: Record<string, unknown>;
  orphanText: string[];
};

export type PageDefinition = Record<string, unknown>;
