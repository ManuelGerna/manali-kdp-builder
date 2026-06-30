import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import { getBookDetail } from "@/lib/kdp/books";
import {
  DEFAULT_BOOK_SETTINGS,
  INTERIOR_TYPE_LABELS,
  PAPER_TYPE_LABELS,
  type InteriorType,
  type PaperType,
} from "@/lib/kdp/constants";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import { SettingsForm } from "@/app/libri/[id]/impostazioni/settings-form";

type BookSettingsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    status?: string;
  }>;
};

function formatInteriorType(interiorType: string) {
  return (
    INTERIOR_TYPE_LABELS[interiorType as InteriorType] ??
    interiorType.replaceAll("_", " ")
  );
}

function formatPaperType(paperType: string) {
  return PAPER_TYPE_LABELS[paperType as PaperType] ?? paperType;
}

export default async function BookSettingsPage({
  params,
  searchParams,
}: BookSettingsPageProps) {
  const { id } = await params;
  const { status } = await searchParams;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Impostazioni KDP"
        eyebrow="Formato libretto"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili dedicate a KDP Builder per modificare le impostazioni del libretto."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Impostazioni KDP"
        eyebrow="Formato libretto"
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
        eyebrow="Impostazioni KDP"
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

  const { book, settings } = detailResult.data;

  return (
    <AppShell
      title="Impostazioni KDP"
      eyebrow={book.title}
      description="Formato, carta, font e margini usati dal flusso guidato del libretto."
      actions={
        <>
          <Link className="secondary-button" href={`/libri/${book.id}`}>
            Torna al libretto
          </Link>
          <Link className="secondary-button" href={`/libri/${book.id}/kdp`}>
            Dati KDP copiabili
          </Link>
        </>
      }
    >
      <div className="grid two settings-page-grid">
        <Card title="Formato guidato">
          {status === "saved" ? (
            <p className="form-note" role="status">
              Impostazioni KDP salvate.
            </p>
          ) : null}

          {settings ? (
            <SettingsForm bookId={book.id} settings={settings} />
          ) : (
            <EmptyState
              title="Impostazioni KDP mancanti"
              description="Questo libretto non ha ancora il record settings collegato. Creane uno prima di modificare il formato."
            />
          )}
        </Card>

        <Card title="Default V1">
          <ul className="panel-list">
            <FieldRow
              label="Trim size"
              value={DEFAULT_BOOK_SETTINGS.trimSize}
            />
            <FieldRow
              label="Interno"
              value={formatInteriorType(DEFAULT_BOOK_SETTINGS.interiorType)}
            />
            <FieldRow
              label="Carta"
              value={formatPaperType(DEFAULT_BOOK_SETTINGS.paperType)}
            />
            <FieldRow
              label="Font corpo"
              value={`${DEFAULT_BOOK_SETTINGS.bodyFont} ${DEFAULT_BOOK_SETTINGS.bodyFontSize} pt`}
            />
            <FieldRow
              label="Line height"
              value={DEFAULT_BOOK_SETTINGS.lineHeight}
            />
            <FieldRow
              label="Margini"
              value={`${DEFAULT_BOOK_SETTINGS.marginTop}/${DEFAULT_BOOK_SETTINGS.marginBottom}/${DEFAULT_BOOK_SETTINGS.marginInner}/${DEFAULT_BOOK_SETTINGS.marginOuter}`}
            />
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
