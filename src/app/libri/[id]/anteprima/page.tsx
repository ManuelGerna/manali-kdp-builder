import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { getBookDetail } from "@/lib/kdp/books";
import { listSectionBlocks } from "@/lib/kdp/section-blocks";
import { createClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

import LegacyPreview from "./legacy-preview";
import { getBookContentMode } from "@/lib/kdp/editorial-book-mode";
import { inspectEditorialMaps } from "@/lib/kdp/editorial-repository";
import { EditorialPreview } from "./editorial-preview";

type BookPreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BookPreviewPage({ params }: BookPreviewPageProps) {
  const { id } = await params;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Anteprima libretto"
        eyebrow="Anteprima editoriale"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href={`/libri/${id}/contenuti`}>
            Torna al Builder
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili del progetto per leggere l'anteprima."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Anteprima libretto"
        eyebrow="Anteprima editoriale"
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

  const mode = await getBookContentMode(supabase, id).catch(() => null);
  if (mode === "pages") redirect(`/libri/${id}/pagine-importate/anteprima`);
  if (mode === "legacy") return <LegacyPreview params={Promise.resolve({ id })} />;
  if (!mode) return <AppShell title="Anteprima libretto"><EmptyState title="Anteprima non disponibile" description="Non riesco a verificare il tipo di libro. Riprova." /></AppShell>;
  const detailResult = await getBookDetail(supabase, id);

  if (!detailResult.data) {
    return (
      <AppShell
        title={detailResult.notFound ? "Libro non trovato" : "Errore"}
        eyebrow="Anteprima editoriale"
        description={detailResult.error}
        actions={
          <Link className="secondary-button" href="/libri">
            Torna ai libri
          </Link>
        }
      >
        <EmptyState
          title={detailResult.notFound ? "Libro non trovato" : "Errore"}
          description={detailResult.error}
        />
      </AppShell>
    );
  }

  const { book, sections } = detailResult.data;
  const blocksResult = await listSectionBlocks(supabase, book.id);

  if (!blocksResult.data) {
    return (
      <AppShell
        title="Anteprima libretto"
        eyebrow={book.title}
        description={blocksResult.error}
      >
        <EmptyState title="Anteprima non disponibile" description={blocksResult.error} />
      </AppShell>
    );
  }


  const images: Record<string, { url?: string; alt?: string }> = {};
  const imageIds = blocksResult.data.filter(b => ["image", "image_prompt"].includes(b.block_type) && b.asset_id).map(b => b.asset_id!);
  if (imageIds.length) {
    const assets = await supabase.from("kdp_assets").select("id,file_path,alt_text,title").eq("book_id", book.id).in("id", imageIds);
    for (const asset of assets.data ?? []) if (asset.file_path) {
      const result = await supabase.storage.from("kdp-assets").createSignedUrl(asset.file_path, 3600);
      images[asset.id] = { url: result.data?.signedUrl, alt: asset.alt_text ?? asset.title ?? undefined };
    }
  }
  const mapState = inspectEditorialMaps(sections, blocksResult.data);
  if (mapState.error || mapState.needsBootstrap) return <AppShell title="Anteprima libretto">
    <EmptyState title="Prepara la struttura editoriale" description={mapState.error || "Apri il Builder per attivare la struttura del libro importato."}
      action={<Link className="button" href={`/libri/${id}/contenuti`}>Apri il Builder</Link>} />
  </AppShell>;
  return (
    <AppShell
      title="Anteprima libretto"
      eyebrow={book.title}
      description="Una lettura continua della struttura editoriale, senza dettagli tecnici."
      actions={
        <>
          <Link className="button" href={`/libri/${book.id}/contenuti`}>
            Torna al Builder
          </Link>
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libro
          </Link>
        </>
      }
    >
      {sections.length === 0 ? (
        <EmptyState
          action={
            <Link className="button" href={`/libri/${book.id}/contenuti`}>
              Inizia a scrivere
            </Link>
          }
          title="Anteprima vuota"
          description="Il libro non ha ancora contenuti."
        />
      ) : (
        <EditorialPreview sections={sections} blocks={blocksResult.data} images={images} />
      )}
    </AppShell>
  );
}
