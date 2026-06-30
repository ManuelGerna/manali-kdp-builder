"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BODY_FONTS,
  BODY_FONT_SIZES,
  HEADING_FONTS,
  INTERIOR_TYPES,
  LINE_HEIGHTS,
  PAPER_TYPES,
  TRIM_SIZES,
  type BodyFont,
  type BodyFontSize,
  type HeadingFont,
  type InteriorType,
  type LineHeight,
  type PaperType,
  type TrimSize,
} from "@/lib/kdp/constants";
import { updateBookSettings } from "@/lib/kdp/books";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type SettingsFormFields = {
  trim_size?: string;
  bleed?: string;
  interior_type?: string;
  paper_type?: string;
  body_font?: string;
  heading_font?: string;
  body_font_size?: string;
  line_height?: string;
  margin_top?: string;
  margin_bottom?: string;
  margin_inner?: string;
  margin_outer?: string;
};

export type SettingsFormState = {
  message: string | null;
  fields?: SettingsFormFields;
};

const MIN_MARGIN = 0.5;
const MAX_MARGIN = 2;
const TRIM_SIZE_VALUES: readonly string[] = TRIM_SIZES;
const INTERIOR_TYPE_VALUES: readonly string[] = INTERIOR_TYPES;
const PAPER_TYPE_VALUES: readonly string[] = PAPER_TYPES;
const BODY_FONT_VALUES: readonly string[] = BODY_FONTS;
const HEADING_FONT_VALUES: readonly string[] = HEADING_FONTS;
const BODY_FONT_SIZE_VALUES: readonly number[] = BODY_FONT_SIZES;
const LINE_HEIGHT_VALUES: readonly number[] = LINE_HEIGHTS;

function logSettingsAction(
  event: string,
  context: Record<string, boolean | number | string | null | undefined> = {},
) {
  console.error("[kdp-settings:action]", {
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

function getFields(formData: FormData): SettingsFormFields {
  return {
    trim_size: getString(formData, "trim_size"),
    bleed: getString(formData, "bleed"),
    interior_type: getString(formData, "interior_type"),
    paper_type: getString(formData, "paper_type"),
    body_font: getString(formData, "body_font"),
    heading_font: getString(formData, "heading_font"),
    body_font_size: getString(formData, "body_font_size"),
    line_height: getString(formData, "line_height"),
    margin_top: getString(formData, "margin_top"),
    margin_bottom: getString(formData, "margin_bottom"),
    margin_inner: getString(formData, "margin_inner"),
    margin_outer: getString(formData, "margin_outer"),
  };
}

function includesString<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return values.includes(value as T);
}

function includesNumber<T extends number>(
  values: readonly T[],
  value: number,
): value is T {
  return values.includes(value as T);
}

function parseClosedNumber<T extends number>(
  value: string,
  values: readonly T[],
) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || !includesNumber(values, numberValue)) {
    return null;
  }

  return numberValue;
}

function parseMargin(value: string) {
  const numberValue = Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue < MIN_MARGIN ||
    numberValue > MAX_MARGIN
  ) {
    return null;
  }

  return Number(numberValue.toFixed(2));
}

function getSettingsPath(
  bookId: string,
  params: { status?: string } = {},
) {
  const searchParams = new URLSearchParams();

  if (params.status) {
    searchParams.set("status", params.status);
  }

  const query = searchParams.toString();

  return `/libri/${bookId}/impostazioni${query ? `?${query}` : ""}`;
}

function revalidateBookSettings(bookId: string) {
  revalidatePath(`/libri/${bookId}`);
  revalidatePath(`/libri/${bookId}/impostazioni`);
  revalidatePath(`/libri/${bookId}/kdp`);
}

