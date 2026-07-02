import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { GenericDraftImportForm } from "@/components/kdp/generic-draft-import-form";
import { Card } from "@/components/ui/card";
import { FieldRow } from "@/components/ui/field-row";

export default function NewBookDraftImportPage() {
  return (
    <AppShell
      title="Anteprima bozza"
      eyebrow="Nuovo libretto"
      description="Analizza una bozza KDP Builder prima di creare un progetto definitivo."
      actions={
        <Link className="secondary-button" href="/libri/nuovo">
          Torna a Nuovo libretto
        </Link>
      }
    >
      <div className="draft-import-layout">
        <div className="grid two">
          <Card title="Importa bozza strutturata">
            <p className="page-copy">
              Incolla una bozza strutturata per generare una anteprima
              normalizzata con progetto, sezioni, pagine, template e avvisi.
            </p>
            <GenericDraftImportForm />
          </Card>

          <Card title="Stato del flusso">
            <ul className="panel-list panel-list-long">
              <FieldRow
                label="Anteprima"
                value="La bozza viene analizzata senza creare un libretto."
              />
              <FieldRow
                label="Salvataggio"
                value="Nessun libretto verra salvato in questa fase."
              />
              <FieldRow
                label="PDF"
                value="Nessun PDF verra generato da questa pagina."
              />
              <FieldRow
                label="Prossimo passaggio"
                value="Il salvataggio definitivo sara implementato in un passaggio successivo."
              />
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
