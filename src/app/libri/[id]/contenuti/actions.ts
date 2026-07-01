"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAsset, deleteAsset } from "@/lib/kdp/assets";
import { touchBookOwnership } from "@/lib/kdp/books";
import {
  PRINT_VISIBILITIES,
  SECTION_LAYOUT_PRESETS,
  SECTION_STATUSES,
  SECTION_TYPES,
  type PrintVisibility,
  type SectionLayoutPreset,
  type SectionStatus,
  type SectionType,
} from "@/lib/kdp/constants";
import {
  createSectionBlock,
  deleteSectionBlock,
  insertPageBreakAfterBlock,
  moveSectionBlock,
  removePageBreakAfterBlock,
  updateSectionBlockVisibility,
  updateTextSectionBlock,
  type MoveSectionBlockDirection,
} from "@/lib/kdp/section-blocks";
import {
  createSection,
  deleteSection,
  moveSection,
  updateSection,
  type MoveSectionDirection,
} from "@/lib/kdp/sections";
import {
  createOwnershipActor,
  type OwnershipActor,
} from "@/lib/kdp/ownership";
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
    subtitle?: string;
    body?: string;
    include_in_toc?: string;
    section_status?: string;
    page_break_before?: string;
    layout_preset?: string;
    editor_notes?: string;
  };
};

const SECTION_TYPE_VALUES: readonly string[] = SECTION_TYPES;
const SECTION_STATUS_VALUES: readonly string[] = SECTION_STATUSES;
const SECTION_LAYOUT_PRESET_VALUES: readonly string[] = SECTION_LAYOUT_PRESETS;
const PRINT_VISIBILITY_VALUES: readonly string[] = PRINT_VISIBILITIES;

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

