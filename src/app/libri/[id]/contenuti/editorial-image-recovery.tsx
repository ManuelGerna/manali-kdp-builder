"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveEditorialImageAction } from "./editorial-actions";

type Destination = { sectionId: string; subsectionId?: string; revision: number; title: string };
function RecoveryButtons() {
  const { pending } = useFormStatus();
  return <div className="editorial-inline-actions">
    <button className="button" disabled={pending} name="operation" value="add_image">Recupera immagine</button>
    <button className="ghost-button" disabled={pending} name="operation" value="discard_image_upload">Elimina upload interrotto</button>
  </div>;
}
export function EditorialImageRecovery({ bookId, assets, destinations }: {
  bookId: string; assets: { id: string; title: string | null }[]; destinations: Destination[];
}) {
  const [destinationIndex, setDestinationIndex] = useState(0);
  const destination = destinations[destinationIndex];
  if (!assets.length || !destination) return null;
  return <details className="editorial-add-panel"><summary>Upload da recuperare ({assets.length})</summary>
    <p>Puoi inserire le immagini già caricate senza caricarle di nuovo, oppure eliminarle. Gli upload scadono dopo un’ora.</p>
    <label>Destinazione<select value={destinationIndex} onChange={event => setDestinationIndex(Number(event.target.value))}>
      {destinations.map((item, index) => <option key={`${item.sectionId}:${item.subsectionId ?? ""}`} value={index}>{item.title}</option>)}
    </select></label>
    {assets.map(asset => <form key={asset.id} action={saveEditorialImageAction}>
      <p>{asset.title || "Immagine senza titolo"}</p>
      <input type="hidden" name="book_id" value={bookId} />
      <input type="hidden" name="section_id" value={destination.sectionId} />
      <input type="hidden" name="subsection_id" value={destination.subsectionId ?? ""} />
      <input type="hidden" name="revision" value={destination.revision} />
      <input type="hidden" name="pending_asset_id" value={asset.id} />
      <input type="hidden" name="size" value="medium" /><input type="hidden" name="align" value="center" />
      <RecoveryButtons />
    </form>)}
  </details>;
}
