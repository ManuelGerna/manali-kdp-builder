"use client";

import { useFormStatus } from "react-dom";
import {
  createImagePlaceholderBlockAction,
  createTextBlockAction,
  deleteSectionAction,
  moveSectionAction,
  updateTextBlockAction,
} from "@/app/libri/[id]/contenuti/actions";
import type { KdpSectionBlock } from "@/lib/kdp/section-blocks";
import type { MoveSectionDirection } from "@/lib/kdp/sections";

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
      className="secondary-button danger-button"
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

      <TextBlockButton
        pendingLabel="Salvataggio..."
        submitLabel="Salva blocco"
      />
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

      <TextBlockButton pendingLabel="Creazione..." submitLabel="Aggiungi" />
    </form>
  );
}