function getCheckbox(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function getToggleValue(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .some((value) => String(value).trim() === "on");
}

function isSectionType(value: string): value is SectionType {
  return SECTION_TYPE_VALUES.includes(value);
}

function isSectionStatus(value: string): value is SectionStatus {
  return SECTION_STATUS_VALUES.includes(value);
}

function isSectionLayoutPreset(value: string): value is SectionLayoutPreset {
  return SECTION_LAYOUT_PRESET_VALUES.includes(value);
}

function isMoveDirection(value: string): value is MoveSectionDirection {
  return value === "up" || value === "down";
}

function isBlockMoveDirection(
  value: string,
): value is MoveSectionBlockDirection {
  return value === "up" || value === "down";
}

function isPrintVisibility(value: string): value is PrintVisibility {
  return PRINT_VISIBILITY_VALUES.includes(value);
}

function getFields(formData: FormData) {
  return {
    section_type: getString(formData, "section_type"),
    title: getString(formData, "title"),
    subtitle: getString(formData, "subtitle"),
    body: getString(formData, "body"),
    include_in_toc: getCheckbox(formData, "include_in_toc") ? "true" : "false",
    section_status: getString(formData, "section_status"),
    page_break_before: getCheckbox(formData, "page_break_before")
      ? "true"
      : "false",
    layout_preset: getString(formData, "layout_preset"),
    editor_notes: getString(formData, "editor_notes"),
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
  revalidatePath(`/libri/${bookId}/anteprima`);
  revalidatePath(`/libri/${bookId}/contenuti`);
  revalidatePath(`/libri/${bookId}/export/pdf`);
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
    actor: createOwnershipActor({
      email: user.email,
      userId: user.id,
    }),
    error: null,
  };
}

async function touchBookAfterContentChange(
  supabase: KdpSupabaseClient,
  bookId: string,
  actor: OwnershipActor,
) {
  const ownershipResult = await touchBookOwnership(supabase, {
    actor,
    bookId,
  });

  return ownershipResult.data === null ? ownershipResult.error : null;
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
  const sectionStatus = getString(formData, "section_status") || "draft";
  const layoutPreset = getString(formData, "layout_preset") || "default";
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

  if (!isSectionStatus(sectionStatus)) {
    return {
      message: "Stato sezione non valido.",
      fields,
    };
  }

  if (!isSectionLayoutPreset(layoutPreset)) {
    return {
      message: "Layout sezione non valido.",
      fields,
    };
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase("create");

  if (!supabase || !actor) {
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

  const sectionBody = getOptionalText(formData, "body");
  const sectionTitle = getOptionalText(formData, "title");
  const result = await createSection(supabase, {
    actor,
    bookId,
    sectionType,
    title: sectionTitle,
    subtitle: getOptionalText(formData, "subtitle"),
    body: sectionBody,
    includeInToc: getCheckbox(formData, "include_in_toc"),
    sectionStatus,
    pageBreakBefore: getCheckbox(formData, "page_break_before"),
    layoutPreset,
    editorNotes: getOptionalText(formData, "editor_notes"),
  });

  if (result.data === null) {
    return {
      message: result.error,
      fields,
    };
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    return {
      message: ownershipError,
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
  const sectionStatus = getString(formData, "section_status");
  const layoutPreset = getString(formData, "layout_preset");
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

  if (!isSectionStatus(sectionStatus)) {
    return {
      message: "Stato sezione non valido.",
      fields,
    };
  }

  if (!isSectionLayoutPreset(layoutPreset)) {
    return {
      message: "Layout sezione non valido.",
      fields,
    };
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase("update");

  if (!supabase || !actor) {
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
    actor,
    bookId,
    sectionId,
    sectionType,
    title: getOptionalText(formData, "title"),
    subtitle: getOptionalText(formData, "subtitle"),
    body: getOptionalText(formData, "body"),
    includeInToc: getCheckbox(formData, "include_in_toc"),
    sectionStatus,
    pageBreakBefore: getCheckbox(formData, "page_break_before"),
    layoutPreset,
    editorNotes: getOptionalText(formData, "editor_notes"),
  });

  if (result.data === null) {
    return {
      message: result.error,
      fields,
    };
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    return {
      message: ownershipError,
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

  const { supabase, actor, error } = await getAuthenticatedSupabase("delete");

  if (!supabase || !actor) {
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

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(getContentPath(bookId, { error: ownershipError }));
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

  const { supabase, actor, error } = await getAuthenticatedSupabase("move");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getContentPath(bookId, { error: bookAccessError }));
  }

  const result = await moveSection(
    supabase,
    bookId,
    sectionId,
    direction,
    actor,
  );

  if (result.data === null) {
    redirect(getContentPath(bookId, { error: result.error }));
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(getContentPath(bookId, { error: ownershipError }));
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "reordered" }));
}

export async function createTextBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const title = getOptionalText(formData, "block_title");
  const body = getOptionalText(formData, "block_body");

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId) {
    redirect(getContentPath(bookId, { error: "Sezione non valida." }));
  }

  if (!body) {
    redirect(
      getContentPath(bookId, {
        error: "Inserisci il testo del nuovo blocco.",
      }),
    );
  }

  const { supabase, actor, error } =
    await getAuthenticatedSupabase("create-text-block");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getContentPath(bookId, { error: bookAccessError }));
  }

  const blockResult = await createSectionBlock(supabase, {
    actor,
    bookId,
    sectionId,
    blockType: "text",
    title,
    body,
    layoutPreset: "default",
    printVisibility: "print",
    editorNotes: null,
  });

  if (blockResult.data === null) {
    redirect(getContentPath(bookId, { error: blockResult.error }));
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(getContentPath(bookId, { error: ownershipError }));
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "text_block_created" }));
}

export async function updateTextBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const title = getOptionalText(formData, "block_title");
  const body = getOptionalText(formData, "block_body");

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId) {
    redirect(getContentPath(bookId, { error: "Blocco testo non valido." }));
  }

  if (!title && !body) {
    redirect(
      getContentPath(bookId, {
        error: "Inserisci almeno titolo o testo del blocco.",
      }),
    );
  }

  const { supabase, actor, error } =
    await getAuthenticatedSupabase("update-text-block");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getContentPath(bookId, { error: bookAccessError }));
  }

  const blockResult = await updateTextSectionBlock(supabase, {
    actor,
    blockId,
    body,
    bookId,
    sectionId,
    title,
  });

  if (blockResult.data === null) {
    redirect(getContentPath(bookId, { error: blockResult.error }));
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(getContentPath(bookId, { error: ownershipError }));
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "block_updated" }));
}

