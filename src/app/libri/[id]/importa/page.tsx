import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import { isBookArchived } from "@/lib/kdp/books";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import { GenericDraftImportForm } from "@/components/kdp/generic-draft-import-form";

type DraftImportPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    status?: string;
  }>;
};

type BookForImport = Pick<
  Tables<"kdp_books">,
  "archived_at" | "id" | "status" | "subtitle" | "title"
>;

type BookResult =
  | {
      data: BookForImport;
      error: null;
      notFound: false;
    }
  | {
      data: null;
      error: string;
      notFound: boolean;
    };

const STATUS_MESSAGES: Record<string, string> = {
  imported: "Import completato.",
};

async function getBookForImport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookId: string,
): Promise<BookResult> {
  const { data, error } = await supabase
    .from("kdp_books")
    .select("id,title,subtitle,status,archived_at")
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    console.error("[kdp-draft-import:page]", {
      bookIdTail: bookId.slice(-8),
      code: error.code,
      event: "book_query_failed",
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

  if (isBookArchived(data)) {
    return {
      data: null,
      error:
        "Questo libretto e' archiviato. Ripristinalo prima di importare nuovi contenuti.",
      notFound: false,
    };
  }

  return {
    data,
    error: null,
    notFound: false,
  };
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

export default async function DraftImportPage({
  params,
  searchParams,
}: DraftImportPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Importa bozza"
        eyebrow="Import strutturato"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili dedicate a KDP Builder per importare contenuti."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Importa bozza"
        eyebrow="Import strutturato"
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

  const bookResult = await getBookForImport(supabase, id);

  if (bookResult.data === null) {
    return (
      <AppShell
        title={bookResult.notFound ? "Libretto non trovato" : "Errore"}
        eyebrow="Import strutturato"
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

  const book = bookResult.data;
  const pageMessage = getPageMessage(resolvedSearchParams);

  return (
    <AppShell
      title="Importa bozza"
      eyebrow={book.title}
      description="Incolla una bozza KDP Builder per analizzarla, generare la struttura normalizzata e controllare pagine, sezioni, template e avvisi prima del salvataggio definitivo."
      actions={
        <>
          <Link className="secondary-button" href={`/libri/${book.id}/contenuti`}>
            Contenuti
          </Link>
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
        </>
      }
    >
      <div className="draft-import-layout">
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

        <div className="grid two">
          <Card title="Importa bozza strutturata">
            <p className="page-copy">
              Incolla una bozza KDP Builder per analizzarla, generare la
              struttura normalizzata e controllare pagine, sezioni, template e
              avvisi prima del salvataggio definitivo.
            </p>
            <GenericDraftImportForm />
          </Card>

          <Card title="Formato supportato V0">
            <ul className="panel-list panel-list-long">
              <FieldRow
                label="Versione"
                value="KDP_BUILDER_DRAFT_VERSION: 0.1 consigliata; se manca, il parser genera un warning."
              />
              <FieldRow
                label="Blocchi"
                value="IDEA_LIBRO, SPECIFICHE_TECNICHE, PIANO_PAGINE, SEQUENZA_PAGINE, TEMPLATE_PAGINA, BRIEF_COPERTINA, METADATI_KDP_DRAFT e CHECKLIST."
              />
              <FieldRow
                label="Pagine"
                value="Usa numero_pagina per pagine singole oppure intervallo_pagine con ripeti per sequenze ripetute."
              />
              <FieldRow
                label="Template"
                value="Ogni pagina dovrebbe avere un template_id; template mancanti o non riconosciuti finiscono nel report."
              />
              <FieldRow
                label="Separazione"
                value="Interno, brief copertina, metadati KDP e checklist vengono mostrati come blocchi distinti."
              />
              <FieldRow
                label="Salvataggio"
                value="Preview-only: in questo task non viene salvato nulla su Supabase e non viene generato alcun PDF."
              />
              <FieldRow
                label="Prossimo passo"
                value="Dopo la revisione della struttura normalizzata si potra collegare un salvataggio definitivo dedicato."
              />
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
