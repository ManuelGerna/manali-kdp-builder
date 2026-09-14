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
async function change(form: FormData, makeChange: (c: Context) => Json) {
  const c = await context(form);
  const result = await applyEditorialChange(c.client, {
    bookId: c.bookId, sectionId: c.sectionId, revision: c.map.revision,
    order: c.blocks.map(b => b.id), change: makeChange(c),
  });
  if (result.error) throw new Error(result.message!);
  refresh(c.bookId);
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
