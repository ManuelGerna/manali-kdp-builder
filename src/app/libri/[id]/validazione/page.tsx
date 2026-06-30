import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import { listAssets } from "@/lib/kdp/assets";
import { getBookDetail } from "@/lib/kdp/books";
import { listSectionBlocks } from "@/lib/kdp/section-blocks";
import {
  buildPreExportValidation,
  VALIDATION_CATEGORIES,
  VALIDATION_CATEGORY_LABELS,
  type ValidationCheck,
  type ValidationStatus,
} from "@/lib/kdp/validation";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type BookValidationPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const STATUS_LABELS: Record<ValidationStatus, string> = {
  failed: "Da sistemare",
  passed: "OK",
  warning: "Attenzione",
};

function getStatusClassName(status: ValidationStatus) {
  return `validation-status validation-status-${status}`;
}

function ValidationCheckItem({ check }: { check: ValidationCheck }) {
  return (
    <li className="validation-check">
      <div className="validation-check-main">
        <span className={getStatusClassName(check.status)}>
          {STATUS_LABELS[check.status]}
        </span>
        <div>
          <h3>{check.label}</h3>
          <p>{check.description}</p>
        </div>
      </div>
      {check.action ? (
        <Link className="secondary-button" href={check.action.href}>
          {check.action.label}
        </Link>
      ) : null}
    </li>
  );
}

export default async function BookValidationPage({
  params,
}: BookValidationPageProps) {
  const { id } = await params;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Validazione pre-export"
        eyebrow="Controllo libretto"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili dedicate a KDP Builder per leggere la validazione reale."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Validazione pre-export"
        eyebrow="Controllo libretto"
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

  const detailResult = await getBookDetail(supabase, id);

  if (detailResult.data === null) {
    return (
      <AppShell
        title={detailResult.notFound ? "Libretto non trovato" : "Errore"}
        eyebrow="Validazione"
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

  const { book, sections, settings } = detailResult.data;
  const blocksResult = await listSectionBlocks(supabase, book.id);

  if (blocksResult.data === null) {
    return (
      <AppShell
        title="Errore"
        eyebrow={book.title}
        description={blocksResult.error}
        actions={
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState title="Errore" description={blocksResult.error} />
      </AppShell>
    );
  }

  const assetsResult = await listAssets(supabase, book.id);

  if (assetsResult.data === null) {
    return (
      <AppShell
        title="Errore"
        eyebrow={book.title}
        description={assetsResult.error}
        actions={
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState title="Errore" description={assetsResult.error} />
      </AppShell>
    );
  }

  const report = buildPreExportValidation({
    assets: assetsResult.data,
    blocks: blocksResult.data,
    book,
    sections,
    settings,
  });

  return (
    <AppShell
      title="Validazione pre-export"
      eyebrow={book.title}
      description="Controlli semplici per capire se il libretto e' pronto per il futuro PDF KDP."
      actions={
        <>
          <Link
            className="secondary-button"
            href={`/libri/${book.id}/anteprima`}
          >
            Vedi anteprima
          </Link>
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
        </>
      }
    >
      <div className="validation-layout">
        <Card title="Esito">
          <div className="validation-summary">
            <div className="validation-final">
              <span
                className={getStatusClassName(
                  report.summary.failed > 0
                    ? "failed"
                    : report.summary.warning > 0
                      ? "warning"
                      : "passed",
                )}
              >
                {report.summary.finalMessage}
              </span>
              <p>
                Controlla gli elementi sotto prima di procedere verso il PDF.
              </p>
            </div>

            <ul className="validation-counts">
              <FieldRow label="OK" value={report.summary.passed} />
              <FieldRow label="Attenzioni" value={report.summary.warning} />
              <FieldRow label="Da sistemare" value={report.summary.failed} />
            </ul>
          </div>
        </Card>

        <Card title="Azioni rapide">
          <div className="card-actions">
            <Link
              className="secondary-button"
              href={`/libri/${book.id}/impostazioni`}
            >
              Modifica impostazioni
            </Link>
            <Link
              className="secondary-button"
              href={`/libri/${book.id}/contenuti`}
            >
              Modifica contenuti
            </Link>
            <Link
              className="secondary-button"
              href={`/libri/${book.id}/anteprima`}
            >
              Vedi anteprima
            </Link>
          </div>
        </Card>

        <section className="validation-category-list">
          {VALIDATION_CATEGORIES.map((category) => {
            const checks = report.checks.filter(
              (check) => check.category === category,
            );

            return (
              <Card
                className="validation-category"
                key={category}
                title={VALIDATION_CATEGORY_LABELS[category]}
              >
                <ul className="validation-check-list">
                  {checks.map((check) => (
                    <ValidationCheckItem check={check} key={check.id} />
                  ))}
                </ul>
              </Card>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
