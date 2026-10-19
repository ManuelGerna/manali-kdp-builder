"use client";

import { useFormStatus } from "react-dom";
import { EditorialRevisionInput } from "./editorial-disclosure";
import { saveEditorialImageAction, deleteEditorialTextAction, moveEditorialTextAction } from "./editorial-actions";
import { editorialImageStyle } from "@/lib/kdp/editorial-images";
import type { KdpSectionBlock } from "@/lib/kdp/section-blocks";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="ghost-button" disabled={pending}>{pending ? "Attendi…" : children}</button>;
}
function Identity({ bookId, sectionId, blockId, subsectionId }: { bookId: string; sectionId: string; blockId?: string; subsectionId?: string }) {
  return <><EditorialRevisionInput /><input type="hidden" name="book_id" value={bookId} /><input type="hidden" name="section_id" value={sectionId} />
    <input type="hidden" name="block_id" value={blockId ?? ""} /><input type="hidden" name="subsection_id" value={subsectionId ?? ""} /></>;
}
export function EditorialImageForm({ bookId, sectionId, subsectionId, block, styleOnly = false }: {
  bookId: string; sectionId: string; subsectionId?: string; block?: KdpSectionBlock; styleOnly?: boolean;
}) {
  const style = editorialImageStyle(block?.editor_notes ?? null);
  return <form action={saveEditorialImageAction} className="form-grid editorial-compact-form">
    <Identity {...{ bookId, sectionId, subsectionId }} blockId={block?.id} />
    <input type="hidden" name="operation" value={styleOnly ? "style_image" : block ? "replace_image" : "add_image"} />
    {!styleOnly && <><label>Immagine PNG/JPG (massimo 3 MB)<input name="image" type="file" accept="image/png,image/jpeg" required onChange={event => {
      const input = event.currentTarget;
      input.setCustomValidity((input.files?.[0]?.size ?? 0) > 3 * 1024 * 1024 ? "Scegli un PNG/JPG fino a 3 MB." : "");
      input.reportValidity();
    }} /></label>
      <label>Descrizione immagine<input name="alt_text" maxLength={500} /></label></>}
    <label>Dimensione<select name="size" defaultValue={style.size}><option value="small">Piccola</option><option value="medium">Media</option><option value="text">Larghezza testo</option></select></label>
    <label>Allineamento<select name="align" defaultValue={style.align}><option value="left">Sinistra</option><option value="center">Centro</option><option value="right">Destra</option></select></label>
    <Submit>{styleOnly ? "Salva formato" : block ? "Sostituisci immagine" : "Carica immagine"}</Submit>
  </form>;
}
export function EditorialImageNode({ block, url, alt, canMoveUp, canMoveDown }: {
  block: KdpSectionBlock; url?: string; alt?: string; canMoveUp: boolean; canMoveDown: boolean;
}) {
  const style = editorialImageStyle(block.editor_notes);
  const identity = { bookId: block.book_id, sectionId: block.section_id, blockId: block.id };
  return <div id={`block-${block.id}`} className="editorial-text-node scroll-target">
    <div style={{ width: style.size === "small" ? "33%" : style.size === "medium" ? "66%" : "100%", marginLeft: style.align === "left" ? 0 : "auto", marginRight: style.align === "right" ? 0 : "auto" }}>
      {/* Signed private Storage URL; intrinsic proportions, no cropping. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={alt || "Immagine del capitolo"} style={{ display: "block", width: "100%", height: "auto" }} /> : <p>Anteprima non disponibile. Ricarica la pagina.</p>}
    </div>
    <div className="editorial-inline-actions">
      {(["up", "down"] as const).filter(d => d === "up" ? canMoveUp : canMoveDown).map(direction => <form action={moveEditorialTextAction} key={direction}><Identity {...identity} /><input type="hidden" name="direction" value={direction} /><Submit>{direction === "up" ? "Immagine su" : "Immagine giù"}</Submit></form>)}
      <form action={deleteEditorialTextAction} onSubmit={e => { if (!confirm("Eliminare questa immagine?")) e.preventDefault(); }}><Identity {...identity} /><Submit>Elimina immagine</Submit></form>
    </div>
    <details><summary>Dimensione e allineamento</summary><EditorialImageForm {...identity} block={block} styleOnly /></details>
    <details><summary>Sostituisci immagine</summary><EditorialImageForm {...identity} block={block} /></details>
  </div>;
}
