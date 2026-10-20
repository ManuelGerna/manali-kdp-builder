"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEditorialTextDraftCache } from "./editorial-disclosure";
import { saveEditorialSubsectionTextAction, type EditorialTextSaveState } from "./editorial-actions";
import { EditorialImagePreview } from "./editorial-image-forms";
import { acknowledgeTextDraft, changedSubsectionTexts, createSubsectionTextDraft, editSubsectionTextDraft,
  isEditableTextBlock, readSubsectionTextDraft, textDraftIsStale, type TextSnapshot } from "@/lib/kdp/editorial-text-editor";

function LiteralText({ value, title, label, readOnly, onChange }: {
  value: string; title?: boolean; label: string; readOnly: boolean; onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function resize() {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }
  useEffect(resize, [value]);
  return <textarea ref={ref} className={`editorial-literal-text${title ? " editorial-literal-title" : ""}`}
    aria-label={label} value={value} rows={Math.max(1, value.split(/\r\n|\r|\n/).length)} readOnly={readOnly}
    spellCheck={false} autoCorrect="off" autoCapitalize="off" onChange={event => onChange(event.target.value)} />;
}

const INITIAL_STATE: EditorialTextSaveState = { status: "idle", message: null };

export function EditorialSubsectionTextEditor({ bookId, sectionId, subsectionId, revision, blocks, images = {}, children }: {
  bookId: string; sectionId: string; subsectionId: string | null; revision: number; blocks: TextSnapshot[];
  images?: Record<string, { url?: string; alt?: string }>; children?: ReactNode;
}) {
  const cache = useEditorialTextDraftCache();
  const opening = subsectionId === null;
  const storageKey = `editorial-text-v1:${bookId}:${sectionId}:${subsectionId ?? "opening"}`;
  const [draft, setDraft] = useState(() => cache?.get(storageKey) ?? createSubsectionTextDraft(blocks, revision));
  const [restored, setRestored] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [state, formAction, pending] = useActionState(saveEditorialSubsectionTextAction, INITIAL_STATE);
  const router = useRouter();
  const formId = useId();
  const changes = changedSubsectionTexts(draft);
  const dirty = changes.length > 0;
  const stale = textDraftIsStale(draft, blocks, revision);

  useEffect(() => {
    let saved = cache?.get(storageKey);
    try { saved ??= readSubsectionTextDraft(sessionStorage.getItem(storageKey)) ?? undefined; }
    catch { setStorageFailed(true); }
    if (saved) setDraft(saved);
    setRestored(true);
  }, [cache, storageKey]);

  useEffect(() => {
    if (!restored) return;
    cache?.set(storageKey, draft);
    try {
      if (changedSubsectionTexts(draft).length) sessionStorage.setItem(storageKey, JSON.stringify(draft));
      else sessionStorage.removeItem(storageKey);
    } catch { setStorageFailed(true); }
  }, [cache, storageKey, draft, restored]);

  useEffect(() => {
    if ((state.status === "saved" || state.status === "unchanged") && state.revision !== undefined && state.saved) {
      setDraft(current => current.revision === state.expectedRevision
        ? acknowledgeTextDraft(current, state.revision!, state.saved!) : current);
    }
  }, [state]);

  useEffect(() => {
    if (restored && !dirty && stale && revision >= draft.revision) setDraft(createSubsectionTextDraft(blocks, revision));
  }, [restored, dirty, stale, revision, draft.revision, blocks]);

  // Edits never create, merge, delete or reorder nodes. Native text controls also
  // prevent selections/backspace/paste from crossing an image or block boundary.
  return <section className="editorial-text-editor" aria-label={opening ? "Editor testo introduttivo" : "Editor testo della sottosezione"}>
    <p className="field-note">Modifica il testo direttamente. I paragrafi e le immagini mantengono la loro posizione.</p>
    <div className="editorial-writing-surface" role="group" aria-label="Testo e immagini">
      {draft.blocks.map((block, index) => <div key={block.id} id={`block-${block.id}`} data-editorial-block={block.id} className="editorial-writing-node scroll-target">
        {isEditableTextBlock(block) ? <>
          {draft.values[block.id].title !== null && <LiteralText title value={draft.values[block.id].title!}
            label={`Titoletto ${index + 1}`} readOnly={pending || !restored}
            onChange={value => setDraft(current => editSubsectionTextDraft(current, block.id, "title", value))} />}
          {(draft.values[block.id].body !== null || draft.values[block.id].title === null) && <LiteralText
            value={draft.values[block.id].body ?? ""} label={`Testo ${index + 1}`} readOnly={pending || !restored}
            onChange={value => setDraft(current => editSubsectionTextDraft(current, block.id, "body", value))} />}
        </> : ["image", "image_prompt"].includes(block.block_type) ? <div className="editorial-writing-image" contentEditable={false}>
          <EditorialImagePreview notes={block.editor_notes} {...images[block.asset_id ?? ""]} />
        </div> : <p className="editorial-prose">{block.title}{block.title && block.body ? "\n" : ""}{block.body}</p>}
      </div>)}
    </div>
    {stale && <p className="form-note form-note-error" role="alert">La versione salvata è cambiata. La tua bozza è conservata e non verrà sovrascritta.</p>}
    {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    {storageFailed && <p role="status">Il browser non consente la copia di sessione. Conserva la bozza scaricandola prima di ricaricare la pagina.</p>}
    <form id={formId} action={formAction} onSubmit={event => { if (!dirty || stale || !restored) event.preventDefault(); }}>
      <input type="hidden" name="book_id" value={bookId} /><input type="hidden" name="section_id" value={sectionId} />
      <input type="hidden" name="subsection_id" value={subsectionId ?? ""} /><input type="hidden" name="revision" value={draft.revision} />
      <input type="hidden" name="changes" value={JSON.stringify(changes)} />
      <button className="button" disabled={!dirty || pending || stale || !restored}>{opening ? "Salva testo" : "Salva sottosezione"}</button>
    </form>
    {(dirty || stale) && <div className="editorial-inline-actions">
      <a className="ghost-button" download="bozza-sottosezione.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(draft))}`}>Scarica bozza</a>
      <button type="button" className="ghost-button" disabled={pending} onClick={() => router.refresh()}>Aggiorna versione salvata</button>
      <button type="button" className="ghost-button" disabled={pending} onClick={() => {
        if (confirm("Scartare la bozza e usare la versione salvata attualmente visualizzata?")) setDraft(createSubsectionTextDraft(blocks, revision));
      }}>Scarta bozza</button>
    </div>}
    <fieldset className="editorial-text-operations" disabled={dirty || pending || stale || !restored}>
      {(dirty || stale) && <p className="field-note">Salva o risolvi la bozza prima di organizzare i contenuti.</p>}
      {children}
    </fieldset>
  </section>;
}
