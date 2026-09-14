import { bootstrapEditorialBuilderAction } from "./editorial-actions";

export function EditorialSetup({ bookId, error }: { bookId: string; error: string | null }) {
  return <div className="editorial-builder-intro">
    <h2>{error ? "Struttura non disponibile" : "Il tuo libro, pronto da organizzare"}</h2>
    <p role={error ? "alert" : undefined}>{error || "Attiva l'editor usando capitoli e sottosezioni già riconosciuti nell'importazione."}</p>
    {!error ? <form action={bootstrapEditorialBuilderAction}>
      <input name="book_id" value={bookId} type="hidden" />
      <button className="button" type="submit">Prepara struttura editoriale</button>
    </form> : null}
  </div>;
}
