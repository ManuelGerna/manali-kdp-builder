import { AppShell } from "@/components/app-shell";
import { CreateBookForm } from "@/app/libri/nuovo/create-book-form";

export default function NewBookPage() {
  return (
    <AppShell
      title="Nuovo libretto"
      description="Base form per i dati iniziali del progetto editoriale."
    >
      <section className="panel">
        <CreateBookForm />
      </section>
    </AppShell>
  );
}
