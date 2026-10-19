"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBookContentMode } from "@/lib/kdp/editorial-book-mode";
import { listSections } from "@/lib/kdp/sections";
import { listSectionBlocks } from "@/lib/kdp/section-blocks";
import { applyEditorialChange, bootstrapEditorialBook, editorialRpcError } from "@/lib/kdp/editorial-repository";
import { orderEditorialBlocks, readEditorialMap, planEditorialSubsectionMove, planEditorialTextMove, planEditorialTextPlacement } from "@/lib/kdp/editorial-hierarchy";
import type { Json } from "@/types/database";
import type { SectionFormState } from "./actions";
import { createAsset } from "@/lib/kdp/assets";
import { createOwnershipActor } from "@/lib/kdp/ownership";
import { validateEditorialImage } from "@/lib/kdp/editorial-images";
import { cleanupEditorialImages } from "@/lib/kdp/editorial-image-storage";
import { parseTextChanges, type TextChange } from "@/lib/kdp/editorial-text-editor";

const field = (form: FormData, key: string) => String(form.get(key) ?? "");
const optional = (form: FormData, key: string) => field(form, key) || null;
function refresh(bookId: string) {
  for (const suffix of ["", "/contenuti", "/anteprima"]) revalidatePath(`/libri/${bookId}${suffix}`);
}
function path(form: FormData, error?: string, status?: string) {
  const section = field(form, "section_id");
  const query = new URLSearchParams(error ? { error } : { status: status ?? "updated" });
  return `/libri/${field(form, "book_id")}/contenuti?${query}${section ? `#section-${section}` : ""}`;
}
async function editorialClient(bookId: string) {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Sessione scaduta. Accedi nuovamente.");
  if (await getBookContentMode(client, bookId) !== "editorial") throw new Error("Questo libro usa il flusso dei contenuti strutturati.");
  return client;
}
async function context(form: FormData) {
  const bookId = field(form, "book_id"); const sectionId = field(form, "section_id");
  const client = await editorialClient(bookId);
  const [sections, result] = await Promise.all([listSections(client, bookId), listSectionBlocks(client, bookId)]);
  const section = sections.data?.find(s => s.id === sectionId);
  if (!section || !result.data) throw new Error(sections.error || result.error || "Parte del libro non disponibile.");
  const blocks = orderEditorialBlocks(result.data.filter(b => b.section_id === sectionId));
  const map = readEditorialMap(section.settings, blocks);
  const revision = field(form, "revision");
  if (!/^\d+$/.test(revision) || Number(revision) !== map.revision) throw new Error("Il contenuto è cambiato. Ricarica il libro prima di riprovare.");
  return { client, bookId, sectionId, blocks, map };
}
type Context = Awaited<ReturnType<typeof context>>;
export type EditorialTextSaveState = {
  status: "idle" | "saved" | "unchanged" | "error";
  message: string | null;
  revision?: number;
  expectedRevision?: number;
  saved?: TextChange[];
};

export async function saveEditorialSubsectionTextAction(_state: EditorialTextSaveState, form: FormData): Promise<EditorialTextSaveState> {
  try {
    const changes = parseTextChanges(JSON.parse(field(form, "changes")))
      .filter(item => item.title !== item.expected_title || item.body !== item.expected_body);
    // A no-op never calls Supabase, RPC, revalidation or Storage cleanup.
    if (!changes.length) return { status: "unchanged", message: "Nessuna modifica da salvare." };
    const c = await context(form);
    const subsectionId = field(form, "subsection_id");
    if (!c.map.subsections.some(sub => sub.heading_block_id === subsectionId)) throw new Error("Sottosezione non disponibile. La bozza è conservata.");
    const result = await applyEditorialChange(c.client, { bookId: c.bookId, sectionId: c.sectionId,
      revision: c.map.revision, order: c.blocks.map(block => block.id),
      change: { operation: "update_text_batch", subsection_id: subsectionId, changes } });
    if (result.error) return { status: "error", message: `${result.message} La bozza è conservata.` };
    const receipt = result.data as { revision?: number; updated?: number } | null;
    if (!receipt || !Number.isInteger(receipt.revision) || !Number.isInteger(receipt.updated)) {
      return { status: "error", message: "Salvataggio non confermato. La bozza è conservata: verifica il contenuto prima di riprovare." };
    }
    if (receipt.updated) refresh(c.bookId);
    return { status: receipt.updated ? "saved" : "unchanged", message: receipt.updated ? "Sottosezione salvata." : "Nessuna modifica da salvare.",
      revision: receipt.revision, expectedRevision: c.map.revision, saved: changes };
  } catch (cause) {
    return { status: "error", message: `${cause instanceof Error ? cause.message : editorialRpcError(null)} La bozza è conservata.` };
  }
}

