import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import { getBookDetail } from "@/lib/kdp/books";
import {
  getImportedPagesReadModel,
  groupImportedPagesBySection,
  type ImportedPageGroup,
  type KdpImportedPage,
} from "@/lib/kdp/imported-pages";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type ImportedPagesPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Non disponibile";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatPrimitive(value: Json) {
  if (value === null || value === undefined) {
    return "Non rilevato";
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  return String(value);
}

function getStatusChipClass(status: string) {
  if (status === "imported") {
    return "section-chip-success";
  }

  if (status === "invalid") {
    return "section-chip-error";
  }

  return "section-chip-warning";
}

function renderJsonValue(value: Json, depth = 0): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const visibleItems = value.slice(0, 8);
    const hiddenCount = value.length - visibleItems.length;

    return (
      <ul className="import-warning-list">
        {visibleItems.map((item, index) => (
          <li key={`${index}-${JSON.stringify(item).slice(0, 40)}`}>
            {renderJsonValue(item, depth + 1)}
          </li>
        ))}
        {hiddenCount > 0 ? <li>Altri {hiddenCount} elementi...</li> : null}
      </ul>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).filter(
      ([, item]) => item !== undefined,
    );

    if (entries.length === 0) {
      return "{}";
    }

    if (depth >= 2) {
      return (
        <details className="section-details-panel">
          <summary className="ghost-button section-edit-toggle">
            Mostra dettagli
          </summary>
          <pre className="section-body-preview">
            {JSON.stringify(value, null, 2)}
          </pre>
        </details>
      );
    }

    return (
      <ul className="panel-list panel-list-long">
        {entries.slice(0, 12).map(([key, item]) => (
          <li className="field-row" key={key}>
            <span className="panel-label">{formatLabel(key)}</span>
            <span className="panel-value">
              {renderJsonValue(item ?? null, depth + 1)}
            </span>
          </li>
        ))}
        {entries.length > 12 ? (
          <li className="field-row">
            <span className="panel-label">Altri campi</span>
            <span className="panel-value">{entries.length - 12}</span>
          </li>
        ) : null}
      </ul>
    );
  }

  return formatPrimitive(value);
}

