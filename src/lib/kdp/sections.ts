import type { PostgrestError } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import type { RepositoryResult } from "@/lib/kdp/books";
import type {
  SectionLayoutPreset,
  SectionStatus,
  SectionType,
} from "@/lib/kdp/constants";
import {
  getCreateOwnershipFields,
  getUpdateOwnershipFields,
  type OwnershipActor,
} from "@/lib/kdp/ownership";
import type { Tables } from "@/types/database";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type KdpSection = Tables<"kdp_sections">;

export type SectionInput = {
  actor: OwnershipActor;
  bookId: string;
  sectionType: SectionType;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  includeInToc: boolean;
  sectionStatus: SectionStatus;
  pageBreakBefore: boolean;
  layoutPreset: SectionLayoutPreset;
  editorNotes: string | null;
};

export type UpdateSectionInput = SectionInput & {
  sectionId: string;
};

export type MoveSectionDirection = "up" | "down";

type LogContext = Record<string, boolean | number | string | null | undefined>;

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

function logSectionError(
  operation: string,
  error: PostgrestError | null,
  context: LogContext = {},
) {
  console.error("[kdp-sections]", {
    operation,
    code: error?.code ?? "unknown",
    message: redactLogText(error?.message),
    details: redactLogText(error?.details),
    hint: redactLogText(error?.hint),
    context,
  });
}

function getSectionPersistenceMessage(
  error: PostgrestError | null,
  fallback: string,
) {
  if (!error) {
    return fallback;
  }

  if (error.code === "42501") {
    return "Il database non consente questa operazione sulle sezioni. Verifica grant e policy Supabase.";
  }

  if (error.code === "23503") {
    return "Non riesco a collegare la sezione al libretto selezionato.";
  }

  if (error.code === "23514") {
    return "Uno dei valori editoriali della sezione non e' accettato dal database. Verifica tipo, stato e layout.";
  }

  return fallback;
}

export async function listSections(
  supabase: KdpSupabaseClient,
  bookId: string,
): Promise<RepositoryResult<KdpSection[]>> {
  const { data, error } = await supabase
    .from("kdp_sections")
    .select("*")
    .eq("book_id", bookId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    logSectionError("list_sections", error, {
      bookIdTail: idTail(bookId),
    });

    return {
      data: null,
      error: "Non riesco a caricare le sezioni del libretto.",
    };
  }

  return {
    data: data ?? [],
    error: null,
  };
}

export async function createSection(
  supabase: KdpSupabaseClient,
  input: SectionInput,
): Promise<RepositoryResult<{ sectionId: string }>> {
  const { data: lastSection, error: lastSectionError } = await supabase
    .from("kdp_sections")
    .select("sort_order")
    .eq("book_id", input.bookId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSectionError) {
    logSectionError("read_last_sort_order", lastSectionError, {
      bookIdTail: idTail(input.bookId),
    });

    return {
      data: null,
      error: "Non riesco a calcolare la posizione della nuova sezione.",
    };
  }

  const nextSortOrder = (lastSection?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("kdp_sections")
    .insert({
      book_id: input.bookId,
      section_type: input.sectionType,
      title: input.title,
      subtitle: input.subtitle,
      body: input.body,
      include_in_toc: input.includeInToc,
      section_status: input.sectionStatus,
      page_break_before: input.pageBreakBefore,
      layout_preset: input.layoutPreset,
      editor_notes: input.editorNotes,
      sort_order: nextSortOrder,
      ...getCreateOwnershipFields(input.actor),
    })
    .select("id")
    .single();

  if (error) {
    logSectionError("create_section", error, {
      bookIdTail: idTail(input.bookId),
      sectionType: input.sectionType,
    });

    return {
      data: null,
      error: getSectionPersistenceMessage(
        error,
        "Non riesco a creare la sezione. Controlla i dati e riprova.",
      ),
    };
  }

  return {
    data: {
      sectionId: data.id,
    },
    error: null,
  };
}

export async function updateSection(
  supabase: KdpSupabaseClient,
  input: UpdateSectionInput,
): Promise<RepositoryResult<{ sectionId: string }>> {
  const { data, error } = await supabase
    .from("kdp_sections")
    .update({
      section_type: input.sectionType,
      title: input.title,
      subtitle: input.subtitle,
      body: input.body,
      include_in_toc: input.includeInToc,
      section_status: input.sectionStatus,
      page_break_before: input.pageBreakBefore,
      layout_preset: input.layoutPreset,
      editor_notes: input.editorNotes,
      ...getUpdateOwnershipFields(input.actor),
    })
    .eq("book_id", input.bookId)
    .eq("id", input.sectionId)
    .select("id")
    .maybeSingle();

  if (error) {
    logSectionError("update_section", error, {
      bookIdTail: idTail(input.bookId),
      sectionIdTail: idTail(input.sectionId),
      sectionType: input.sectionType,
    });

    return {
      data: null,
      error: getSectionPersistenceMessage(
        error,
        "Non riesco ad aggiornare la sezione. Controlla i dati e riprova.",
      ),
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Sezione non trovata o non accessibile.",
    };
  }

  return {
    data: {
      sectionId: data.id,
    },
    error: null,
  };
}

export async function deleteSection(
  supabase: KdpSupabaseClient,
  bookId: string,
  sectionId: string,
): Promise<RepositoryResult<{ sectionId: string }>> {
  const { data, error } = await supabase
    .from("kdp_sections")
    .delete()
    .eq("book_id", bookId)
    .eq("id", sectionId)
    .select("id")
    .maybeSingle();

  if (error) {
    logSectionError("delete_section", error, {
      bookIdTail: idTail(bookId),
      sectionIdTail: idTail(sectionId),
    });

    return {
      data: null,
      error: getSectionPersistenceMessage(
        error,
        "Non riesco a eliminare la sezione. Riprova tra poco.",
      ),
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Sezione non trovata o non accessibile.",
    };
  }

  return {
    data: {
      sectionId: data.id,
    },
    error: null,
  };
}

export async function moveSection(
  supabase: KdpSupabaseClient,
  bookId: string,
  sectionId: string,
  direction: MoveSectionDirection,
  actor: OwnershipActor,
): Promise<RepositoryResult<{ moved: boolean }>> {
  const sectionsResult = await listSections(supabase, bookId);

  if (sectionsResult.data === null) {
    return sectionsResult;
  }

  const sections = sectionsResult.data;
  const currentIndex = sections.findIndex((section) => section.id === sectionId);

  if (currentIndex === -1) {
    return {
      data: null,
      error: "Sezione non trovata o non accessibile.",
    };
  }

  const targetIndex =
    direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= sections.length) {
    return {
      data: {
        moved: false,
      },
      error: null,
    };
  }

  const reordered = [...sections];
  const [currentSection] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, currentSection);

  for (const [index, section] of reordered.entries()) {
    const nextSortOrder = index + 1;

    if (section.sort_order === nextSortOrder) {
      continue;
    }

    const { error } = await supabase
      .from("kdp_sections")
      .update({
        sort_order: nextSortOrder,
        ...getUpdateOwnershipFields(actor),
      })
      .eq("book_id", bookId)
      .eq("id", section.id);

    if (error) {
      logSectionError("move_section_update_sort_order", error, {
        bookIdTail: idTail(bookId),
        sectionIdTail: idTail(section.id),
        nextSortOrder,
      });

      return {
        data: null,
        error: getSectionPersistenceMessage(
          error,
          "Non riesco a riordinare le sezioni. Riprova tra poco.",
        ),
      };
    }
  }

  return {
    data: {
      moved: true,
    },
    error: null,
  };
}
