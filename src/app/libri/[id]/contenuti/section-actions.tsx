"use client";

import { useFormStatus } from "react-dom";
import {
  createImagePlaceholderBlockAction,
  deleteSectionAction,
  moveSectionAction,
} from "@/app/libri/[id]/contenuti/actions";
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
    <button className="secondary-button danger-button" disabled={pending} type="submit">
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
        <label htmlFor={`placeholder_title_${sectionId}`}>Titolo placeholder</label>
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
