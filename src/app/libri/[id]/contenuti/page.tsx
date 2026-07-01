import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import { listAssets, type KdpAsset } from "@/lib/kdp/assets";
import {
  getImportRunReport,
  type DraftImportReport,
} from "@/lib/kdp/import-runs";
import { formatInternalOwner } from "@/lib/kdp/ownership";
import {
  ASSET_STATUS_LABELS,
  BLOCK_TYPE_LABELS,
  PRINT_VISIBILITY_LABELS,
  SECTION_LAYOUT_PRESET_LABELS,
  SECTION_STATUS_LABELS,
  SECTION_TYPE_LABELS,
  type AssetStatus,
  type BlockType,
  type PrintVisibility,
  type SectionLayoutPreset,
  type SectionStatus,
  type SectionType,
} from "@/lib/kdp/constants";
import {
  listSectionBlocks,
  type KdpSectionBlock,
} from "@/lib/kdp/section-blocks";
import { listSections, type KdpSection } from "@/lib/kdp/sections";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import {
  CreateImagePlaceholderBlockForm,
  CreateInternalNoteBlockForm,
  CreateTextBlockForm,
  DeleteSectionBlockForm,
  DeleteSectionForm,
  MoveSectionBlockForm,
  MoveSectionForm,
  PageBreakAfterBlockForm,
  UpdateSectionBlockVisibilityForm,
  UpdateTextBlockForm,
  UploadImageForBlockForm,
} from "./section-actions";
import { SectionCreateForm } from "./section-create-form";
import { SectionEditForm } from "./section-edit-form";

type BookContentsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    run?: string;
    status?: string;
  }>;
};

type BookForContents = Pick<
  Tables<"kdp_books">,
  "id" | "subtitle" | "title"
>;

type BookResult =
  | {
      data: BookForContents;
      error: null;
      notFound: false;
    }
  | {
      data: null;
      error: string;
      notFound: boolean;
    };

const STATUS_MESSAGES: Record<string, string> = {
  block_created: "Placeholder immagine creato.",
  block_deleted: "Blocco contenuto eliminato.",
  block_reordered: "Ordine blocchi aggiornato.",
  block_updated: "Blocco testo aggiornato.",
  block_visibility_updated: "Visibilita blocco aggiornata.",
  image_uploaded: "Immagine caricata.",
  created: "Sezione creata.",
  deleted: "Sezione eliminata.",
  imported: "Import completato.",
  internal_note_created: "Nota interna aggiunta.",
  page_break_inserted: "Interruzione pagina inserita.",
  page_break_removed: "Interruzione pagina rimossa.",
  page_break_unchanged: "Interruzione pagina gia corretta.",
  reordered: "Ordine sezioni aggiornato.",
  text_block_created: "Blocco testo creato.",
  updated: "Sezione aggiornata.",
};

async function getBookForContents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookId: string,
): Promise<BookResult> {
  const { data, error } = await supabase
    .from("kdp_books")
    .select("id,title,subtitle")
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    console.error("[kdp-sections:page]", {
      event: "book_query_failed",
      bookIdTail: bookId.slice(-8),
      code: error.code,
    });

    return {
      data: null,
      error: "Non riesco a caricare questo libretto.",
      notFound: false,
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Libretto non trovato o non accessibile.",
      notFound: true,
    };
  }

  return {
    data,
    error: null,
    notFound: false,
  };
}

function formatSectionType(sectionType: string) {
  return (
    SECTION_TYPE_LABELS[sectionType as SectionType] ??
    sectionType.replaceAll("_", " ")
  );
}

function formatSectionStatus(sectionStatus: string) {
  return (
    SECTION_STATUS_LABELS[sectionStatus as SectionStatus] ??
    sectionStatus.replaceAll("_", " ")
  );
}

function formatLayoutPreset(layoutPreset: string) {
  return (
    SECTION_LAYOUT_PRESET_LABELS[layoutPreset as SectionLayoutPreset] ??
    layoutPreset.replaceAll("_", " ")
  );
}

function formatBlockType(blockType: string) {
  return (
    BLOCK_TYPE_LABELS[blockType as BlockType] ?? blockType.replaceAll("_", " ")
  );
}

