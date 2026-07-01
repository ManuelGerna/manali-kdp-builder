"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  autosavePageBreakAfterBlockAction,
  autosaveSectionBlockVisibilityAction,
  createImagePlaceholderBlockAction,
  createInternalNoteBlockAction,
  createPageBreakBlockAction,
  createTextBlockAction,
  deleteSectionBlockAction,
  deleteSectionAction,
  moveSectionBlockAction,
  moveSectionAction,
  updateTextBlockAction,
  uploadImageForBlockAction,
  type AutosaveActionState,
} from "@/app/libri/[id]/contenuti/actions";
import { PRINT_VISIBILITY_OPTIONS } from "@/lib/kdp/constants";
import type { KdpAsset } from "@/lib/kdp/assets";
import type {
  KdpSectionBlock,
  MoveSectionBlockDirection,
} from "@/lib/kdp/section-blocks";
import type { MoveSectionDirection } from "@/lib/kdp/sections";

const AUTOSAVE_INITIAL_STATE: AutosaveActionState = {
  message: null,
  savedAt: null,
  status: "idle",
};

function MoveButton({
  disabled,
  label,
}: {
  disabled: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="secondary-button"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "Spostamento..." : label}
    </button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="danger-button"
      disabled={pending}
      type="submit"
    >
      {pending ? "Eliminazione..." : "Elimina"}
    </button>
  );
}

function PlaceholderButton() {
  const { pending } = useFormStatus();

  return (
    <button className="secondary-button" disabled={pending} type="submit">
      {pending ? "Creazione..." : "Crea placeholder"}
    </button>
  );
}

function QuickAddButton({
  pendingLabel,
  submitLabel,
}: {
  pendingLabel: string;
  submitLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className="secondary-button" disabled={pending} type="submit">
      {pending ? pendingLabel : submitLabel}
    </button>
  );
}

function TextBlockButton({
  pendingLabel,
  submitLabel,
}: {
  pendingLabel: string;
  submitLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? pendingLabel : submitLabel}
    </button>
  );
}

function ResetButton({ label = "Annulla modifiche" }: { label?: string }) {
  return (
    <button className="ghost-button" type="reset">
      {label}
    </button>
  );
}

function ImageUploadButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Caricamento..." : "Carica immagine"}
    </button>
  );
}

function AutosaveFeedback({
  pending,
  state,
}: {
  pending: boolean;
  state: AutosaveActionState;
}) {
  if (pending) {
    return (
      <span className="autosave-status autosave-status-loading" role="status">
        Salvataggio...
      </span>
    );
  }

  if (state.status === "idle") {
    return null;
  }

  return (
    <span
      className={`autosave-status autosave-status-${state.status}`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.status === "success" ? "Salvato" : state.message}
    </span>
  );
}

export function MoveSectionForm({
  bookId,
  direction,
  disabled = false,
  sectionId,
}: {
  bookId: string;
  direction: MoveSectionDirection;
  disabled?: boolean;
  sectionId: string;
}) {
  return (
    <form action={moveSectionAction} className="inline-form">
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />
      <input name="direction" type="hidden" value={direction} />
      <MoveButton
        disabled={disabled}
        label={direction === "up" ? "Sposta su" : "Sposta giu"}
      />
    </form>
  );
}

export function MoveSectionBlockForm({
  blockId,
  bookId,
  direction,
  sectionId,
}: {
  blockId: string;
  bookId: string;
  direction: MoveSectionBlockDirection;
  sectionId: string;
}) {
  return (
    <form action={moveSectionBlockAction} className="inline-form block-action-form">
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />
      <input name="block_id" type="hidden" value={blockId} />
      <input name="direction" type="hidden" value={direction} />
      <MoveButton
        disabled={false}
        label={direction === "up" ? "Sposta su" : "Sposta giu"}
      />
    </form>
  );
}

