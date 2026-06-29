import { DEFAULT_BOOK_SETTINGS } from "@/lib/kdp/constants";
import type { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/types/database";

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
  userId: string;
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

export async function listBooks(
  supabase: KdpSupabaseClient,
): Promise<RepositoryResult<KdpBook[]>> {
  const { data, error } = await supabase
    .from("kdp_books")
    .select(
      "id,title,subtitle,author_name,language,book_type,status,ai_usage_type,internal_description,created_by,created_at,updated_at",
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
  const { data: book, error: bookError } = await supabase
    .from("kdp_books")
    .insert({
      title: input.title,
      subtitle: input.subtitle,
      author_name: input.authorName,
      language: input.language,
      status: "draft",
      ai_usage_type: input.aiUsageType,
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (bookError || !book) {
    return {
      data: null,
      error: "Non riesco a creare il libretto. Controlla i dati e riprova.",
    };
  }

  const { error: settingsError } = await supabase
    .from("kdp_book_settings")
    .insert({
      book_id: book.id,
      ...DEFAULT_SETTINGS_INSERT,
    });

  if (!settingsError) {
    return {
      data: {
        bookId: book.id,
      },
      error: null,
    };
  }

  const { error: rollbackError } = await supabase
    .from("kdp_books")
    .delete()
    .eq("id", book.id);

  if (rollbackError) {
    return {
      data: null,
      error:
        "Il libretto e' stato creato, ma le impostazioni KDP non sono state salvate. Apri la lista e verifica il record prima di riprovare.",
    };
  }

  return {
    data: null,
    error:
      "Creazione interrotta: non sono riuscito a salvare le impostazioni KDP. Il libretto non e' stato mantenuto.",
  };
}
