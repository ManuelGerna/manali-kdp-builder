"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { editorialTextV2Extensions } from "@/lib/kdp/editorial-text-v2-schema";
import { parseLiteralDocument, sameEditorialJson, type EditorialTextGroupV2, type LiteralDocument } from "@/lib/kdp/editorial-text-v2";
import { acknowledgeEditorialTextV2, createEditorialTextDraftV2, readEditorialTextDraftV2, textDraftV2Dirty, textDraftV2Stale } from "@/lib/kdp/editorial-text-v2-draft";
import { useEditorialTextV2DraftCache } from "./editorial-disclosure";
import { saveEditorialTextV2Action, type EditorialTextV2SaveState } from "./editorial-actions";
import { EditorialGroupV2View } from "./editorial-text-v2-render";
import { EditorialImageNode } from "./editorial-image-forms";
import { readImagePlacement } from "@/lib/kdp/editorial-image-placement";
import type { ImageDestination } from "./editorial-images-v2";

function TextSegment({ doc, readOnly, onChange, onFocus }: {
  doc: LiteralDocument; readOnly: boolean; onChange: (doc: LiteralDocument) => void; onFocus: (editor: Editor) => void;
}) {
  const callbacks = useRef({ onChange, onFocus }); callbacks.current = { onChange, onFocus };
  const editor = useEditor({
    extensions: editorialTextV2Extensions(), content: doc as JSONContent, immediatelyRender: false,
    enableInputRules: false, enablePasteRules: false,
    parseOptions: { preserveWhitespace: "full" },
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-label": "Testo continuo", spellcheck: "false" } },
    onUpdate({ editor }) {
      const json = editor.getJSON();
      callbacks.current.onChange(parseLiteralDocument({ ...json, content: json.content ?? [] }));
    },
    onFocus({ editor }) { callbacks.current.onFocus(editor); },
  });
  // Toggling editability must not emit an update with the pre-restore document.
  useEffect(() => { editor?.setEditable(!readOnly, false); }, [editor, readOnly]);
  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON();
    if (!sameEditorialJson({ ...current, content: current.content ?? [] }, doc)) {
      editor.commands.setContent(doc as JSONContent, { emitUpdate: false, parseOptions: { preserveWhitespace: "full" } });
    }
  }, [editor, doc]);
  return <EditorContent editor={editor} className="editorial-v2-segment" />;
}

