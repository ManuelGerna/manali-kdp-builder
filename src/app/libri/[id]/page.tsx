import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/ui/status-pill";
import { DEFAULT_BOOK_SETTINGS } from "@/lib/kdp/constants";
import { mockBooks } from "@/lib/kdp/mock-data";

type BookDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const { id } = await params;
  const book = mockBooks.find((item) => item.id === id);

  if (!book) {
    notFound();
  }

  return (
    <AppShell
      title={book.title}
      eyebrow="Dettaglio libro"
      description={book.subtitle}
      actions={
        <Link className="secondary-button" href="/libri">
          Torna ai libri
        </Link>
      }
    >
      <div className="grid two">
        <section className="panel">
          <StatusPill status={book.status} />
          <h2>Dati principali</h2>
          <ul className="panel-list">
            <li>
              <span className="panel-label">Autore</span>
              <span className="panel-value">{book.authorName}</span>
            </li>
            <li>
              <span className="panel-label">Lingua</span>
              <span className="panel-value">{book.language.toUpperCase()}</span>
            </li>
            <li>
              <span className="panel-label">Tipo</span>
              <span className="panel-value">Crystal guide journal</span>
            </li>
            <li>
              <span className="panel-label">Sezioni</span>
              <span className="panel-value">{book.sectionCount}</span>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2>Formato V1</h2>
          <ul className="panel-list">
            <li>
              <span className="panel-label">Trim size</span>
              <span className="panel-value">{DEFAULT_BOOK_SETTINGS.trimSize}</span>
            </li>
            <li>
              <span className="panel-label">Bleed</span>
              <span className="panel-value">No</span>
            </li>
            <li>
              <span className="panel-label">Interior</span>
              <span className="panel-value">
                {DEFAULT_BOOK_SETTINGS.interiorType}
              </span>
            </li>
            <li>
              <span className="panel-label">Paper</span>
              <span className="panel-value">{DEFAULT_BOOK_SETTINGS.paperType}</span>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2>Progress checklist</h2>
          <ul className="panel-list">
            <li>
              <span className="panel-label">Dati libro</span>
              <span className="panel-value">Pronto</span>
            </li>
            <li>
              <span className="panel-label">Impostazioni KDP</span>
              <span className="panel-value">Default V1</span>
            </li>
            <li>
              <span className="panel-label">Contenuti</span>
              <span className="panel-value">Da collegare</span>
            </li>
            <li>
              <span className="panel-label">Export</span>
              <span className="panel-value">Fuori scope</span>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2>Azioni</h2>
          <div className="card-actions">
            <button className="secondary-button" disabled type="button">
              Modifica contenuti
            </button>
            <button className="secondary-button" disabled type="button">
              Prepara dati KDP
            </button>
            <button className="secondary-button" disabled type="button">
              Genera PDF
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
