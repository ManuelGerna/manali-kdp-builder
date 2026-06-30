import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import { StatusPill } from "@/components/ui/status-pill";
import { listAssets } from "@/lib/kdp/assets";
import { formatInternalOwner } from "@/lib/kdp/ownership";
import {
  AI_USAGE_LABELS,
  BOOK_STATUSES,
  INTERIOR_TYPE_LABELS,
  PAPER_TYPE_LABELS,
  SECTION_TYPE_LABELS,
  TRIM_SIZE_LABELS,
  type AiUsageType,
  type BookStatus,
  type InteriorType,
  type PaperType,
  type SectionType,
  type TrimSize,
} from "@/lib/kdp/constants";
import { getBookDetail } from "@/lib/kdp/books";
import { listSectionBlocks } from "@/lib/kdp/section-blocks";
import {
  buildPreExportValidation,
  getExportReadiness,
  type ExportReadiness,
} from "@/lib/kdp/validation";
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

function formatTrimSize(trimSize: string) {
  return TRIM_SIZE_LABELS[trimSize as TrimSize] ?? trimSize;
}

function formatInteriorType(interiorType: string) {
  return (
    INTERIOR_TYPE_LABELS[interiorType as InteriorType] ??
    interiorType.replaceAll("_", " ")
  );
}

function formatPaperType(paperType: string) {
  return PAPER_TYPE_LABELS[paperType as PaperType] ?? paperType;
}

function formatSectionType(sectionType: string) {
  return (
    SECTION_TYPE_LABELS[sectionType as SectionType] ??
    sectionType.replaceAll("_", " ")
  );
}

