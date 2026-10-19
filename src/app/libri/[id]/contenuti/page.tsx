import { listEditorialImageAssets } from "@/lib/kdp/assets";
import { readEditorialMap } from "@/lib/kdp/editorial-hierarchy";
import { EditorialImageRecovery } from "./editorial-image-recovery";
import { cleanupEditorialImages } from "@/lib/kdp/editorial-image-storage";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { listSectionBlocks, type KdpSectionBlock } from "@/lib/kdp/section-blocks";
import { listSections } from "@/lib/kdp/sections";
import { createClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import { ContentAnchorScroll } from "./content-anchor-scroll";
import { EditorialBuilder } from "./editorial-builder";
import { CreateEditorialSectionPanel } from "./editorial-builder-forms";
import LegacyBuilder from "./legacy-builder";
import { getBookContentMode } from "@/lib/kdp/editorial-book-mode";
import { inspectEditorialMaps } from "@/lib/kdp/editorial-repository";
import { EditorialSetup } from "./editorial-setup";

type BookContentsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
};

type BookForContents = Pick<Tables<"kdp_books">, "id" | "subtitle" | "title">;

const STATUS_MESSAGES: Record<string, string> = {
  image_saved: "Immagine salvata.",
  editorial_initialized: "Struttura editoriale pronta.",
  block_deleted: "Testo eliminato.",
  block_reordered: "Ordine dei testi aggiornato.",
  block_updated: "Testo aggiornato.",
  created: "Nuova parte del libro creata.",
  deleted: "Parte del libro eliminata.",
  reordered: "Struttura del libro riordinata.",
  subsection_created: "Sottosezione aggiunta.",
  subsection_deleted: "Sottosezione eliminata.",
  subsection_reordered: "Sottosezioni riordinate.",
  text_block_created: "Testo aggiunto.",
  updated: "Titolo e testo aggiornati.",
};