function formatPrintVisibility(printVisibility: string) {
  return (
    PRINT_VISIBILITY_LABELS[printVisibility as PrintVisibility] ??
    printVisibility.replaceAll("_", " ")
  );
}

function formatAssetStatus(assetStatus: string) {
  return (
    ASSET_STATUS_LABELS[assetStatus as AssetStatus] ??
    assetStatus.replaceAll("_", " ")
  );
}

function getSectionStatusChipClass(sectionStatus: string) {
  if (sectionStatus === "ready") {
    return "section-chip-success";
  }

  if (sectionStatus === "needs_review") {
    return "section-chip-error";
  }

  if (sectionStatus === "archived") {
    return "section-chip-warning";
  }

  return "";
}

function getPrintVisibilityChipClass(printVisibility: string) {
  if (printVisibility === "print") {
    return "section-chip-success";
  }

  if (printVisibility === "internal_only") {
    return "section-chip-warning";
  }

  return "section-chip-error";
}

function getPrintVisibilityOutputLabel(printVisibility: string) {
  return printVisibility === "print" ? "Nel PDF" : "Fuori PDF";
}

function getAssetStatusChipClass(assetStatus: string) {
  if (assetStatus === "uploaded" || assetStatus === "approved") {
    return "section-chip-success";
  }

  if (assetStatus === "rejected") {
    return "section-chip-error";
  }

  return "section-chip-warning";
}

function getStorageFileName(filePath: string) {
  return filePath.split("/").at(-1) ?? filePath;
}

function groupBlocksBySection(blocks: KdpSectionBlock[]) {
  const grouped = new Map<string, KdpSectionBlock[]>();

  for (const block of blocks) {
    const sectionBlocks = grouped.get(block.section_id) ?? [];
    sectionBlocks.push(block);
    grouped.set(block.section_id, sectionBlocks);
  }

  for (const sectionBlocks of grouped.values()) {
    sectionBlocks.sort((first, second) => {
      if (first.sort_order !== second.sort_order) {
        return first.sort_order - second.sort_order;
      }

      return first.created_at.localeCompare(second.created_at);
    });
  }

  return grouped;
}

function isVisibleContentBlock(block: KdpSectionBlock) {
  return block.block_type !== "page_break";
}

function isPrintableContentBlock(block: KdpSectionBlock) {
  return (
    block.print_visibility === "print" &&
    block.block_type !== "internal_note" &&
    block.block_type !== "page_break"
  );
}

async function getAssetPreviewUrlMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assets: KdpAsset[],
) {
  const previewableAssets = assets.filter(
    (asset) =>
      asset.file_path &&
      (asset.status === "uploaded" || asset.status === "approved"),
  );
  const entries = await Promise.all(
    previewableAssets.map(async (asset) => {
      const { data, error } = await supabase.storage
        .from("kdp-assets")
        .createSignedUrl(asset.file_path as string, 60 * 60);

      return [asset.id, error ? null : data.signedUrl] as const;
    }),
  );

  return new Map(entries);
}

function canTogglePageBreakAfterBlock(block: KdpSectionBlock) {
  return (
    block.print_visibility === "print" &&
    block.block_type !== "internal_note" &&
    block.block_type !== "page_break"
  );
}

function hasImmediatePageBreakAfter(blocks: KdpSectionBlock[], blockId: string) {
  const blockIndex = blocks.findIndex((block) => block.id === blockId);

  return (
    blockIndex >= 0 && blocks[blockIndex + 1]?.block_type === "page_break"
  );
}

function getPageMessage(searchParams: { error?: string; status?: string }) {
  if (searchParams.error) {
    return {
      tone: "error" as const,
      text: searchParams.error,
    };
  }

  if (searchParams.status && STATUS_MESSAGES[searchParams.status]) {
    return {
      tone: "status" as const,
      text: STATUS_MESSAGES[searchParams.status],
    };
  }

  return null;
}

