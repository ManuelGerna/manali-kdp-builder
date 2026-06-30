import { randomUUID } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";
import { DEFAULT_BOOK_SETTINGS } from "@/lib/kdp/constants";
import {
  getCreateOwnershipFields,
  getUpdateOwnershipFields,
  type OwnershipActor,
} from "@/lib/kdp/ownership";
import type { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type KdpBook = Tables<"kdp_books">;
export type KdpBookSettings = Tables<"kdp_book_settings">;
export type KdpSection = Tables<"kdp_sections">;

export type CreateBookInput = {
  title: string;
  subtitle: string | null;
  authorName: string;
  language: string;
  aiUsageType: string;
  actor: OwnershipActor;
};

export type UpdateBookSettingsInput = {
  bookId: string;
  actor: OwnershipActor;
  trimSize: string;
  bleed: boolean;
  interiorType: string;
  paperType: string;
  bodyFont: string;
  headingFont: string;
  bodyFontSize: number;
  lineHeight: number;
  marginTop: number;
  marginBottom: number;
  marginInner: number;
  marginOuter: number;
};

export type RepositoryResult<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: string;
    };

export type BookDetailResult =
  | {
      data: {
        book: KdpBook;
        settings: KdpBookSettings | null;
        sections: KdpSection[];
      };
      error: null;
      notFound: false;
    }
  | {
      data: null;
      error: string;
      notFound: boolean;
    };

type LogContext = Record<string, boolean | number | string | null | undefined>;

const DEFAULT_SETTINGS_INSERT = {
  trim_size: DEFAULT_BOOK_SETTINGS.trimSize,
  bleed: DEFAULT_BOOK_SETTINGS.bleed,
  interior_type: DEFAULT_BOOK_SETTINGS.interiorType,
  paper_type: DEFAULT_BOOK_SETTINGS.paperType,
  body_font: DEFAULT_BOOK_SETTINGS.bodyFont,
  heading_font: DEFAULT_BOOK_SETTINGS.headingFont,
  body_font_size: DEFAULT_BOOK_SETTINGS.bodyFontSize,
  line_height: DEFAULT_BOOK_SETTINGS.lineHeight,
  margin_top: DEFAULT_BOOK_SETTINGS.marginTop,
  margin_bottom: DEFAULT_BOOK_SETTINGS.marginBottom,
  margin_inner: DEFAULT_BOOK_SETTINGS.marginInner,
  margin_outer: DEFAULT_BOOK_SETTINGS.marginOuter,
  page_numbering: DEFAULT_BOOK_SETTINGS.pageNumbering,
  header_enabled: DEFAULT_BOOK_SETTINGS.headerEnabled,
  footer_enabled: DEFAULT_BOOK_SETTINGS.footerEnabled,
} satisfies Omit<TablesInsert<"kdp_book_settings">, "book_id">;

function redactLogText(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[redacted-email]",
    )
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[redacted-uuid]",
    )
    .slice(0, 500);
}

function idTail(value: string) {
  return value.slice(-8);
}

function logPersistenceError(
  operation: string,
  error: PostgrestError | null,
  context: LogContext = {},
) {
  console.error("[kdp-books:persistence]", {
    operation,
    code: error?.code ?? "unknown",
    message: redactLogText(error?.message),
    details: redactLogText(error?.details),
    hint: redactLogText(error?.hint),
    context,
  });
}

function getPersistenceMessage(
  error: PostgrestError | null,
  fallback: string,
) {
  if (!error) {
    return fallback;
  }

  if (error.code === "42501") {
    return "Il database non consente la creazione del libretto. Verifica la configurazione Supabase.";
  }

  if (error.code === "23514") {
    return "I dati non rispettano i vincoli richiesti. Controlla i campi e riprova.";
  }

  if (error.code === "23503") {
    return "Non riesco a collegare il libretto ai record richiesti.";
  }

  if (error.code === "23505") {
    return "Esiste gia' un record collegato a questo libretto.";
  }

  return fallback;
}

function getSettingsUpdateMessage(
  error: PostgrestError | null,
  fallback: string,
) {
  if (!error) {
    return fallback;
  }

  if (error.code === "42501") {
    return "Il database non consente l'aggiornamento delle impostazioni KDP. Verifica grant e policy Supabase.";
  }

  if (error.code === "23514") {
    return "Le impostazioni selezionate non rispettano i vincoli KDP configurati nel database.";
  }

  return fallback;
}

export async function listBooks(
  supabase: KdpSupabaseClient,
): Promise<RepositoryResult<KdpBook[]>> {
  const { data, error } = await supabase
    .from("kdp_books")
    .select(
      "id,title,subtitle,author_name,language,book_type,status,ai_usage_type,internal_description,created_by,created_by_user_id,created_by_email,updated_by_user_id,updated_by_email,created_at,updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      data: null,
      error: "Non riesco a caricare i libretti. Riprova tra poco.",
    };
  }

  return {
    data: data ?? [],
    error: null,
  };
}