function getPdfExportGateCopy(readiness: ExportReadiness) {
  if (readiness.status === "blocked") {
    return {
      buttonLabel: "Scarica PDF tecnico di prova",
      description:
        "Bloccato per KDP. Risolvi gli elementi da sistemare nella validazione.",
      hrefSuffix: "export/pdf?mode=technical",
      note:
        "Disponibile solo come test interno. Non caricare questo PDF su Amazon KDP.",
      statusClass: "failed",
      statusLabel: "Export PDF finale bloccato",
    };
  }

  if (readiness.status === "available_with_warnings") {
    return {
      buttonLabel: "Scarica PDF tecnico",
      description: readiness.description,
      hrefSuffix: "export/pdf?mode=technical",
      note: "Controlla le attenzioni prima di caricare su KDP.",
      statusClass: "warning",
      statusLabel: "Export PDF quasi pronto",
    };
  }

  return {
    buttonLabel: "Scarica PDF tecnico",
    description: readiness.description,
    hrefSuffix: "export/pdf",
    note: "Il libretto e' pronto per il prossimo step PDF.",
    statusClass: "passed",
    statusLabel: "Export PDF pronto",
  };
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
  const [blocksResult, assetsResult] = await Promise.all([
    listSectionBlocks(supabase, book.id),
    listAssets(supabase, book.id),
  ]);
  let exportReadiness: ExportReadiness;

  if (blocksResult.data === null || assetsResult.data === null) {
    exportReadiness = {
      description:
        "Non riesco a verificare lo stato export. Apri la validazione prima di procedere.",
      label: "Bloccato",
      status: "blocked",
    };
  } else {
    exportReadiness = getExportReadiness(
      buildPreExportValidation({
        assets: assetsResult.data,
        blocks: blocksResult.data,
        book,
        sections,
        settings,
      }),
    );
  }

  const pdfExportGate = getPdfExportGateCopy(exportReadiness);

  return (
    <AppShell
      title={book.title}
      eyebrow="Dettaglio libro"
      description={book.subtitle || "Dettaglio reale del libretto KDP."}
      actions={
        <>
          <Link className="secondary-button" href={`/libri/${book.id}/importa`}>
            Importa bozza
          </Link>
          <Link className="secondary-button" href="/libri">
            Torna ai libri
          </Link>
        </>
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
            <FieldRow
              label="Creato da"
              value={formatInternalOwner(book.created_by_email)}
            />
            <FieldRow
              label="Ultima modifica"
              value={formatInternalOwner(book.updated_by_email)}
            />
          </ul>
        </Card>

        <Card title="Formato V1">
          {settings ? (
            <ul className="panel-list">
              <FieldRow
                label="Trim size"
                value={formatTrimSize(settings.trim_size)}
              />
              <FieldRow label="Bleed" value={formatBoolean(settings.bleed)} />
              <FieldRow
                label="Interior"
                value={formatInteriorType(settings.interior_type)}
              />
              <FieldRow
                label="Paper"
                value={formatPaperType(settings.paper_type)}
              />
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

        <Card title="Flusso guidato">
          <ol className="workflow-list">
            <li className="workflow-item">
              <span className="workflow-index">1</span>
              <div className="workflow-content">
                <h3>Impostazioni KDP</h3>
                <p>Formato, carta, font e margini del libretto.</p>
                <Link
                  className="secondary-button"
                  href={`/libri/${book.id}/impostazioni`}
                >
                  Impostazioni KDP
                </Link>
              </div>
            </li>
            <li className="workflow-item">
              <span className="workflow-index">2</span>
              <div className="workflow-content">
                <h3>Contenuti</h3>
                <p>Sezioni e testi che finiranno nel futuro PDF.</p>
                <Link
                  className="secondary-button"
                  href={`/libri/${book.id}/contenuti`}
                >
                  Contenuti
                </Link>
              </div>
            </li>
            <li className="workflow-item">
              <span className="workflow-index">3</span>
              <div className="workflow-content">
                <h3>Anteprima libretto</h3>
                <p>Indice automatico e contenuto ordinato senza note interne.</p>
                <Link
                  className="secondary-button"
                  href={`/libri/${book.id}/anteprima`}
                >
                  Anteprima libretto
                </Link>
              </div>
            </li>
            <li className="workflow-item">
              <span className="workflow-index">4</span>
              <div className="workflow-content">
                <h3>Validazione pre-export</h3>
                <p>Controlli su contenuti, indice e coerenza prima del PDF.</p>
                <Link
                  className="secondary-button"
                  href={`/libri/${book.id}/validazione`}
                >
                  Validazione pre-export
                </Link>
              </div>
            </li>
            <li className="workflow-item">
              <span className="workflow-index">5</span>
              <div className="workflow-content">
                <h3>Dati KDP copiabili</h3>
                <p>Campi editoriali e paperback da copiare in Amazon KDP.</p>
                <Link
                  className="secondary-button"
                  href={`/libri/${book.id}/kdp`}
                >
                  Dati KDP copiabili
                </Link>
              </div>
            </li>
            <li className={`workflow-item workflow-item-${exportReadiness.status}`}>
              <span className="workflow-index">6</span>
              <div className="workflow-content">
                <h3>Export PDF</h3>
                <span
                  className={`validation-status validation-status-${pdfExportGate.statusClass}`}
                >
                  {pdfExportGate.statusLabel}
                </span>
                <p>{pdfExportGate.description}</p>
                <Link
                  className={
                    exportReadiness.status === "ready"
                      ? "button"
                      : "secondary-button"
                  }
                  href={`/libri/${book.id}/${pdfExportGate.hrefSuffix}`}
                >
                  {pdfExportGate.buttonLabel}
                </Link>
                <Link
                  className="secondary-button"
                  href={`/libri/${book.id}/validazione`}
                >
                  {exportReadiness.status === "blocked"
                    ? "Validazione pre-export"
                    : "Controlla validazione"}
                </Link>
                <p className="form-note">{pdfExportGate.note}</p>
              </div>
            </li>
          </ol>
        </Card>
      </div>
    </AppShell>
  );
}
