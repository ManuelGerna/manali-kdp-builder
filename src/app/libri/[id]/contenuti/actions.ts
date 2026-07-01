"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAsset, deleteAsset, updateAssetUpload } from "@/lib/kdp/assets";
import { touchBookOwnership } from "@/lib/kdp/books";
import {
  IMAGE_PDF_LAYOUT_PRESETS,
  PRINT_VISIBILITIES,
  SECTION_LAYOUT_PRESETS,
  SECTION_STATUSES,
  SECTION_TYPES,
  type ImagePdfLayoutPreset,
  type PrintVisibility,
  type SectionLayoutPreset,
  type SectionStatus,
  type SectionType,
} from "@/lib/kdp/constants";
import {
  createSectionBlock,
  deleteSectionBlock,
  insertPageBreakAfterBlock,
  listSectionBlocks,
  moveSectionBlock,
  removePageBreakAfterBlock,
  updateSectionBlockLayout,
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
  getUpdateOwnershipFields,
  type OwnershipActor,
} from "@/lib/kdp/ownership";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AutosaveActionState = {
  message: string | null;
  savedAt: number | null;
  status: "idle" | "error" | "success";
};

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
const IMAGE_PDF_LAYOUT_PRESET_VALUES: readonly string[] =
  IMAGE_PDF_LAYOUT_PRESETS;
const KDP_ASSETS_BUCKET = "kdp-assets";
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_UPLOAD_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function logSectionAction(
  event: string,
  context: Record<string, boolean | number | string | null | undefined> = {},
) {
  console.error("[kdp-sections:action]", {
    event,
    context,
  });
}

