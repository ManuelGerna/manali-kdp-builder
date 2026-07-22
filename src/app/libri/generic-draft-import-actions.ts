"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { getBookVisibilityFromFormData } from "@/lib/kdp/book-visibility";
import {
  buildEditorialBlockInserts,
  buildEditorialBookDetails,
  buildEditorialImportRunInsert,
  buildEditorialSectionInserts,
  canPersistEditorialDraft,
  resolveEditorialPersistenceFailure,
} from "@/lib/kdp/editorial-draft-persistence";
import {
  createBookWithDefaultSettings,
  type RepositoryResult,
} from "@/lib/kdp/books";
import {
  buildGenericDraftImportRunInsert,
  buildGenericDraftPageInserts,
  buildGenericDraftSectionInserts,
  canPersistGenericDraftProject,
  createGenericDraftImportIds,
  getGenericDraftBookDetails,
  hashGenericDraftText,
} from "@/lib/kdp/generic-draft-persistence";
import {
  normalizeDraftParserMode,
  parseDraftWithSelectedParser,
  type DraftParserMode,
  type EditorialDraftProject,
  type NormalizedKdpProject,
} from "@/lib/kdp/importer";
import {
  getUtf8ByteLength,
  MAX_DRAFT_TEXT_FILE_SIZE_BYTES,
  MAX_DRAFT_TEXT_FILE_SIZE_LABEL,
} from "@/lib/kdp/importer/draft-text-file";
import { createOwnershipActor } from "@/lib/kdp/ownership";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

export type GenericDraftImportFormState = {
  fields?: {
    draft_type?: DraftParserMode;
    draft_text?: string;
  };
  message: string | null;
  preview: EditorialDraftProject | NormalizedKdpProject | null;
};

export type CreateBookFromGenericDraftState = {
  fields?: {
    draft_type?: DraftParserMode;
    draft_text?: string;
    visibility?: string;
  };
  message: string | null;
};

const PAGE_INSERT_CHUNK_SIZE = 200;

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getDraftText(formData: FormData) {
  // Questa è la sorgente testuale transitata dal form. Il browser può
  // normalizzare tecnicamente CRLF/LF nel valore della textarea; parole,
  // punteggiatura, spazi significativi, righe vuote e ordine restano invariati.
  return String(formData.get("draft_text") ?? "");
}

function getDraftParserMode(formData: FormData) {
  return normalizeDraftParserMode(
    String(formData.get("draft_type") ?? ""),
  );
}

function isEditorialProject(
  project: EditorialDraftProject | NormalizedKdpProject,
): project is EditorialDraftProject {
  return "kind" in project && project.kind === "editorial";
}

function validateGenericDraftText(draftText: string) {
  if (!draftText.trim()) {
    return "Incolla una bozza prima di analizzarla.";
  }

  if (getUtf8ByteLength(draftText) > MAX_DRAFT_TEXT_FILE_SIZE_BYTES) {
    return `Il testo supera la dimensione massima consentita di ${MAX_DRAFT_TEXT_FILE_SIZE_LABEL}.`;
  }

  return null;
}

function logGenericDraftCreateAction(
  event: string,
  context: Record<string, boolean | number | string | null | undefined> = {},
) {
  console.error("[kdp-generic-draft-create:action]", {
    event,
    context,
  });
}

function getPersistenceMessage(error: PostgrestError | null, fallback: string) {
  if (!error) {
    return fallback;
  }

  if (error.code === "42501") {
    return "Il database non consente il salvataggio della bozza importata. Verifica grant e policy Supabase.";
  }

  if (error.code === "23503") {
    return "Non riesco a collegare la bozza importata ai record del libretto.";
  }

  if (error.code === "23505") {
    return "Una o piu' pagine importate risultano duplicate per questo libretto.";
  }

  if (error.code === "23514") {
    return "La bozza importata contiene valori non accettati dallo schema del database.";
  }

  return fallback;
}

async function cleanupCreatedBook(
  supabase: KdpSupabaseClient,
  bookId: string,
): Promise<RepositoryResult<{ cleaned: boolean }>> {
  const { error } = await supabase.from("kdp_books").delete().eq("id", bookId);

  if (error) {
    logGenericDraftCreateAction("cleanup_book_failed", {
      bookIdTail: bookId.slice(-8),
      code: error.code,
    });

    return {
      data: null,
      error:
        "Il libretto e' stato creato, ma il salvataggio della bozza non e' stato completato. Controlla il record prima di riprovare.",
    };
  }

  return {
    data: {
      cleaned: true,
    },
    error: null,
  };
}