function ImportReportSummary({ report }: { report: DraftImportReport }) {
  return (
    <Card className="import-report-card" title="Report import">
      <dl className="draft-stat-grid import-report-grid">
        <div>
          <dt>Sezioni create</dt>
          <dd>{report.sectionCount}</dd>
        </div>
        <div>
          <dt>Blocchi creati</dt>
          <dd>{report.blockCount}</dd>
        </div>
        <div>
          <dt>Immagini placeholder</dt>
          <dd>{report.imagePlaceholderCount}</dd>
        </div>
        <div>
          <dt>Warning</dt>
          <dd>{report.warningCount}</dd>
        </div>
      </dl>

      {report.duplicate ? (
        <p className="form-note form-note-warning">
          Submit gia registrato: non sono stati creati duplicati.
        </p>
      ) : null}

      {report.warnings.length > 0 ? (
        <ul className="import-warning-list">
          {report.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p className="form-note form-note-success">
          Import completato senza warning.
        </p>
      )}
    </Card>
  );
}

function ImageAssetPanel({
  asset,
  block,
  previewUrl,
}: {
  asset: KdpAsset | null;
  block: KdpSectionBlock;
  previewUrl: string | null;
}) {
  const title = asset?.title || block.title || "Placeholder immagine";
  const altText = asset?.alt_text || title;

  return (
    <div className="image-asset-panel">
      <div className="image-asset-header">
        <div>
          <p className="section-meta">Asset immagine</p>
          <p className="image-asset-title">{title}</p>
        </div>
        <span
          className={`section-chip ${
            asset
              ? getAssetStatusChipClass(asset.status)
              : "section-chip-warning"
          }`}
        >
          {asset ? formatAssetStatus(asset.status) : "Asset mancante"}
        </span>
      </div>

      {asset?.file_path ? (
        <p className="field-note">
          File caricato: {getStorageFileName(asset.file_path)}
        </p>
      ) : (
        <p className="field-note">
          Nessun file caricato. Il PDF tecnico continua a usare il placeholder.
        </p>
      )}

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="image-asset-preview" src={previewUrl} alt={altText} />
      ) : asset?.file_path ? (
        <p className="field-note">
          Preview non disponibile. Verifica bucket e policy Storage.
        </p>
      ) : null}

      <UploadImageForBlockForm asset={asset} block={block} />
    </div>
  );
}

