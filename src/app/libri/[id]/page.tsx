import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import {
  AI_USAGE_LABELS,
  BOOK_STATUSES,
  type AiUsageType,
  type BookStatus,
} from "@/lib/kdp/constants";
import { getBookDetail } from "@/lib/kdp/books";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type BookDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toBookStatus(status: string): BookStatus {
  return BOOK_STATUSES.includes(status as BookStatus)
    ? (status as BookStatus)
    : "draft";
}

function formatAiUsage(aiUsageType: string) {
  return AI_USAGE_LABELS[aiUsageType as AiUsageType] ?? aiUsageType;
}

function formatBoolean(value: boolean) {
  return value ? "Si" : "No";
}

function formatSectionType(sectionType: string) {
  return sectionType.replaceAll("_", " ");
}

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const { id } = await params;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Libretto"
        eyebrow="Dettaglio libro"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href="/libri">
            Torna ai libri
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili dedicate a KDP Builder per leggere il dettaglio reale."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Libretto"
        eyebrow="Dettaglio libro"
        description="Supabase non disponibile."
        actions={
          <Link className="secondary-button" href="/libri">
            Torna ai libri
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

  const detailResult = await getBookDetail(supabase, id);

  if (detailResult.data === null) {
    return (
      <AppShell
        title={detailResult.notFound ? "Libretto non trovato" : "Errore"}
        eyebrow="Dettaglio libro"
        description={detailResult.error}
        actions={
          <Link className="secondary-button" href="/libri">
            Torna ai libri
          </Link>
        }
      >
        <EmptyState
          title={detailResult.notFound ? "Libretto non trovato" : "Errore"}
          description={detailResult.error}
        />
      </AppShell>
    );
  }

  const { book, settings, sections } = detailResult.data;

  return (
    <AppShell
      title={book.title}
      eyebrow="Dettaglio libro"
      description={book.subtitle || "Dettaglio reale del libretto KDP."}
      actions={
        <Link className="secondary-button" href="/libri">
          Torna ai libri
        </Link>
      }
    >
      <div className="grid two">
        <section className="panel">
          <StatusPill status={toBookStatus(book.status)} />
          <h2>Dati principali</h2>
          <ul className="panel-list">
            <li>
              <span className="panel-label">Autore</span>
              <span className="panel-value">{book.author_name}</span>
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
              <span className="panel-label">Uso AI</span>
              <span className="panel-value">
                {formatAiUsage(book.ai_usage_type)}
              </span>
            </li>
            <li>
              <span className="panel-label">Sezioni</span>
              <span className="panel-value">{sections.length}</span>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2>Formato V1</h2>
          {settings ? (
            <ul className="panel-list">
              <li>
                <span className="panel-label">Trim size</span>
                <span className="panel-value">{settings.trim_size}</span>
              </li>
              <li>
                <span className="panel-label">Bleed</span>
                <span className="panel-value">{formatBoolean(settings.bleed)}</span>
              </li>
              <li>
                <span className="panel-label">Interior</span>
                <span className="panel-value">{settings.interior_type}</span>
              </li>
              <li>
                <span className="panel-label">Paper</span>
                <span className="panel-value">{settings.paper_type}</span>
              </li>
              <li>
                <span className="panel-label">Body font</span>
                <span className="panel-value">{settings.body_font}</span>
              </li>
              <li>
                <span className="panel-label">Heading font</span>
                <span className="panel-value">{settings.heading_font}</span>
              </li>
              <li>
                <span className="panel-label">Font size</span>
                <span className="panel-value">{settings.body_font_size}</span>
              </li>
              <li>
                <span className="panel-label">Line height</span>
                <span className="panel-value">{settings.line_height}</span>
              </li>
              <li>
                <span className="panel-label">Margini</span>
                <span className="panel-value">
                  {settings.margin_top}/{settings.margin_bottom}/
                  {settings.margin_inner}/{settings.margin_outer}
                </span>
              </li>
            </ul>
          ) : (
            <p className="form-note">
              Impostazioni KDP non trovate per questo libretto.
            </p>
          )}
        </section>

        <section className="panel">
          <h2>Sezioni</h2>
          {sections.length === 0 ? (
            <p className="form-note">Nessuna sezione ancora creata.</p>
          ) : (
            <ul className="panel-list">
              {sections.map((section) => (
                <li key={section.id}>
                  <span className="panel-label">
                    {section.sort_order}. {formatSectionType(section.section_type)}
                  </span>
                  <span className="panel-value">
                    {section.title || "Senza titolo"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Azioni</h2>
          <div className="card-actions">
            <button className="secondary-button" disabled type="button">
              Contenuti
            </button>
            <Link className="secondary-button" href={`/libri/${book.id}/kdp`}>
              Dati KDP copiabili
            </Link>
            <button className="secondary-button" disabled type="button">
              Export PDF
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
