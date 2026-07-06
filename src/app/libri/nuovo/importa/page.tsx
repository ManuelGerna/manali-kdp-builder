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
      description="Analizza una bozza KDP_DRAFT_V1 o legacy e crea un libretto salvato dopo una preview valida."
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
              Incolla una bozza KDP_DRAFT_V1 o legacy per generare una
              anteprima normalizzata con progetto, sezioni, pagine, template e
              avvisi. Se il report non contiene errori bloccanti, potrai
              creare il libretto da questa bozza.
            </p>
            <GenericDraftImportForm enableCreateBook />
          </Card>

          <Card title="Stato del flusso">
            <ul className="panel-list panel-list-long">
              <FieldRow
                label="Anteprima"
                value="La bozza viene analizzata prima del salvataggio e mostra formato, titolo, trim size e pagine generate."
              />
              <FieldRow
                label="Salvataggio"
                value="Dopo una preview valida puoi creare un libretto salvato."
              />
              <FieldRow
                label="PDF"
                value="Nessun PDF verra generato da questa pagina."
              />
              <FieldRow
                label="Prossimo passaggio"
                value="Renderer, copertina e integrazione KDP restano passaggi successivi."
              />
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
