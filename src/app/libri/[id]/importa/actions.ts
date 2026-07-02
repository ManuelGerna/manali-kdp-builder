"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseStructuredDraft,
  type DraftImportResult,
} from "@/lib/kdp/draft-import";
import {
  importKdpBuilderDraft,
  type NormalizedKdpProject,
} from "@/lib/kdp/importer";
import { createOwnershipActor } from "@/lib/kdp/ownership";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type DraftImportFormState = {
  fields?: {
    draft_text?: string;
  };
  importToken: string | null;
  message: string | null;
  preview: DraftImportResult | null;
};

export type GenericDraftImportFormState = {
  fields?: {
    draft_text?: string;
  };
  message: string | null;
  preview: NormalizedKdpProject | null;
};

const MAX_DRAFT_LENGTH = 120000;

function logDraftImportAction(
  event: string,
  context: Record<string, boolean | number | string | null | undefined> = {},
) {
  console.error("[kdp-draft-import:action]", {
    context,
    event,
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

function getDraftHash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getImportPath(
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

  return `/libri/${bookId}/importa${query ? `?${query}` : ""}`;
}

function getContentPathWithReport(
  bookId: string,
  params: { run?: string; status: string },
) {
  const searchParams = new URLSearchParams({
    status: params.status,
  });

  if (params.run) {
    searchParams.set("run", params.run);
  }

  return `/libri/${bookId}/contenuti?${searchParams.toString()}`;
}

async function getAuthenticatedSupabase(actionName: string) {
  if (!hasSupabaseServerConfig()) {
    logDraftImportAction("missing_supabase_config", {
      actionName,
    });

    return {
      actor: null,
      error:
        "Supabase non configurato. Completa le variabili del progetto KDP Builder.",
      supabase: null,
    };
  }

  const supabase = await createClient().catch((error: unknown) => {
    logDraftImportAction("create_supabase_client_failed", {
      actionName,
      errorName: getErrorName(error),
    });

    return null;
  });

  if (!supabase) {
    return {
      actor: null,
      error: "Supabase non disponibile in questo momento.",
      supabase: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logDraftImportAction("auth_user_missing", {
      actionName,
      authErrorName: userError?.name,
      authErrorStatus: userError?.status,
      hasUser: Boolean(user),
    });

    redirect("/login");
  }

  return {
    actor: createOwnershipActor({
      email: user.email,
      userId: user.id,
    }),
    error: null,
    supabase,
  };
}

async function getBookAccessError(
  supabase: KdpSupabaseClient,
  bookId: string,
) {
  const { data, error } = await supabase
    .from("kdp_books")
    .select("id,status,archived_at")
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    logDraftImportAction("book_access_query_failed", {
      bookIdTail: idTail(bookId),
      errorCode: error.code,
      errorName: error.name,
    });

    return "Non riesco a verificare il libretto selezionato.";
  }

  if (!data) {
    return "Libretto non trovato o non accessibile.";
  }

  if (data.archived_at || data.status === "archived") {
    return "Questo libretto e' archiviato. Ripristinalo prima di importare nuovi contenuti.";
  }

  return null;
}

function validateDraftText(bookId: string, draftText: string) {
  if (!bookId) {
    return "Libretto non valido.";
  }

  if (!draftText) {
    return "Incolla una bozza prima di analizzarla.";
  }

  if (draftText.length > MAX_DRAFT_LENGTH) {
    return "La bozza e' troppo lunga per l'import V1. Dividila in piu' parti.";
  }

  return null;
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
    logDraftImportAction("generic_importer_failed", {
      errorName: getErrorName(error),
    });

    return {
      fields,
      message:
        "Non riesco ad analizzare questa bozza con il Parser V0. Controlla il formato e riprova.",
      preview: null,
    };
  }
}

export async function analyzeDraftAction(
  _previousState: DraftImportFormState,
  formData: FormData,
): Promise<DraftImportFormState> {
  const bookId = getString(formData, "book_id");
  const draftText = getString(formData, "draft_text");
  const fields = {
    draft_text: draftText,
  };
  const validationError = validateDraftText(bookId, draftText);

  if (validationError) {
    return {
      fields,
      importToken: null,
      message: validationError,
      preview: null,
    };
  }

  const { supabase, error } =
    await getAuthenticatedSupabase("analyze-draft");

  if (!supabase) {
    return {
      fields,
      importToken: null,
      message: error,
      preview: null,
    };
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    return {
      fields,
      importToken: null,
      message: bookAccessError,
      preview: null,
    };
  }

  const preview = parseStructuredDraft(draftText);

  if (preview.sections.length === 0) {
    return {
      fields,
      importToken: null,
      message: "Non ho rilevato sezioni importabili nella bozza.",
      preview: null,
    };
  }

  return {
    fields,
    importToken: randomUUID(),
    message: null,
    preview,
  };
}

function getImportFailureMessage(error: { code?: string; message?: string }) {
  if (error.message?.includes("book_not_found_or_archived")) {
    return "Libretto non trovato, non accessibile o archiviato. Ripristinalo prima di importare.";
  }

  if (
    error.message?.includes("empty_import_payload") ||
    error.message?.includes("invalid_import_request") ||
    error.message?.includes("invalid_import_hash")
  ) {
    return "Import non valido. Rianalizza la bozza e riprova.";
  }

  if (
    error.message?.includes("invalid_section") ||
    error.message?.includes("invalid_block")
  ) {
    return "La preview contiene dati non validi. Rianalizza la bozza e riprova.";
  }

  if (error.code === "42501") {
    return "Il database non consente l'import. Verifica grant e policy Supabase.";
  }

  return "Import interrotto. Nessun contenuto parziale e' stato mantenuto.";
}

export async function importDraftAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const draftText = getString(formData, "draft_text");
  const importToken = getString(formData, "import_token");
  const validationError = validateDraftText(bookId, draftText);

  if (validationError) {
    redirect(getImportPath(bookId || "missing", { error: validationError }));
  }

  if (!importToken || !isUuid(importToken)) {
    redirect(
      getImportPath(bookId, {
        error: "Token import non valido. Rianalizza la bozza e riprova.",
      }),
    );
  }

  const { supabase, actor, error } =
    await getAuthenticatedSupabase("import-draft");

  if (!supabase || !actor) {
    redirect(getImportPath(bookId, { error: error ?? "Accesso non valido." }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getImportPath(bookId, { error: bookAccessError }));
  }

  const parsedDraft = parseStructuredDraft(draftText);

  if (parsedDraft.sections.length === 0) {
    redirect(
      getImportPath(bookId, {
        error: "Non ho rilevato sezioni importabili nella bozza.",
      }),
    );
  }

  const { error: importError } = await supabase.rpc(
    "import_kdp_structured_draft_v2",
    {
      p_actor_email: actor.email,
      p_book_id: bookId,
      p_draft_hash: getDraftHash(draftText),
      p_import_token: importToken,
      p_sections: parsedDraft.sections as unknown as Json,
    },
  );

  if (importError) {
    logDraftImportAction("import_rpc_failed", {
      bookIdTail: idTail(bookId),
      errorCode: importError.code,
      errorName: importError.name,
    });

    redirect(
      getImportPath(bookId, {
        error: getImportFailureMessage(importError),
      }),
    );
  }

  revalidatePath(`/libri/${bookId}`);
  revalidatePath(`/libri/${bookId}/contenuti`);
  revalidatePath(`/libri/${bookId}/importa`);
  redirect(
    getContentPathWithReport(bookId, {
      run: importToken,
      status: "imported",
    }),
  );
}
