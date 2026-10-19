import { deleteAsset } from "@/lib/kdp/assets";
import { removeStoredKdpAssetFile } from "@/lib/kdp/storage-cleanup";
import type { createClient } from "@/lib/supabase/server";
import { readCompleteCollection } from "./complete-collection";

type Client = Awaited<ReturnType<typeof createClient>>;

// Only detached, dedicated Builder assets are collected. Failed removals keep
// their path in kdp_assets and are retried on the next Builder visit/action.
export async function cleanupEditorialImages(client: Client, bookId: string) {
  try { return await collectAndCleanup(client, bookId); }
  catch { return false; }
}

async function collectAndCleanup(client: Client, bookId: string) {
  const expired = await client.rpc("collect_editorial_image_uploads_v1", { p_book_id: bookId });
  if (expired.error) return false;
  // Finish reading before deleting: mutation during offset pagination would skip
  // records, while permanently empty tombstones could starve subsequent pages.
  const data = await readCompleteCollection((from, to) => client.from("kdp_assets")
    .select("id,file_path", { count: "exact" }).eq("book_id", bookId)
    .eq("prompt", "editorial-image-v1:garbage").order("id").range(from, to));
  let complete = true;
  for (const asset of data ?? []) {
    const refs = await client.from("kdp_section_blocks").select("id", { count: "exact", head: true }).eq("asset_id", asset.id);
    if (refs.error || refs.count !== 0) { complete = false; continue; }
    const warning = await removeStoredKdpAssetFile(
      async path => {
        const result = await client.storage.from("kdp-assets").remove([path]);
        if (result.error) return result;
        // Empty success is not proof of removal (RLS, absent or late upload).
        // Keep a tombstone so a file arriving after cancellation stays tracked.
        return result.data?.some(item => item.name === path)
          ? { error: null } : { error: { message: "Storage removal not confirmed" } };
      }, asset.file_path, "remove_deleted_asset_file",
    );
    if (warning) { complete = false; continue; }
    const removed = await deleteAsset(client, bookId, asset.id);
    if (removed.error) complete = false;
  }
  return complete;
}
