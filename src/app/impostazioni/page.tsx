import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { FieldRow } from "@/components/ui/field-row";
import { DEFAULT_BOOK_SETTINGS } from "@/lib/kdp/constants";

export default function SettingsPage() {
  return (
    <AppShell
      title="Impostazioni"
      description="Preferenze base del progetto. Le impostazioni operative dei singoli libretti si modificano dentro ogni libretto."
    >
      <div className="grid two">
        <Card title="App">
          <ul className="panel-list">
            <FieldRow label="Brand interno" value="KDP Builder" />
            <FieldRow
              label="Dominio previsto"
              value="kdp.manalicorporate.com"
            />
            <FieldRow label="Accesso" value="Privato" />
          </ul>
        </Card>

        <Card title="Flusso operativo">
          <p className="form-note">
            Formato, carta, font e margini sono impostazioni specifiche del
            libretto: apri un libro e usa la pagina Impostazioni KDP.
          </p>
        </Card>

        <Card title="Default V1">
          <ul className="panel-list">
            <FieldRow
              label="Trim size"
              value={DEFAULT_BOOK_SETTINGS.trimSize}
            />
            <FieldRow label="Body font" value={DEFAULT_BOOK_SETTINGS.bodyFont} />
            <FieldRow
              label="Heading font"
              value={DEFAULT_BOOK_SETTINGS.headingFont}
            />
            <FieldRow label="Margini" value="Conservativi" />
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