async function getBookForContents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookId: string,
) {
  const { data, error } = await supabase
    .from("kdp_books")
    .select("id,title,subtitle")
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    console.error("[editorial-builder:page]", {
      bookIdTail: bookId.slice(-8),
      code: error.code,
      event: "book_query_failed",
    });

    return {
      data: null,
      error: "Non riesco a caricare questo libro.",
      notFound: false,
    } as const;
  }

  if (!data) {
    return {
      data: null,
      error: "Libro non trovato o non accessibile.",
      notFound: true,
    } as const;
  }

  return { data: data as BookForContents, error: null, notFound: false } as const;
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
    return { error: true, text: searchParams.error };
  }

  if (searchParams.status && STATUS_MESSAGES[searchParams.status]) {
    return { error: false, text: STATUS_MESSAGES[searchParams.status] };
  }

  return null;
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
        title="Editorial Builder"
        eyebrow="Struttura del libro"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libro
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili del progetto per aprire il Builder."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Editorial Builder"
        eyebrow="Struttura del libro"
        description="Supabase non disponibile."
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

  if (userError || !user) redirect("/login");

  const bookResult = await getBookForContents(supabase, id);

  if (!bookResult.data) {
    return (
      <AppShell
        title={bookResult.notFound ? "Libro non trovato" : "Errore"}
        eyebrow="Editorial Builder"
        description={bookResult.error}
        actions={
          <Link className="secondary-button" href="/libri">
            Torna ai libri
          </Link>
        }
      >
        <EmptyState
          title={bookResult.notFound ? "Libro non trovato" : "Errore"}
          description={bookResult.error}
        />
      </AppShell>
    );
  }

  try {
    const mode = await getBookContentMode(supabase, id);
    if (mode === "pages") redirect(`/libri/${id}/pagine-importate`);
    if (mode === "legacy") return <LegacyBuilder params={Promise.resolve({ id })} searchParams={searchParams} />;
  } catch (cause) {
    // Next redirects are control flow, not query errors.
    if (cause && typeof cause === "object" && "digest" in cause) throw cause;
    return <AppShell title="Contenuti" description="Tipo di libro non disponibile."><EmptyState title="Riprova" description="Non riesco a verificare il percorso di questo libro." /></AppShell>;
  }
  const cleanupComplete = await cleanupEditorialImages(supabase, id);
  const assets = await listEditorialImageAssets(supabase, id);
  const images: Record<string, { url?: string; alt?: string }> = {};
  await Promise.all((assets.data ?? []).filter(a => a.file_path && a.prompt === "editorial-image-v1:active").map(async a => {
    try {
      const result = await supabase.storage.from("kdp-assets").createSignedUrl(a.file_path!, 3600);
      images[a.id] = { url: result.data?.signedUrl, alt: a.alt_text ?? a.title ?? undefined };
    } catch { images[a.id] = {}; }
  }));
  const [sectionsResult, blocksResult] = await Promise.all([
    listSections(supabase, id),
    listSectionBlocks(supabase, id),
  ]);

  if (!sectionsResult.data) {
    return (
      <AppShell
        title="Errore"
        eyebrow={bookResult.data.title}
        description={sectionsResult.error}
      >
        <EmptyState title="Struttura non disponibile" description={sectionsResult.error} />
      </AppShell>
    );
  }

  const book = bookResult.data;
  const sections = sectionsResult.data;
  const blocks = blocksResult.data ?? [];
  const pageMessage = getPageMessage(resolvedSearchParams);
  const mapState = inspectEditorialMaps(sections, blocks);

  return (
    <AppShell
      title="Editorial Builder"
      eyebrow={book.title}
      description={book.subtitle || "Organizza capitoli, sottosezioni e testi."}
      actions={
        <>
          <a className="button" href="#nuova-sezione">
            + Nuova parte
          </a>
          <Link className="secondary-button" href={`/libri/${book.id}/anteprima`}>
            Anteprima libretto
          </Link>
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libro
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <ContentAnchorScroll />
      </Suspense>

      <div className="editorial-builder-layout">
        {pageMessage ? (
          <p
            className={`form-note form-note-${pageMessage.error ? "error" : "success"}`}
            role={pageMessage.error ? "alert" : "status"}
          >
            {pageMessage.text}
          </p>
        ) : null}

        {blocksResult.data === null ? (
          <p className="form-note form-note-error" role="alert">
            {blocksResult.error}
          </p>
        ) : null}

        <div className="editorial-builder-intro">
          <div>
            <p className="editorial-node-label">Struttura logica</p>
            <h2>{book.title}</h2>
            <p>
              Il contenuto è raccolto in livelli. Apri solo la parte su cui vuoi
              lavorare: il resto del libro rimane compatto.
            </p>
          </div>
          <span>{sections.length} parti</span>
          <Link className="ghost-button" href={`/libri/${book.id}/impostazioni`}>Modifica titolo del libro</Link>
        </div>

        {blocksResult.data === null ? null : mapState.error || mapState.needsBootstrap ? (
          <EditorialSetup bookId={book.id} error={mapState.error} />
        ) : sections.length === 0 ? (
          <EmptyState
            action={
              <a className="button" href="#nuova-sezione">
                Crea la prima parte
              </a>
            }
            title="Il libro è ancora vuoto"
            description="Inizia da un'introduzione, un capitolo o una conclusione."
          />
        ) : (
          <>{!cleanupComplete && <p role="status">Pulizia Storage in attesa. I file restano tracciati e verranno rimossi al prossimo tentativo.</p>}
          {assets.error && <p role="alert">{assets.error}</p>}
          <EditorialImageRecovery bookId={book.id}
            assets={(assets.data ?? []).filter(asset => asset.prompt === "editorial-image-v1:pending")}
            destinations={sections.flatMap(section => {
              const rows = blocks.filter(block => block.section_id === section.id);
              const map = readEditorialMap(section.settings, rows);
              return [{ sectionId: section.id, revision: map.revision, title: section.title || "Introduzione" },
                ...map.subsections.map(subsection => ({ sectionId: section.id, subsectionId: subsection.heading_block_id,
                  revision: map.revision, title: `${section.title || "Introduzione"} / ${rows.find(row => row.id === subsection.heading_block_id)?.title || "Sottosezione"}` }))];
            })} />
          <EditorialBuilder
            images={images}
            blocksBySection={groupBlocksBySection(blocks)}
            sections={sections}
          /></>
        )}

        {!mapState.error && !mapState.needsBootstrap && blocksResult.data ? <CreateEditorialSectionPanel bookId={book.id} initiallyOpen={sections.length === 0} /> : null}
      </div>
    </AppShell>
  );
}
