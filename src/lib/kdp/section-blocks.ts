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
import type { Tables, TablesUpdate } from "@/types/database";

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

export type UpdateSectionBlockInput = {
  actor: OwnershipActor;
  blockId: string;
  blockType?: BlockType;
  body?: string | null;
  bookId: string;
  editorNotes?: string | null;
  printVisibility?: PrintVisibility;
  sectionId: string;
  title?: string | null;
};

export type MoveSectionBlockDirection = "up" | "down";

export type MoveSectionBlockInput = {
  actor: OwnershipActor;
  blockId: string;
  bookId: string;
  direction: MoveSectionBlockDirection;
  sectionId: string;
};

export type SectionBlockIdentityInput = {
  blockId: string;
  bookId: string;
  sectionId: string;
};

export type UpdateSectionBlockVisibilityInput = SectionBlockIdentityInput & {
  actor: OwnershipActor;
  printVisibility: PrintVisibility;
};

export type PageBreakAfterBlockInput = SectionBlockIdentityInput & {
  actor: OwnershipActor;
};

export type PageBreakAfterBlockResult = {
  changed: boolean;
};

type SectionBlockMoveGroup = {
  anchorBlockId: string | null;
  blocks: KdpSectionBlock[];
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

async function listSectionBlocksInSection(
  supabase: KdpSupabaseClient,
  bookId: string,
  sectionId: string,
): Promise<RepositoryResult<KdpSectionBlock[]>> {
  const { data, error } = await supabase
    .from("kdp_section_blocks")
    .select("*")
    .eq("book_id", bookId)
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    logBlockError("list_section_blocks_in_section", error, {
      bookIdTail: idTail(bookId),
      sectionIdTail: idTail(sectionId),
    });

    return {
      data: null,
      error: "Non riesco a caricare i blocchi della sezione.",
    };
  }

  return {
    data: data ?? [],
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

export async function updateSectionBlock(
  supabase: KdpSupabaseClient,
  input: UpdateSectionBlockInput,
): Promise<RepositoryResult<{ blockId: string }>> {
  const updatePayload: TablesUpdate<"kdp_section_blocks"> = {
    ...getUpdateOwnershipFields(input.actor),
  };

  if ("title" in input) {
    updatePayload.title = input.title;
  }

  if ("body" in input) {
    updatePayload.body = input.body;
  }

  if ("editorNotes" in input) {
    updatePayload.editor_notes = input.editorNotes;
  }

  if (input.printVisibility !== undefined) {
    updatePayload.print_visibility = input.printVisibility;
  }

  let updateQuery = supabase
    .from("kdp_section_blocks")
    .update(updatePayload)
    .eq("book_id", input.bookId)
    .eq("section_id", input.sectionId)
    .eq("id", input.blockId);

  if (input.blockType) {
    updateQuery = updateQuery.eq("block_type", input.blockType);
  }

  const { data, error } = await updateQuery
    .select("id")
    .maybeSingle();

  if (error) {
    logBlockError("update_section_block", error, {
      blockIdTail: idTail(input.blockId),
      bookIdTail: idTail(input.bookId),
      sectionIdTail: idTail(input.sectionId),
      blockType: input.blockType,
      printVisibility: input.printVisibility,
    });

    return {
      data: null,
      error: getBlockPersistenceMessage(
        error,
        "Non riesco ad aggiornare il blocco contenuto. Controlla i dati e riprova.",
      ),
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Blocco contenuto non trovato o non accessibile.",
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
  return updateSectionBlock(supabase, {
    actor: input.actor,
    blockId: input.blockId,
    blockType: "text",
    body: input.body,
    bookId: input.bookId,
    sectionId: input.sectionId,
    title: input.title,
  });
}

async function updateSectionBlockSortOrder(
  supabase: KdpSupabaseClient,
  input: SectionBlockIdentityInput & {
    actor: OwnershipActor;
    sortOrder: number;
  },
): Promise<RepositoryResult<{ blockId: string }>> {
  const { data, error } = await supabase
    .from("kdp_section_blocks")
    .update({
      sort_order: input.sortOrder,
      ...getUpdateOwnershipFields(input.actor),
    })
    .eq("book_id", input.bookId)
    .eq("section_id", input.sectionId)
    .eq("id", input.blockId)
    .select("id")
    .maybeSingle();

  if (error) {
    logBlockError("update_section_block_sort_order", error, {
      blockIdTail: idTail(input.blockId),
      bookIdTail: idTail(input.bookId),
      sectionIdTail: idTail(input.sectionId),
      sortOrder: input.sortOrder,
    });

    return {
      data: null,
      error: getBlockPersistenceMessage(
        error,
        "Non riesco a riordinare i blocchi contenuto. Riprova tra poco.",
      ),
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Blocco contenuto non trovato o non accessibile.",
    };
  }

  return {
    data: {
      blockId: data.id,
    },
    error: null,
  };
}

async function normalizeSectionBlockSortOrder(
  supabase: KdpSupabaseClient,
  blocks: KdpSectionBlock[],
  actor: OwnershipActor,
): Promise<RepositoryResult<{ moved: boolean }>> {
  for (const [index, block] of blocks.entries()) {
    const nextSortOrder = index + 1;

    if (block.sort_order === nextSortOrder) {
      continue;
    }

    const updateResult = await updateSectionBlockSortOrder(supabase, {
      actor,
      blockId: block.id,
      bookId: block.book_id,
      sectionId: block.section_id,
      sortOrder: nextSortOrder,
    });

    if (updateResult.data === null) {
      return updateResult;
    }
  }

  return {
    data: {
      moved: true,
    },
    error: null,
  };
}

function groupBlocksWithPageBreakMarkers(
  blocks: KdpSectionBlock[],
): SectionBlockMoveGroup[] {
  const groups: SectionBlockMoveGroup[] = [];

  for (const block of blocks) {
    if (block.block_type === "page_break") {
      const previousGroup = groups.at(-1);

      if (previousGroup?.anchorBlockId) {
        previousGroup.blocks.push(block);
      } else {
        groups.push({
          anchorBlockId: null,
          blocks: [block],
        });
      }

      continue;
    }

    groups.push({
      anchorBlockId: block.id,
      blocks: [block],
    });
  }

  return groups;
}

function getVisibleGroupIndexes(groups: SectionBlockMoveGroup[]) {
  return groups.flatMap((group, index) =>
    group.anchorBlockId ? [index] : [],
  );
}

export async function moveSectionBlock(
  supabase: KdpSupabaseClient,
  input: MoveSectionBlockInput,
): Promise<RepositoryResult<{ moved: boolean }>> {
  const blocksResult = await listSectionBlocksInSection(
    supabase,
    input.bookId,
    input.sectionId,
  );

  if (blocksResult.data === null) {
    return blocksResult;
  }

  const blocks = blocksResult.data;
  const currentIndex = blocks.findIndex((block) => block.id === input.blockId);

  if (currentIndex === -1) {
    return {
      data: null,
      error: "Blocco contenuto non trovato o non accessibile.",
    };
  }

  const currentBlock = blocks[currentIndex];

  if (currentBlock.block_type === "page_break") {
    return {
      data: {
        moved: false,
      },
      error: null,
    };
  }

  const groups = groupBlocksWithPageBreakMarkers(blocks);
  const visibleGroupIndexes = getVisibleGroupIndexes(groups);
  const currentGroupIndex = groups.findIndex(
    (group) => group.anchorBlockId === input.blockId,
  );
  const currentVisibleIndex = visibleGroupIndexes.indexOf(currentGroupIndex);

  if (currentGroupIndex === -1 || currentVisibleIndex === -1) {
    return {
      data: null,
      error: "Blocco contenuto non trovato o non accessibile.",
    };
  }

  const targetVisibleIndex =
    input.direction === "up"
      ? currentVisibleIndex - 1
      : currentVisibleIndex + 1;

  if (
    targetVisibleIndex < 0 ||
    targetVisibleIndex >= visibleGroupIndexes.length
  ) {
    return {
      data: {
        moved: false,
      },
      error: null,
    };
  }

  const targetGroupIndex = visibleGroupIndexes[targetVisibleIndex];
  const reorderedGroups = [...groups];
  const currentGroup = reorderedGroups[currentGroupIndex];

  reorderedGroups.splice(currentGroupIndex, 1);
  const targetGroupIndexAfterRemoval =
    targetGroupIndex > currentGroupIndex
      ? targetGroupIndex - 1
      : targetGroupIndex;
  const insertIndex =
    input.direction === "up"
      ? targetGroupIndexAfterRemoval
      : targetGroupIndexAfterRemoval + 1;

  reorderedGroups.splice(insertIndex, 0, currentGroup);

  return normalizeSectionBlockSortOrder(
    supabase,
    reorderedGroups.flatMap((group) => group.blocks),
    input.actor,
  );
}

export async function deleteSectionBlock(
  supabase: KdpSupabaseClient,
  input: SectionBlockIdentityInput,
): Promise<RepositoryResult<{ blockId: string }>> {
  const { data, error } = await supabase
    .from("kdp_section_blocks")
    .delete()
    .eq("book_id", input.bookId)
    .eq("section_id", input.sectionId)
    .eq("id", input.blockId)
    .select("id")
    .maybeSingle();

  if (error) {
    logBlockError("delete_section_block", error, {
      blockIdTail: idTail(input.blockId),
      bookIdTail: idTail(input.bookId),
      sectionIdTail: idTail(input.sectionId),
    });

    return {
      data: null,
      error: getBlockPersistenceMessage(
        error,
        "Non riesco a eliminare il blocco contenuto. Riprova tra poco.",
      ),
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Blocco contenuto non trovato o non accessibile.",
    };
  }

  return {
    data: {
      blockId: data.id,
    },
    error: null,
  };
}

export async function updateSectionBlockVisibility(
  supabase: KdpSupabaseClient,
  input: UpdateSectionBlockVisibilityInput,
): Promise<RepositoryResult<{ blockId: string }>> {
  return updateSectionBlock(supabase, {
    actor: input.actor,
    blockId: input.blockId,
    bookId: input.bookId,
    printVisibility: input.printVisibility,
    sectionId: input.sectionId,
  });
}

export async function insertPageBreakAfterBlock(
  supabase: KdpSupabaseClient,
  input: PageBreakAfterBlockInput,
): Promise<RepositoryResult<PageBreakAfterBlockResult>> {
  const blocksResult = await listSectionBlocksInSection(
    supabase,
    input.bookId,
    input.sectionId,
  );

  if (blocksResult.data === null) {
    return blocksResult;
  }

  const blocks = blocksResult.data;
  const currentIndex = blocks.findIndex((block) => block.id === input.blockId);

  if (currentIndex === -1) {
    return {
      data: null,
      error: "Blocco contenuto non trovato o non accessibile.",
    };
  }

  if (blocks[currentIndex].block_type === "page_break") {
    return {
      data: {
        changed: false,
      },
      error: null,
    };
  }

  const nextBlock = blocks[currentIndex + 1];

  if (nextBlock?.block_type === "page_break") {
    return {
      data: {
        changed: false,
      },
      error: null,
    };
  }

  const createResult = await createSectionBlock(supabase, {
    actor: input.actor,
    bookId: input.bookId,
    sectionId: input.sectionId,
    blockType: "page_break",
    title: null,
    body: null,
    layoutPreset: "default",
    printVisibility: "print",
    editorNotes: null,
  });

  if (createResult.data === null) {
    return createResult;
  }

  const updatedBlocksResult = await listSectionBlocksInSection(
    supabase,
    input.bookId,
    input.sectionId,
  );

  if (updatedBlocksResult.data === null) {
    return updatedBlocksResult;
  }

  const insertedBlock = updatedBlocksResult.data.find(
    (block) => block.id === createResult.data.blockId,
  );

  if (!insertedBlock) {
    return {
      data: null,
      error: "Interruzione pagina creata ma non ricaricata.",
    };
  }

  const reordered = updatedBlocksResult.data.filter(
    (block) => block.id !== insertedBlock.id,
  );
  const currentUpdatedIndex = reordered.findIndex(
    (block) => block.id === input.blockId,
  );

  if (currentUpdatedIndex === -1) {
    return {
      data: null,
      error: "Blocco contenuto non trovato dopo la creazione del page break.",
    };
  }

  reordered.splice(currentUpdatedIndex + 1, 0, insertedBlock);

  const normalizeResult = await normalizeSectionBlockSortOrder(
    supabase,
    reordered,
    input.actor,
  );

  if (normalizeResult.data === null) {
    return normalizeResult;
  }

  return {
    data: {
      changed: true,
    },
    error: null,
  };
}

export async function removePageBreakAfterBlock(
  supabase: KdpSupabaseClient,
  input: PageBreakAfterBlockInput,
): Promise<RepositoryResult<PageBreakAfterBlockResult>> {
  const blocksResult = await listSectionBlocksInSection(
    supabase,
    input.bookId,
    input.sectionId,
  );

  if (blocksResult.data === null) {
    return blocksResult;
  }

  const blocks = blocksResult.data;
  const currentIndex = blocks.findIndex((block) => block.id === input.blockId);

  if (currentIndex === -1) {
    return {
      data: null,
      error: "Blocco contenuto non trovato o non accessibile.",
    };
  }

  const nextBlock = blocks[currentIndex + 1];

  if (nextBlock?.block_type !== "page_break") {
    return {
      data: {
        changed: false,
      },
      error: null,
    };
  }

  const deleteResult = await deleteSectionBlock(supabase, {
    blockId: nextBlock.id,
    bookId: input.bookId,
    sectionId: input.sectionId,
  });

  if (deleteResult.data === null) {
    return deleteResult;
  }

  const remainingBlocksResult = await listSectionBlocksInSection(
    supabase,
    input.bookId,
    input.sectionId,
  );

  if (remainingBlocksResult.data === null) {
    return remainingBlocksResult;
  }

  const normalizeResult = await normalizeSectionBlockSortOrder(
    supabase,
    remainingBlocksResult.data,
    input.actor,
  );

  if (normalizeResult.data === null) {
    return normalizeResult;
  }

  return {
    data: {
      changed: true,
    },
    error: null,
  };
}
