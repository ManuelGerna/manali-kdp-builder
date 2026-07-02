"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type {
  BookPage,
  BookSection,
  ImportIssue,
  NormalizedKdpProject,
} from "@/lib/kdp/importer";
import {
  analyzeGenericDraftAction,
  type GenericDraftImportFormState,
} from "./actions";

const initialState: GenericDraftImportFormState = {
  message: null,
  preview: null,
};

const PAGE_PREVIEW_LIMIT = 120;

function AnalyzeButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Analisi..." : "Analizza bozza"}
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
  const summary = project.importReport.summary;

  return (
    <section className="draft-preview" aria-label="Report importazione V0">
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
          <dt>Pagine generate</dt>
          <dd>{summary.generatedPageCount}</dd>
        </div>
        <div>
          <dt>Sezioni</dt>
          <dd>{summary.sectionCount}</dd>
        </div>
        <div>
          <dt>Template</dt>
          <dd>{summary.requestedTemplateCount}</dd>
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
                Pagine attese: {section.expectedPageCount ?? "n/d"} · Pagine
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
        {page.sectionId ? ` · sezione: ${page.sectionId}` : ""}
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
    <section className="draft-preview" aria-label="Anteprima Parser V0">
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

export function GenericDraftImportForm() {
  const [state, formAction] = useActionState(
    analyzeGenericDraftAction,
    initialState,
  );
  const draftText = state.fields?.draft_text ?? "";

  return (
    <div className="draft-import-workspace">
      <form action={formAction} className="form-grid">
        {state.message ? (
          <p className="form-note form-note-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <p className="form-note form-note-warning" role="status">
          Anteprima preview-only: nessun dato viene salvato, nessuna RPC viene
          chiamata e nessun PDF viene generato.
        </p>

        <div className="field">
          <label htmlFor="generic_draft_text">Bozza strutturata</label>
          <textarea
            className="draft-import-textarea"
            defaultValue={draftText}
            id="generic_draft_text"
            name="draft_text"
            placeholder="Incolla qui una bozza KDP Builder strutturata"
          />
        </div>

        <AnalyzeButton />
      </form>

      {state.preview ? <GenericDraftPreview project={state.preview} /> : null}
    </div>
  );
}
