"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SECTION_TYPES, type SectionType } from "@/lib/kdp/constants";
import {
  createSection,
  deleteSection,
  moveSection,
  updateSection,
  type MoveSectionDirection,
} from "@/lib/kdp/sections";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type SectionFormState = {
  message: string | null;
  fields?: {
    section_type?: string;
    title?: string;
    body?: string;
  };
};

const SECTION_TYPE_VALUES: readonly string[] = SECTION_TYPES;

function logSectionAction(
  event: string,
  context: Record<string, boolean | number | string | null | undefined> = {},
) {
  console.error("[kdp-sections:action]", {
    event,
    context,
  });
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function idTail(value: string) {
  return value.slice(-8);
}

function getString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function getOptionalText(formData: FormData, name: string) {
  const value = getString(formData, name);
  return value || null;
}

function isSectionType(value: string): value is SectionType {
  return SECTION_TYPE_VALUES.includes(value);
}

function isMoveDirection(value: string): value is MoveSectionDirection {
  return value === "up" || value === "down";
}

function getFields(formData: FormData) {
  return {
    section_type: getString(formData, "section_type"),
    title: getString(formData, "title"),
    body: getString(formData, "body"),
  };
}

function getContentPath(
  bookId: string,
  params: { error?: string; status?: string } = {},
) {
  const searchParams = new URLSearchParams();

  if (params.error) {
    searchParams.set("error", params.error);
  }

  if (params.status) {
    searchParams.set("status", params.status);
  }

  const query = searchParams.toString();

  return `/libri/${bookId}/contenuti${query ? `?${query}` : ""}`;
}

function revalidateBookContent(bookId: string) {
  revalidatePath(`/libri/${bookId}`);
  revalidatePath(`/libri/${bookId}/contenuti`);
}

async function getAuthenticatedSupabase(actionName: string) {
  if (!hasSupabaseServerConfig()) {
    logSectionAction("missing_supabase_config", {
      actionName,
    });

    return {
      supabase: null,
      error:
        "Supabase non configurato. Completa le variabili del progetto KDP Builder.",
    };
  }

  const supabase = await createClient().catch((error: unknown) => {
    logSectionAction("create_supabase_client_failed", {
      actionName,
      errorName: getErrorName(error),
    });

    return null;
  });

  if (!supabase) {
    return {
      supabase: null,
      error: "Supabase non disponibile in questo momento.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logSectionAction("auth_user_missing", {
      actionName,
      hasUser: Boolean(user),
      authErrorName: userError?.name,
      authErrorStatus: userError?.status,
    });

    redirect("/login");
  }

  return {
    supabase,
    error: null,
  };
}

async function getBookAccessError(
  supabase: KdpSupabaseClient,
  bookId: string,
) {
  const { data, error } = await supabase
    .from("kdp_books")
    .select("id")
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    logSectionAction("book_access_query_failed", {
      bookIdTail: idTail(bookId),
      errorName: error.name,
      errorCode: error.code,
    });

    return "Non riesco a verificare il libretto selezionato.";
  }

  if (!data) {
    return "Libretto non trovato o non accessibile.";
  }

  return null;
}

export async function createSectionAction(
  _previousState: SectionFormState,
  formData: FormData,
): Promise<SectionFormState> {
  const bookId = getString(formData, "book_id");
  const sectionType = getString(formData, "section_type") || "chapter";
  const fields = getFields(formData);

  if (!bookId) {
    return {
      message: "Libretto non valido.",
      fields,
    };
  }

  if (!isSectionType(sectionType)) {
    return {
      message: "Tipo sezione non valido.",
      fields,
    };
  }

  const { supabase, error } = await getAuthenticatedSupabase("create");

  if (!supabase) {
    return {
      message: error,
      fields,
    };
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    return {
      message: bookAccessError,
      fields,
    };
  }

  const result = await createSection(supabase, {
    bookId,
    sectionType,
    title: getOptionalText(formData, "title"),
    body: getOptionalText(formData, "body"),
  });

  if (result.data === null) {
    return {
      message: result.error,
      fields,
    };
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "created" }));
}

export async function updateSectionAction(
  _previousState: SectionFormState,
  formData: FormData,
): Promise<SectionFormState> {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const sectionType = getString(formData, "section_type");
  const fields = getFields(formData);

  if (!bookId || !sectionId) {
    return {
      message: "Sezione non valida.",
      fields,
    };
  }

  if (!isSectionType(sectionType)) {
    return {
      message: "Tipo sezione non valido.",
      fields,
    };
  }

  const { supabase, error } = await getAuthenticatedSupabase("update");

  if (!supabase) {
    return {
      message: error,
      fields,
    };
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    return {
      message: bookAccessError,
      fields,
    };
  }

  const result = await updateSection(supabase, {
    bookId,
    sectionId,
    sectionType,
    title: getOptionalText(formData, "title"),
    body: getOptionalText(formData, "body"),
  });

  if (result.data === null) {
    return {
      message: result.error,
      fields,
    };
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "updated" }));
}

export async function deleteSectionAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId) {
    redirect(getContentPath(bookId, { error: "Sezione non valida." }));
  }

  const { supabase, error } = await getAuthenticatedSupabase("delete");

  if (!supabase) {
    redirect(getContentPath(bookId, { error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getContentPath(bookId, { error: bookAccessError }));
  }

  const result = await deleteSection(supabase, bookId, sectionId);

  if (result.data === null) {
    redirect(getContentPath(bookId, { error: result.error }));
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "deleted" }));
}

export async function moveSectionAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const direction = getString(formData, "direction");

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !isMoveDirection(direction)) {
    redirect(getContentPath(bookId, { error: "Riordino non valido." }));
  }

  const { supabase, error } = await getAuthenticatedSupabase("move");

  if (!supabase) {
    redirect(getContentPath(bookId, { error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getContentPath(bookId, { error: bookAccessError }));
  }

  const result = await moveSection(supabase, bookId, sectionId, direction);

  if (result.data === null) {
    redirect(getContentPath(bookId, { error: result.error }));
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "reordered" }));
}
