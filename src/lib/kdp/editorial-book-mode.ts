import type { createClient } from "@/lib/supabase/server";

export function resolveBookContentMode(importKinds: string[], importedPageCount: number) {
  if (importedPageCount > 0) return "pages";
  if (importKinds.length > 0 && importKinds.every(kind => kind === "editorial_draft_v1")) return "editorial";
  return "legacy";
}

export async function getBookContentMode(client: Awaited<ReturnType<typeof createClient>>, bookId: string) {
  const [runs, pages] = await Promise.all([
    client.from("kdp_import_runs").select("import_kind").eq("book_id", bookId),
    client.from("kdp_imported_pages").select("id", { count: "exact", head: true }).eq("book_id", bookId),
  ]);
  if (runs.error || pages.error || !runs.data || pages.count === null) throw new Error("Non riesco a verificare il tipo di libro. Riprova.");
  return resolveBookContentMode(runs.data.map(r => r.import_kind), pages.count);
}
