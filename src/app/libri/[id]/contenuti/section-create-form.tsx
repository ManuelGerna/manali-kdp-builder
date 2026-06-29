"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createSectionAction,
  type SectionFormState,
} from "@/app/libri/[id]/contenuti/actions";
import { SECTION_TYPE_OPTIONS } from "@/lib/kdp/constants";

const initialState: SectionFormState = {
  message: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Aggiunta..." : "Aggiungi sezione"}
    </button>
  );
}

export function SectionCreateForm({ bookId }: { bookId: string }) {
  const [state, formAction] = useActionState(
    createSectionAction,
    initialState,
  );

  return (
    <form action={formAction} className="form-grid">
      <input name="book_id" type="hidden" value={bookId} />

      {state.message ? (
        <p className="form-note" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="section_type_new">Tipo sezione</label>
        <select
          defaultValue={state.fields?.section_type || "chapter"}
          id="section_type_new"
          name="section_type"
        >
          {SECTION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="title_new">Titolo</label>
        <input
          defaultValue={state.fields?.title ?? ""}
          id="title_new"
          name="title"
          placeholder="Titolo sezione"
        />
      </div>

      <div className="field">
        <label htmlFor="body_new">Corpo</label>
        <textarea
          defaultValue={state.fields?.body ?? ""}
          id="body_new"
          name="body"
          placeholder="Testo della sezione"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
