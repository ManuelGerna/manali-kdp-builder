import { AppShell } from "@/components/app-shell";
import {
  AI_USAGE_OPTIONS,
  BOOK_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
} from "@/lib/kdp/constants";

export default function NewBookPage() {
  return (
    <AppShell
      title="Nuovo libretto"
      description="Base form per i dati iniziali del progetto editoriale."
    >
      <section className="panel">
        <p className="form-note">
          Il salvataggio reale verra&apos; collegato al database nel Task 02.
        </p>

        <form className="form-grid">
          <div className="grid two">
            <div className="field">
              <label htmlFor="title">Titolo</label>
              <input id="title" name="title" placeholder="Titolo del libretto" />
            </div>

            <div className="field">
              <label htmlFor="subtitle">Sottotitolo</label>
              <input
                id="subtitle"
                name="subtitle"
                placeholder="Sottotitolo opzionale"
              />
            </div>
          </div>

          <div className="grid two">
            <div className="field">
              <label htmlFor="author_name">Autore / pen name</label>
              <input id="author_name" name="author_name" placeholder="Nome autore" />
            </div>

            <div className="field">
              <label htmlFor="language">Lingua</label>
              <select id="language" name="language" defaultValue="it">
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid two">
            <div className="field">
              <label htmlFor="book_type">Tipo libretto</label>
              <select
                id="book_type"
                name="book_type"
                defaultValue="crystal_guide_journal"
              >
                {BOOK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="ai_usage_type">Uso AI</label>
              <select id="ai_usage_type" name="ai_usage_type" defaultValue="none">
                {AI_USAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="internal_description">Descrizione interna</label>
            <textarea
              id="internal_description"
              name="internal_description"
              placeholder="Note operative interne sul libretto"
            />
          </div>

          <button className="button" disabled type="button">
            Crea libretto
          </button>
        </form>
      </section>
    </AppShell>
  );
}