export async function moveSectionBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const direction = getString(formData, "direction");

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId || !isBlockMoveDirection(direction)) {
    redirect(getContentPath(bookId, { error: "Riordino blocco non valido." }));
  }

  const { supabase, actor, error } =
    await getAuthenticatedSupabase("move-section-block");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getContentPath(bookId, { error: bookAccessError }));
  }

  const blockResult = await moveSectionBlock(supabase, {
    actor,
    blockId,
    bookId,
    direction,
    sectionId,
  });

  if (blockResult.data === null) {
    redirect(getContentPath(bookId, { error: blockResult.error }));
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(getContentPath(bookId, { error: ownershipError }));
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "block_reordered" }));
}

export async function deleteSectionBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId) {
    redirect(getContentPath(bookId, { error: "Blocco non valido." }));
  }

  const { supabase, actor, error } =
    await getAuthenticatedSupabase("delete-section-block");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getContentPath(bookId, { error: bookAccessError }));
  }

  const blockResult = await deleteSectionBlock(supabase, {
    blockId,
    bookId,
    sectionId,
  });

  if (blockResult.data === null) {
    redirect(getContentPath(bookId, { error: blockResult.error }));
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(getContentPath(bookId, { error: ownershipError }));
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "block_deleted" }));
}

export async function updateSectionBlockVisibilityAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const printVisibility = getString(formData, "print_visibility");

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId || !isPrintVisibility(printVisibility)) {
    redirect(getContentPath(bookId, { error: "Visibilita blocco non valida." }));
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "update-section-block-visibility",
  );

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getContentPath(bookId, { error: bookAccessError }));
  }

  const blockResult = await updateSectionBlockVisibility(supabase, {
    actor,
    blockId,
    bookId,
    printVisibility,
    sectionId,
  });

  if (blockResult.data === null) {
    redirect(getContentPath(bookId, { error: blockResult.error }));
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(getContentPath(bookId, { error: ownershipError }));
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "block_visibility_updated" }));
}

export async function togglePageBreakAfterBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const enabled = getToggleValue(formData, "page_break_after");

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId) {
    redirect(getContentPath(bookId, { error: "Blocco non valido." }));
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "toggle-page-break-after-block",
  );

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getContentPath(bookId, { error: bookAccessError }));
  }

  const blockResult = enabled
    ? await insertPageBreakAfterBlock(supabase, {
        actor,
        blockId,
        bookId,
        sectionId,
      })
    : await removePageBreakAfterBlock(supabase, {
        actor,
        blockId,
        bookId,
        sectionId,
      });

  if (blockResult.data === null) {
    redirect(getContentPath(bookId, { error: blockResult.error }));
  }

  if (blockResult.data.changed) {
    const ownershipError = await touchBookAfterContentChange(
      supabase,
      bookId,
      actor,
    );

    if (ownershipError) {
      redirect(getContentPath(bookId, { error: ownershipError }));
    }
  }

  const status = blockResult.data.changed
    ? enabled
      ? "page_break_inserted"
      : "page_break_removed"
    : "page_break_unchanged";

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status }));
}

export async function createImagePlaceholderBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const title = getOptionalText(formData, "placeholder_title");
  const prompt = getOptionalText(formData, "placeholder_prompt");
  const editorNotes = getOptionalText(formData, "placeholder_notes");

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId) {
    redirect(getContentPath(bookId, { error: "Sezione non valida." }));
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "create-image-placeholder",
  );

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(getContentPath(bookId, { error: bookAccessError }));
  }

  const assetResult = await createAsset(supabase, {
    actor,
    bookId,
    assetType: "image",
    title: title || "Placeholder immagine",
    altText: null,
    prompt,
    status: "placeholder",
  });

  if (assetResult.data === null) {
    redirect(getContentPath(bookId, { error: assetResult.error }));
  }

  const blockResult = await createSectionBlock(supabase, {
    actor,
    bookId,
    sectionId,
    assetId: assetResult.data.assetId,
    blockType: "image_prompt",
    title: title || "Placeholder immagine",
    body: prompt,
    layoutPreset: "image_text",
    printVisibility: "print",
    editorNotes,
  });

  if (blockResult.data === null) {
    await deleteAsset(supabase, bookId, assetResult.data.assetId);
    redirect(getContentPath(bookId, { error: blockResult.error }));
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(getContentPath(bookId, { error: ownershipError }));
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { status: "block_created" }));
}