function logImageUploadAction(
  event: string,
  context: Record<string, boolean | number | string | null | undefined> = {},
) {
  console.error("[kdp-image-upload:action]", {
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

function autosaveSuccess(message = "Salvato"): AutosaveActionState {
  return {
    message,
    savedAt: Date.now(),
    status: "success",
  };
}

function autosaveError(message: string | null): AutosaveActionState {
  return {
    message: message || "Salvataggio non riuscito.",
    savedAt: null,
    status: "error",
  };
}

function isImageUploadFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function getImageUploadMeta(file: File) {
  const mimeType = file.type.toLowerCase();

  if (mimeType in IMAGE_UPLOAD_TYPES) {
    return {
      extension: IMAGE_UPLOAD_TYPES[mimeType as keyof typeof IMAGE_UPLOAD_TYPES],
      mimeType,
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return {
      extension: "jpg",
      mimeType: "image/jpeg",
    };
  }

  if (extension === "png" || extension === "webp") {
    return {
      extension,
      mimeType: `image/${extension}`,
    };
  }

  return null;
}

function getSafeImageFileName(fileName: string, extension: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const safeBaseName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return `${safeBaseName || "image"}.${extension}`;
}

function getTitleFromFileName(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || null
  );
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

function isImagePdfLayoutPreset(value: string): value is ImagePdfLayoutPreset {
  return IMAGE_PDF_LAYOUT_PRESET_VALUES.includes(value);
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
  params: {
    anchor?: string | null;
    error?: string;
    focus?: string | null;
    status?: string;
  } = {},
) {
  const searchParams = new URLSearchParams();
  const anchor = getSafeContentAnchor(params.anchor);
  const focus = getSafeContentAnchor(params.focus) ?? anchor;

  if (params.error) {
    searchParams.set("error", params.error);
  }

  if (params.status) {
    searchParams.set("status", params.status);
  }

  if (focus) {
    searchParams.set("focus", focus);
  }

  const query = searchParams.toString();

  return `/libri/${bookId}/contenuti${query ? `?${query}` : ""}${
    anchor ? `#${encodeURIComponent(anchor)}` : ""
  }`;
}

function getSafeContentAnchor(value: string | null | undefined) {
  const anchor = value?.trim().replace(/^#/, "");

  if (!anchor || !/^[A-Za-z0-9_-]+$/.test(anchor)) {
    return null;
  }

  return anchor;
}

function getFormReturnAnchor(formData: FormData, fallback?: string) {
  return getSafeContentAnchor(getString(formData, "return_to")) ?? fallback;
}

function getSectionAnchor(sectionId: string) {
  return `section-${sectionId}`;
}

function getBlockAnchor(blockId: string) {
  return `block-${blockId}`;
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
  redirect(
    getContentPath(bookId, {
      anchor: getSectionAnchor(result.data.sectionId),
      status: "created",
    }),
  );
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
  redirect(
    getContentPath(bookId, {
      anchor: getSectionAnchor(sectionId),
      status: "updated",
    }),
  );
}

export async function deleteSectionAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const returnAnchor = getFormReturnAnchor(formData, "nuova-sezione");

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Sezione non valida.",
      }),
    );
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase("delete");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
  }

  const result = await deleteSection(supabase, bookId, sectionId);

  if (result.data === null) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: result.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { anchor: returnAnchor, status: "deleted" }));
}

export async function moveSectionAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const direction = getString(formData, "direction");
  const returnAnchor = getFormReturnAnchor(
    formData,
    sectionId ? getSectionAnchor(sectionId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !isMoveDirection(direction)) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Riordino non valido.",
      }),
    );
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase("move");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
  }

  const result = await moveSection(
    supabase,
    bookId,
    sectionId,
    direction,
    actor,
  );

  if (result.data === null) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: result.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(
    getContentPath(bookId, { anchor: returnAnchor, status: "reordered" }),
  );
}

export async function createPageBreakBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const returnAnchor = getFormReturnAnchor(
    formData,
    sectionId ? getSectionAnchor(sectionId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Sezione non valida.",
      }),
    );
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "create-page-break-block",
  );

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
  }

  const blocksResult = await listSectionBlocks(supabase, bookId);

  if (blocksResult.data === null) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: blocksResult.error }),
    );
  }

  const sectionBlocks = blocksResult.data
    .filter((block) => block.section_id === sectionId)
    .sort((first, second) => {
      if (first.sort_order !== second.sort_order) {
        return first.sort_order - second.sort_order;
      }

      return first.created_at.localeCompare(second.created_at);
    });
  const lastBlock = sectionBlocks.at(-1);

  if (lastBlock?.block_type === "page_break") {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        status: "page_break_unchanged",
      }),
    );
  }

  const blockResult = await createSectionBlock(supabase, {
    actor,
    bookId,
    sectionId,
    blockType: "page_break",
    title: null,
    body: null,
    layoutPreset: "default",
    printVisibility: "print",
    editorNotes: null,
  });

  if (blockResult.data === null) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: blockResult.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(
    getContentPath(bookId, {
      anchor: returnAnchor,
      status: "page_break_inserted",
    }),
  );
}

export async function createInternalNoteBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const title = getOptionalText(formData, "note_title");
  const body = getOptionalText(formData, "note_body");
  const returnAnchor = getFormReturnAnchor(
    formData,
    sectionId ? getSectionAnchor(sectionId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Sezione non valida.",
      }),
    );
  }

  if (!title && !body) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Inserisci almeno titolo o testo della nota interna.",
      }),
    );
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "create-internal-note-block",
  );

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
  }

  const blockResult = await createSectionBlock(supabase, {
    actor,
    bookId,
    sectionId,
    blockType: "internal_note",
    title: title || "Nota interna",
    body,
    layoutPreset: "default",
    printVisibility: "internal_only",
    editorNotes: null,
  });

  if (blockResult.data === null) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: blockResult.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(
    getContentPath(bookId, {
      anchor: getBlockAnchor(blockResult.data.blockId),
      status: "internal_note_created",
    }),
  );
}

export async function createTextBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const title = getOptionalText(formData, "block_title");
  const body = getOptionalText(formData, "block_body");
  const returnAnchor = getFormReturnAnchor(
    formData,
    sectionId ? getSectionAnchor(sectionId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Sezione non valida.",
      }),
    );
  }

  if (!body) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Inserisci il testo del nuovo blocco.",
      }),
    );
  }

  const { supabase, actor, error } =
    await getAuthenticatedSupabase("create-text-block");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
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
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: blockResult.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(
    getContentPath(bookId, {
      anchor: getBlockAnchor(blockResult.data.blockId),
      status: "text_block_created",
    }),
  );
}

export async function updateTextBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const title = getOptionalText(formData, "block_title");
  const body = getOptionalText(formData, "block_body");
  const returnAnchor = getFormReturnAnchor(
    formData,
    blockId ? getBlockAnchor(blockId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Blocco testo non valido.",
      }),
    );
  }

  if (!title && !body) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Inserisci almeno titolo o testo del blocco.",
      }),
    );
  }

  const { supabase, actor, error } =
    await getAuthenticatedSupabase("update-text-block");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
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
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: blockResult.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(
    getContentPath(bookId, { anchor: returnAnchor, status: "block_updated" }),
  );
}

export async function moveSectionBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const direction = getString(formData, "direction");
  const returnAnchor = getFormReturnAnchor(
    formData,
    blockId ? getBlockAnchor(blockId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId || !isBlockMoveDirection(direction)) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Riordino blocco non valido.",
      }),
    );
  }

  const { supabase, actor, error } =
    await getAuthenticatedSupabase("move-section-block");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
  }

  const blockResult = await moveSectionBlock(supabase, {
    actor,
    blockId,
    bookId,
    direction,
    sectionId,
  });

  if (blockResult.data === null) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: blockResult.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(
    getContentPath(bookId, { anchor: returnAnchor, status: "block_reordered" }),
  );
}

export async function deleteSectionBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const returnAnchor = getFormReturnAnchor(
    formData,
    sectionId ? getSectionAnchor(sectionId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Blocco non valido.",
      }),
    );
  }

  const { supabase, actor, error } =
    await getAuthenticatedSupabase("delete-section-block");

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
  }

  const pageBreakResult = await removePageBreakAfterBlock(supabase, {
    actor,
    blockId,
    bookId,
    sectionId,
  });

  if (pageBreakResult.data === null) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: pageBreakResult.error,
      }),
    );
  }

  const blockResult = await deleteSectionBlock(supabase, {
    blockId,
    bookId,
    sectionId,
  });

  if (blockResult.data === null) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: blockResult.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(
    getContentPath(bookId, { anchor: returnAnchor, status: "block_deleted" }),
  );
}

export async function updateSectionBlockVisibilityAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const printVisibility = getString(formData, "print_visibility");
  const returnAnchor = getFormReturnAnchor(
    formData,
    blockId ? getBlockAnchor(blockId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId || !isPrintVisibility(printVisibility)) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Visibilita blocco non valida.",
      }),
    );
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "update-section-block-visibility",
  );

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
  }

  const blockResult = await updateSectionBlockVisibility(supabase, {
    actor,
    blockId,
    bookId,
    printVisibility,
    sectionId,
  });

  if (blockResult.data === null) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: blockResult.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(
    getContentPath(bookId, {
      anchor: returnAnchor,
      status: "block_visibility_updated",
    }),
  );
}

export async function autosaveSectionBlockVisibilityAction(
  _previousState: AutosaveActionState,
  formData: FormData,
): Promise<AutosaveActionState> {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const printVisibility = getString(formData, "print_visibility");

  if (!bookId || !sectionId || !blockId || !isPrintVisibility(printVisibility)) {
    return autosaveError("Visibilita blocco non valida.");
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "autosave-section-block-visibility",
  );

  if (!supabase || !actor) {
    return autosaveError(error);
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    return autosaveError(bookAccessError);
  }

  const blockResult = await updateSectionBlockVisibility(supabase, {
    actor,
    blockId,
    bookId,
    printVisibility,
    sectionId,
  });

  if (blockResult.data === null) {
    return autosaveError(blockResult.error);
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    return autosaveError(ownershipError);
  }

  revalidateBookContent(bookId);

  return autosaveSuccess();
}

export async function autosaveImageBlockLayoutAction(
  _previousState: AutosaveActionState,
  formData: FormData,
): Promise<AutosaveActionState> {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const layoutPreset = getString(formData, "layout_preset");

  if (
    !bookId ||
    !sectionId ||
    !blockId ||
    !isImagePdfLayoutPreset(layoutPreset)
  ) {
    return autosaveError("Layout immagine non valido.");
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "autosave-image-block-layout",
  );

  if (!supabase || !actor) {
    return autosaveError(error);
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    return autosaveError(bookAccessError);
  }

  const blockResult = await updateSectionBlockLayout(supabase, {
    actor,
    blockId,
    bookId,
    layoutPreset,
    sectionId,
  });

  if (blockResult.data === null) {
    return autosaveError(blockResult.error);
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    return autosaveError(ownershipError);
  }

  revalidateBookContent(bookId);

  return autosaveSuccess();
}

export async function togglePageBreakAfterBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const enabled = getToggleValue(formData, "page_break_after");
  const returnAnchor = getFormReturnAnchor(
    formData,
    blockId ? getBlockAnchor(blockId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Blocco non valido.",
      }),
    );
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "toggle-page-break-after-block",
  );

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
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
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: blockResult.error }),
    );
  }

  if (blockResult.data.changed) {
    const ownershipError = await touchBookAfterContentChange(
      supabase,
      bookId,
      actor,
    );

    if (ownershipError) {
      redirect(
        getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
      );
    }
  }

  const status = blockResult.data.changed
    ? enabled
      ? "page_break_inserted"
      : "page_break_removed"
    : "page_break_unchanged";

  revalidateBookContent(bookId);
  redirect(getContentPath(bookId, { anchor: returnAnchor, status }));
}

export async function autosavePageBreakAfterBlockAction(
  _previousState: AutosaveActionState,
  formData: FormData,
): Promise<AutosaveActionState> {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const enabled = getToggleValue(formData, "page_break_after");

  if (!bookId || !sectionId || !blockId) {
    return autosaveError("Blocco non valido.");
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "autosave-page-break-after-block",
  );

  if (!supabase || !actor) {
    return autosaveError(error);
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    return autosaveError(bookAccessError);
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
    return autosaveError(blockResult.error);
  }

  if (blockResult.data.changed) {
    const ownershipError = await touchBookAfterContentChange(
      supabase,
      bookId,
      actor,
    );

    if (ownershipError) {
      return autosaveError(ownershipError);
    }
  }

  revalidateBookContent(bookId);

  return autosaveSuccess();
}

export async function createImagePlaceholderBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const title = getOptionalText(formData, "placeholder_title");
  const prompt = getOptionalText(formData, "placeholder_prompt");
  const editorNotes = getOptionalText(formData, "placeholder_notes");
  const returnAnchor = getFormReturnAnchor(
    formData,
    sectionId ? getSectionAnchor(sectionId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Sezione non valida.",
      }),
    );
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "create-image-placeholder",
  );

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
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
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: assetResult.error }),
    );
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
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: blockResult.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(
    getContentPath(bookId, {
      anchor: getBlockAnchor(blockResult.data.blockId),
      status: "block_created",
    }),
  );
}

export async function uploadImageForBlockAction(formData: FormData) {
  const bookId = getString(formData, "book_id");
  const sectionId = getString(formData, "section_id");
  const blockId = getString(formData, "block_id");
  const requestedTitle = getOptionalText(formData, "asset_title");
  const requestedAltText = getOptionalText(formData, "asset_alt_text");
  const file = formData.get("image_file");
  const returnAnchor = getFormReturnAnchor(
    formData,
    blockId ? getBlockAnchor(blockId) : undefined,
  );

  if (!bookId) {
    redirect("/libri");
  }

  if (!sectionId || !blockId) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Blocco immagine non valido.",
      }),
    );
  }

  if (!isImageUploadFile(file)) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Seleziona un file immagine valido da caricare.",
      }),
    );
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Immagine troppo grande. Usa un file entro 10 MB.",
      }),
    );
  }

  const uploadMeta = getImageUploadMeta(file);

  if (!uploadMeta) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Formato immagine non supportato. Usa PNG, JPG o WEBP.",
      }),
    );
  }

  const { supabase, actor, error } = await getAuthenticatedSupabase(
    "upload-image-for-block",
  );

  if (!supabase || !actor) {
    redirect(getContentPath(bookId, { anchor: returnAnchor, error }));
  }

  const bookAccessError = await getBookAccessError(supabase, bookId);

  if (bookAccessError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: bookAccessError }),
    );
  }

  const { data: block, error: blockError } = await supabase
    .from("kdp_section_blocks")
    .select("id,asset_id,block_type,title,body")
    .eq("book_id", bookId)
    .eq("section_id", sectionId)
    .eq("id", blockId)
    .maybeSingle();

  if (blockError) {
    logSectionAction("upload_image_block_query_failed", {
      blockIdTail: idTail(blockId),
      bookIdTail: idTail(bookId),
      errorCode: blockError.code,
      errorName: blockError.name,
    });

    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Non riesco a leggere il blocco immagine.",
      }),
    );
  }

  if (!block || block.block_type !== "image_prompt") {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Caricamento disponibile solo sui placeholder immagine.",
      }),
    );
  }

  let assetId = block.asset_id;

  if (!assetId) {
    const assetResult = await createAsset(supabase, {
      actor,
      altText: requestedAltText,
      assetType: "image",
      bookId,
      prompt: block.body,
      status: "placeholder",
      title:
        requestedTitle ||
        block.title ||
        getTitleFromFileName(file.name) ||
        "Immagine caricata",
    });

    if (assetResult.data === null) {
      redirect(
        getContentPath(bookId, {
          anchor: returnAnchor,
          error: assetResult.error,
        }),
      );
    }

    assetId = assetResult.data.assetId;

    const { error: attachError } = await supabase
      .from("kdp_section_blocks")
      .update({
        asset_id: assetId,
        ...getUpdateOwnershipFields(actor),
      })
      .eq("book_id", bookId)
      .eq("section_id", sectionId)
      .eq("id", blockId);

    if (attachError) {
      logSectionAction("upload_image_attach_asset_failed", {
        assetIdTail: idTail(assetId),
        blockIdTail: idTail(blockId),
        bookIdTail: idTail(bookId),
        errorCode: attachError.code,
        errorName: attachError.name,
      });

      redirect(
        getContentPath(bookId, {
          anchor: returnAnchor,
          error: "Asset creato ma non collegato al blocco immagine.",
        }),
      );
    }
  }

  const { data: asset, error: assetError } = await supabase
    .from("kdp_assets")
    .select("id,title,alt_text")
    .eq("book_id", bookId)
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) {
    logImageUploadAction("asset_query_failed", {
      assetIdTail: idTail(assetId),
      bookIdTail: idTail(bookId),
      errorCode: assetError.code,
      errorName: assetError.name,
    });

    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Non riesco a leggere l'asset immagine.",
      }),
    );
  }

  if (!asset) {
    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error: "Asset immagine non trovato o non accessibile.",
      }),
    );
  }

  const safeFileName = getSafeImageFileName(file.name, uploadMeta.extension);
  const storagePath = `${actor.userId}/${bookId}/${assetId}/${Date.now()}-${safeFileName}`;
  const uploadResult = await supabase.storage
    .from(KDP_ASSETS_BUCKET)
    .upload(storagePath, file, {
      contentType: uploadMeta.mimeType,
      upsert: false,
    })
    .catch((error: unknown) => {
      logImageUploadAction("storage_upload_threw", {
        assetIdTail: idTail(assetId),
        blockIdTail: idTail(blockId),
        bookIdTail: idTail(bookId),
        errorName: getErrorName(error),
      });

      return {
        data: null,
        error: {
          message: "storage_upload_threw",
          name: getErrorName(error),
        },
      };
    });

  if (uploadResult.error) {
    logImageUploadAction("storage_upload_failed", {
      assetIdTail: idTail(assetId),
      blockIdTail: idTail(blockId),
      bookIdTail: idTail(bookId),
      errorName: uploadResult.error.name,
    });

    redirect(
      getContentPath(bookId, {
        anchor: returnAnchor,
        error:
          "Upload immagine non riuscito. Verifica bucket e policy Supabase Storage.",
      }),
    );
  }

  const title =
    requestedTitle ||
    asset.title ||
    block.title ||
    getTitleFromFileName(file.name) ||
    "Immagine caricata";
  const altText = requestedAltText || asset.alt_text || title;
  const updateResult = await updateAssetUpload(supabase, {
    actor,
    altText,
    assetId,
    bookId,
    filePath: storagePath,
    title,
  });

  if (updateResult.data === null) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: updateResult.error }),
    );
  }

  const ownershipError = await touchBookAfterContentChange(
    supabase,
    bookId,
    actor,
  );

  if (ownershipError) {
    redirect(
      getContentPath(bookId, { anchor: returnAnchor, error: ownershipError }),
    );
  }

  revalidateBookContent(bookId);
  redirect(
    getContentPath(bookId, { anchor: returnAnchor, status: "image_uploaded" }),
  );
}