const initial: EditorialTextV2SaveState = { status: "idle", message: null };
export function EditorialTextV2Editor({ bookId, sectionId, revision, group, images = {}, children, imageDestinations = [] }: {
  bookId: string; sectionId: string; revision: number; group: EditorialTextGroupV2;
  images?: Record<string, { url?: string; alt?: string }>; children?: ReactNode;
  imageDestinations?: ImageDestination[];
}) {
  const cache = useEditorialTextV2DraftCache();
  const key = `editorial-text-v2:${bookId}:${sectionId}:${group.subsection_id ?? "opening"}`;
  const [draft, setDraft] = useState(() => cache?.get(key) ?? createEditorialTextDraftV2(group, revision));
  const [restored, setRestored] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [state, action, pending] = useActionState(saveEditorialTextV2Action, initial);
  const focused = useRef<Editor | null>(null);
  const router = useRouter();
  const dirty = textDraftV2Dirty(draft);
  const stale = textDraftV2Stale(draft, group, revision);
  const textNodes = draft.group.nodes.filter(n => n.kind === "text");
  const hasText = textNodes.some(n => n.source_ids.length || n.doc.content.length);
  const firstAfterImage = draft.group.nodes.findIndex(n => n.kind === "block" &&
    readImagePlacement(draft.group.source.blocks.find(b => b.id === n.id)?.editor_notes ?? null)?.edge === "after");
  const emptyTextId = firstAfterImage > 0 ? draft.group.nodes[firstAfterImage - 1].id : textNodes.at(-1)?.id;
  useEffect(() => {
    let saved = cache?.get(key);
    try { saved ??= readEditorialTextDraftV2(sessionStorage.getItem(key)) ?? undefined; } catch { setStorageFailed(true); }
    if (saved) setDraft(saved);
    setRestored(true);
  }, [cache, key]);
  useEffect(() => {
    if (!restored) return;
    cache?.set(key, draft);
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify(draft)); else sessionStorage.removeItem(key);
    } catch { setStorageFailed(true); }
  }, [cache, key, restored, dirty, draft]);
  useEffect(() => {
    if (state.status === "saved" && state.expected && state.saved && state.revision !== undefined) {
      setDraft(current => acknowledgeEditorialTextV2(current, state.expected!, state.saved!, state.revision!));
    }
  }, [state]);
  useEffect(() => {
    if (restored && !dirty && stale && revision >= draft.revision) setDraft(createEditorialTextDraftV2(group, revision));
  }, [restored, dirty, stale, revision, draft.revision, group]);

  return <section className="editorial-text-editor editorial-text-v2-editor" aria-label="Editor testo continuo V2">
    <div className="editorial-inline-actions" aria-label="Cronologia testo">
      <button type="button" className="ghost-button" disabled={pending || !restored} onMouseDown={e => e.preventDefault()} onClick={() => focused.current?.chain().focus().undo().run()}>Annulla</button>
      <button type="button" className="ghost-button" disabled={pending || !restored} onMouseDown={e => e.preventDefault()} onClick={() => focused.current?.chain().focus().redo().run()}>Ripristina</button>
    </div>
    <div className="editorial-writing-surface">
      {draft.group.nodes.map(node => node.kind === "text" ? (!node.source_ids.length && !node.doc.content.length && (hasText || node.id !== emptyTextId) ? null : <TextSegment key={node.id} doc={node.doc} readOnly={pending || !restored}
        onFocus={editor => { focused.current = editor; }}
        onChange={doc => setDraft(current => ({ ...current, group: { ...current.group, nodes: current.group.nodes.map(n => n.id === node.id && n.kind === "text" ? { ...n, doc } : n) } }))} />) :
        (() => {
          const block = draft.group.source.blocks.find(b => b.id === node.id)!;
          if (block.block_type !== "image") return <EditorialGroupV2View key={node.id} group={{ ...draft.group, nodes: [node] }} images={images} />;
          if (readImagePlacement(block.editor_notes)?.scope === "chapter") return null;
          return <fieldset key={node.id} className="editorial-v2-image-tools" disabled={dirty || stale || pending || !restored}>
            <EditorialImageNode block={block} {...images[block.asset_id ?? ""]} canMoveUp={false} canMoveDown={false} v2 destinations={[
              ...imageDestinations,
              ...draft.group.source.blocks.filter(b => b.block_type === "image" && b.id !== block.id && readImagePlacement(b.editor_notes)).map((b, i) => ({ value: `image|${b.id}|before`, title: `Prima dell’immagine ${i + 1}` })),
            ]} />
          </fieldset>;
        })())}
    </div>
    {stale && <p role="alert">La versione salvata è cambiata. La bozza è conservata; aggiorna la versione salvata prima di risolvere il conflitto.</p>}
    {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    {storageFailed && <p role="status">Copia di sessione non disponibile. Scarica la bozza prima di ricaricare.</p>}
    <form action={action} onSubmit={e => { if (!dirty || stale || !restored) e.preventDefault(); }}>
      <input type="hidden" name="book_id" value={bookId} /><input type="hidden" name="section_id" value={sectionId} />
      <input type="hidden" name="subsection_id" value={group.subsection_id ?? ""} /><input type="hidden" name="revision" value={draft.revision} />
      <input type="hidden" name="expected_group" value={JSON.stringify(draft.base)} /><input type="hidden" name="group" value={JSON.stringify(draft.group)} />
      <button className="button" disabled={!dirty || stale || pending || !restored}>Salva</button>
    </form>
    {(dirty || stale || storageFailed) && <div className="editorial-inline-actions">
      <a className="ghost-button" download="bozza-editoriale-v2.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(draft))}`}>Scarica bozza</a>
      <button type="button" className="ghost-button" disabled={pending} onClick={() => router.refresh()}>Aggiorna versione salvata</button>
      <button type="button" className="ghost-button" disabled={pending} onClick={() => { if (confirm("Scartare la bozza e usare la versione salvata?")) setDraft(createEditorialTextDraftV2(group, revision)); }}>Scarta bozza</button>
    </div>}
    {dirty && <p className="editorial-image-help">Salva il testo prima di modificare le immagini.</p>}
    <fieldset className="editorial-text-operations" disabled={dirty || stale || pending || !restored}>{children}</fieldset>
  </section>;
}
