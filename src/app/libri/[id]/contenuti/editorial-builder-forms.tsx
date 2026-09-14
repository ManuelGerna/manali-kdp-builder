"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import {
  createEditorialSubsectionAction,
  createEditorialTextAction,
  createEditorialSectionAction,
  deleteEditorialSubsectionAction,
  moveEditorialSubsectionAction,
  updateEditorialBlockAction,
  moveEditorialTextAction,
  deleteEditorialTextAction,
} from "./editorial-actions";
import { updateSectionAction, type SectionFormState } from "./actions";
import { EditorialRevisionInput, EditorialDisclosure, useEditorialDraftForm } from "./editorial-disclosure";
import type { KdpSectionBlock } from "@/lib/kdp/section-blocks";
import type { KdpSection } from "@/lib/kdp/sections";

const EMPTY_SECTION_STATE: SectionFormState = { message: null };

export function CreateEditorialSectionPanel({ bookId, initiallyOpen }: { bookId: string; initiallyOpen: boolean }) {
  return <EditorialDisclosure className="editorial-new-section scroll-target" id="nuova-sezione" open={initiallyOpen}>
    <summary className="button">+ Aggiungi una parte al libro</summary>
    <CreateEditorialSectionForm bookId={bookId} />
  </EditorialDisclosure>;
}

function SubmitButton({ label, pendingLabel, className = "button" }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? pendingLabel : label}
    </button>
  );
}

