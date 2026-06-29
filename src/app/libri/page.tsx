import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { BOOK_STATUS_OPTIONS } from "@/lib/kdp/constants";
import { mockBooks } from "@/lib/kdp/mock-data";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default function BooksPage() {
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

      {mockBooks.length === 0 ? (
        <EmptyState
          title="Nessun libretto"
          description="La dashboard e' pronta per mostrare i progetti creati con il CRUD del prossimo task."
          action={
            <Link className="button" href="/libri/nuovo">
              Nuovo libretto
            </Link>
          }
        />
      ) : (
        <div className="grid">
          {mockBooks.map((book) => (
            <article className="book-card" key={book.id}>
              <div className="book-card-main">
                <StatusPill status={book.status} />
                <div>
                  <h2>{book.title}</h2>
                  <p className="book-subtitle">{book.subtitle}</p>
                </div>
                <div className="meta-row">
                  <span>{book.authorName}</span>
                  <span>{book.language.toUpperCase()}</span>
                  <span>{book.format}</span>
                  <span>{book.sectionCount} sezioni</span>
                  <span>Modificato {dateFormatter.format(book.updatedAt)}</span>
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