export function DeleteSectionForm({
  bookId,
  sectionId,
  title,
}: {
  bookId: string;
  sectionId: string;
  title: string;
}) {
  return (
    <form
      action={deleteSectionAction}
      className="inline-form"
      onSubmit={(event) => {
        if (!window.confirm(`Eliminare la sezione "${title}"?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />
      <DeleteButton />
    </form>
  );
}

export function DeleteSectionBlockForm({
  blockId,
  bookId,
  label,
  sectionId,
}: {
  blockId: string;
  bookId: string;
  label: string;
  sectionId: string;
}) {
  return (
    <form
      action={deleteSectionBlockAction}
      className="inline-form block-action-form"
      onSubmit={(event) => {
        if (!window.confirm(`Eliminare il blocco "${label}"?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />
      <input name="block_id" type="hidden" value={blockId} />
      <DeleteButton />
    </form>
  );
}

export function PageBreakAfterBlockForm({
  block,
  hasPageBreakAfter,
}: {
  block: Pick<KdpSectionBlock, "book_id" | "id" | "section_id">;
  hasPageBreakAfter: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    autosavePageBreakAfterBlockAction,
    AUTOSAVE_INITIAL_STATE,
  );

  return (
    <form
      action={formAction}
      className="block-page-break-form"
    >
      <input name="book_id" type="hidden" value={block.book_id} />
      <input name="section_id" type="hidden" value={block.section_id} />
      <input name="block_id" type="hidden" value={block.id} />

      <label className="block-toggle-label" htmlFor={`page_break_${block.id}`}>
        <input
          defaultChecked={hasPageBreakAfter}
          id={`page_break_${block.id}`}
          name="page_break_after"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          type="checkbox"
        />
        <span>Interruzione pagina dopo</span>
      </label>

      <AutosaveFeedback pending={pending} state={state} />
    </form>
  );
}

export function UpdateSectionBlockVisibilityForm({
  block,
}: {
  block: Pick<
    KdpSectionBlock,
    "book_id" | "id" | "print_visibility" | "section_id"
  >;
}) {
  const [state, formAction, pending] = useActionState(
    autosaveSectionBlockVisibilityAction,
    AUTOSAVE_INITIAL_STATE,
  );

  return (
    <form
      action={formAction}
      className="block-visibility-form"
    >
      <input name="book_id" type="hidden" value={block.book_id} />
      <input name="section_id" type="hidden" value={block.section_id} />
      <input name="block_id" type="hidden" value={block.id} />

      <label htmlFor={`block_visibility_${block.id}`}>Visibilita PDF</label>
      <select
        defaultValue={block.print_visibility}
        id={`block_visibility_${block.id}`}
        name="print_visibility"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {PRINT_VISIBILITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <AutosaveFeedback pending={pending} state={state} />
    </form>
  );
}

export function UploadImageForBlockForm({
  asset,
  block,
}: {
  asset: Pick<KdpAsset, "alt_text" | "title"> | null;
  block: Pick<
    KdpSectionBlock,
    "body" | "book_id" | "id" | "section_id" | "title"
  >;
}) {
  return (
    <form
      action={uploadImageForBlockAction}
      className="image-upload-form"
      encType="multipart/form-data"
    >
      <input name="book_id" type="hidden" value={block.book_id} />
      <input name="section_id" type="hidden" value={block.section_id} />
      <input name="block_id" type="hidden" value={block.id} />

      <div className="field">
        <label htmlFor={`image_file_${block.id}`}>Carica immagine</label>
        <input
          accept="image/png,image/jpeg,image/webp"
          id={`image_file_${block.id}`}
          name="image_file"
          required
          type="file"
        />
        <p className="field-note">PNG, JPG o WEBP. Dimensione massima 10 MB.</p>
      </div>

      <div className="image-upload-meta-grid">
        <div className="field">
          <label htmlFor={`asset_title_${block.id}`}>Titolo asset</label>
          <input
            defaultValue={asset?.title ?? block.title ?? ""}
            id={`asset_title_${block.id}`}
            name="asset_title"
            placeholder="Titolo immagine"
          />
        </div>

        <div className="field">
          <label htmlFor={`asset_alt_text_${block.id}`}>Alt text</label>
          <input
            defaultValue={asset?.alt_text ?? block.title ?? block.body ?? ""}
            id={`asset_alt_text_${block.id}`}
            name="asset_alt_text"
            placeholder="Descrizione breve dell'immagine"
          />
        </div>
      </div>

      <div className="form-actions">
        <ImageUploadButton />
        <button className="ghost-button" disabled type="button">
          Genera con AI - presto
        </button>
      </div>
    </form>
  );
}

export function CreateImagePlaceholderBlockForm({
  bookId,
  sectionId,
}: {
  bookId: string;
  sectionId: string;
}) {
  return (
    <form action={createImagePlaceholderBlockAction} className="form-grid">
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />

      <div className="field">
        <label htmlFor={`placeholder_title_${sectionId}`}>
          Titolo placeholder
        </label>
        <input
          id={`placeholder_title_${sectionId}`}
          name="placeholder_title"
          placeholder="Es. Illustrazione segno zodiacale"
        />
      </div>

      <div className="field">
        <label htmlFor={`placeholder_prompt_${sectionId}`}>
          Prompt o descrizione immagine
        </label>
        <textarea
          id={`placeholder_prompt_${sectionId}`}
          name="placeholder_prompt"
          placeholder="Descrizione editoriale dell'immagine da creare o sostituire"
        />
      </div>

      <div className="field">
        <label htmlFor={`placeholder_notes_${sectionId}`}>Note interne</label>
        <textarea
          id={`placeholder_notes_${sectionId}`}
          name="placeholder_notes"
          placeholder="Vincoli, fonti, taglio pagina o note per chi impagina"
        />
      </div>

      <PlaceholderButton />
    </form>
  );
}

export function CreatePageBreakBlockForm({
  bookId,
  sectionId,
}: {
  bookId: string;
  sectionId: string;
}) {
  return (
    <form
      action={createPageBreakBlockAction}
      className="inline-form block-action-form"
    >
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />
      <QuickAddButton
        pendingLabel="Creazione..."
        submitLabel="+ Interruzione pagina"
      />
    </form>
  );
}

export function UpdateTextBlockForm({
  block,
}: {
  block: Pick<
    KdpSectionBlock,
    "body" | "book_id" | "id" | "section_id" | "title"
  >;
}) {
  return (
    <form action={updateTextBlockAction} className="form-grid block-edit-form">
      <input name="book_id" type="hidden" value={block.book_id} />
      <input name="section_id" type="hidden" value={block.section_id} />
      <input name="block_id" type="hidden" value={block.id} />

      <div className="field">
        <label htmlFor={`block_title_${block.id}`}>Titolo blocco</label>
        <input
          defaultValue={block.title ?? ""}
          id={`block_title_${block.id}`}
          name="block_title"
          placeholder="Titolo opzionale"
        />
      </div>

      <div className="field">
        <label htmlFor={`block_body_${block.id}`}>Testo blocco</label>
        <textarea
          defaultValue={block.body ?? ""}
          id={`block_body_${block.id}`}
          name="block_body"
          placeholder="Testo usato da anteprima e PDF"
        />
      </div>

      <div className="form-actions">
        <TextBlockButton
          pendingLabel="Salvataggio..."
          submitLabel="Salva blocco"
        />
        <ResetButton />
      </div>
    </form>
  );
}

export function CreateTextBlockForm({
  bookId,
  sectionId,
}: {
  bookId: string;
  sectionId: string;
}) {
  return (
    <form action={createTextBlockAction} className="form-grid block-edit-form">
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />

      <div className="field">
        <label htmlFor={`new_block_title_${sectionId}`}>Titolo blocco</label>
        <input
          id={`new_block_title_${sectionId}`}
          name="block_title"
          placeholder="Titolo opzionale"
        />
      </div>

      <div className="field">
        <label htmlFor={`new_block_body_${sectionId}`}>Testo blocco</label>
        <textarea
          id={`new_block_body_${sectionId}`}
          name="block_body"
          placeholder="Testo usato da anteprima e PDF"
          required
        />
      </div>

      <TextBlockButton
        pendingLabel="Creazione..."
        submitLabel="Aggiungi blocco testo"
      />
    </form>
  );
}

export function CreateInternalNoteBlockForm({
  bookId,
  sectionId,
}: {
  bookId: string;
  sectionId: string;
}) {
  return (
    <form
      action={createInternalNoteBlockAction}
      className="form-grid block-edit-form"
    >
      <input name="book_id" type="hidden" value={bookId} />
      <input name="section_id" type="hidden" value={sectionId} />

      <div className="field">
        <label htmlFor={`new_note_title_${sectionId}`}>Titolo nota</label>
        <input
          id={`new_note_title_${sectionId}`}
          name="note_title"
          placeholder="Es. Da verificare prima del PDF"
        />
      </div>

      <div className="field">
        <label htmlFor={`new_note_body_${sectionId}`}>Nota interna</label>
        <textarea
          id={`new_note_body_${sectionId}`}
          name="note_body"
          placeholder="Promemoria editoriale escluso da anteprima e PDF"
        />
      </div>

      <TextBlockButton pendingLabel="Creazione..." submitLabel="Aggiungi nota" />
    </form>
  );
}
