import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import { listAssets } from "@/lib/kdp/assets";
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
  DeleteSectionForm,
  MoveSectionForm,
} from "./section-actions";
import { SectionCreateForm } from "./section-create-form";
import { SectionEditForm } from "./section-edit-form";

type BookContentsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
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
  created: "Sezione creata.",
  deleted: "Sezione eliminata.",
  imported: "Import completato.",
  reordered: "Ordine sezioni aggiornato.",
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

function groupBlocksBySection(blocks: KdpSectionBlock[]) {
  const grouped = new Map<string, KdpSectionBlock[]>();

  for (const block of blocks) {
    const sectionBlocks = grouped.get(block.section_id) ?? [];
    sectionBlocks.push(block);
    grouped.set(block.section_id, sectionBlocks);
  }

  return grouped;
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

function SectionCard({
  blocks,
  index,
  isFirst,
  isLast,
  section,
}: {
  blocks: KdpSectionBlock[];
  index: number;
  isFirst: boolean;
  isLast: boolean;
  section: KdpSection;
}) {
  const title = section.title || "Senza titolo";
  const includeInToc = section.include_in_toc !== false;

  return (
    <article className="section-card">
      <div className="section-card-header">
        <div>
          <p className="section-meta">
            {index + 1}. {formatSectionType(section.section_type)}
          </p>
          <h2>{title}</h2>
          {section.subtitle ? (
            <p className="section-subtitle">{section.subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="section-chip-row" aria-label="Metadati sezione">
        <span className="section-chip">
          {formatSectionStatus(section.section_status)}
        </span>
        <span className="section-chip">
          Layout: {formatLayoutPreset(section.layout_preset)}
        </span>
        <span className="section-chip">
          Indice: {includeInToc ? "si" : "no"}
        </span>
        {section.page_break_before ? (
          <span className="section-chip">Page break prima</span>
        ) : null}
      </div>

      <p className="section-owner-meta">
        Creato da: {formatInternalOwner(section.created_by_email)} - Ultima
        modifica: {formatInternalOwner(section.updated_by_email)}
      </p>

      <div className="section-content-grid">
        <section className="section-content-area">
          <h3>Testo pubblicabile</h3>
          {section.body ? (
            <p className="section-body-preview">{section.body}</p>
          ) : (
            <p className="section-empty-body">Testo vuoto.</p>
          )}
        </section>

        <section className="section-content-area">
          <h3>Note interne</h3>
          {section.editor_notes ? (
            <p className="section-internal-notes">{section.editor_notes}</p>
          ) : (
            <p className="section-empty-body">Nessuna nota interna.</p>
          )}
        </section>
      </div>

      <section className="section-blocks-panel">
        <div className="section-blocks-header">
          <h3>Blocchi contenuto</h3>
          <span className="section-chip">{blocks.length}</span>
        </div>

        {blocks.length > 0 ? (
          <ul className="section-block-list">
            {blocks.map((block) => (
              <li className="section-block-item" key={block.id}>
                <div className="section-block-item-header">
                  <p className="section-meta">
                    {block.sort_order}. {formatBlockType(block.block_type)}
                  </p>
                  <span className="section-chip">
                    {formatPrintVisibility(block.print_visibility)}
                  </span>
                </div>
                {block.title ? <h4>{block.title}</h4> : null}
                {block.body ? (
                  <p className="section-body-preview">{block.body}</p>
                ) : null}
                {block.editor_notes ? (
                  <p className="section-internal-notes">
                    {block.editor_notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="section-empty-body">Nessun blocco dedicato.</p>
        )}

        <details className="section-edit-panel">
          <summary className="secondary-button section-edit-toggle">
            Placeholder immagine
          </summary>
          <CreateImagePlaceholderBlockForm
            bookId={section.book_id}
            sectionId={section.id}
          />
        </details>
      </section>

      <div className="section-actions">
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

      <details className="section-edit-panel">
        <summary className="secondary-button section-edit-toggle">
          Modifica
        </summary>
        <SectionEditForm section={section} />
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
  const assets = assetsResult.data ?? [];
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
  const pageMessage = getPageMessage(resolvedSearchParams);

  return (
    <AppShell
      title="Contenuti libretto"
      eyebrow={book.title}
      description={book.subtitle || "Builder editoriale per sezioni, blocchi e note."}
      actions={
        <>
          <Link className="secondary-button" href={`/libri/${book.id}/importa`}>
            Importa bozza
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
            className="form-note"
            role={pageMessage.tone === "error" ? "alert" : "status"}
          >
            {pageMessage.text}
          </p>
        ) : null}

        {dataWarnings.map((warning) => (
          <p className="form-note" key={warning} role="alert">
            {warning}
          </p>
        ))}

        <div className="grid two" id="nuova-sezione">
          <Card title="Aggiungi sezione">
            <SectionCreateForm bookId={book.id} />
          </Card>

          <Card title="Riepilogo">
            <ul className="panel-list">
              <FieldRow label="Titolo" value={book.title} />
              <FieldRow label="Sezioni" value={sections.length} />
              <FieldRow label="In indice" value={sectionsInToc} />
              <FieldRow label="Blocchi" value={blocks.length} />
              <FieldRow
                label={`Asset ${formatAssetStatus("placeholder")}`}
                value={placeholderAssets}
              />
              <FieldRow
                label="Prossima posizione"
                value={sections.length + 1}
              />
            </ul>
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
      </div>
    </AppShell>
  );
}
