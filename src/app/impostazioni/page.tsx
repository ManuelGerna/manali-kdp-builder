import { AppShell } from "@/components/app-shell";
import { DEFAULT_BOOK_SETTINGS } from "@/lib/kdp/constants";

export default function SettingsPage() {
  return (
    <AppShell
      title="Impostazioni"
      description="Preferenze iniziali per il progetto KDP Builder."
    >
      <div className="grid two">
        <section className="panel">
          <h2>App</h2>
          <ul className="panel-list">
            <li>
              <span className="panel-label">Brand interno</span>
              <span className="panel-value">KDP Builder</span>
            </li>
            <li>
              <span className="panel-label">Dominio previsto</span>
              <span className="panel-value">kdp.manalicorporate.com</span>
            </li>
            <li>
              <span className="panel-label">Accesso</span>
              <span className="panel-value">Privato</span>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2>Default V1</h2>
          <ul className="panel-list">
            <li>
              <span className="panel-label">Trim size</span>
              <span className="panel-value">{DEFAULT_BOOK_SETTINGS.trimSize}</span>
            </li>
            <li>
              <span className="panel-label">Body font</span>
              <span className="panel-value">{DEFAULT_BOOK_SETTINGS.bodyFont}</span>
            </li>
            <li>
              <span className="panel-label">Heading font</span>
              <span className="panel-value">
                {DEFAULT_BOOK_SETTINGS.headingFont}
              </span>
            </li>
            <li>
              <span className="panel-label">Margini</span>
              <span className="panel-value">Conservativi</span>
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
