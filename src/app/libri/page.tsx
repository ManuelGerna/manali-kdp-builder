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
import { isBookArchived, listBooks, type KdpBook } from "@/lib/kdp/books";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import {
  ArchiveBookForm,
  RestoreBookForm,
} from "@/app/libri/book-archive-actions";

type BooksPageProps = {
  searchParams: Promise<{
    error?: string;
    status?: string;
    view?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const STATUS_MESSAGES: Record<string, string> = {
  book_archived: "Libretto archiviato. Lo trovi nella vista Archiviati.",
  book_restored: "Libretto ripristinato nel flusso di lavoro.",
};

function toBookStatus(book: KdpBook): BookStatus {
  if (isBookArchived(book)) {
    return "archived";
  }

  const status = book.status;

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

export default async function BooksPage({ searchParams }: BooksPageProps) {
  const resolvedSearchParams = await searchParams;
  const isArchivedView = resolvedSearchParams.view === "archived";
  const pageMessage = getPageMessage(resolvedSearchParams);

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

  const booksResult = await listBooks(
    supabase,
    isArchivedView ? "archived" : "active",
  );

  return (
    <AppShell
      title="Libri"
      description={
        isArchivedView
          ? "Libretti archiviati, esclusi dal flusso quotidiano."
          : "Dashboard operativa per i libretti KDP interni."
      }
      actions={
        <Link className="button" href="/libri/nuovo">
          Nuovo libretto
        </Link>
      }
    >
      {pageMessage ? (
        <p
          className={`form-note form-note-${
            pageMessage.tone === "error" ? "error" : "success"
          } page-message`}
          role={pageMessage.tone === "error" ? "alert" : "status"}
        >
          {pageMessage.text}
        </p>
      ) : null}

      <div className="toolbar" aria-label="Filtri stato">
        <Link
          className={`filter-chip ${!isArchivedView ? "is-active" : ""}`}
          href="/libri"
        >
          Attivi
        </Link>
        {BOOK_STATUS_OPTIONS.slice(0, 4).map((status) => (
          <span className="filter-chip" key={status.value}>
            {status.label}
          </span>
        ))}
        <Link
          className={`filter-chip ${isArchivedView ? "is-active" : ""}`}
          href="/libri?view=archived"
        >
          Archiviati
        </Link>
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
          title={isArchivedView ? "Archivio vuoto" : "Nessun libretto"}
          description={
            isArchivedView
              ? "I libretti archiviati compariranno qui senza essere cancellati dal database."
              : "Crea il primo libretto per iniziare a popolare la dashboard reale."
          }
          action={
            isArchivedView ? (
              <Link className="secondary-button" href="/libri">
                Torna agli attivi
              </Link>
            ) : (
              <Link className="button" href="/libri/nuovo">
                Nuovo libretto
              </Link>
            )
          }
        />
      ) : (
        <div className="grid">
          {booksResult.data.map((book) => (
            <article
              className={`book-card ${
                isBookArchived(book) ? "book-card-archived" : ""
              }`}
              key={book.id}
            >
              <div className="book-card-main">
                <StatusPill status={toBookStatus(book)} />
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
                  <span>
                    {isBookArchived(book) && book.archived_at
                      ? `Archiviato ${formatUpdatedAt(book.archived_at)}`
                      : `Modificato ${formatUpdatedAt(book.updated_at)}`}
                  </span>
                </div>
              </div>

              <div className="card-actions">
                <Link className="secondary-button" href={`/libri/${book.id}`}>
                  Apri
                </Link>
                {isBookArchived(book) ? (
                  <RestoreBookForm bookId={book.id} />
                ) : (
                  <ArchiveBookForm bookId={book.id} title={book.title} />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
