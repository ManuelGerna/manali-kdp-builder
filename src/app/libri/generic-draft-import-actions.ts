"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
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
  importKdpBuilderDraft,
  type NormalizedKdpProject,
} from "@/lib/kdp/importer";
import { createOwnershipActor } from "@/lib/kdp/ownership";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

export type GenericDraftImportFormState = {
  fields?: {
    draft_text?: string;
  };
  message: string | null;
  preview: NormalizedKdpProject | null;
};

export type CreateBookFromGenericDraftState = {
  fields?: {
    draft_text?: string;
  };
  message: string | null;
};

const MAX_DRAFT_LENGTH = 120000;
const PAGE_INSERT_CHUNK_SIZE = 200;

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function validateGenericDraftText(draftText: string) {
  if (!draftText) {
    return "Incolla una bozza prima di analizzarla.";
  }

  if (draftText.length > MAX_DRAFT_LENGTH) {
    return "La bozza e' troppo lunga per il Parser V0. Dividila in piu' parti.";
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
  const draftText = getString(formData, "draft_text");
  const fields = {
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
      preview: importKdpBuilderDraft(draftText),
    };
  } catch (error: unknown) {
    console.error("[kdp-generic-draft-import:action]", {
      errorName: getErrorName(error),
      event: "generic_importer_failed",
    });

    return {
      fields,
      message:
        "Non riesco ad analizzare questa bozza con il Parser V0. Controlla il formato e riprova.",
      preview: null,
    };
  }
}

export async function createBookFromGenericDraftAction(
  _previousState: CreateBookFromGenericDraftState,
  formData: FormData,
): Promise<CreateBookFromGenericDraftState> {
  const draftText = getString(formData, "draft_text");
  const fields = {
    draft_text: draftText,
  };
  const validationError = validateGenericDraftText(draftText);

  if (validationError) {
    return {
      fields,
      message: validationError,
    };
  }

  let project: NormalizedKdpProject;

  try {
    project = importKdpBuilderDraft(draftText);
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

  const persistenceValidation = canPersistGenericDraftProject(project);

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
  const bookDetails = getGenericDraftBookDetails(project);
  const bookResult = await createBookWithDefaultSettings(supabase, {
    title: bookDetails.title,
    subtitle: bookDetails.subtitle,
    authorName: bookDetails.authorName,
    language: bookDetails.language,
    aiUsageType: bookDetails.aiUsageType,
    bookType: bookDetails.bookType,
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
