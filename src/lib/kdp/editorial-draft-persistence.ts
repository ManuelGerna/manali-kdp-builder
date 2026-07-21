import { randomUUID } from "node:crypto";
import type { EditorialDraftProject } from "./importer/index.ts";
import type { BookVisibility } from "./book-visibility.ts";
import { buildEditorialDraftImportReport } from "./import-runs.ts";
import { getCreateOwnershipFields, type OwnershipActor } from "./ownership.ts";
import type { Json, TablesInsert } from "../../types/database.ts";

export const EDITORIAL_DRAFT_IMPORT_KIND = "editorial_draft_v1";
export const EDITORIAL_DRAFT_BOOK_TYPE = "generic_kdp_book";

type PersistenceInput = {
  actor: OwnershipActor;
  bookId: string;
  createId?: () => string;
};

export type EditorialSectionInsertPlan = {
  sourceSectionId: string;
  insert: TablesInsert<"kdp_sections">;
};

export type EditorialBlockInsertPlan = {
  insert: TablesInsert<"kdp_section_blocks">;
};

export type EditorialCleanupResult = {
  data: { cleaned: boolean } | null;
  error: string | null;
};

export function getEditorialPersistenceFailureMessage(
  cleanup: EditorialCleanupResult,
  failureMessage: string,
) {
  return cleanup.data === null
    ? cleanup.error ??
        "Il salvataggio editoriale e' fallito e il libro potrebbe essere rimasto parziale."
    : failureMessage;
}

export async function resolveEditorialPersistenceFailure(
  cleanup: () => Promise<EditorialCleanupResult>,
  failureMessage: string,
) {
  return getEditorialPersistenceFailureMessage(await cleanup(), failureMessage);
}

export function buildEditorialBookDetails(
  project: EditorialDraftProject,
  visibility: BookVisibility,
) {
  return {
    aiUsageType: "none" as const,
    authorName: "Autore KDP Builder",
    bookType: EDITORIAL_DRAFT_BOOK_TYPE,
    language: "it",
    subtitle: project.subtitle,
    title: project.title,
    visibility,
  };
}

function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(toJson);

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, toJson(item)]),
    );
  }

  return String(value);
}

export function canPersistEditorialDraft(project: EditorialDraftProject) {
  if (project.errors.length > 0 || !project.title) {
    return {
      message: "Il manoscritto editoriale contiene errori bloccanti.",
      ok: false as const,
    };
  }

  if (project.sections.length === 0) {
    return {
      message: "Il manoscritto non contiene una struttura editoriale salvabile.",
      ok: false as const,
    };
  }

  return { message: null, ok: true as const };
}

export function buildEditorialSectionInserts(
  project: EditorialDraftProject,
  input: PersistenceInput,
): EditorialSectionInsertPlan[] {
  const createId = input.createId ?? randomUUID;

  return project.sections.map((section, index) => ({
    sourceSectionId: section.id,
    insert: {
      ...getCreateOwnershipFields(input.actor),
      body: null,
      book_id: input.bookId,
      editor_notes: null,
      id: createId(),
      include_in_toc: section.kind !== "introduction",
      layout_preset: "default",
      page_break_before: false,
      section_status: "ready",
      section_type:
        section.kind === "chapter"
          ? "chapter"
          : section.kind === "main"
            ? "chapter_text"
            : "introduction",
      settings: toJson({
        editorialImporter: {
          kind: EDITORIAL_DRAFT_IMPORT_KIND,
          sourceSectionId: section.id,
        },
      }),
      sort_order: index + 1,
      subtitle: null,
      title: section.title,
    },
  }));
}

export function buildEditorialBlockInserts(
  project: EditorialDraftProject,
  input: {
    actor: OwnershipActor;
    bookId: string;
    sectionIdBySourceId: Map<string, string>;
  },
): EditorialBlockInsertPlan[] {
  const plans: EditorialBlockInsertPlan[] = [];

  for (const section of project.sections) {
    const sectionId = input.sectionIdBySourceId.get(section.id);

    if (!sectionId) continue;
    const targetSectionId = sectionId;
    let sortOrder = 0;

    function appendTextBlock(title: string | null, body: string | null) {
      sortOrder += 1;
      plans.push({
        insert: {
          ...getCreateOwnershipFields(input.actor),
          block_type: "text",
          body,
          book_id: input.bookId,
          editor_notes: null,
          layout_preset: "default",
          print_visibility: "print",
          section_id: targetSectionId,
          sort_order: sortOrder,
          title,
        },
      });
    }

    function appendEditorialBlock(
      block: EditorialDraftProject["sections"][number]["blocks"][number],
    ) {
      appendTextBlock(
        block.type === "editorial" ? block.text : null,
        block.type === "editorial" ? null : block.text,
      );
    }

    for (const block of section.blocks) {
      appendEditorialBlock(block);
    }

    for (const subsection of section.subsections) {
      appendTextBlock(subsection.title, null);

      for (const block of subsection.blocks) {
        appendEditorialBlock(block);
      }
    }
  }

  return plans;
}

export function buildEditorialImportRunInsert(
  project: EditorialDraftProject,
  input: {
    actor: OwnershipActor;
    bookId: string;
    draftHash: string;
    importRunId: string;
    importToken: string;
  },
): TablesInsert<"kdp_import_runs"> {
  return {
    book_id: input.bookId,
    cover_brief: null,
    created_by_email: input.actor.email,
    created_by_user_id: input.actor.userId,
    draft_hash: input.draftHash,
    id: input.importRunId,
    import_kind: EDITORIAL_DRAFT_IMPORT_KIND,
    import_token: input.importToken,
    kdp_metadata: null,
    normalized_project: toJson(project),
    parser_version: project.parserVersion,
    quality_checklist: null,
    report: toJson(buildEditorialDraftImportReport(project)),
    source_draft_version: project.format,
  };
}
