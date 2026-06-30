"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAsset, deleteAsset } from "@/lib/kdp/assets";
import { touchBookOwnership } from "@/lib/kdp/books";
import {
  parseStructuredDraft,
  type DraftImportResult,
} from "@/lib/kdp/draft-import";
import { createOwnershipActor, type OwnershipActor } from "@/lib/kdp/ownership";
import { createSectionBlock } from "@/lib/kdp/section-blocks";
import { createSection } from "@/lib/kdp/sections";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type DraftImportFormState = {
  fields?: {
    draft_text?: string;
  };
  message: string | null;
  preview: DraftImportResult | null;
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

function getContentPath(bookId: string, status: string) {
  return `/libri/${bookId}/contenuti?status=${status}`;
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
    .select("id")
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
      message: validationError,
      preview: null,
    };
  }

  const { supabase, error } =
    await getAuthenticatedSupabase("analyze-draft");

  if (!supabase) {
    return {
      fields,
      message: error,
      preview: null,
    };
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    return {
      fields,
      message: bookAccessError,
      preview: null,
    };
  }

  const preview = parseStructuredDraft(draftText);

  if (preview.sections.length === 0) {
    return {
      fields,
      message: "Non ho rilevato sezioni importabili nella bozza.",
      preview: null,
    };
  }

  return {
    fields,
    message: null,
    preview,
  };
}

async function importDraftSectionBlocks(
  supabase: KdpSupabaseClient,
  input: {
    actor: OwnershipActor;
    bookId: string;
    sectionId: string;
    section: DraftImportResult["sections"][number];
  },
) {
  let sortOrder = 1;

  for (const block of input.section.blocks) {
    if (block.blockType === "image_prompt") {
      const assetResult = await createAsset(supabase, {
        actor: input.actor,
        altText: null,
        assetType: "image",
        bookId: input.bookId,
        prompt: block.prompt,
        status: "placeholder",
        title: block.title || "Immagine da inserire",
      });

      if (assetResult.data === null) {
        return assetResult.error;
      }

      const blockResult = await createSectionBlock(supabase, {
        actor: input.actor,
        assetId: assetResult.data.assetId,
        blockType: "image_prompt",
        body: block.body,
        bookId: input.bookId,
        editorNotes: block.editorNotes,
        layoutPreset: "image_text",
        printVisibility: "print",
        sectionId: input.sectionId,
        sortOrder,
        title: block.title,
      });

      if (blockResult.data === null) {
        await deleteAsset(supabase, input.bookId, assetResult.data.assetId);

        return blockResult.error;
      }

      sortOrder += 1;
      continue;
    }

    const blockResult = await createSectionBlock(supabase, {
      actor: input.actor,
      blockType: block.blockType,
      body: block.body,
      bookId: input.bookId,
      editorNotes: block.editorNotes,
      layoutPreset: "default",
      printVisibility: "print",
      sectionId: input.sectionId,
      sortOrder,
      title: block.title,
    });

    if (blockResult.data === null) {
      return blockResult.error;
    }

    sortOrder += 1;
  }

  return null;
}

export async function importDraftAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const draftText = getString(formData, "draft_text");
  const validationError = validateDraftText(bookId, draftText);

  if (validationError) {
    redirect(getImportPath(bookId || "missing", { error: validationError }));
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

  for (const section of parsedDraft.sections) {
    const sectionResult = await createSection(supabase, {
      actor,
      body: null,
      bookId,
      editorNotes: section.editorNotes.join("\n") || null,
      includeInToc: true,
      layoutPreset: "default",
      pageBreakBefore: false,
      sectionStatus: "draft",
      sectionType: "chapter",
      subtitle: null,
      title: section.title,
    });

    if (sectionResult.data === null) {
      redirect(getImportPath(bookId, { error: sectionResult.error }));
    }

    const blockError = await importDraftSectionBlocks(supabase, {
      actor,
      bookId,
      section,
      sectionId: sectionResult.data.sectionId,
    });

    if (blockError) {
      redirect(getImportPath(bookId, { error: blockError }));
    }
  }

  const ownershipResult = await touchBookOwnership(supabase, {
    actor,
    bookId,
  });

  if (ownershipResult.data === null) {
    redirect(getImportPath(bookId, { error: ownershipResult.error }));
  }

  revalidatePath(`/libri/${bookId}`);
  revalidatePath(`/libri/${bookId}/contenuti`);
  revalidatePath(`/libri/${bookId}/importa`);
  redirect(getContentPath(bookId, "imported"));
}