async function change(form: FormData, makeChange: (c: Context) => Json) {
  const c = await context(form);
  const result = await applyEditorialChange(c.client, {
    bookId: c.bookId, sectionId: c.sectionId, revision: c.map.revision,
    order: c.blocks.map(b => b.id), change: makeChange(c),
  });
  if (result.error) throw new Error(result.message!);
  refresh(c.bookId);
  if (!await cleanupEditorialImages(c.client, c.bookId)) throw new Error("Modifica salvata. Pulizia Storage in attesa: verrà ritentata alla prossima apertura del Builder.");
}
async function run(form: FormData, makeChange: (c: Context) => Json, status: string) {
  let error: string | undefined;
  try { await change(form, makeChange); }
  catch (cause) { error = cause instanceof Error ? cause.message : editorialRpcError(null); }
  redirect(path(form, error, status));
}

export async function bootstrapEditorialBuilderAction(form: FormData) {
  let error: string | undefined;
  try {
    const bookId = field(form, "book_id");
    const result = await bootstrapEditorialBook(await editorialClient(bookId), bookId);
    if (result.error) throw new Error(result.message!);
    refresh(bookId);
  } catch (cause) { error = cause instanceof Error ? cause.message : editorialRpcError(null); }
  redirect(path(form, error, "editorial_initialized"));
}
export async function createEditorialSectionAction(_state: SectionFormState, form: FormData): Promise<SectionFormState> {
  try {
    const bookId = field(form, "book_id"); const client = await editorialClient(bookId);
    const result = await client.rpc("create_editorial_section_v1", { p_book_id: bookId, p_title: field(form, "title"), p_section_type: field(form, "section_type") });
    if (result.error) return { message: editorialRpcError(result.error) };
    refresh(bookId);
  } catch { return { message: editorialRpcError(null) }; }
  redirect(path(form, undefined, "created"));
}
export async function createEditorialSubsectionAction(form: FormData) {
  return run(form, () => ({ operation: "add_subsection", title: field(form, "title") }), "subsection_created");
}
export async function createEditorialTextAction(form: FormData) {
  return run(form, () => ({ operation: "add_text", body: field(form, "body"), subsection_id: optional(form, "subsection_id") }), "text_block_created");
}
export async function deleteEditorialSubsectionAction(form: FormData) {
  return run(form, () => ({ operation: "delete_subsection", block_id: field(form, "subsection_id") }), "subsection_deleted");
}
export async function deleteEditorialTextAction(form: FormData) {
  return run(form, () => ({ operation: "delete_text", block_id: field(form, "block_id") }), "block_deleted");
}
export async function moveEditorialSubsectionAction(form: FormData) {
  return run(form, ({ blocks, map }) => {
    const direction = field(form, "direction");
    if (direction !== "up" && direction !== "down") throw new Error("Spostamento non valido.");
    return { operation: "reorder", order: planEditorialSubsectionMove(blocks, field(form, "subsection_id"), direction, map) };
  }, "subsection_reordered");
}
export async function moveEditorialTextAction(form: FormData) {
  return run(form, ({ blocks, map }) => {
    const direction = field(form, "direction"); const id = field(form, "block_id");
    if (field(form, "placement") === "true") return { operation: "reorder", order: planEditorialTextPlacement(blocks, id, optional(form, "subsection_id"), map) };
    if (direction !== "up" && direction !== "down") throw new Error("Spostamento non valido.");
    return { operation: "reorder", order: planEditorialTextMove(blocks, id, direction, map) };
  }, "block_reordered");
}
export async function updateEditorialBlockAction(_state: SectionFormState, form: FormData): Promise<SectionFormState> {
  try {
    await change(form, () => ({ operation: "update_text", block_id: field(form, "block_id"),
      title: optional(form, "block_title"), body: optional(form, "block_body") }));
  } catch (cause) { return { message: cause instanceof Error ? cause.message : editorialRpcError(null) }; }
  redirect(path(form, undefined, "block_updated"));
}

