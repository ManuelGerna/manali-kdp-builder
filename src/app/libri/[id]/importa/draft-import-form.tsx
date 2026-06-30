"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type {
  DraftImportBlock,
  DraftImportResult,
  DraftImportSection,
} from "@/lib/kdp/draft-import";
import {
  analyzeDraftAction,
  importDraftAction,
  type DraftImportFormState,
} from "./actions";

const initialState: DraftImportFormState = {
  message: null,
  preview: null,
};

function AnalyzeButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Analisi..." : "Analizza bozza"}
    </button>
  );
}

function ImportButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Import in corso..." : "Importa nel libretto"}
    </button>
  );
}

function getBlockLabel(block: DraftImportBlock) {
  if (block.blockType === "image_prompt") {
    return "Immagine placeholder";
  }

  if (block.blockType === "page_break") {
    return "Page break";
  }

  return "Testo";
}

function DraftBlockPreview({ block }: { block: DraftImportBlock }) {
  return (
    <li className={`draft-block-preview draft-block-${block.blockType}`}>
      <p className="preview-block-meta">{getBlockLabel(block)}</p>
      {block.title ? <h4>{block.title}</h4> : null}
      {block.body ? <p className="preview-body">{block.body}</p> : null}
      {block.prompt ? (
        <p className="draft-prompt-preview">Prompt: {block.prompt}</p>
      ) : null}
      {block.editorNotes ? (
        <p className="section-internal-notes">{block.editorNotes}</p>
      ) : null}
    </li>
  );
}

function DraftSectionPreview({
  index,
  section,
}: {
  index: number;
  section: DraftImportSection;
}) {
  return (
    <article className="draft-section-preview">
      <div>
        <p className="section-meta">Sezione {index + 1}</p>
        <h3>{section.title}</h3>
      </div>

      {section.editorNotes.length > 0 ? (
        <div className="draft-notes-preview">
          <p className="preview-block-meta">Note interne rilevate</p>
          <ul>
            {section.editorNotes.map((note, noteIndex) => (
              <li key={`${section.title}-${noteIndex}`}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {section.blocks.length > 0 ? (
        <ul className="draft-block-list">
          {section.blocks.map((block, blockIndex) => (
            <DraftBlockPreview
              block={block}
              key={`${section.title}-${block.blockType}-${blockIndex}`}
            />
          ))}
        </ul>
      ) : (
        <p className="section-empty-body">Nessun blocco stampabile.</p>
      )}
    </article>
  );
}

function DraftPreview({
  bookId,
  draftText,
  preview,
}: {
  bookId: string;
  draftText: string;
  preview: DraftImportResult;
}) {
  return (
    <section className="draft-preview" aria-label="Preview import bozza">
      <div className="draft-preview-header">
        <div>
          <p className="eyebrow">Preview import</p>
          <h2>Sezioni rilevate</h2>
        </div>
        <form action={importDraftAction} className="draft-import-confirm-form">
          <input name="book_id" type="hidden" value={bookId} />
          <textarea hidden name="draft_text" readOnly value={draftText} />
          <ImportButton />
        </form>
      </div>

      <dl className="draft-stat-grid">
        <div>
          <dt>Sezioni</dt>
          <dd>{preview.stats.sectionCount}</dd>
        </div>
        <div>
          <dt>Blocchi</dt>
          <dd>{preview.stats.blockCount}</dd>
        </div>
        <div>
          <dt>Immagini</dt>
          <dd>{preview.stats.imageCount}</dd>
        </div>
        <div>
          <dt>Note</dt>
          <dd>{preview.stats.noteCount}</dd>
        </div>
        <div>
          <dt>Page break</dt>
          <dd>{preview.stats.pageBreakCount}</dd>
        </div>
      </dl>

      <div className="draft-section-list">
        {preview.sections.map((section, index) => (
          <DraftSectionPreview
            index={index}
            key={`${section.title}-${index}`}
            section={section}
          />
        ))}
      </div>
    </section>
  );
}

export function DraftImportForm({ bookId }: { bookId: string }) {
  const [state, formAction] = useActionState(analyzeDraftAction, initialState);
  const draftText = state.fields?.draft_text ?? "";

  return (
    <div className="draft-import-workspace">
      <form action={formAction} className="form-grid">
        <input name="book_id" type="hidden" value={bookId} />

        {state.message ? (
          <p className="form-note" role="alert">
            {state.message}
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="draft_text">Bozza strutturata</label>
          <textarea
            className="draft-import-textarea"
            defaultValue={draftText}
            id="draft_text"
            name="draft_text"
            placeholder="Incolla qui la bozza lunga del libretto"
          />
        </div>

        <AnalyzeButton />
      </form>

      {state.preview ? (
        <DraftPreview
          bookId={bookId}
          draftText={draftText}
          preview={state.preview}
        />
      ) : null}
    </div>
  );
}