async function getAuthenticatedSupabase(actionName: string) {
  if (!hasSupabaseServerConfig()) {
    logSettingsAction("missing_supabase_config", {
      actionName,
    });

    return {
      supabase: null,
      userId: null,
      error:
        "Supabase non configurato. Completa le variabili del progetto KDP Builder.",
    };
  }

  const supabase = await createClient().catch((error: unknown) => {
    logSettingsAction("create_supabase_client_failed", {
      actionName,
      errorName: getErrorName(error),
    });

    return null;
  });

  if (!supabase) {
    return {
      supabase: null,
      userId: null,
      error: "Supabase non disponibile in questo momento.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logSettingsAction("auth_user_missing", {
      actionName,
      hasUser: Boolean(user),
      authErrorName: userError?.name,
      authErrorStatus: userError?.status,
    });

    redirect("/login");
  }

  return {
    supabase,
    userId: user.id,
    error: null,
  };
}

async function getBookAccessError(
  supabase: KdpSupabaseClient,
  bookId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("kdp_books")
    .select("id")
    .eq("id", bookId)
    .eq("created_by", userId)
    .maybeSingle();

  if (error) {
    logSettingsAction("book_access_query_failed", {
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

export async function updateSettingsAction(
  _previousState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const bookId = getString(formData, "book_id");
  const fields = getFields(formData);
  const bodyFontSize = parseClosedNumber(
    fields.body_font_size ?? "",
    BODY_FONT_SIZE_VALUES,
  );
  const lineHeight = parseClosedNumber(
    fields.line_height ?? "",
    LINE_HEIGHT_VALUES,
  );
  const marginTop = parseMargin(fields.margin_top ?? "");
  const marginBottom = parseMargin(fields.margin_bottom ?? "");
  const marginInner = parseMargin(fields.margin_inner ?? "");
  const marginOuter = parseMargin(fields.margin_outer ?? "");

  if (!bookId) {
    return {
      message: "Libretto non valido.",
      fields,
    };
  }

  if (!includesString(TRIM_SIZE_VALUES, fields.trim_size ?? "")) {
    return {
      message: "Trim size non valido.",
      fields,
    };
  }

  if (fields.bleed !== "false" && fields.bleed !== "true") {
    return {
      message: "Bleed non valido.",
      fields,
    };
  }

  if (!includesString(INTERIOR_TYPE_VALUES, fields.interior_type ?? "")) {
    return {
      message: "Tipo interno non valido.",
      fields,
    };
  }

  if (!includesString(PAPER_TYPE_VALUES, fields.paper_type ?? "")) {
    return {
      message: "Tipo carta non valido.",
      fields,
    };
  }

  if (!includesString(BODY_FONT_VALUES, fields.body_font ?? "")) {
    return {
      message: "Body font non valido.",
      fields,
    };
  }

  if (!includesString(HEADING_FONT_VALUES, fields.heading_font ?? "")) {
    return {
      message: "Heading font non valido.",
      fields,
    };
  }

  if (bodyFontSize === null) {
    return {
      message: "Dimensione body font non valida.",
      fields,
    };
  }

  if (lineHeight === null) {
    return {
      message: "Line height non valida.",
      fields,
    };
  }

  if (
    marginTop === null ||
    marginBottom === null ||
    marginInner === null ||
    marginOuter === null
  ) {
    return {
      message: "I margini devono essere numeri tra 0.5 e 2 pollici.",
      fields,
    };
  }

  const { supabase, userId, error } =
    await getAuthenticatedSupabase("update-settings");

  if (!supabase || !userId) {
    return {
      message: error,
      fields,
    };
  }

  const bookAccessError = await getBookAccessError(supabase, bookId, userId);

  if (bookAccessError) {
    return {
      message: bookAccessError,
      fields,
    };
  }

  const result = await updateBookSettings(supabase, {
    bookId,
    trimSize: fields.trim_size as TrimSize,
    bleed: fields.bleed === "true",
    interiorType: fields.interior_type as InteriorType,
    paperType: fields.paper_type as PaperType,
    bodyFont: fields.body_font as BodyFont,
    headingFont: fields.heading_font as HeadingFont,
    bodyFontSize: bodyFontSize as BodyFontSize,
    lineHeight: lineHeight as LineHeight,
    marginTop,
    marginBottom,
    marginInner,
    marginOuter,
  });

  if (result.data === null) {
    return {
      message: result.error,
      fields,
    };
  }

  revalidateBookSettings(bookId);
  redirect(getSettingsPath(bookId, { status: "saved" }));
}