export async function saveEditorialImageAction(form: FormData) {
  let error: string | undefined;
  let pending: { client: Context["client"]; bookId: string; assetId: string } | undefined;
  try {
    const c = await context(form);
    const operation = field(form, "operation");
    if (!["add_image", "replace_image", "style_image", "discard_image_upload"].includes(operation)) throw new Error("Operazione non valida.");
    const size = field(form, "size"); const align = field(form, "align");
    if (!["small", "medium", "text"].includes(size) || !["left", "center", "right"].includes(align)) throw new Error("Dimensione o allineamento non valido.");
    let assetId: string | undefined;
    const recoveryId = field(form, "pending_asset_id");
    if (recoveryId) {
      const recovered = await c.client.from("kdp_assets").select("id,file_path,title")
        .eq("book_id", c.bookId).eq("id", recoveryId).eq("prompt", "editorial-image-v1:pending").maybeSingle();
      if (recovered.error || !recovered.data?.file_path) throw new Error("Upload non più disponibile. Ricarica il Builder.");
      assetId = recovered.data.id;
      if (operation !== "discard_image_upload") {
        if (operation !== "add_image") throw new Error("Recupero non valido.");
        const downloaded = await c.client.storage.from("kdp-assets").download(recovered.data.file_path);
        if (downloaded.error || !downloaded.data) throw new Error("Upload non completato. Attendi oppure elimina l'upload interrotto.");
        await validateEditorialImage(new File([downloaded.data], recovered.data.title ?? "image", { type: downloaded.data.type.split(";")[0] }));
      }
    } else if (operation === "discard_image_upload") {
      throw new Error("Upload non trovato.");
    } else if (operation !== "style_image") {
      const file = form.get("image");
      if (!(file instanceof File)) throw new Error("Scegli un'immagine.");
      const meta = await validateEditorialImage(file);
      const { data: { user } } = await c.client.auth.getUser();
      if (!user) throw new Error("Sessione scaduta.");
      const storagePath = `${user.id}/${c.bookId}/${crypto.randomUUID()}/image.${meta.extension}`;
      const asset = await createAsset(c.client, { actor: createOwnershipActor({ userId: user.id, email: user.email }),
        bookId: c.bookId, assetType: "image", title: file.name, altText: field(form, "alt_text") || file.name,
        prompt: "editorial-image-v1:pending", status: "placeholder", filePath: storagePath });
      if (!asset.data) throw new Error(asset.error);
      assetId = asset.data.assetId;
      pending = { client: c.client, bookId: c.bookId, assetId };
      const uploaded = await c.client.storage.from("kdp-assets").upload(storagePath, file, { contentType: meta.mimeType, upsert: false });
      if (uploaded.error) throw new Error("Caricamento Storage non riuscito.");
    }
    const result = await applyEditorialChange(c.client, { bookId: c.bookId, sectionId: c.sectionId,
      revision: c.map.revision, order: c.blocks.map(b => b.id), change: {
        operation, size, align, block_id: optional(form, "block_id"), subsection_id: optional(form, "subsection_id"), ...(assetId ? { asset_id: assetId } : {}),
      } });
    if (result.error) throw new Error(result.message!);
    pending = undefined;
    refresh(c.bookId);
    if (!await cleanupEditorialImages(c.client, c.bookId)) throw new Error("Immagine salvata. Pulizia Storage in attesa, ritentata alla prossima apertura.");
  } catch (cause) {
    error = cause instanceof Error ? cause.message : editorialRpcError(null);
    if (pending) {
      // Never discard the ledger before Storage confirms deletion.
      const marked = await pending.client.from("kdp_assets").update({ prompt: "editorial-image-v1:garbage" })
        .eq("book_id", pending.bookId).eq("id", pending.assetId).eq("prompt", "editorial-image-v1:pending");
      if (marked.error || !await cleanupEditorialImages(pending.client, pending.bookId)) error += " File tracciato per la pulizia Storage.";
    }
  }
  redirect(path(form, error, "image_saved"));
}