function SectionCard({
  assetById,
  assetPreviewUrls,
  blocks,
  index,
  isFirst,
  isLast,
  section,
}: {
  assetById: Map<string, KdpAsset>;
  assetPreviewUrls: Map<string, string | null>;
  blocks: KdpSectionBlock[];
  index: number;
  isFirst: boolean;
  isLast: boolean;
  section: KdpSection;
}) {
  const title = section.title || "Senza titolo";
  const includeInToc = section.include_in_toc !== false;
  const visibleBlocks = blocks.filter(isVisibleContentBlock);
  const hasPrintableContentBlocks = visibleBlocks.some(isPrintableContentBlock);
  const printableBlockCount = visibleBlocks.filter(
    isPrintableContentBlock,
  ).length;

  return (
    <article className="section-card">
      <div className="section-card-header">
        <div className="section-card-title-area">
          <p className="section-meta">
            Sezione {index + 1} - {formatSectionType(section.section_type)}
          </p>
          <h2>{title}</h2>
          {section.subtitle ? (
            <p className="section-subtitle">{section.subtitle}</p>
          ) : null}
        </div>

        <div className="section-actions section-actions-compact">
          <MoveSectionForm
            bookId={section.book_id}
            direction="up"
            disabled={isFirst}
            sectionId={section.id}
          />
          <MoveSectionForm
            bookId={section.book_id}
            direction="down"
            disabled={isLast}
            sectionId={section.id}
          />
          <DeleteSectionForm
            bookId={section.book_id}
            sectionId={section.id}
            title={title}
          />
        </div>
      </div>

      <div className="section-chip-row" aria-label="Metadati sezione">
        <span
          className={`section-chip ${getSectionStatusChipClass(
            section.section_status,
          )}`}
        >
          {formatSectionStatus(section.section_status)}
        </span>
        <span className="section-chip">
          Indice: {includeInToc ? "si" : "no"}
        </span>
        <span className="section-chip">Blocchi: {visibleBlocks.length}</span>
        <span className="section-chip">Stampabili: {printableBlockCount}</span>
        <span className="section-chip">
          Layout: {formatLayoutPreset(section.layout_preset)}
        </span>
        {section.page_break_before ? (
          <span className="section-chip">Page break prima</span>
        ) : null}
      </div>

      <details className="section-details-panel">
        <summary className="ghost-button section-edit-toggle">
          Dettagli sezione
        </summary>
        <p className="section-owner-meta">
          Creato da: {formatInternalOwner(section.created_by_email)} - Ultima
          modifica: {formatInternalOwner(section.updated_by_email)}
        </p>

        <div className="section-content-grid">
          <section className="section-content-area">
            <h3>Fallback tecnico</h3>
            {section.body ? (
              <p className="section-body-preview">{section.body}</p>
            ) : (
              <p className="section-empty-body">
                section.body vuoto. Anteprima e PDF useranno i blocchi
                stampabili quando presenti.
              </p>
            )}
            {hasPrintableContentBlocks ? (
              <p className="field-note">
                I blocchi stampabili hanno priorita su questo fallback.
              </p>
            ) : null}
          </section>

          <section className="section-content-area">
            <h3>Note interne sezione</h3>
            {section.editor_notes ? (
              <p className="section-internal-notes">{section.editor_notes}</p>
            ) : (
              <p className="section-empty-body">Nessuna nota interna.</p>
            )}
          </section>
        </div>
      </details>

      <section className="section-blocks-panel">
        <div className="section-blocks-header">
          <h3>Blocchi contenuto</h3>
          <span className="section-chip">{visibleBlocks.length} totali</span>
        </div>
        <p className="section-panel-note">
          Aggiungi e riordina i blocchi della sezione. Solo i blocchi
          stampabili finiscono in anteprima e PDF.
        </p>

        {visibleBlocks.length > 0 ? (
          <ul className="section-block-list">
            {visibleBlocks.map((block, blockIndex) => {
              const blockTypeLabel = formatBlockType(block.block_type);
              const blockLabel = block.title || blockTypeLabel;
              const hasPageBreakAfter = hasImmediatePageBreakAfter(
                blocks,
                block.id,
              );
              const showPageBreakToggle = canTogglePageBreakAfterBlock(block);
              const isInternalNote = block.block_type === "internal_note";
              const blockAsset = block.asset_id
                ? assetById.get(block.asset_id) ?? null
                : null;
              const previewUrl = blockAsset
                ? assetPreviewUrls.get(blockAsset.id) ?? null
                : null;

              return (
                <li
                  className={`section-block-item section-block-item-${block.block_type}`}
                  key={block.id}
                >
                  <div className="section-block-item-header">
                    <p className="section-meta">
                      {blockIndex + 1}. {blockTypeLabel}
                    </p>
                    <div
                      className="section-chip-row"
                      aria-label="Visibilita blocco"
                    >
                      <span
                        className={`section-chip ${getPrintVisibilityChipClass(
                          block.print_visibility,
                        )}`}
                      >
                        {formatPrintVisibility(block.print_visibility)}
                      </span>
                      <span
                        className={`section-chip ${getPrintVisibilityChipClass(
                          block.print_visibility,
                        )}`}
                      >
                        {getPrintVisibilityOutputLabel(block.print_visibility)}
                      </span>
                    </div>
                  </div>
                  {block.title ? <h4>{block.title}</h4> : null}
                  {block.body ? (
                    <p
                      className={
                        isInternalNote
                          ? "section-internal-notes"
                          : "section-body-preview"
                      }
                    >
                      {block.body}
                    </p>
                  ) : null}
                  {block.editor_notes ? (
                    <p className="section-internal-notes">
                      {block.editor_notes}
                    </p>
                  ) : null}
                  {block.block_type === "image_prompt" ? (
                    <ImageAssetPanel
                      asset={blockAsset}
                      block={block}
                      previewUrl={previewUrl}
                    />
                  ) : null}
                  <div className="section-block-controls">
                    <div
                      className="section-block-action-group section-block-primary-actions"
                      aria-label="Azioni principali blocco"
                    >
                      {block.block_type === "text" ? (
                        <details className="block-edit-panel block-inline-edit-panel">
                          <summary className="secondary-button section-edit-toggle block-edit-toggle">
                            Modifica blocco
                          </summary>
                          <UpdateTextBlockForm block={block} />
                        </details>
                      ) : null}
                      {blockIndex > 0 ? (
                        <MoveSectionBlockForm
                          blockId={block.id}
                          bookId={block.book_id}
                          direction="up"
                          sectionId={block.section_id}
                        />
                      ) : null}
                      {blockIndex < visibleBlocks.length - 1 ? (
                        <MoveSectionBlockForm
                          blockId={block.id}
                          bookId={block.book_id}
                          direction="down"
                          sectionId={block.section_id}
                        />
                      ) : null}
                      <DeleteSectionBlockForm
                        blockId={block.id}
                        bookId={block.book_id}
                        label={blockLabel}
                        sectionId={block.section_id}
                      />
                    </div>
                    <div
                      className="section-block-action-group section-block-output-actions"
                      aria-label="Output PDF blocco"
                    >
                      <UpdateSectionBlockVisibilityForm block={block} />
                      {showPageBreakToggle ? (
                        <PageBreakAfterBlockForm
                          block={block}
                          hasPageBreakAfter={hasPageBreakAfter}
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="section-empty-body">
            Nessun blocco in questa sezione. Inizia da un blocco testo.
          </p>
        )}

        <div className="block-add-toolbar" aria-label="Aggiungi blocco">
          <details className="section-edit-panel block-add-panel">
            <summary className="secondary-button section-edit-toggle">
              + Blocco testo
            </summary>
            <CreateTextBlockForm
              bookId={section.book_id}
              sectionId={section.id}
            />
          </details>

          <details className="section-edit-panel block-add-panel">
            <summary className="secondary-button section-edit-toggle">
              + Placeholder immagine
            </summary>
            <CreateImagePlaceholderBlockForm
              bookId={section.book_id}
              sectionId={section.id}
            />
          </details>
          <details className="section-edit-panel block-add-panel">
            <summary className="secondary-button section-edit-toggle">
              + Nota interna
            </summary>
            <CreateInternalNoteBlockForm
              bookId={section.book_id}
              sectionId={section.id}
            />
          </details>
        </div>
      </section>

      <details className="section-edit-panel">
        <summary className="ghost-button section-edit-toggle section-settings-toggle">
          Modifica sezione
        </summary>
        <SectionEditForm
          hasContentBlocks={hasPrintableContentBlocks}
          section={section}
        />
      </details>
    </article>
  );
}

export default async function BookContentsPage({
  params,
  searchParams,
}: BookContentsPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Contenuti libretto"
        eyebrow="Sezioni"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili dedicate a KDP Builder per gestire le sezioni."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Contenuti libretto"
        eyebrow="Sezioni"
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

  const bookResult = await getBookForContents(supabase, id);

  if (bookResult.data === null) {
    return (
      <AppShell
        title={bookResult.notFound ? "Libretto non trovato" : "Errore"}
        eyebrow="Sezioni"
        description={bookResult.error}
        actions={
          <Link className="secondary-button" href="/libri">
            Torna ai libri
          </Link>
        }
      >
        <EmptyState
          title={bookResult.notFound ? "Libretto non trovato" : "Errore"}
          description={bookResult.error}
        />
      </AppShell>
    );
  }

  const sectionsResult = await listSections(supabase, id);

  if (sectionsResult.data === null) {
    return (
      <AppShell
        title="Errore"
        eyebrow={bookResult.data.title}
        description={sectionsResult.error}
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState title="Errore" description={sectionsResult.error} />
      </AppShell>
    );
  }

  const book = bookResult.data;
  const sections = sectionsResult.data;
  const blocksResult = await listSectionBlocks(supabase, id);
  const assetsResult = await listAssets(supabase, id);
  const blocks = blocksResult.data ?? [];
  const visibleBlocks = blocks.filter(isVisibleContentBlock);
  const assets = assetsResult.data ?? [];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const assetPreviewUrls = await getAssetPreviewUrlMap(supabase, assets);
  const blocksBySection = groupBlocksBySection(blocks);
  const sectionsInToc = sections.filter(
    (section) => section.include_in_toc !== false,
  ).length;
  const placeholderAssets = assets.filter(
    (asset) => asset.status === "placeholder",
  ).length;
  const dataWarnings = [
    blocksResult.data === null ? blocksResult.error : null,
    assetsResult.data === null ? assetsResult.error : null,
  ].filter((warning): warning is string => Boolean(warning));
  const importReportResult = resolvedSearchParams.run
    ? await getImportRunReport(supabase, {
        bookId: book.id,
        importToken: resolvedSearchParams.run,
      })
    : null;
  const pageMessage = getPageMessage(resolvedSearchParams);

  return (
    <AppShell
      title="Contenuti libretto"
      eyebrow={book.title}
      description={
        book.subtitle || "Editor manuale per sezioni, blocchi e controllo PDF."
      }
      actions={
        <>
          <a className="button" href="#nuova-sezione">
            + Aggiungi sezione
          </a>
          <Link
            className="secondary-button"
            href={`/libri/${book.id}/anteprima`}
          >
            Anteprima
          </Link>
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
        </>
      }
    >
      <div className="content-layout">
        {pageMessage ? (
          <p
            className={`form-note form-note-${
              pageMessage.tone === "error" ? "error" : "success"
            }`}
            role={pageMessage.tone === "error" ? "alert" : "status"}
          >
            {pageMessage.text}
          </p>
        ) : null}

        {importReportResult?.data ? (
          <ImportReportSummary report={importReportResult.data.report} />
        ) : null}

        {importReportResult?.data === null ? (
          <p className="form-note form-note-warning" role="status">
            {importReportResult.error}
          </p>
        ) : null}

        {dataWarnings.map((warning) => (
          <p className="form-note form-note-error" key={warning} role="alert">
            {warning}
          </p>
        ))}

        <section className="editor-focus-panel" aria-label="Flusso editoriale">
          <p>
            Scrivi il libretto direttamente qui. I blocchi stampabili sono
            quelli che finiranno in anteprima e PDF.
          </p>
        </section>

        <div className="grid two editor-top-grid" id="nuova-sezione">
          <Card className="section-create-card">
            <details
              className="section-create-details"
              open={sections.length === 0}
            >
              <summary className="button section-create-summary">
                + Aggiungi sezione
              </summary>
              <SectionCreateForm bookId={book.id} />
            </details>
          </Card>

          <Card title="Riepilogo editoriale">
            <ul className="panel-list">
              <FieldRow label="Titolo" value={book.title} />
              <FieldRow label="Sezioni" value={sections.length} />
              <FieldRow label="In indice" value={sectionsInToc} />
              <FieldRow label="Blocchi" value={visibleBlocks.length} />
              <FieldRow
                label={`Asset ${formatAssetStatus("placeholder")}`}
                value={placeholderAssets}
              />
              <FieldRow
                label="Prossima posizione"
                value={sections.length + 1}
              />
            </ul>
            <div className="editor-support-actions">
              <Link
                className="ghost-button"
                href={`/libri/${book.id}/importa`}
              >
                Importa bozza strutturata
              </Link>
            </div>
          </Card>
        </div>

        {sections.length === 0 ? (
          <EmptyState
            action={
              <a className="button" href="#nuova-sezione">
                Aggiungi sezione
              </a>
            }
            title="Nessuna sezione"
            description="Questo libretto non ha ancora contenuti."
          />
        ) : (
          <section className="section-list" aria-label="Sezioni contenuto">
            {sections.map((section, index) => (
              <SectionCard
                assetById={assetById}
                assetPreviewUrls={assetPreviewUrls}
                blocks={blocksBySection.get(section.id) ?? []}
                index={index}
                isFirst={index === 0}
                isLast={index === sections.length - 1}
                key={section.id}
                section={section}
              />
            ))}
          </section>
        )}

        <Card className="final-actions-card" title="Controllo libretto">
          <p className="section-panel-note">
            Controlla anteprima, validazione e PDF tecnico mentre sistemi i
            contenuti.
          </p>
          <div className="final-action-grid">
            <Link
              className="secondary-button"
              href={`/libri/${book.id}/anteprima`}
            >
              Anteprima libretto
            </Link>
            <Link
              className="secondary-button"
              href={`/libri/${book.id}/validazione`}
            >
              Validazione pre-export
            </Link>
            <Link
              className="button"
              href={`/libri/${book.id}/export/pdf?mode=technical`}
            >
              Scarica PDF tecnico di prova
            </Link>
          </div>
          <p className="form-note form-note-warning">
            Da usare solo per controllare contenuti e layout. Non caricare su
            Amazon KDP se la validazione segnala problemi.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
