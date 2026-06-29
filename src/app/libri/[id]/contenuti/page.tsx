import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldRow } from "@/components/ui/field-row";
import {
  SECTION_TYPE_LABELS,
  type SectionType,
} from "@/lib/kdp/constants";
import { listSections, type KdpSection } from "@/lib/kdp/sections";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import { DeleteSectionForm, MoveSectionForm } from "./section-actions";
import { SectionCreateForm } from "./section-create-form";
import { SectionEditForm } from "./section-edit-form";

type BookContentsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    status?: string;
  }>;
};

type BookForContents = Pick<
  Tables<"kdp_books">,
  "id" | "subtitle" | "title"
>;

type BookResult =
  | {
      data: BookForContents;
      error: null;
      notFound: false;
    }
  | {
      data: null;
      error: string;
      notFound: boolean;
    };

const STATUS_MESSAGES: Record<string, string> = {
  created: "Sezione creata.",
  deleted: "Sezione eliminata.",
  reordered: "Ordine sezioni aggiornato.",
  updated: "Sezione aggiornata.",
};

async function getBookForContents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookId: string,
): Promise<BookResult> {
  const { data, error } = await supabase
    .from("kdp_books")
    .select("id,title,subtitle")
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    console.error("[kdp-sections:page]", {
      event: "book_query_failed",
      bookIdTail: bookId.slice(-8),
      code: error.code,
    });

    return {
      data: null,
      error: "Non riesco a caricare questo libretto.",
      notFound: false,
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Libretto non trovato o non accessibile.",
      notFound: true,
    };
  }

  return {
    data,
    error: null,
    notFound: false,
  };
}

function formatSectionType(sectionType: string) {
  return (
    SECTION_TYPE_LABELS[sectionType as SectionType] ??
    sectionType.replaceAll("_", " ")
  );
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

function SectionCard({
  index,
  isFirst,
  isLast,
  section,
}: {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  section: KdpSection;
}) {
  const title = section.title || "Senza titolo";

  return (
    <article className="section-card">
      <div className="section-card-header">
        <div>
          <p className="section-meta">
            {index + 1}. {formatSectionType(section.section_type)}
          </p>
          <h2>{title}</h2>
        </div>
      </div>

      {section.body ? (
        <p className="section-body-preview">{section.body}</p>
      ) : (
        <p className="section-empty-body">Corpo vuoto.</p>
      )}

      <div className="section-actions">
        <MoveSectionForm
          bookId={section.book_id}
          direction="up"
          disabled={isFirst}
          sectionId={section.id}
        />
        <MoveSectionForm
          bookId={section.book_id}
          direction="down"
          disabled={isLast}
          sectionId={section.id}
        />
        <DeleteSectionForm
          bookId={section.book_id}
          sectionId={section.id}
          title={title}
        />
      </div>

      <details className="section-edit-panel">
        <summary className="secondary-button section-edit-toggle">
          Modifica
        </summary>
        <SectionEditForm section={section} />
      </details>
    </article>
  );
}

export default async function BookContentsPage({
  params,
  searchParams,
}: BookContentsPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  if (!hasSupabaseServerConfig()) {
    return (
      <AppShell
        title="Contenuti libretto"
        eyebrow="Sezioni"
        description="Supabase non configurato."
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState
          title="Supabase non configurato"
          description="Configura le variabili dedicate a KDP Builder per gestire le sezioni."
        />
      </AppShell>
    );
  }

  const supabase = await createClient().catch(() => null);

  if (!supabase) {
    return (
      <AppShell
        title="Contenuti libretto"
        eyebrow="Sezioni"
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

  const bookResult = await getBookForContents(supabase, id);

  if (bookResult.data === null) {
    return (
      <AppShell
        title={bookResult.notFound ? "Libretto non trovato" : "Errore"}
        eyebrow="Sezioni"
        description={bookResult.error}
        actions={
          <Link className="secondary-button" href="/libri">
            Torna ai libri
          </Link>
        }
      >
        <EmptyState
          title={bookResult.notFound ? "Libretto non trovato" : "Errore"}
          description={bookResult.error}
        />
      </AppShell>
    );
  }

  const sectionsResult = await listSections(supabase, id);

  if (sectionsResult.data === null) {
    return (
      <AppShell
        title="Errore"
        eyebrow={bookResult.data.title}
        description={sectionsResult.error}
        actions={
          <Link className="secondary-button" href={`/libri/${id}`}>
            Torna al libretto
          </Link>
        }
      >
        <EmptyState title="Errore" description={sectionsResult.error} />
      </AppShell>
    );
  }

  const book = bookResult.data;
  const sections = sectionsResult.data;
  const pageMessage = getPageMessage(resolvedSearchParams);

  return (
    <AppShell
      title="Contenuti libretto"
      eyebrow={book.title}
      description={book.subtitle || "Gestione minima delle sezioni del libretto."}
      actions={
        <Link className="secondary-button" href={`/libri/${book.id}`}>
          Torna al libretto
        </Link>
      }
    >
      <div className="content-layout">
        {pageMessage ? (
          <p
            className="form-note"
            role={pageMessage.tone === "error" ? "alert" : "status"}
          >
            {pageMessage.text}
          </p>
        ) : null}

        <div className="grid two" id="nuova-sezione">
          <Card title="Aggiungi sezione">
            <SectionCreateForm bookId={book.id} />
          </Card>

          <Card title="Riepilogo">
            <ul className="panel-list">
              <FieldRow label="Titolo" value={book.title} />
              <FieldRow label="Sezioni" value={sections.length} />
              <FieldRow
                label="Prossima posizione"
                value={sections.length + 1}
              />
            </ul>
          </Card>
        </div>

        {sections.length === 0 ? (
          <EmptyState
            action={
              <a className="button" href="#nuova-sezione">
                Aggiungi sezione
              </a>
            }
            title="Nessuna sezione"
            description="Questo libretto non ha ancora contenuti."
          />
        ) : (
          <section className="section-list" aria-label="Sezioni contenuto">
            {sections.map((section, index) => (
              <SectionCard
                index={index}
                isFirst={index === 0}
                isLast={index === sections.length - 1}
                key={section.id}
                section={section}
              />
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
