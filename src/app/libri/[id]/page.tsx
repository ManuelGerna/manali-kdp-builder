import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import { StatusPill } from "@/components/ui/status-pill";
import {
  AI_USAGE_LABELS,
  BOOK_STATUSES,
  SECTION_TYPE_LABELS,
  type AiUsageType,
  type BookStatus,
  type SectionType,
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
  return (
    SECTION_TYPE_LABELS[sectionType as SectionType] ??
    sectionType.replaceAll("_", " ")
  );
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
        <Card>
          <StatusPill status={toBookStatus(book.status)} />
          <h2>Dati principali</h2>
          <ul className="panel-list">
            <FieldRow label="Autore" value={book.author_name} />
            <FieldRow label="Lingua" value={book.language.toUpperCase()} />
            <FieldRow label="Tipo" value="Crystal guide journal" />
            <FieldRow
              label="Uso AI"
              value={formatAiUsage(book.ai_usage_type)}
            />
            <FieldRow label="Sezioni" value={sections.length} />
          </ul>
        </Card>

        <Card title="Formato V1">
          {settings ? (
            <ul className="panel-list">
              <FieldRow label="Trim size" value={settings.trim_size} />
              <FieldRow label="Bleed" value={formatBoolean(settings.bleed)} />
              <FieldRow label="Interior" value={settings.interior_type} />
              <FieldRow label="Paper" value={settings.paper_type} />
              <FieldRow label="Body font" value={settings.body_font} />
              <FieldRow label="Heading font" value={settings.heading_font} />
              <FieldRow label="Font size" value={settings.body_font_size} />
              <FieldRow label="Line height" value={settings.line_height} />
              <FieldRow
                label="Margini"
                value={`${settings.margin_top}/${settings.margin_bottom}/${settings.margin_inner}/${settings.margin_outer}`}
              />
            </ul>
          ) : (
            <p className="form-note">
              Impostazioni KDP non trovate per questo libretto.
            </p>
          )}
        </Card>

        <Card title="Sezioni">
          {sections.length === 0 ? (
            <p className="form-note">Nessuna sezione ancora creata.</p>
          ) : (
            <ul className="panel-list">
              {sections.map((section) => (
                <FieldRow
                  key={section.id}
                  label={`${section.sort_order}. ${formatSectionType(
                    section.section_type,
                  )}`}
                  value={section.title || "Senza titolo"}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card title="Azioni">
          <div className="card-actions">
            <Link
              className="secondary-button"
              href={`/libri/${book.id}/contenuti`}
            >
              Contenuti
            </Link>
            <Link className="secondary-button" href={`/libri/${book.id}/kdp`}>
              Dati KDP copiabili
            </Link>
            <button className="secondary-button" disabled type="button">
              Export PDF
            </button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
