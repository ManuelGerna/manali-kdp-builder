import type { PostgrestError } from "@supabase/supabase-js";
import type { RepositoryResult } from "@/lib/kdp/books";
import type {
  BlockLayoutPreset,
  BlockType,
  PrintVisibility,
} from "@/lib/kdp/constants";
import {
  getCreateOwnershipFields,
  getUpdateOwnershipFields,
  type OwnershipActor,
} from "@/lib/kdp/ownership";
import type { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type KdpSectionBlock = Tables<"kdp_section_blocks">;

export type SectionBlockInput = {
  actor: OwnershipActor;
  bookId: string;
  sectionId: string;
  assetId?: string | null;
  blockType: BlockType;
  title: string | null;
  body: string | null;
  sortOrder?: number;
  layoutPreset: BlockLayoutPreset;
  printVisibility: PrintVisibility;
  editorNotes: string | null;
};

export type UpdateTextSectionBlockInput = {
  actor: OwnershipActor;
  blockId: string;
  body: string | null;
  bookId: string;
  sectionId: string;
  title: string | null;
};

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

function logBlockError(
  operation: string,
  error: PostgrestError | null,
  context: LogContext = {},
) {
  console.error("[kdp-section-blocks]", {
    operation,
    code: error?.code ?? "unknown",
    message: redactLogText(error?.message),
    details: redactLogText(error?.details),
    hint: redactLogText(error?.hint),
    context,
  });
}

function getBlockPersistenceMessage(
  error: PostgrestError | null,
  fallback: string,
) {
  if (!error) {
    return fallback;
  }

  if (error.code === "42501") {
    return "Il database non consente questa operazione sui blocchi. Verifica grant e policy Supabase.";
  }

  if (error.code === "23503") {
    return "Non riesco a collegare il blocco a libretto, sezione o asset.";
  }

  if (error.code === "23514") {
    return "Tipo, layout o visibilita' blocco non accettati dal database.";
  }

  return fallback;
}

export async function listSectionBlocks(
  supabase: KdpSupabaseClient,
  bookId: string,
): Promise<RepositoryResult<KdpSectionBlock[]>> {
  const { data, error } = await supabase
    .from("kdp_section_blocks")
    .select("*")
    .eq("book_id", bookId)
    .order("section_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    logBlockError("list_section_blocks", error, {
      bookIdTail: idTail(bookId),
    });

    return {
      data: null,
      error: "Non riesco a caricare i blocchi contenuto del libretto.",
    };
  }

  return {
    data: data ?? [],
    error: null,
  };
}

async function getNextBlockSortOrder(
  supabase: KdpSupabaseClient,
  bookId: string,
  sectionId: string,
): Promise<RepositoryResult<number>> {
  const { data, error } = await supabase
    .from("kdp_section_blocks")
    .select("sort_order")
    .eq("book_id", bookId)
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logBlockError("read_last_block_sort_order", error, {
      bookIdTail: idTail(bookId),
      sectionIdTail: idTail(sectionId),
    });

    return {
      data: null,
      error: "Non riesco a calcolare la posizione del nuovo blocco.",
    };
  }

  return {
    data: (data?.sort_order ?? 0) + 1,
    error: null,
  };
}

export async function createSectionBlock(
  supabase: KdpSupabaseClient,
  input: SectionBlockInput,
): Promise<RepositoryResult<{ blockId: string }>> {
  const sortOrderResult =
    input.sortOrder === undefined
      ? await getNextBlockSortOrder(supabase, input.bookId, input.sectionId)
      : ({
          data: input.sortOrder,
          error: null,
        } as const);

  if (sortOrderResult.data === null) {
    return sortOrderResult;
  }

  const { data, error } = await supabase
    .from("kdp_section_blocks")
    .insert({
      book_id: input.bookId,
      section_id: input.sectionId,
      asset_id: input.assetId ?? null,
      block_type: input.blockType,
      title: input.title,
      body: input.body,
      sort_order: sortOrderResult.data,
      layout_preset: input.layoutPreset,
      print_visibility: input.printVisibility,
      editor_notes: input.editorNotes,
      ...getCreateOwnershipFields(input.actor),
    })
    .select("id")
    .single();

  if (error) {
    logBlockError("create_section_block", error, {
      bookIdTail: idTail(input.bookId),
      sectionIdTail: idTail(input.sectionId),
      blockType: input.blockType,
      printVisibility: input.printVisibility,
    });

    return {
      data: null,
      error: getBlockPersistenceMessage(
        error,
        "Non riesco a creare il blocco contenuto. Controlla i dati e riprova.",
      ),
    };
  }

  return {
    data: {
      blockId: data.id,
    },
    error: null,
  };
}

export async function updateTextSectionBlock(
  supabase: KdpSupabaseClient,
  input: UpdateTextSectionBlockInput,
): Promise<RepositoryResult<{ blockId: string }>> {
  const { data, error } = await supabase
    .from("kdp_section_blocks")
    .update({
      title: input.title,
      body: input.body,
      ...getUpdateOwnershipFields(input.actor),
    })
    .eq("book_id", input.bookId)
    .eq("section_id", input.sectionId)
    .eq("id", input.blockId)
    .eq("block_type", "text")
    .select("id")
    .maybeSingle();

  if (error) {
    logBlockError("update_text_section_block", error, {
      blockIdTail: idTail(input.blockId),
      bookIdTail: idTail(input.bookId),
      sectionIdTail: idTail(input.sectionId),
    });

    return {
      data: null,
      error: getBlockPersistenceMessage(
        error,
        "Non riesco ad aggiornare il blocco testo. Controlla i dati e riprova.",
      ),
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Blocco testo non trovato o non accessibile.",
    };
  }

  return {
    data: {
      blockId: data.id,
    },
    error: null,
  };
}