async function insertImportedPages(
  supabase: KdpSupabaseClient,
  pages: ReturnType<typeof buildGenericDraftPageInserts>,
) {
  for (let index = 0; index < pages.length; index += PAGE_INSERT_CHUNK_SIZE) {
    const chunk = pages
      .slice(index, index + PAGE_INSERT_CHUNK_SIZE)
      .map((page) => page.insert);

    const { error } = await supabase.from("kdp_imported_pages").insert(chunk);

    if (error) {
      return error;
    }
  }

  return null;
}

export async function analyzeGenericDraftAction(
  _previousState: GenericDraftImportFormState,
  formData: FormData,
): Promise<GenericDraftImportFormState> {
  const draftText = getDraftText(formData);
  const draftType = getDraftParserMode(formData);
  const fields = {
    draft_type: draftType,
    draft_text: draftText,
  };
  const validationError = validateGenericDraftText(draftText);

  if (validationError) {
    return {
      fields,
      message: validationError,
      preview: null,
    };
  }

  try {
    return {
      fields,
      message: null,
      preview: parseDraftWithSelectedParser(draftText, draftType),
    };
  } catch (error: unknown) {
    console.error("[kdp-generic-draft-import:action]", {
      errorName: getErrorName(error),
      event: "generic_importer_failed",
    });

    return {
      fields,
      message:
        "Non riesco ad analizzare questa bozza. Controlla il formato e riprova.",
      preview: null,
    };
  }
}

