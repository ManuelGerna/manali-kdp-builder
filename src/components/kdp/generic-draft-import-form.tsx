"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BookVisibilityFieldset } from "@/components/kdp/book-visibility-fieldset";
import {
  buildImportedDraftPreviewSummary,
  canCreateBookFromImportedDraftPreview,
} from "@/lib/kdp/importer/import-preview-summary";
import {
  type BookPage,
  type BookSection,
  type EditorialDraftProject,
  type DraftParserMode,
  type ImportIssue,
  type NormalizedKdpProject,
} from "@/lib/kdp/importer";
import {
  analyzeGenericDraftAction,
  createBookFromGenericDraftAction,
  type CreateBookFromGenericDraftState,
  type GenericDraftImportFormState,
} from "@/app/libri/generic-draft-import-actions";

const initialState: GenericDraftImportFormState = {
  message: null,
  preview: null,
};

const initialCreateState: CreateBookFromGenericDraftState = {
  message: null,
};

const PAGE_PREVIEW_LIMIT = 120;

function isEditorialProject(
  project: EditorialDraftProject | NormalizedKdpProject,
): project is EditorialDraftProject {
  return "kind" in project && project.kind === "editorial";
}

function AnalyzeButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Analisi..." : "Analizza bozza"}
    </button>
  );
}

function CreateBookButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Creazione..." : "Crea libretto da questa bozza"}
    </button>
  );
}

function getReportClass(project: NormalizedKdpProject) {
  if (project.importReport.errors.length > 0) {
    return "form-note form-note-error";
  }

  if (project.importReport.warnings.length > 0) {
    return "form-note form-note-warning";
  }

  return "form-note form-note-success";
}

function getPageStatusClass(status: BookPage["status"]) {
  if (status === "ready") {
    return "section-chip-success";
  }

  if (status === "error") {
    return "section-chip-error";
  }

  return "section-chip-warning";
}

function getSectionStatusClass(status: BookSection["status"]) {
  if (status === "ok") {
    return "section-chip-success";
  }

  if (status === "needs_review") {
    return "section-chip-error";
  }

  return "section-chip-warning";
}

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Non rilevato";
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Non rilevato";
  }

  return String(value);
}

function FieldItem({ label, value }: { label: string; value: unknown }) {
  return (
    <li className="field-row">
      <span className="panel-label">{label}</span>
      <span className="panel-value">{formatValue(value)}</span>
    </li>
  );
}

