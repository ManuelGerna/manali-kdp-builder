import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { DownloadTextButton } from "@/components/ui/download-text-button";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import { listAssets } from "@/lib/kdp/assets";
import { getBookDetail } from "@/lib/kdp/books";
import {
  INTERIOR_TYPE_LABELS,
  PAPER_TYPE_LABELS,
  TRIM_SIZE_LABELS,
  type InteriorType,
  type PaperType,
  type TrimSize,
} from "@/lib/kdp/constants";
import {
  buildBookPreview,
  formatBookPreviewAsText,
  getBookPreviewTextFileName,
  type PreviewBlock,
} from "@/lib/kdp/preview";
import { listSectionBlocks } from "@/lib/kdp/section-blocks";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type BookPreviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatTrimSize(trimSize: string) {
  return TRIM_SIZE_LABELS[trimSize as TrimSize] ?? trimSize;
}

function formatInteriorType(interiorType: string) {
  return (
    INTERIOR_TYPE_LABELS[interiorType as InteriorType] ??
    interiorType.replaceAll("_", " ")
  );
}

function formatPaperType(paperType: string) {
  return PAPER_TYPE_LABELS[paperType as PaperType] ?? paperType;
}

function getImagePrompt(block: PreviewBlock) {
  return block.body || block.assetPrompt || block.assetAltText || null;
}

function PreviewBlockView({ block }: { block: PreviewBlock }) {
  if (block.isPageBreak) {
    return (
      <div className="preview-page-break">
        <span>Interruzione pagina</span>
      </div>
    );
  }

  if (block.isImagePlaceholder) {
    const prompt = getImagePrompt(block);

    return (
      <div className="preview-image-placeholder">
        <p className="preview-image-label">
          {block.title || block.assetTitle || "Immagine placeholder"}
        </p>
        {prompt ? <p>{prompt}</p> : null}
      </div>
    );
  }

  return (
    <div className={`preview-block preview-block-${block.blockType}`}>
      <p className="preview-block-meta">
        {block.sortOrder}. {block.blockTypeLabel}
      </p>
      {block.title ? <h4>{block.title}</h4> : null}
      {block.body ? <p className="preview-body">{block.body}</p> : null}
    </div>
  );
}

export default async function BookPreviewPage({
  params,
}: BookPreviewPageProps) {
  const { id } = await params;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Anteprima libretto"
        eyebrow="Preview"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili dedicate a KDP Builder per leggere l'anteprima reale."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Anteprima libretto"
        eyebrow="Preview"
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
        eyebrow="Anteprima"
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
  const blocksResult = await listSectionBlocks(supabase, book.id);

  if (blocksResult.data === null) {
    return (
      <AppShell
        title="Errore"
        eyebrow={book.title}
        description={blocksResult.error}
        actions={
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState title="Errore" description={blocksResult.error} />
      </AppShell>
    );
  }

  const assetsResult = await listAssets(supabase, book.id);

  if (assetsResult.data === null) {
    return (
      <AppShell
        title="Errore"
        eyebrow={book.title}
        description={assetsResult.error}
        actions={
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState title="Errore" description={assetsResult.error} />
      </AppShell>
    );
  }

  const preview = buildBookPreview({
    assets: assetsResult.data,
    blocks: blocksResult.data,
    book,
    sections,
    settings,
  });
  const previewText = formatBookPreviewAsText(preview);
  const previewFilename = getBookPreviewTextFileName(book.title);

  return (
    <AppShell
      title="Anteprima libretto"
      eyebrow={book.title}
      description="Contenuto ordinato, indice automatico e soli elementi destinati alla stampa."
      actions={
        <>
          <DownloadTextButton
            content={previewText}
            filename={previewFilename}
            label="Scarica anteprima .txt"
          />
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
        </>
      }
    >
      {sections.length === 0 ? (
        <EmptyState
          action={
            <Link className="button" href={`/libri/${book.id}/contenuti`}>
              Aggiungi contenuti
            </Link>
          }
          title="Anteprima vuota"
          description="Questo libretto non ha ancora sezioni da mostrare."
        />
      ) : (
        <div className="preview-layout">
          <Card title="Indice">
            {preview.toc.length === 0 ? (
              <p className="preview-empty">
                Nessuna sezione marcata per l&apos;indice.
              </p>
            ) : (
              <ol className="preview-toc-list">
                {preview.toc.map((item) => (
                  <li className="preview-toc-item" key={item.id}>
                    <span className="preview-toc-index">{item.index}</span>
                    <div>
                      <h3>{item.title}</h3>
                      {item.subtitle ? <p>{item.subtitle}</p> : null}
                      <span>
                        {item.sectionTypeLabel} - {item.layoutPresetLabel}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Formato">
            {settings ? (
              <ul className="panel-list">
                <FieldRow
                  label="Trim size"
                  value={formatTrimSize(settings.trim_size)}
                />
                <FieldRow
                  label="Interno"
                  value={formatInteriorType(settings.interior_type)}
                />
                <FieldRow
                  label="Carta"
                  value={formatPaperType(settings.paper_type)}
                />
                <FieldRow
                  label="Font corpo"
                  value={`${settings.body_font} ${settings.body_font_size} pt`}
                />
                <FieldRow label="Line height" value={settings.line_height} />
              </ul>
            ) : (
              <p className="preview-empty">
                Impostazioni KDP non trovate per questo libretto.
              </p>
            )}
          </Card>

          <section className="preview-paper" aria-label="Anteprima contenuto">
            {preview.sections.map((section) => (
              <article className="preview-section" key={section.id}>
                {section.pageBreakBefore ? (
                  <div className="preview-page-break">
                    <span>Interruzione pagina prima della sezione</span>
                  </div>
                ) : null}

                <p className="preview-section-meta">
                  {section.index}. {section.sectionTypeLabel} -{" "}
                  {section.layoutPresetLabel}
                </p>
                <h2>{section.title}</h2>
                {section.subtitle ? (
                  <p className="preview-subtitle">{section.subtitle}</p>
                ) : null}
                {section.body ? (
                  <p className="preview-body">{section.body}</p>
                ) : null}

                {section.blocks.length > 0 ? (
                  <div className="preview-block-list">
                    {section.blocks.map((block) => (
                      <PreviewBlockView block={block} key={block.id} />
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        </div>
      )}
    </AppShell>
  );
}
