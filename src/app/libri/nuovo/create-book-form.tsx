"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createBook, type CreateBookFormState } from "@/app/libri/nuovo/actions";
import { AI_USAGE_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/kdp/constants";

const initialState: CreateBookFormState = {
  message: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Creazione..." : "Crea libretto"}
    </button>
  );
}

export function CreateBookForm() {
  const [state, formAction] = useActionState(createBook, initialState);

  return (
    <form action={formAction} className="form-grid">
      {state.message ? (
        <p className="form-note form-note-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="title">Titolo</label>
        <input
          id="title"
          name="title"
          placeholder="Titolo del libretto"
          required
          defaultValue={state.fields?.title ?? ""}
        />
      </div>

      <div className="field">
        <label htmlFor="subtitle">Sottotitolo</label>
        <input
          id="subtitle"
          name="subtitle"
          placeholder="Sottotitolo opzionale"
          defaultValue={state.fields?.subtitle ?? ""}
        />
      </div>

      <div className="form-compact-grid">
        <div className="field">
          <label htmlFor="author_name">Autore / pen name</label>
          <input
            id="author_name"
            name="author_name"
            placeholder="Nome autore"
            required
            defaultValue={state.fields?.author_name ?? ""}
          />
        </div>

        <div className="field">
          <label htmlFor="language">Lingua</label>
          <select
            id="language"
            name="language"
            defaultValue={state.fields?.language ?? "it"}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="ai_usage_type">Uso AI</label>
          <select
            id="ai_usage_type"
            name="ai_usage_type"
            defaultValue={state.fields?.ai_usage_type ?? "none"}
          >
            {AI_USAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
