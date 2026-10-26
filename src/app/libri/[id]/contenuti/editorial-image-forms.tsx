"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import { EditorialRevisionInput } from "./editorial-disclosure";
import { saveEditorialImageAction, deleteEditorialTextAction, moveEditorialTextAction } from "./editorial-actions";
import { editorialImageStyle } from "@/lib/kdp/editorial-images";
import type { KdpSectionBlock } from "@/lib/kdp/section-blocks";
import { readImagePlacement } from "@/lib/kdp/editorial-image-placement";

function Submit({ children, primary = false }: { children: React.ReactNode; primary?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={primary ? "button editorial-image-submit" : "ghost-button"} disabled={pending}>{pending ? "Attendi…" : children}</button>;
}
function Identity({ bookId, sectionId, blockId, subsectionId }: { bookId: string; sectionId: string; blockId?: string; subsectionId?: string }) {
  return <><EditorialRevisionInput /><input type="hidden" name="book_id" value={bookId} /><input type="hidden" name="section_id" value={sectionId} />
    <input type="hidden" name="block_id" value={blockId ?? ""} /><input type="hidden" name="subsection_id" value={subsectionId ?? ""} /></>;
}
export function EditorialImageForm({ bookId, sectionId, subsectionId, block, styleOnly = false, v2 = false, chapter = false }: {
  bookId: string; sectionId: string; subsectionId?: string; block?: KdpSectionBlock; styleOnly?: boolean; v2?: boolean; chapter?: boolean;
}) {
  const style = editorialImageStyle(block?.editor_notes ?? null);
  const placement = readImagePlacement(block?.editor_notes ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <form action={saveEditorialImageAction} className="form-grid editorial-image-form" onReset={() => { setFile(null); setError(""); }}>
    <Identity {...{ bookId, sectionId, subsectionId }} blockId={block?.id} />
    {v2 && <><input type="hidden" name="image_v2" value="true" /><input type="hidden" name="scope" value={chapter ? "chapter" : placement?.scope ?? "group"} /></>}
    <input type="hidden" name="operation" value={styleOnly ? "style_image" : block ? "replace_image" : "add_image"} />
    {!styleOnly && <><label className="editorial-image-picker">Seleziona immagine<input name="image" type="file" accept="image/png,image/jpeg" required onChange={event => {
      const input = event.currentTarget;
      const selected = input.files?.[0];
      const message = selected && (!selected.size || selected.size > 3 * 1024 * 1024 || !["image/png", "image/jpeg"].includes(selected.type)) ? "Scegli un PNG/JPG fino a 3 MB." : "";
      input.setCustomValidity(message); setError(message); setFile(!message && selected ? selected : null);
      input.reportValidity();
    }} /><span className="editorial-image-help">PNG o JPG · massimo 3 MB</span></label>
      {error && <p role="alert">{error}</p>}
      {preview && <figure className="editorial-image-upload-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Anteprima prima del caricamento" /><figcaption>{file?.name}</figcaption></figure>}
      <label className="editorial-image-description">Descrizione immagine (facoltativa)<input name="alt_text" maxLength={500} placeholder="Descrivi brevemente l’immagine" /></label></>}
    {v2 && !block && !chapter && <label>Posizione<select name="edge" defaultValue="after"><option value="before">Prima del testo</option><option value="after">Dopo il testo</option></select></label>}
    {v2 && (block || chapter) && <input type="hidden" name="edge" value={placement?.edge ?? "after"} />}
    <label>Dimensione<select name="size" defaultValue={style.size}><option value="small">Piccola</option><option value="medium">Media</option><option value="text">Larghezza testo</option></select></label>
    <label>Allineamento<select name="align" defaultValue={style.align}><option value="left">Sinistra</option><option value="center">Centro</option><option value="right">Destra</option></select></label>
    <Submit primary>{styleOnly ? "Salva formato" : block ? "Sostituisci immagine" : "Carica immagine"}</Submit>
  </form>;
}
export function EditorialImageNode({ block, url, alt, canMoveUp, canMoveDown, anchorPrefix = "", v2 = false, destinations = [] }: {
  block: KdpSectionBlock; url?: string; alt?: string; canMoveUp: boolean; canMoveDown: boolean; anchorPrefix?: string; v2?: boolean;
  destinations?: { value: string; title: string }[];
}) {
  const identity = { bookId: block.book_id, sectionId: block.section_id, blockId: block.id };
  return <div id={`${anchorPrefix}block-${block.id}`} className="editorial-text-node scroll-target">
    <EditorialImagePreview notes={block.editor_notes} url={url} alt={alt} />
    <div className="editorial-inline-actions">
      {!v2 && (["up", "down"] as const).filter(d => d === "up" ? canMoveUp : canMoveDown).map(direction => <form action={moveEditorialTextAction} key={direction}><Identity {...identity} /><input type="hidden" name="direction" value={direction} /><Submit>{direction === "up" ? "Immagine su" : "Immagine giù"}</Submit></form>)}
      {v2 && <form action={saveEditorialImageAction} className="editorial-image-position"><Identity {...identity} /><input type="hidden" name="image_v2" value="true" /><input type="hidden" name="operation" value="move_image" /><label>Sposta immagine<select name="destination" required defaultValue=""><option value="" disabled>Scegli posizione</option>{destinations.map(d => <option key={d.value} value={d.value}>{d.title}</option>)}</select></label><Submit>Sposta immagine</Submit></form>}
      <form action={v2 ? saveEditorialImageAction : deleteEditorialTextAction} onSubmit={e => { if (!confirm("Eliminare questa immagine?")) e.preventDefault(); }}><Identity {...identity} />{v2 && <><input type="hidden" name="image_v2" value="true" /><input type="hidden" name="operation" value="delete_image" /></>}<Submit>Elimina immagine</Submit></form>
    </div>
    <details><summary>Dimensione e allineamento</summary><EditorialImageForm {...identity} block={block} styleOnly v2={v2} /></details>
    <details><summary>Sostituisci immagine</summary><EditorialImageForm {...identity} block={block} v2={v2} /></details>
  </div>;
}

export function EditorialImagePreview({ notes, url, alt }: { notes: string | null; url?: string; alt?: string }) {
  const style = editorialImageStyle(notes);
  return (
    <div style={{ width: style.size === "small" ? "33%" : style.size === "medium" ? "66%" : "100%", marginLeft: style.align === "left" ? 0 : "auto", marginRight: style.align === "right" ? 0 : "auto" }}>
      {/* Signed private Storage URL; intrinsic proportions, no cropping. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={alt || "Immagine del capitolo"} style={{ display: "block", width: "100%", height: "auto" }} /> : <p>Anteprima non disponibile. Ricarica la pagina.</p>}
    </div>
  );
}
