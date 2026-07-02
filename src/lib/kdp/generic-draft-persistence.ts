import { createHash, randomUUID } from "node:crypto";
import type { BookPage, NormalizedKdpProject } from "./importer/index.ts";
import {
  getCreateOwnershipFields,
  type OwnershipActor,
} from "./ownership.ts";
import type { Json, TablesInsert } from "../../types/database.ts";

export const GENERIC_DRAFT_BOOK_TYPE = "generic_kdp_book";
export const GENERIC_DRAFT_IMPORT_KIND = "generic_draft_v0";

export type GenericDraftBookDetails = {
  aiUsageType: "ai_assisted";
  authorName: string;
  bookType: typeof GENERIC_DRAFT_BOOK_TYPE;
  language: string;
  subtitle: string | null;
  title: string;
};

export type GenericDraftSectionInsertPlan = {
  sourceSectionId: string;
  insert: TablesInsert<"kdp_sections">;
};

export type GenericDraftPageInsertPlan = {
  insert: TablesInsert<"kdp_imported_pages">;
};

export type GenericDraftPersistenceValidation =
  | {
      ok: true;
      message: null;
    }
  | {
      ok: false;
      message: string;
    };

type BuildSectionInput = {
  actor: OwnershipActor;
  bookId: string;
  createId?: () => string;
};

type BuildImportRunInput = {
  actor: OwnershipActor;
  bookId: string;
  draftHash: string;
  importRunId: string;
  importToken: string;
};

type BuildPageInput = {
  bookId: string;
  importRunId: string;
  sectionIdBySourceId: Map<string, string>;
};

function pickText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeLanguage(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (normalized?.startsWith("en")) {
    return "en";
  }

  return "it";
}

function toJsonValue(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (typeof value === "object") {
    const record: Record<string, Json> = {};

    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) {
        record[key] = toJsonValue(item);
      }
    }

    return record;
  }

  return String(value);
}

function toJsonArray(value: string[] | undefined): Json {
  return value ?? [];
}

function mapSectionStatus(status: NormalizedKdpProject["sections"][number]["status"]) {
  return status === "ok" ? "ready" : "needs_review";
}

function mapPageStatus(status: BookPage["status"]) {
  if (status === "ready") {
    return "imported";
  }

  if (status === "error") {
    return "invalid";
  }

  return "needs_review";
}

function mapPageSourceType(sourceType: BookPage["sourceType"]) {
  return sourceType === "expanded_range" ? "generated_interval" : "fixed_page";
}

function buildPageContent(page: BookPage) {
  const content: Record<string, unknown> = {
    ...page.content,
  };

  if (page.sectionId) {
    content.normalizedSectionId = page.sectionId;
  }

  if (page.layoutHints && Object.keys(page.layoutHints).length > 0) {
    content.layoutHints = page.layoutHints;
  }

  if (page.extras && Object.keys(page.extras).length > 0) {
    content.extras = page.extras;
  }

  return toJsonValue(content);
}

export function hashGenericDraftText(rawText: string) {
  return createHash("sha256").update(rawText).digest("hex");
}

export function createGenericDraftImportIds() {
  return {
    importRunId: randomUUID(),
    importToken: randomUUID(),
  };
}

export function getGenericDraftBookDetails(
  project: NormalizedKdpProject,
): GenericDraftBookDetails {
  return {
    aiUsageType: "ai_assisted",
    authorName: "Autore KDP Builder",
    bookType: GENERIC_DRAFT_BOOK_TYPE,
    language: normalizeLanguage(project.project.language),
    subtitle: pickText(project.project.subtitle, project.kdpMetadata?.subtitle),
    title:
      pickText(
        project.project.title,
        project.kdpMetadata?.title,
        project.coverBrief?.title,
      ) ?? "Libretto importato",
  };
}

