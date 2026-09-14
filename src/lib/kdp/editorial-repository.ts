import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { readEditorialMap } from "./editorial-hierarchy";
import type { KdpSection } from "./sections";
import type { KdpSectionBlock } from "./section-blocks";

type Client = Awaited<ReturnType<typeof createClient>>;
export function editorialRpcError(error: { message?: string; code?: string } | null) {
  if (error?.code === "PGRST202" || error?.code === "42883") return "Le operazioni del Builder richiedono l'aggiornamento del database. Nessuna modifica applicata.";
  if (error?.message?.includes("bootstrap_mismatch")) return "I blocchi non coincidono integralmente con l'import originale. Nessuna mappa salvata e nessun testo modificato.";
  if (error?.code === "40001") return "Il contenuto è cambiato. Ricarica il libro prima di riprovare; questa operazione non è stata applicata.";
  if (error?.message?.includes("map_invalid")) return "La mappa editoriale manca o non è valida. Nessuna modifica applicata.";
  // Only a confirmed PostgreSQL rejection guarantees transaction rollback.
  // Fetch/connection failures may happen after COMMIT: never promise no writes.
  if (error?.code && /^[0-9A-Z]{5}$/.test(error.code) && !error.code.startsWith("08") && error.code !== "40003") {
    return "Operazione annullata. Nessuna modifica applicata: ricarica il libro e riprova.";
  }
  return "Operazione non confermata. Ricarica il libro per verificarne l'esito prima di riprovare.";
}

export function inspectEditorialMaps(sections: KdpSection[], blocks: KdpSectionBlock[]) {
  let needsBootstrap = false;
  try {
    for (const section of sections) {
      if (!section.settings || typeof section.settings !== "object" || Array.isArray(section.settings) || !("editorial_builder_v1" in section.settings)) {
        needsBootstrap = true; continue;
      }
      readEditorialMap(section.settings, blocks.filter(b => b.section_id === section.id));
    }
    return { needsBootstrap, error: null };
  } catch (error) { return { needsBootstrap: false, error: (error as Error).message }; }
}

export async function bootstrapEditorialBook(client: Client, bookId: string) {
  const result = await client.rpc("bootstrap_editorial_builder_v1", { p_book_id: bookId });
  return { ...result, message: result.error ? editorialRpcError(result.error) : null };
}

export async function applyEditorialChange(client: Client, input: {
  bookId: string; sectionId: string; revision: number; order: string[]; change: Json;
}) {
  const result = await client.rpc("apply_editorial_section_change_v1", {
    p_book_id: input.bookId, p_section_id: input.sectionId,
    p_expected_revision: input.revision, p_expected_order: input.order, p_change: input.change,
  });
  return { ...result, message: result.error ? editorialRpcError(result.error) : null };
}