function CounterList({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort(([first], [second]) =>
    first.localeCompare(second),
  );

  if (entries.length === 0) {
    return <span className="section-chip">Nessun dato</span>;
  }

  return (
    <div className="section-chip-row">
      {entries.map(([key, count]) => (
        <span className="section-chip" key={key}>
          {formatLabel(key)}: {count}
        </span>
      ))}
    </div>
  );
}

function ImportedPageCard({ page }: { page: KdpImportedPage }) {
  return (
    <li className="draft-block-preview">
      <div className="section-chip-row">
        <span className="section-chip">Pagina {page.page_number}</span>
        <span className={`section-chip ${getStatusChipClass(page.status)}`}>
          {formatLabel(page.status)}
        </span>
        <span className="section-chip">
          {formatLabel(page.source_type ?? "source non rilevata")}
        </span>
      </div>
      <h4>{page.title || "Senza titolo"}</h4>
      <p className="preview-block-meta">
        template_id: {page.template_id ?? "mancante"}
        {page.source_ref ? ` - source_ref: ${page.source_ref}` : ""}
      </p>

      {Array.isArray(page.warnings) && page.warnings.length > 0 ? (
        <p className="form-note form-note-warning">
          Warning: {page.warnings.map(String).join(" ")}
        </p>
      ) : null}

      {Array.isArray(page.errors) && page.errors.length > 0 ? (
        <p className="form-note form-note-error">
          Errori: {page.errors.map(String).join(" ")}
        </p>
      ) : null}

      <details className="section-details-panel">
        <summary className="ghost-button section-edit-toggle">
          Contenuto normalizzato
        </summary>
        {renderJsonValue(page.content)}
      </details>
    </li>
  );
}

function ImportedPageGroupSection({ group }: { group: ImportedPageGroup }) {
  return (
    <section className="draft-section-preview" aria-label={group.title}>
      <div className="draft-preview-header">
        <div>
          <p className="section-meta">
            {group.section
              ? `Sezione ${group.section.sort_order}`
              : "Gruppo pagine"}
          </p>
          <h3>{group.title}</h3>
        </div>
        <span className="section-chip">{group.pages.length} pagine</span>
      </div>

      <ul className="draft-block-list">
        {group.pages.map((page) => (
          <ImportedPageCard key={page.id} page={page} />
        ))}
      </ul>
    </section>
  );
}

export default async function ImportedPagesPage({
  params,
}: ImportedPagesPageProps) {
  const { id } = await params;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Pagine importate"
        eyebrow="Parser/Importer V0"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili dedicate a KDP Builder per leggere le pagine importate."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Pagine importate"
        eyebrow="Parser/Importer V0"
        description="Supabase non disponibile."
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState
          title="Supabase non disponibile"
          description="Non riesco a inizializzare il collegamento al database."
        />
      </AppShell>
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const detailResult = await getBookDetail(supabase, id);

  if (detailResult.data === null) {
    return (
      <AppShell
        title={detailResult.notFound ? "Libretto non trovato" : "Errore"}
        eyebrow="Pagine importate"
        description={detailResult.error}
        actions={
          <Link className="secondary-button" href="/libri">
            Torna ai libri
          </Link>
        }
      >
        <EmptyState
          title={detailResult.notFound ? "Libretto non trovato" : "Errore"}
          description={detailResult.error}
        />
      </AppShell>
    );
  }

  const { book, sections } = detailResult.data;
  const importedPagesResult = await getImportedPagesReadModel(supabase, {
    bookId: book.id,
    sections,
  });

  if (importedPagesResult.data === null) {
    return (
      <AppShell
        title="Pagine importate"
        eyebrow={book.title}
        description={importedPagesResult.error}
        actions={
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState title="Errore" description={importedPagesResult.error} />
      </AppShell>
    );
  }

  const importedPages = importedPagesResult.data;
  const groups = groupImportedPagesBySection(importedPages.pages, sections);
  const summary = importedPages.summary;

  return (
    <AppShell
      title="Pagine importate"
      eyebrow={book.title}
      description="Pagine normalizzate salvate dal Parser/Importer V0."
      actions={
        <>
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
          {summary.pageCount > 0 ? (
            <Link
              className="button"
              href={`/libri/${book.id}/pagine-importate/anteprima`}
            >
              Anteprima visuale
            </Link>
          ) : null}
          <Link
            className="secondary-button"
            href={`/libri/${book.id}/contenuti`}
          >
            Editor blocchi
          </Link>
        </>
      }
    >
      {summary.pageCount === 0 ? (
        <EmptyState
          action={
            <Link className="secondary-button" href={`/libri/${book.id}/importa`}>
              Importa bozza
            </Link>
          }
          title="Nessuna pagina importata"
          description="Questo libretto non ha ancora pagine normalizzate in kdp_imported_pages."
        />
      ) : (
        <div className="content-layout">
          <Card title="Pagine importate">
            <p className="page-copy">
              {summary.pageCount} pagine generate dalla bozza e salvate come
              pagine normalizzate. Questa vista non modifica editor a blocchi
              e non genera PDF.
            </p>
            <dl className="draft-stat-grid">
              <div>
                <dt>Pagine importate</dt>
                <dd>{summary.pageCount}</dd>
              </div>
              <div>
                <dt>Sezioni</dt>
                <dd>{summary.sectionCount}</dd>
              </div>
              <div>
                <dt>Template usati</dt>
                <dd>{summary.templateCount}</dd>
              </div>
              <div>
                <dt>Senza sezione</dt>
                <dd>{summary.unassignedPageCount}</dd>
              </div>
            </dl>
            <ul className="panel-list panel-list-long">
              <FieldRow
                label="Import run"
                value={importedPages.importRun?.import_kind ?? "Non rilevato"}
              />
              <FieldRow
                label="Parser"
                value={importedPages.importRun?.parser_version ?? "Non rilevato"}
              />
              <FieldRow
                label="Versione bozza"
                value={
                  importedPages.importRun?.source_draft_version ??
                  "Non rilevata"
                }
              />
              <FieldRow
                label="Creato"
                value={formatDate(importedPages.importRun?.created_at)}
              />
            </ul>
          </Card>

          <section className="draft-section-preview" aria-label="Riepilogo">
            <div>
              <p className="section-meta">Riepilogo</p>
              <h3>Status, source e template</h3>
            </div>
            <h4>Status pagine</h4>
            <CounterList counts={summary.statusCounts} />
            <h4>Source type</h4>
            <CounterList counts={summary.sourceTypeCounts} />
            <h4>Template</h4>
            <p className="section-empty-body">
              {summary.templateIds.length > 0
                ? summary.templateIds.join(", ")
                : "Nessun template rilevato."}
            </p>
          </section>

          {groups.map((group) => (
            <ImportedPageGroupSection group={group} key={group.key} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
