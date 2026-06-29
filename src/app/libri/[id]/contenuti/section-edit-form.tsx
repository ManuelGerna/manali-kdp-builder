"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateSectionAction,
  type SectionFormState,
} from "@/app/libri/[id]/contenuti/actions";
import {
  SECTION_TYPES,
  SECTION_TYPE_OPTIONS,
  type SectionType,
} from "@/lib/kdp/constants";
import type { KdpSection } from "@/lib/kdp/sections";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Salvataggio..." : "Salva modifiche"}
    </button>
  );
}

function getEditableSectionType(sectionType: string): SectionType {
  if (SECTION_TYPES.includes(sectionType as SectionType)) {
    return sectionType as SectionType;
  }

  return "chapter";
}

export function SectionEditForm({ section }: { section: KdpSection }) {
  const initialState: SectionFormState = {
    message: null,
    fields: {
      section_type: getEditableSectionType(section.section_type),
      title: section.title ?? "",
      body: section.body ?? "",
    },
  };

  const [state, formAction] = useActionState(
    updateSectionAction,
    initialState,
  );

  return (
    <form action={formAction} className="form-grid section-edit-form">
      <input name="book_id" type="hidden" value={section.book_id} />
      <input name="section_id" type="hidden" value={section.id} />

      {state.message ? (
        <p className="form-note" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor={`section_type_${section.id}`}>Tipo sezione</label>
        <select
          defaultValue={
            state.fields?.section_type ||
            getEditableSectionType(section.section_type)
          }
          id={`section_type_${section.id}`}
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
        <label htmlFor={`title_${section.id}`}>Titolo</label>
        <input
          defaultValue={state.fields?.title ?? section.title ?? ""}
          id={`title_${section.id}`}
          name="title"
          placeholder="Titolo sezione"
        />
      </div>

      <div className="field">
        <label htmlFor={`body_${section.id}`}>Corpo</label>
        <textarea
          defaultValue={state.fields?.body ?? section.body ?? ""}
          id={`body_${section.id}`}
          name="body"
          placeholder="Testo della sezione"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