export function canPersistGenericDraftProject(
  project: NormalizedKdpProject,
): GenericDraftPersistenceValidation {
  if (project.importReport.status === "failed") {
    return {
      ok: false,
      message:
        "La bozza contiene errori bloccanti. Correggi il report prima di creare il libretto.",
    };
  }

  if (project.importReport.errors.length > 0) {
    return {
      ok: false,
      message:
        "La bozza contiene errori bloccanti. Correggi il report prima di creare il libretto.",
    };
  }

  if (project.pages.length === 0) {
    return {
      ok: false,
      message:
        "La bozza non contiene pagine normalizzate salvabili. Controlla la sequenza pagine.",
    };
  }

  return {
    ok: true,
    message: null,
  };
}

export function buildGenericDraftSectionInserts(
  project: NormalizedKdpProject,
  input: BuildSectionInput,
): GenericDraftSectionInsertPlan[] {
  const createId = input.createId ?? randomUUID;

  return project.sections.map((section, index) => {
    const sectionId = createId();
    const settings = toJsonValue({
      importer: {
        actualPageCount: section.actualPageCount ?? null,
        expectedPageCount: section.expectedPageCount ?? null,
        kind: GENERIC_DRAFT_IMPORT_KIND,
        normalizedSectionId: section.id,
        pageEnd: section.endPage ?? null,
        pageStart: section.startPage ?? null,
        parserStatus: section.status,
        warnings: section.warnings ?? [],
      },
    });

    return {
      sourceSectionId: section.id,
      insert: {
        id: sectionId,
        book_id: input.bookId,
        section_type: "chapter",
        title: section.title || `Sezione ${index + 1}`,
        subtitle:
          section.startPage && section.endPage
            ? `Pagine ${section.startPage}-${section.endPage}`
            : null,
        body: null,
        sort_order: index + 1,
        include_in_toc: true,
        section_status: mapSectionStatus(section.status),
        page_break_before: index > 0,
        layout_preset: "default",
        editor_notes: "Sezione creata da Parser/Importer V0.",
        settings,
        ...getCreateOwnershipFields(input.actor),
      },
    };
  });
}

export function buildGenericDraftImportRunInsert(
  project: NormalizedKdpProject,
  input: BuildImportRunInput,
): TablesInsert<"kdp_import_runs"> {
  return {
    id: input.importRunId,
    book_id: input.bookId,
    import_token: input.importToken,
    draft_hash: input.draftHash,
    report: toJsonValue(project.importReport),
    import_kind: GENERIC_DRAFT_IMPORT_KIND,
    parser_version:
      project.source.parserVersion || project.importReport.summary.parserVersion,
    source_draft_version: project.source.draftVersion ?? null,
    normalized_project: toJsonValue(project),
    cover_brief: project.coverBrief ? toJsonValue(project.coverBrief) : null,
    kdp_metadata: project.kdpMetadata ? toJsonValue(project.kdpMetadata) : null,
    quality_checklist: project.qualityChecklist
      ? toJsonValue(project.qualityChecklist)
      : null,
    created_by_user_id: input.actor.userId,
    created_by_email: input.actor.email,
  };
}

export function buildGenericDraftPageInserts(
  project: NormalizedKdpProject,
  input: BuildPageInput,
): GenericDraftPageInsertPlan[] {
  return project.pages.map((page) => {
    const mappedSectionId = page.sectionId
      ? input.sectionIdBySourceId.get(page.sectionId)
      : undefined;

    return {
      insert: {
        book_id: input.bookId,
        import_run_id: input.importRunId,
        section_id: mappedSectionId ?? null,
        page_number: page.pageNumber,
        template_id: page.templateId ?? null,
        title: page.title ?? null,
        source_type: mapPageSourceType(page.sourceType),
        source_ref: page.sourceRef ?? page.sectionId ?? null,
        status: mapPageStatus(page.status),
        content: buildPageContent(page),
        warnings: toJsonArray(page.warnings),
        errors: toJsonArray(page.errors),
      },
    };
  });
}