function IssueList({
  emptyLabel,
  issues,
  title,
  tone,
}: {
  emptyLabel: string;
  issues: ImportIssue[];
  title: string;
  tone: "error" | "warning";
}) {
  return (
    <section
      className={`form-note form-note-${tone}`}
      aria-label={title}
      role={tone === "error" && issues.length > 0 ? "alert" : "status"}
    >
      <strong>{title}</strong>
      {issues.length > 0 ? (
        <ul className="import-warning-list">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${issue.path ?? "issue"}-${index}`}>
              <strong>{issue.code}</strong>
              {": "}
              {issue.message}
              {issue.pageNumber ? ` Pagina ${issue.pageNumber}.` : ""}
              {issue.templateId ? ` Template ${issue.templateId}.` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="section-empty-body">{emptyLabel}</p>
      )}
    </section>
  );
}

function ReportSummary({ project }: { project: NormalizedKdpProject }) {
  const summary = buildImportedDraftPreviewSummary(project);

  return (
    <section className="draft-preview" aria-label="Report importazione bozza">
      <div className="draft-preview-header">
        <div>
          <p className="eyebrow">Anteprima generata</p>
          <h2>Report importazione</h2>
        </div>
        <span
          className={`section-chip ${
            project.importReport.status === "failed"
              ? "section-chip-error"
              : project.importReport.status === "success_with_warnings"
                ? "section-chip-warning"
                : "section-chip-success"
          }`}
        >
          {project.importReport.status}
        </span>
      </div>

      <p className={getReportClass(project)}>
        Questa e solo una anteprima: il progetto non viene ancora salvato e il
        PDF non viene generato.
      </p>

      <dl className="draft-stat-grid">
        <div>
          <dt>Formato rilevato</dt>
          <dd>{summary.formatLabel}</dd>
        </div>
        <div>
          <dt>Pagine generate</dt>
          <dd>{summary.generatedPageCount}</dd>
        </div>
        <div>
          <dt>Warning</dt>
          <dd>{summary.warningCount}</dd>
        </div>
        <div>
          <dt>Errori</dt>
          <dd>{summary.errorCount}</dd>
        </div>
        <div>
          <dt>Target pagine</dt>
          <dd>{summary.targetPageCount ?? "n/d"}</dd>
        </div>
        <div>
          <dt>Parser</dt>
          <dd>{summary.parserVersion}</dd>
        </div>
      </dl>
    </section>
  );
}

function ProjectPanel({ project }: { project: NormalizedKdpProject }) {
  return (
    <section className="draft-section-preview" aria-label="Progetto riconosciuto">
      <div>
        <p className="section-meta">Progetto riconosciuto</p>
        <h3>{project.project.title ?? "Titolo non rilevato"}</h3>
      </div>
      <ul className="panel-list">
        <FieldItem
          label="Formato rilevato"
          value={buildImportedDraftPreviewSummary(project).formatLabel}
        />
        <FieldItem label="Sottotitolo" value={project.project.subtitle} />
        <FieldItem label="Lingua" value={project.project.language} />
        <FieldItem label="Tipo progetto" value={project.project.projectType} />
        <FieldItem label="Tipo libro" value={project.project.bookType} />
        <FieldItem label="Mercato" value={project.project.targetMarket} />
        <FieldItem label="Versione bozza" value={project.source.draftVersion} />
      </ul>
    </section>
  );
}

function TechnicalSpecsPanel({ project }: { project: NormalizedKdpProject }) {
  const specs = project.technicalSpecs;

  return (
    <section className="draft-section-preview" aria-label="Specifiche tecniche">
      <div>
        <p className="section-meta">Specifiche tecniche</p>
        <h3>Formato e impostazioni rilevate</h3>
      </div>
      <ul className="panel-list">
        <FieldItem label="Trim size" value={specs.trimSize} />
        <FieldItem label="Interno" value={specs.interiorColor} />
        <FieldItem label="Carta" value={specs.paperType} />
        <FieldItem label="Bleed" value={specs.bleed} />
        <FieldItem label="Pagine target" value={specs.targetPageCount} />
        <FieldItem label="Orientamento" value={specs.orientation} />
      </ul>
    </section>
  );
}

function SectionsPanel({ sections }: { sections: BookSection[] }) {
  return (
    <section className="draft-section-preview" aria-label="Sezioni generate">
      <div>
        <p className="section-meta">Sezioni</p>
        <h3>Sezioni generate</h3>
      </div>
      {sections.length > 0 ? (
        <ul className="draft-block-list">
          {sections.map((section) => (
            <li className="draft-block-preview" key={section.id}>
              <div className="section-chip-row">
                <span className="section-chip">{section.id}</span>
                <span
                  className={`section-chip ${getSectionStatusClass(
                    section.status,
                  )}`}
                >
                  {section.status}
                </span>
              </div>
              <h4>{section.title}</h4>
              <p className="preview-block-meta">
                Pagine attese: {section.expectedPageCount ?? "n/d"} - Pagine
                assegnate: {section.actualPageCount ?? 0}
              </p>
              {section.warnings?.length ? (
                <p className="section-internal-notes">
                  {section.warnings.join(" ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="section-empty-body">Nessuna sezione rilevata.</p>
      )}
    </section>
  );
}

function PagePreviewItem({ page }: { page: BookPage }) {
  return (
    <li className="draft-block-preview">
      <div className="section-chip-row">
        <span className="section-chip">Pagina {page.pageNumber}</span>
        <span className={`section-chip ${getPageStatusClass(page.status)}`}>
          {page.status}
        </span>
        <span className="section-chip">{page.sourceType}</span>
      </div>
      <h4>{page.title ?? "Senza titolo"}</h4>
      <p className="preview-block-meta">
        template_id: {page.templateId ?? "mancante"}
        {page.sectionId ? ` - sezione: ${page.sectionId}` : ""}
      </p>
      {page.warnings?.length ? (
        <p className="section-internal-notes">{page.warnings.join(" ")}</p>
      ) : null}
      {page.errors?.length ? (
        <p className="form-note form-note-error">{page.errors.join(" ")}</p>
      ) : null}
    </li>
  );
}

function PagesPanel({ pages }: { pages: BookPage[] }) {
  const visiblePages = pages.slice(0, PAGE_PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, pages.length - visiblePages.length);

  return (
    <section className="draft-section-preview" aria-label="Pagine generate">
      <div>
        <p className="section-meta">Pagine generate</p>
        <h3>Anteprima strutturata</h3>
      </div>
      {pages.length > 0 ? (
        <>
          <ul className="draft-block-list">
            {visiblePages.map((page, index) => (
              <PagePreviewItem
                key={`${page.pageNumber}-${page.templateId ?? "missing"}-${index}`}
                page={page}
              />
            ))}
          </ul>
          {hiddenCount > 0 ? (
            <p className="form-note form-note-warning">
              Mostrate le prime {PAGE_PREVIEW_LIMIT} pagine. Altre {hiddenCount}{" "}
              pagine sono state generate ma non visualizzate in questa lista.
            </p>
          ) : null}
        </>
      ) : (
        <p className="section-empty-body">Nessuna pagina generata.</p>
      )}
    </section>
  );
}

function TemplatesPanel({ project }: { project: NormalizedKdpProject }) {
  return (
    <section className="draft-section-preview" aria-label="Template richiesti">
      <div>
        <p className="section-meta">Template</p>
        <h3>Template richiesti e mancanti</h3>
      </div>
      <ul className="panel-list">
        <FieldItem
          label="Richiesti"
          value={project.templates.requestedTemplateIds}
        />
        <FieldItem label="Definiti" value={project.templates.definedTemplateIds} />
        <FieldItem label="Trovati" value={project.templates.foundTemplateIds} />
        <FieldItem label="Mancanti" value={project.templates.missingTemplateIds} />
      </ul>
    </section>
  );
}

function SeparatedBlocksPanel({ project }: { project: NormalizedKdpProject }) {
  return (
    <section
      className="draft-section-preview"
      aria-label="Blocchi separati riconosciuti"
    >
      <div>
        <p className="section-meta">Blocchi separati</p>
        <h3>Copertina, metadati KDP e checklist</h3>
      </div>
      <ul className="panel-list">
        <FieldItem
          label="Brief copertina"
          value={project.coverBrief ? "Riconosciuto" : "Non rilevato"}
        />
        <FieldItem
          label="Titolo copertina"
          value={project.coverBrief?.title}
        />
        <FieldItem
          label="Metadati KDP"
          value={project.kdpMetadata ? "Riconosciuti" : "Non rilevati"}
        />
        <FieldItem label="Titolo KDP" value={project.kdpMetadata?.title} />
        <FieldItem
          label="Checklist"
          value={project.qualityChecklist ? "Riconosciuta" : "Non rilevata"}
        />
        <FieldItem
          label="Checklist interno"
          value={project.qualityChecklist?.interior}
        />
      </ul>
    </section>
  );
}

function GenericDraftPreview({ project }: { project: NormalizedKdpProject }) {
  return (
    <section className="draft-preview" aria-label="Anteprima import bozza">
      <ReportSummary project={project} />
      <IssueList
        emptyLabel="Nessun errore bloccante rilevato."
        issues={project.importReport.errors}
        title="Errori"
        tone="error"
      />
      <IssueList
        emptyLabel="Nessun warning rilevato."
        issues={project.importReport.warnings}
        title="Warning"
        tone="warning"
      />
      <ProjectPanel project={project} />
      <TechnicalSpecsPanel project={project} />
      <TemplatesPanel project={project} />
      <SectionsPanel sections={project.sections} />
      <PagesPanel pages={project.pages} />
      <SeparatedBlocksPanel project={project} />
    </section>
  );
}

function EditorialDraftPreview({ project }: { project: EditorialDraftProject }) {
  return (
    <section className="draft-preview" aria-label="Anteprima manoscritto editoriale">
      <section className="draft-preview" aria-label="Report importazione editoriale">
        <div className="draft-preview-header">
          <div>
            <p className="eyebrow">Anteprima generata</p>
            <h2>Struttura editoriale</h2>
          </div>
          <span
            className={`section-chip ${
              project.errors.length > 0
                ? "section-chip-error"
                : project.warnings.length > 0
                  ? "section-chip-warning"
                  : "section-chip-success"
            }`}
          >
            {project.errors.length > 0 ? "failed" : "ready"}
          </span>
        </div>

        <p className="form-note form-note-success">
          Il parser ha creato soltanto struttura modificabile. Nessuna pagina e
          nessuna impaginazione sono state generate.
        </p>

        <dl className="draft-stat-grid">
          <div><dt>Formato rilevato</dt><dd>{project.format}</dd></div>
          <div><dt>Titolo</dt><dd>{project.title ?? "Non rilevato"}</dd></div>
          <div><dt>Sottotitolo</dt><dd>{project.subtitle ?? "Non rilevato"}</dd></div>
          <div><dt>Capitoli</dt><dd>{project.summary.chapterCount}</dd></div>
          <div><dt>Sottosezioni</dt><dd>{project.summary.subsectionCount}</dd></div>
          <div><dt>Blocchi</dt><dd>{project.summary.blockCount}</dd></div>
          <div><dt>Annotazioni pagina ignorate</dt><dd>{project.summary.annotationCount}</dd></div>
          <div><dt>Parser</dt><dd>{project.parserVersion}</dd></div>
        </dl>
      </section>

      <section className="form-note form-note-error" aria-label="Errori">
        <strong>Errori</strong>
        {project.errors.length > 0 ? (
          <ul className="import-warning-list">
            {project.errors.map((issue) => <li key={issue.code}><strong>{issue.code}</strong>: {issue.message}</li>)}
          </ul>
        ) : <p className="section-empty-body">Nessun errore bloccante rilevato.</p>}
      </section>

      <section className="form-note form-note-warning" aria-label="Warning">
        <strong>Warning</strong>
        {project.warnings.length > 0 ? (
          <ul className="import-warning-list">
            {project.warnings.map((issue) => <li key={issue.code}><strong>{issue.code}</strong>: {issue.message}</li>)}
          </ul>
        ) : <p className="section-empty-body">Nessun warning rilevato.</p>}
      </section>

      {project.sections.map((section) => (
        <section className="draft-section-preview" key={section.id}>
          <div>
            <p className="section-meta">{section.kind}</p>
            <h3>{section.title ?? "Introduzione senza intestazione"}</h3>
          </div>
          {section.blocks.map((block) => (
            <div className="draft-block-preview" key={block.id}>
              <span className="section-chip">{block.type}</span>
              <p className="section-body-preview">{block.text}</p>
            </div>
          ))}
          {section.subsections.map((subsection) => (
            <div className="draft-block-preview" key={subsection.id}>
              <p className="section-meta">Sottosezione</p>
              <h4>{subsection.title}</h4>
              {subsection.blocks.map((block) => (
                <div key={block.id}>
                  <span className="section-chip">{block.type}</span>
                  <p className="section-body-preview">{block.text}</p>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </section>
  );
}

function CreateBookFromDraftPanel({
  draftType,
  draftText,
  project,
}: {
  draftType: DraftParserMode;
  draftText: string;
  project: EditorialDraftProject | NormalizedKdpProject;
}) {
  const [state, formAction] = useActionState(
    createBookFromGenericDraftAction,
    initialCreateState,
  );

  const canCreate = isEditorialProject(project)
    ? project.errors.length === 0 && Boolean(project.title) && project.sections.length > 0
    : canCreateBookFromImportedDraftPreview(project);

  if (!canCreate) {
    return (
      <section className="draft-section-preview" aria-label="Crea libretto">
        <div>
          <p className="section-meta">Salvataggio</p>
          <h3>Correggi la bozza prima di creare il libretto</h3>
        </div>
        <p className="form-note form-note-error" role="status">
          Il salvataggio viene abilitato solo quando la preview non contiene
          errori bloccanti e contiene una struttura salvabile.
        </p>
      </section>
    );
  }

  return (
    <section className="draft-section-preview" aria-label="Crea libretto">
      <div>
        <p className="section-meta">Salvataggio</p>
        <h3>Crea un libretto salvato</h3>
      </div>
      <p className="form-note form-note-success" role="status">
        La bozza verra riparsata lato server. Verranno creati libro,
        impostazioni, sezioni, blocchi modificabili e report import. Le pagine
        vengono salvate soltanto per i formati strutturati che le dichiarano.
        Nessun PDF verra generato.
      </p>
      <form action={formAction} className="form-grid">
        {state.message ? (
          <p className="form-note form-note-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <input name="draft_text" type="hidden" value={draftText} />
        <input name="draft_type" type="hidden" value={draftType} />
        <BookVisibilityFieldset defaultValue={state.fields?.visibility} />
        <CreateBookButton />
      </form>
    </section>
  );
}

export function GenericDraftImportForm({
  enableCreateBook = false,
}: {
  enableCreateBook?: boolean;
}) {
  const [state, formAction] = useActionState(
    analyzeGenericDraftAction,
    initialState,
  );
  const draftText = state.fields?.draft_text ?? "";
  const draftType = state.fields?.draft_type ?? "structured";

  return (
    <div className="draft-import-workspace">
      <form action={formAction} className="form-grid">
        {state.message ? (
          <p className="form-note form-note-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <p className="form-note form-note-warning" role="status">
          {enableCreateBook
            ? "Scegli il tipo di importazione e genera prima l'anteprima. Libro editoriale accetta testo naturale senza header; il libro viene salvato solo dopo una preview valida."
            : "Scegli esplicitamente il parser. Libro editoriale accetta testo naturale senza header; questa schermata non salva dati e non genera PDF."}
        </p>

        <fieldset className="visibility-fieldset">
          <legend>Tipo di importazione</legend>
          <div className="visibility-options">
            <label className="radio-field">
              <input
                defaultChecked={draftType === "structured"}
                name="draft_type"
                type="radio"
                value="structured"
              />
              <span className="radio-field-main">
                <span>Bozza strutturata</span>
                <small>KDP_DRAFT_V1 o formato legacy con pagine dichiarate.</small>
              </span>
            </label>
            <label className="radio-field">
              <input
                defaultChecked={draftType === "editorial"}
                name="draft_type"
                type="radio"
                value="editorial"
              />
              <span className="radio-field-main">
                <span>Libro editoriale</span>
                <small>Manoscritto naturale senza header tecnico obbligatorio.</small>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="generic_draft_text">Manoscritto o bozza strutturata</label>
          <textarea
            className="draft-import-textarea"
            defaultValue={draftText}
            id="generic_draft_text"
            name="draft_text"
            placeholder="Incolla qui il manoscritto naturale o la bozza strutturata"
          />
        </div>

        <AnalyzeButton />
      </form>

      {state.preview ? (
        <>
          {isEditorialProject(state.preview) ? (
            <EditorialDraftPreview project={state.preview} />
          ) : (
            <GenericDraftPreview project={state.preview} />
          )}
          {enableCreateBook ? (
            <CreateBookFromDraftPanel
              draftType={draftType}
              draftText={draftText}
              project={state.preview}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
