"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createSectionAction,
  type SectionFormState,
} from "@/app/libri/[id]/contenuti/actions";
import {
  SECTION_LAYOUT_PRESET_OPTIONS,
  SECTION_STATUS_OPTIONS,
  SECTION_TYPE_OPTIONS,
} from "@/lib/kdp/constants";

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
  const includeInToc = state.fields?.include_in_toc !== "false";
  const pageBreakBefore = state.fields?.page_break_before === "true";

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
        <label htmlFor="subtitle_new">Sottotitolo</label>
        <input
          defaultValue={state.fields?.subtitle ?? ""}
          id="subtitle_new"
          name="subtitle"
          placeholder="Sottotitolo opzionale"
        />
      </div>

      <div className="field">
        <label htmlFor="section_status_new">Stato editoriale</label>
        <select
          defaultValue={state.fields?.section_status || "draft"}
          id="section_status_new"
          name="section_status"
        >
          {SECTION_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="layout_preset_new">Layout sezione</label>
        <select
          defaultValue={state.fields?.layout_preset || "default"}
          id="layout_preset_new"
          name="layout_preset"
        >
          {SECTION_LAYOUT_PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <label className="checkbox-field" htmlFor="include_in_toc_new">
        <input
          defaultChecked={includeInToc}
          id="include_in_toc_new"
          name="include_in_toc"
          type="checkbox"
        />
        <span>Mostra in indice</span>
      </label>

      <label className="checkbox-field" htmlFor="page_break_before_new">
        <input
          defaultChecked={pageBreakBefore}
          id="page_break_before_new"
          name="page_break_before"
          type="checkbox"
        />
        <span>Interruzione pagina prima della sezione</span>
      </label>

      <div className="field">
        <label htmlFor="body_new">Testo pubblicabile</label>
        <textarea
          defaultValue={state.fields?.body ?? ""}
          id="body_new"
          name="body"
          placeholder="Testo finale destinato al PDF"
        />
      </div>

      <div className="field">
        <label htmlFor="editor_notes_new">Note interne</label>
        <textarea
          defaultValue={state.fields?.editor_notes ?? ""}
          id="editor_notes_new"
          name="editor_notes"
          placeholder="Note editoriali non destinate alla stampa"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
