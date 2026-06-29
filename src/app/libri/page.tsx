import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import {
  AI_USAGE_LABELS,
  BOOK_STATUS_OPTIONS,
  BOOK_STATUSES,
  type AiUsageType,
  type BookStatus,
} from "@/lib/kdp/constants";
import { listBooks } from "@/lib/kdp/books";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function toBookStatus(status: string): BookStatus {
  return BOOK_STATUSES.includes(status as BookStatus)
    ? (status as BookStatus)
    : "draft";
}

function formatAiUsage(aiUsageType: string) {
  return AI_USAGE_LABELS[aiUsageType as AiUsageType] ?? aiUsageType;
}

function formatUpdatedAt(value: string) {
  return dateFormatter.format(new Date(value));
}

export default async function BooksPage() {
  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Libri"
        description="Dashboard operativa per i libretti KDP interni."
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili dedicate a KDP Builder per leggere i libretti reali."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Libri"
        description="Dashboard operativa per i libretti KDP interni."
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

  const booksResult = await listBooks(supabase);

  return (
    <AppShell
      title="Libri"
      description="Dashboard operativa per i libretti KDP interni."
      actions={
        <Link className="button" href="/libri/nuovo">
          Nuovo libretto
        </Link>
      }
    >
      <div className="toolbar" aria-label="Filtri stato">
        <span className="filter-chip is-active">Tutti</span>
        {BOOK_STATUS_OPTIONS.slice(0, 4).map((status) => (
          <span className="filter-chip" key={status.value}>
            {status.label}
          </span>
        ))}
      </div>

      {booksResult.data === null ? (
        <EmptyState
          title="Errore caricamento"
          description={booksResult.error}
          action={
            <Link className="button" href="/libri/nuovo">
              Nuovo libretto
            </Link>
          }
        />
      ) : booksResult.data.length === 0 ? (
        <EmptyState
          title="Nessun libretto"
          description="Crea il primo libretto per iniziare a popolare la dashboard reale."
          action={
            <Link className="button" href="/libri/nuovo">
              Nuovo libretto
            </Link>
          }
        />
      ) : (
        <div className="grid">
          {booksResult.data.map((book) => (
            <article className="book-card" key={book.id}>
              <div className="book-card-main">
                <StatusPill status={toBookStatus(book.status)} />
                <div>
                  <h2>{book.title}</h2>
                  <p className="book-subtitle">
                    {book.subtitle || "Senza sottotitolo"}
                  </p>
                </div>
                <div className="meta-row">
                  <span>{book.author_name}</span>
                  <span>{book.language.toUpperCase()}</span>
                  <span>{formatAiUsage(book.ai_usage_type)}</span>
                  <span>Modificato {formatUpdatedAt(book.updated_at)}</span>
                </div>
              </div>

              <div className="card-actions">
                <Link className="secondary-button" href={`/libri/${book.id}`}>
                  Apri
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