export function CreateEditorialSectionForm({ bookId }: { bookId: string }) {
  const [state, formAction] = useActionState(
    createEditorialSectionAction,
    EMPTY_SECTION_STATE,
  );

  return (
    <form action={formAction} className="form-grid editorial-compact-form">
      <input name="book_id" type="hidden" value={bookId} />
      <input name="return_to" type="hidden" value="#nuova-sezione" />
      <input name="section_status" type="hidden" value="draft" />
      <input name="layout_preset" type="hidden" value="default" />
      <input name="include_in_toc" type="hidden" value="on" />

      {state.message ? (
        <p className="form-note form-note-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="editorial_section_type_new">Livello</label>
        <select
          defaultValue={state.fields?.section_type || "chapter"}
          id="editorial_section_type_new"
          name="section_type"
        >
          <option value="introduction">Introduzione</option>
          <option value="chapter">Capitolo</option>
          <option value="chapter_text">Sezione</option>
          <option value="conclusion">Conclusione</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="editorial_title_new">Titolo</label>
        <input
          defaultValue={state.fields?.title ?? ""}
          id="editorial_title_new"
          name="title"
          placeholder="Es. 1. AMORE"
          required
        />
      </div>

      <input name="subtitle" type="hidden" value="" />
      <input name="body" type="hidden" value="" />
      <input name="editor_notes" type="hidden" value="" />
      <SubmitButton label="Aggiungi al libro" pendingLabel="Creazione..." />
    </form>
  );
}

export function EditEditorialSectionForm({ section, fieldSuffix = "section" }: { section: KdpSection; fieldSuffix?: string }) {
  const draft = useEditorialDraftForm(`section:${section.id}:${section.updated_at}`);
  const initialState: SectionFormState = {
    message: null,
    fields: {
      body: section.body ?? "",
      editor_notes: section.editor_notes ?? "",
      include_in_toc: section.include_in_toc ? "true" : "false",
      layout_preset: section.layout_preset,
      page_break_before: section.page_break_before ? "true" : "false",
      section_status: section.section_status,
      section_type: section.section_type,
      subtitle: section.subtitle ?? "",
      title: section.title ?? "",
    },
  };
  const [state, formAction] = useActionState(updateSectionAction, initialState);

  return (
    <form {...draft} action={formAction} className="form-grid editorial-compact-form">
      <input name="book_id" type="hidden" value={section.book_id} />
      <input name="section_id" type="hidden" value={section.id} />
      <EditorialRevisionInput />
      <input name="return_to" type="hidden" value={`#section-${section.id}`} />
      <input name="section_type" type="hidden" value={section.section_type} />
      <input name="section_status" type="hidden" value={section.section_status} />
      <input name="layout_preset" type="hidden" value={section.layout_preset} />
      <input name="editor_notes" type="hidden" value={section.editor_notes ?? ""} />
      {section.include_in_toc ? (
        <input name="include_in_toc" type="hidden" value="on" />
      ) : null}
      {section.page_break_before ? (
        <input name="page_break_before" type="hidden" value="on" />
      ) : null}

      {state.message ? (
        <p className="form-note form-note-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor={`editorial_title_${section.id}_${fieldSuffix}`}>Titolo</label>
        <input
          defaultValue={state.fields?.title ?? section.title ?? ""}
          id={`editorial_title_${section.id}_${fieldSuffix}`}
          name="title"
          required
        />
      </div>

      <div className="field">
        <label htmlFor={`editorial_subtitle_${section.id}_${fieldSuffix}`}>Sottotitolo</label>
        <input
          defaultValue={state.fields?.subtitle ?? section.subtitle ?? ""}
          id={`editorial_subtitle_${section.id}_${fieldSuffix}`}
          name="subtitle"
          placeholder="Facoltativo"
        />
      </div>

      <div className="field">
        <label htmlFor={`editorial_body_${section.id}_${fieldSuffix}`}>Testo introduttivo</label>
        <textarea
          defaultValue={state.fields?.body ?? section.body ?? ""}
          id={`editorial_body_${section.id}_${fieldSuffix}`}
          name="body"
          placeholder="Testo facoltativo prima delle sottosezioni"
        />
      </div>

      <SubmitButton label="Salva" pendingLabel="Salvataggio..." />
      <button className="ghost-button" type="reset">Annulla modifiche</button>
    </form>
  );
}

export function EditEditorialBlockForm({
  block,
  subsection = false,
}: {
  block: KdpSectionBlock;
  subsection?: boolean;
}) {
  const draft = useEditorialDraftForm(`block:${block.id}:${block.updated_at}`);
  const [state, formAction] = useActionState(updateEditorialBlockAction, EMPTY_SECTION_STATE);
  return (
    <form {...draft} action={formAction} className="form-grid editorial-compact-form">
      <input name="book_id" type="hidden" value={block.book_id} />
      <input name="section_id" type="hidden" value={block.section_id} />
      <EditorialRevisionInput />
      <input name="block_id" type="hidden" value={block.id} />
      <input name="return_to" type="hidden" value={`#block-${block.id}`} />
      {state.message ? <p className="form-note form-note-error" role="alert">{state.message}</p> : null}

      {subsection ? (
        <>
          <div className="field">
            <label htmlFor={`editorial_block_title_${block.id}`}>
              Titolo sottosezione
            </label>
            <input
              defaultValue={block.title ?? ""}
              id={`editorial_block_title_${block.id}`}
              name="block_title"
              required
            />
          </div>
          {block.block_type === "heading" ? (
            <div className="field">
              <label htmlFor={`editorial_heading_body_${block.id}`}>Testo di apertura</label>
              <textarea id={`editorial_heading_body_${block.id}`} name="block_body" defaultValue={block.body ?? ""} />
            </div>
          ) : <input name="block_body" type="hidden" value="" />}
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor={`editorial_block_title_${block.id}`}>
              Titolo del testo
            </label>
            <input
              defaultValue={block.title ?? ""}
              id={`editorial_block_title_${block.id}`}
              name="block_title"
              placeholder="Facoltativo"
            />
          </div>
          <div className="field">
            <label htmlFor={`editorial_block_body_${block.id}`}>Testo</label>
            <textarea
              defaultValue={block.body ?? ""}
              id={`editorial_block_body_${block.id}`}
              name="block_body"
            />
          </div>
        </>
      )}

      <SubmitButton label="Salva" pendingLabel="Salvataggio..." />
      <button className="ghost-button" type="reset">Annulla modifiche</button>
    </form>
  );
}

export function AddEditorialSubsectionForm({
  bookId,
  sectionId,
}: {
  bookId: string;
  sectionId: string;
}) {
  const fieldId = useId();
  const draft = useEditorialDraftForm(`add-subsection:${sectionId}`);
  return (
    <form {...draft} action={createEditorialSubsectionAction} className="form-grid editorial-compact-form">
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />
      <EditorialRevisionInput />
      <div className="field">
        <label htmlFor={fieldId}>Titolo sottosezione</label>
        <input
          id={fieldId}
          name="title"
          placeholder="Es. OMBRA"
          required
        />
      </div>
      <SubmitButton label="Aggiungi sottosezione" pendingLabel="Creazione..." />
    </form>
  );
}

export function AddEditorialTextForm({
  bookId,
  sectionId,
  subsectionId,
}: {
  bookId: string;
  sectionId: string;
  subsectionId?: string;
}) {
  const fieldId = useId();
  const draft = useEditorialDraftForm(`add-text:${sectionId}:${subsectionId ?? "opening"}`);

  return (
    <form {...draft} action={createEditorialTextAction} className="form-grid editorial-compact-form">
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />
      <EditorialRevisionInput />
      {subsectionId ? (
        <input name="subsection_id" type="hidden" value={subsectionId} />
      ) : null}
      <div className="field">
        <label htmlFor={fieldId}>Testo</label>
        <textarea id={fieldId} name="body" placeholder="Inizia a scrivere..." required />
      </div>
      <SubmitButton label="Aggiungi testo" pendingLabel="Creazione..." />
    </form>
  );
}

export function MoveEditorialSubsectionForm({
  bookId,
  direction,
  sectionId,
  subsectionId,
}: {
  bookId: string;
  direction: "up" | "down";
  sectionId: string;
  subsectionId: string;
}) {
  return (
    <form action={moveEditorialSubsectionAction} className="inline-form">
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />
      <EditorialRevisionInput />
      <input name="subsection_id" type="hidden" value={subsectionId} />
      <input name="direction" type="hidden" value={direction} />
      <SubmitButton className="ghost-button editorial-small-button" label={direction === "up" ? "Sposta su" : "Sposta giù"} pendingLabel="Spostamento..." />
    </form>
  );
}

export function DeleteEditorialSubsectionForm({
  bookId,
  sectionId,
  subsectionId,
  title,
}: {
  bookId: string;
  sectionId: string;
  subsectionId: string;
  title: string;
}) {
  return (
    <form
      action={deleteEditorialSubsectionAction}
      className="inline-form"
      onSubmit={(event) => {
        if (!window.confirm(`Eliminare "${title}" e tutti i suoi contenuti?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />
      <EditorialRevisionInput />
      <input name="subsection_id" type="hidden" value={subsectionId} />
      <SubmitButton className="danger-button editorial-small-button" label="Elimina sottosezione" pendingLabel="Eliminazione..." />
    </form>
  );
}

export function MoveEditorialTextForm({
  block, direction, destinations, currentSubsectionId,
}: {
  block: KdpSectionBlock;
  direction?: "up" | "down";
  destinations?: { id: string; title: string }[];
  currentSubsectionId?: string;
}) {
  const fieldId = useId();
  return (
    <form action={moveEditorialTextAction} className={direction ? "inline-form" : "form-grid editorial-compact-form"}>
      <input name="book_id" type="hidden" value={block.book_id} />
      <input name="section_id" type="hidden" value={block.section_id} />
      <EditorialRevisionInput />
      <input name="block_id" type="hidden" value={block.id} />
      {direction ? <input name="direction" type="hidden" value={direction} /> : (
        <>
          <input name="placement" type="hidden" value="true" />
          <div className="field">
            <label htmlFor={fieldId}>Destinazione in questa parte del libro</label>
            <select id={fieldId} name="subsection_id" defaultValue={currentSubsectionId ?? ""}>
              <option value="">Testo introduttivo</option>
              {destinations?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </div>
          <p className="field-note">Il testo viene collocato alla fine della destinazione scelta.</p>
        </>
      )}
      <SubmitButton className={direction ? "ghost-button editorial-small-button" : "button"} label={direction ? direction === "up" ? "Sposta su" : "Sposta giù" : "Sposta testo"} pendingLabel="Spostamento..." />
    </form>
  );
}

export function DeleteEditorialTextForm({ block, subsectionId }: { block: KdpSectionBlock; subsectionId?: string }) {
  return (
    <form action={deleteEditorialTextAction} className="inline-form" onSubmit={(event) => {
      if (!window.confirm("Eliminare questo testo?")) event.preventDefault();
    }}>
      <input name="book_id" type="hidden" value={block.book_id} />
      <input name="section_id" type="hidden" value={block.section_id} />
      <EditorialRevisionInput />
      <input name="block_id" type="hidden" value={block.id} />
      <input name="return_to" type="hidden" value={subsectionId ? `#block-${subsectionId}` : `#section-${block.section_id}`} />
      <SubmitButton className="danger-button editorial-small-button" label="Elimina testo" pendingLabel="Eliminazione..." />
    </form>
  );
}
