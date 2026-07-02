import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ImportedPagePreview } from "@/components/kdp/imported-page-preview";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getBookDetail } from "@/lib/kdp/books";
import {
  getImportedPagesReadModel,
  groupImportedPagesBySection,
} from "@/lib/kdp/imported-pages";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type ImportedPagesVisualPreviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ImportedPagesVisualPreviewPage({
  params,
}: ImportedPagesVisualPreviewPageProps) {
  const { id } = await params;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Anteprima visuale"
        eyebrow="Pagine importate"
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
        title="Anteprima visuale"
        eyebrow="Pagine importate"
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
        eyebrow="Anteprima visuale"
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
        title="Anteprima visuale"
        eyebrow={book.title}
        description={importedPagesResult.error}
        actions={
          <Link
            className="secondary-button"
            href={`/libri/${book.id}/pagine-importate`}
          >
            Torna alle pagine importate
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
      title="Anteprima visuale"
      eyebrow={book.title}
      description="Mini preview HTML delle pagine importate. Non genera PDF e non modifica i contenuti salvati."
      actions={
        <>
          <Link
            className="secondary-button"
            href={`/libri/${book.id}/pagine-importate`}
          >
            Torna alle pagine importate
          </Link>
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
        </>
      }
    >
      {summary.pageCount === 0 ? (
        <EmptyState
          action={
            <Link
              className="secondary-button"
              href={`/libri/${book.id}/importa`}
            >
              Importa bozza
            </Link>
          }
          title="Nessuna pagina da visualizzare"
          description="Questo libretto non ha ancora pagine normalizzate in kdp_imported_pages."
        />
      ) : (
        <div className="content-layout imported-visual-preview-layout">
          <Card title="Anteprima visuale">
            <p className="page-copy">
              {summary.pageCount} pagine importate, {summary.sectionCount}{" "}
              sezioni e {summary.templateCount} template rilevati. Questa vista
              aiuta a leggere la struttura come pagina stampabile, ma non e un
              renderer PDF finale.
            </p>
            <dl className="draft-stat-grid">
              <div>
                <dt>Pagine</dt>
                <dd>{summary.pageCount}</dd>
              </div>
              <div>
                <dt>Sezioni</dt>
                <dd>{summary.sectionCount}</dd>
              </div>
              <div>
                <dt>Template</dt>
                <dd>{summary.templateCount}</dd>
              </div>
              <div>
                <dt>Senza sezione</dt>
                <dd>{summary.unassignedPageCount}</dd>
              </div>
            </dl>
          </Card>

          {groups.map((group) => (
            <section
              className="imported-preview-section"
              key={group.key}
              aria-label={group.title}
            >
              <div className="draft-preview-header">
                <div>
                  <p className="section-meta">
                    {group.section
                      ? `Sezione ${group.section.sort_order}`
                      : "Gruppo pagine"}
                  </p>
                  <h2>{group.title}</h2>
                </div>
                <span className="section-chip">
                  {group.pages.length} pagine
                </span>
              </div>

              <div className="imported-page-preview-grid">
                {group.pages.map((page) => (
                  <ImportedPagePreview
                    content={page.content}
                    key={page.id}
                    pageNumber={page.page_number}
                    sourceType={page.source_type}
                    status={page.status}
                    templateId={page.template_id}
                    title={page.title}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