export async function createBookFromGenericDraftAction(
  _previousState: CreateBookFromGenericDraftState,
  formData: FormData,
): Promise<CreateBookFromGenericDraftState> {
  const draftText = getDraftText(formData);
  const draftType = getDraftParserMode(formData);
  const visibility = getBookVisibilityFromFormData(formData);
  const fields = {
    draft_type: draftType,
    draft_text: draftText,
    visibility,
  };
  const validationError = validateGenericDraftText(draftText);

  if (validationError) {
    return {
      fields,
      message: validationError,
    };
  }

  let project: EditorialDraftProject | NormalizedKdpProject;

  try {
    project = parseDraftWithSelectedParser(draftText, draftType);
  } catch (error: unknown) {
    logGenericDraftCreateAction("generic_importer_failed", {
      errorName: getErrorName(error),
    });

    return {
      fields,
      message:
        "Non riesco ad analizzare questa bozza prima del salvataggio. Controlla il formato e riprova.",
    };
  }

  const persistenceValidation =
    isEditorialProject(project)
      ? canPersistEditorialDraft(project)
      : canPersistGenericDraftProject(project);

  if (!persistenceValidation.ok) {
    return {
      fields,
      message: persistenceValidation.message,
    };
  }

  if (!hasSupabaseServerConfig()) {
    logGenericDraftCreateAction("missing_supabase_config");

    return {
      fields,
      message:
        "Supabase non configurato. Completa le variabili del progetto KDP Builder prima di creare il libretto.",
    };
  }

  const supabase = await createClient().catch((error: unknown) => {
    logGenericDraftCreateAction("create_supabase_client_failed", {
      errorName: getErrorName(error),
    });

    return null;
  });

  if (!supabase) {
    return {
      fields,
      message: "Supabase non disponibile in questo momento.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logGenericDraftCreateAction("auth_user_missing", {
      hasUser: Boolean(user),
      authErrorName: userError?.name,
      authErrorStatus: userError?.status,
    });

    redirect("/login");
  }

  const actor = createOwnershipActor({
    email: user.email,
    userId: user.id,
  });

  if (isEditorialProject(project)) {
    const bookDetails = buildEditorialBookDetails(project, visibility);
    const bookResult = await createBookWithDefaultSettings(supabase, {
      ...bookDetails,
      title: bookDetails.title as string,
      actor,
    });

    if (bookResult.data === null) {
      return { fields, message: bookResult.error };
    }

    const bookId = bookResult.data.bookId;
    const sectionPlans = buildEditorialSectionInserts(project, {
      actor,
      bookId,
    });
    const sectionIdBySourceId = new Map(
      sectionPlans.map((section) => [
        section.sourceSectionId,
        section.insert.id as string,
      ]),
    );
    const { importRunId, importToken } = createGenericDraftImportIds();
    const importRun = buildEditorialImportRunInsert(project, {
      actor,
      bookId,
      draftHash: hashGenericDraftText(draftText),
      importRunId,
      importToken,
    });
    const blockPlans = buildEditorialBlockInserts(project, {
      actor,
      bookId,
      sectionIdBySourceId,
    });
    const { error: sectionError } = await supabase
      .from("kdp_sections")
      .insert(sectionPlans.map((plan) => plan.insert));

    if (sectionError) {
      const failureMessage = getPersistenceMessage(
        sectionError,
        "Creazione interrotta: non sono riuscito a salvare la struttura editoriale.",
      );

      return {
        fields,
        message: await resolveEditorialPersistenceFailure(
          () => cleanupCreatedBook(supabase, bookId),
          failureMessage,
        ),
      };
    }

    const { error: importRunError } = await supabase
      .from("kdp_import_runs")
      .insert(importRun);

    if (importRunError) {
      const failureMessage = getPersistenceMessage(
        importRunError,
        "Creazione interrotta: non sono riuscito a salvare il report editoriale.",
      );

      return {
        fields,
        message: await resolveEditorialPersistenceFailure(
          () => cleanupCreatedBook(supabase, bookId),
          failureMessage,
        ),
      };
    }

    if (blockPlans.length > 0) {
      const { error: blockError } = await supabase
        .from("kdp_section_blocks")
        .insert(blockPlans.map((plan) => plan.insert));

      if (blockError) {
        const failureMessage = getPersistenceMessage(
          blockError,
          "Creazione interrotta: non sono riuscito a salvare i blocchi editoriali.",
        );

        return {
          fields,
          message: await resolveEditorialPersistenceFailure(
            () => cleanupCreatedBook(supabase, bookId),
            failureMessage,
          ),
        };
      }
    }

    revalidatePath("/libri");
    revalidatePath(`/libri/${bookId}`);
    redirect(`/libri/${bookId}/contenuti?run=${importToken}`);
  }

  const bookDetails = getGenericDraftBookDetails(project);
  const bookResult = await createBookWithDefaultSettings(supabase, {
    title: bookDetails.title,
    subtitle: bookDetails.subtitle,
    authorName: bookDetails.authorName,
    language: bookDetails.language,
    aiUsageType: bookDetails.aiUsageType,
    bookType: bookDetails.bookType,
    visibility,
    actor,
  });

  if (bookResult.data === null) {
    return {
      fields,
      message: bookResult.error,
    };
  }

  const bookId = bookResult.data.bookId;
  const sectionPlans = buildGenericDraftSectionInserts(project, {
    actor,
    bookId,
  });
  const sectionIdBySourceId = new Map(
    sectionPlans.map((section) => [
      section.sourceSectionId,
      section.insert.id as string,
    ]),
  );
  const { importRunId, importToken } = createGenericDraftImportIds();
  const importRunInsert = buildGenericDraftImportRunInsert(project, {
    actor,
    bookId,
    draftHash: hashGenericDraftText(draftText),
    importRunId,
    importToken,
  });
  const pagePlans = buildGenericDraftPageInserts(project, {
    bookId,
    importRunId,
    sectionIdBySourceId,
  });

  if (sectionPlans.length > 0) {
    const { error: sectionError } = await supabase
      .from("kdp_sections")
      .insert(sectionPlans.map((section) => section.insert));

    if (sectionError) {
      logGenericDraftCreateAction("insert_sections_failed", {
        bookIdTail: bookId.slice(-8),
        code: sectionError.code,
      });

      const cleanup = await cleanupCreatedBook(supabase, bookId);

      return {
        fields,
        message:
          cleanup.data === null
            ? cleanup.error
            : getPersistenceMessage(
                sectionError,
                "Creazione interrotta: non sono riuscito a salvare le sezioni importate.",
              ),
      };
    }
  }

  const { error: importRunError } = await supabase
    .from("kdp_import_runs")
    .insert(importRunInsert);

  if (importRunError) {
    logGenericDraftCreateAction("insert_import_run_failed", {
      bookIdTail: bookId.slice(-8),
      code: importRunError.code,
    });

    const cleanup = await cleanupCreatedBook(supabase, bookId);

    return {
      fields,
      message:
        cleanup.data === null
          ? cleanup.error
          : getPersistenceMessage(
              importRunError,
              "Creazione interrotta: non sono riuscito a salvare il report import.",
            ),
    };
  }

  const pageError = await insertImportedPages(supabase, pagePlans);

  if (pageError) {
    logGenericDraftCreateAction("insert_imported_pages_failed", {
      bookIdTail: bookId.slice(-8),
      code: pageError.code,
    });

    const cleanup = await cleanupCreatedBook(supabase, bookId);

    return {
      fields,
      message:
        cleanup.data === null
          ? cleanup.error
          : getPersistenceMessage(
              pageError,
              "Creazione interrotta: non sono riuscito a salvare le pagine importate.",
            ),
    };
  }

  revalidatePath("/libri");
  revalidatePath(`/libri/${bookId}`);
  redirect(`/libri/${bookId}`);
}