export async function getBookDetail(
  supabase: KdpSupabaseClient,
  bookId: string,
): Promise<BookDetailResult> {
  const { data: book, error: bookError } = await supabase
    .from("kdp_books")
    .select("*")
    .eq("id", bookId)
    .maybeSingle();

  if (bookError) {
    return {
      data: null,
      error: "Non riesco a caricare questo libretto.",
      notFound: false,
    };
  }

  if (!book) {
    return {
      data: null,
      error: "Libretto non trovato o non accessibile.",
      notFound: true,
    };
  }

  const { data: settings, error: settingsError } = await supabase
    .from("kdp_book_settings")
    .select("*")
    .eq("book_id", book.id)
    .maybeSingle();

  if (settingsError) {
    return {
      data: null,
      error: "Non riesco a caricare le impostazioni KDP del libretto.",
      notFound: false,
    };
  }

  const { data: sections, error: sectionsError } = await supabase
    .from("kdp_sections")
    .select("*")
    .eq("book_id", book.id)
    .order("sort_order", { ascending: true });

  if (sectionsError) {
    return {
      data: null,
      error: "Non riesco a caricare le sezioni del libretto.",
      notFound: false,
    };
  }

  return {
    data: {
      book,
      settings,
      sections: sections ?? [],
    },
    error: null,
    notFound: false,
  };
}

export async function createBookWithDefaultSettings(
  supabase: KdpSupabaseClient,
  input: CreateBookInput,
): Promise<RepositoryResult<{ bookId: string }>> {
  const bookId = randomUUID();
  const logContext = {
    bookIdTail: idTail(bookId),
    userIdTail: idTail(input.actor.userId),
  };

  const { error: bookError } = await supabase
    .from("kdp_books")
    .insert({
      id: bookId,
      title: input.title,
      subtitle: input.subtitle,
      author_name: input.authorName,
      language: input.language,
      status: "draft",
      ai_usage_type: input.aiUsageType,
      created_by: input.actor.userId,
      ...getCreateOwnershipFields(input.actor),
    });

  if (bookError) {
    logPersistenceError("insert_kdp_books", bookError, logContext);

    return {
      data: null,
      error: getPersistenceMessage(
        bookError,
        "Non riesco a creare il libretto. Controlla i dati e riprova.",
      ),
    };
  }

  const { error: settingsError } = await supabase
    .from("kdp_book_settings")
    .insert({
      book_id: bookId,
      ...DEFAULT_SETTINGS_INSERT,
    });

  if (!settingsError) {
    return {
      data: {
        bookId,
      },
      error: null,
    };
  }

  logPersistenceError("insert_kdp_book_settings", settingsError, logContext);

  const { error: rollbackError } = await supabase
    .from("kdp_books")
    .delete()
    .eq("id", bookId);

  if (rollbackError) {
    logPersistenceError("rollback_delete_kdp_books", rollbackError, logContext);

    return {
      data: null,
      error:
        "Il libretto e' stato creato, ma le impostazioni KDP non sono state salvate. Verifica il record prima di riprovare.",
    };
  }

  return {
    data: null,
    error: getPersistenceMessage(
      settingsError,
      "Creazione interrotta: non sono riuscito a salvare le impostazioni KDP. Il libretto non e' stato mantenuto.",
    ),
  };
}

export async function updateBookSettings(
  supabase: KdpSupabaseClient,
  input: UpdateBookSettingsInput,
): Promise<RepositoryResult<{ settingsId: string }>> {
  const settingsUpdate = {
    trim_size: input.trimSize,
    bleed: input.bleed,
    interior_type: input.interiorType,
    paper_type: input.paperType,
    body_font: input.bodyFont,
    heading_font: input.headingFont,
    body_font_size: input.bodyFontSize,
    line_height: input.lineHeight,
    margin_top: input.marginTop,
    margin_bottom: input.marginBottom,
    margin_inner: input.marginInner,
    margin_outer: input.marginOuter,
  } satisfies TablesUpdate<"kdp_book_settings">;

  const { data, error } = await supabase
    .from("kdp_book_settings")
    .update(settingsUpdate)
    .eq("book_id", input.bookId)
    .select("id")
    .maybeSingle();

  if (error) {
    logPersistenceError("update_kdp_book_settings", error, {
      bookIdTail: idTail(input.bookId),
    });

    return {
      data: null,
      error: getSettingsUpdateMessage(
        error,
        "Non riesco a salvare le impostazioni KDP. Controlla i valori e riprova.",
      ),
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Impostazioni KDP non trovate per questo libretto.",
    };
  }

  const ownershipResult = await touchBookOwnership(supabase, {
    actor: input.actor,
    bookId: input.bookId,
  });

  if (ownershipResult.data === null) {
    return ownershipResult;
  }

  return {
    data: {
      settingsId: data.id,
    },
    error: null,
  };
}

export async function touchBookOwnership(
  supabase: KdpSupabaseClient,
  input: {
    actor: OwnershipActor;
    bookId: string;
  },
): Promise<RepositoryResult<{ bookId: string }>> {
  const bookUpdate = {
    ...getUpdateOwnershipFields(input.actor),
  } satisfies TablesUpdate<"kdp_books">;
  const { error } = await supabase
    .from("kdp_books")
    .update(bookUpdate)
    .eq("id", input.bookId);

  if (error) {
    logPersistenceError("update_kdp_books_owner", error, {
      bookIdTail: idTail(input.bookId),
    });

    return {
      data: null,
      error: getPersistenceMessage(
        error,
        "Non riesco ad aggiornare il tracciamento interno del libretto.",
      ),
    };
  }

  return {
    data: {
      bookId: input.bookId,
    },
    error: null,
  };
}
