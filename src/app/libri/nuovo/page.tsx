import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateBookForm } from "@/app/libri/nuovo/create-book-form";
import { Card } from "@/components/ui/card";
import { FieldRow } from "@/components/ui/field-row";

export default function NewBookPage() {
  return (
    <AppShell
      title="Nuovo libretto"
      description="Scegli se creare un libretto manualmente oppure analizzare prima una bozza strutturata."
    >
      <div className="grid two">
        <Card title="Crea manualmente">
          <CreateBookForm />
        </Card>

        <Card title="Importa bozza strutturata">
          <p className="page-copy">
            Incolla una bozza KDP Builder e controlla la struttura normalizzata
            prima di creare un libretto salvato.
          </p>
          <ul className="panel-list panel-list-long">
            <FieldRow label="Modalita" value="Anteprima bozza e creazione" />
            <FieldRow
              label="Salvataggio"
              value="Disponibile dopo una preview valida"
            />
            <FieldRow label="Output" value="Report, sezioni, pagine e template" />
          </ul>
          <Link className="button" href="/libri/nuovo/importa">
            Importa bozza strutturata
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
