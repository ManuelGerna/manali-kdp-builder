"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateSectionAction,
  type SectionFormState,
} from "@/app/libri/[id]/contenuti/actions";
import {
  SECTION_LAYOUT_PRESET_OPTIONS,
  SECTION_LAYOUT_PRESETS,
  SECTION_STATUSES,
  SECTION_STATUS_OPTIONS,
  SECTION_TYPES,
  SECTION_TYPE_OPTIONS,
  type SectionLayoutPreset,
  type SectionStatus,
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

function getEditableSectionStatus(sectionStatus: string): SectionStatus {
  if (SECTION_STATUSES.includes(sectionStatus as SectionStatus)) {
    return sectionStatus as SectionStatus;
  }

  return "draft";
}

function getEditableLayoutPreset(layoutPreset: string): SectionLayoutPreset {
  if (SECTION_LAYOUT_PRESETS.includes(layoutPreset as SectionLayoutPreset)) {
    return layoutPreset as SectionLayoutPreset;
  }

  return "default";
}

export function SectionEditForm({ section }: { section: KdpSection }) {
  const initialState: SectionFormState = {
    message: null,
    fields: {
      section_type: getEditableSectionType(section.section_type),
      title: section.title ?? "",
      subtitle: section.subtitle ?? "",
      body: section.body ?? "",
      include_in_toc: section.include_in_toc ? "true" : "false",
      section_status: getEditableSectionStatus(section.section_status),
      page_break_before: section.page_break_before ? "true" : "false",
      layout_preset: getEditableLayoutPreset(section.layout_preset),
      editor_notes: section.editor_notes ?? "",
    },
  };

  const [state, formAction] = useActionState(
    updateSectionAction,
    initialState,
  );
  const includeInToc = state.fields?.include_in_toc !== "false";
  const pageBreakBefore = state.fields?.page_break_before === "true";

  return (
    <form action={formAction} className="form-grid section-edit-form">
      <input name="book_id" type="hidden" value={section.book_id} />
      <input name="section_id" type="hidden" value={section.id} />

      {state.message ? (
        <p className="form-note form-note-error" role="alert">
          {state.message}
        </p>
      ) : null}

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
        <label htmlFor={`subtitle_${section.id}`}>Sottotitolo</label>
        <input
          defaultValue={state.fields?.subtitle ?? section.subtitle ?? ""}
          id={`subtitle_${section.id}`}
          name="subtitle"
          placeholder="Sottotitolo opzionale"
        />
      </div>

      <div className="form-compact-grid">
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
          <label htmlFor={`section_status_${section.id}`}>
            Stato editoriale
          </label>
          <select
            defaultValue={
              state.fields?.section_status ||
              getEditableSectionStatus(section.section_status)
            }
            id={`section_status_${section.id}`}
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
          <label htmlFor={`layout_preset_${section.id}`}>Layout sezione</label>
          <select
            defaultValue={
              state.fields?.layout_preset ||
              getEditableLayoutPreset(section.layout_preset)
            }
            id={`layout_preset_${section.id}`}
            name="layout_preset"
          >
            {SECTION_LAYOUT_PRESET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <label
          className="checkbox-field"
          htmlFor={`include_in_toc_${section.id}`}
        >
          <input
            defaultChecked={includeInToc}
            id={`include_in_toc_${section.id}`}
            name="include_in_toc"
            type="checkbox"
          />
          <span>Mostra in indice</span>
        </label>

        <label
          className="checkbox-field"
          htmlFor={`page_break_before_${section.id}`}
        >
          <input
            defaultChecked={pageBreakBefore}
            id={`page_break_before_${section.id}`}
            name="page_break_before"
            type="checkbox"
          />
          <span>Page break prima</span>
        </label>
      </div>

      <div className="field">
        <label htmlFor={`body_${section.id}`}>Testo pubblicabile</label>
        <textarea
          defaultValue={state.fields?.body ?? section.body ?? ""}
          id={`body_${section.id}`}
          name="body"
          placeholder="Testo finale destinato al PDF"
        />
      </div>

      <div className="field">
        <label htmlFor={`editor_notes_${section.id}`}>Note interne</label>
        <textarea
          defaultValue={state.fields?.editor_notes ?? section.editor_notes ?? ""}
          id={`editor_notes_${section.id}`}
          name="editor_notes"
          placeholder="Note editoriali non destinate alla stampa"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
