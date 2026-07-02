import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ImportedPrintPreviewDocument } from "@/components/kdp/imported-print-preview";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getBookDetail } from "@/lib/kdp/books";
import { buildImportedPrintRenderModel } from "@/lib/kdp/imported-page-print-renderer";
import { getImportedPagesReadModel } from "@/lib/kdp/imported-pages";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type ImportedPagesTechnicalRenderPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ImportedPagesTechnicalRenderPage({
  params,
}: ImportedPagesTechnicalRenderPageProps) {
  const { id } = await params;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Renderer tecnico"
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
        title="Renderer tecnico"
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
        eyebrow="Renderer tecnico"
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

  const { book, sections, settings } = detailResult.data;
  const importedPagesResult = await getImportedPagesReadModel(supabase, {
    bookId: book.id,
    sections,
  });

  if (importedPagesResult.data === null) {
    return (
      <AppShell
        title="Renderer tecnico"
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
  const renderModel = buildImportedPrintRenderModel({
    bookSettings: settings
      ? {
          trimSize: settings.trim_size,
        }
      : null,
    normalizedProject: importedPages.importRun?.normalized_project ?? null,
    pages: importedPages.pages.map((page) => ({
      content: page.content,
      pageNumber: page.page_number,
      sourceType: page.source_type,
      status: page.status,
      templateId: page.template_id,
      title: page.title,
    })),
  });

  return (
    <AppShell
      title="Renderer tecnico"
      eyebrow={book.title}
      description="Preview tecnica print-safe delle pagine importate. Non genera PDF e non avvia export KDP."
      actions={
        <>
          <Link
            className="secondary-button"
            href={`/libri/${book.id}/pagine-importate`}
          >
            Torna alle pagine importate
          </Link>
          <Link
            className="secondary-button"
            href={`/libri/${book.id}/pagine-importate/anteprima`}
          >
            Anteprima visuale
          </Link>
        </>
      }
    >
      {renderModel.pages.length === 0 ? (
        <EmptyState
          action={
            <Link
              className="secondary-button"
              href={`/libri/${book.id}/importa`}
            >
              Importa bozza
            </Link>
          }
          title="Nessuna pagina da renderizzare"
          description="Questo libretto non ha ancora pagine normalizzate in kdp_imported_pages."
        />
      ) : (
        <div className="content-layout imported-print-layout">
          <Card title="Anteprima tecnica stampa">
            <p className="page-copy">
              {renderModel.pages.length} pagine renderizzate come fogli tecnici
              con area sicura e margini simulati. Questa vista prepara il lavoro
              del futuro PDF, ma non genera file.
            </p>
            <dl className="draft-stat-grid">
              <div>
                <dt>Formato</dt>
                <dd>{renderModel.settings.pageSize.label}</dd>
              </div>
              <div>
                <dt>Margine interno</dt>
                <dd>{renderModel.settings.margins.insideIn} in</dd>
              </div>
              <div>
                <dt>Margine esterno</dt>
                <dd>{renderModel.settings.margins.outsideIn} in</dd>
              </div>
              <div>
                <dt>Warning tecnici</dt>
                <dd>{renderModel.warnings.length}</dd>
              </div>
            </dl>
          </Card>

          <ImportedPrintPreviewDocument model={renderModel} />
        </div>
      )}
    </AppShell>
  );
}
