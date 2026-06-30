import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import { DraftImportForm } from "./draft-import-form";

type DraftImportPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    status?: string;
  }>;
};

type BookForImport = Pick<Tables<"kdp_books">, "id" | "subtitle" | "title">;

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
    .select("id,title,subtitle")
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
      description="Analisi deterministica di una bozza lunga con preview prima del salvataggio."
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
            className="form-note"
            role={pageMessage.tone === "error" ? "alert" : "status"}
          >
            {pageMessage.text}
          </p>
        ) : null}

        <div className="grid two">
          <Card title="Bozza da importare">
            <DraftImportForm bookId={book.id} />
          </Card>

          <Card title="Formato supportato">
            <ul className="panel-list">
              <FieldRow
                label="Sezioni"
                value="Titoli brevi, titoli maiuscoli, righe con emoji iniziale o separatore"
              />
              <FieldRow
                label="Separatore"
                value="Riga con tre trattini, em dash ripetuti o separatore editoriale"
              />
              <FieldRow
                label="Page break"
                value="[PAGINA 2] oppure [PAGINA 14 - PIETRA]"
              />
              <FieldRow
                label="Immagini"
                value="[IMMAGINE: descrizione del placeholder]"
              />
              <FieldRow
                label="Note interne"
                value="Righe tra parentesi tonde, salvate come note non stampabili"
              />
              <FieldRow
                label="Salvataggio"
                value="Le sezioni vengono aggiunte in coda, senza cancellare contenuti esistenti"
              />
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
