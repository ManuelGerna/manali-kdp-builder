import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { CopyField } from "@/components/ui/copy-field";
import { EmptyState } from "@/components/ui/empty-state";
import { getBookDetail } from "@/lib/kdp/books";
import { buildKdpCopyFieldGroups } from "@/lib/kdp/copy-fields";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type KdpFieldsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function KdpFieldsPage({ params }: KdpFieldsPageProps) {
  const { id } = await params;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Dati per Amazon KDP"
        eyebrow="Dati KDP"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili dedicate a KDP Builder per leggere i dati KDP."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Dati per Amazon KDP"
        eyebrow="Dati KDP"
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
        eyebrow="Dati KDP"
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
  const fieldGroups = buildKdpCopyFieldGroups({
    book,
    settings,
  });

  return (
    <AppShell
      title="Dati per Amazon KDP"
      eyebrow={book.title}
      description="Campi principali pronti da copiare manualmente durante la pubblicazione."
      actions={
        <Link className="secondary-button" href={`/libri/${book.id}`}>
          Torna al libretto
        </Link>
      }
    >
      <div className="kdp-copy-layout">
        {fieldGroups.map((group) => (
          <Card
            className={`kdp-panel kdp-panel-${group.id}`}
            key={group.id}
            title={group.title}
          >
            <div className="copy-field-list">
              {group.fields.map((field) => (
                <CopyField
                  key={field.id}
                  label={field.label}
                  value={field.value}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
