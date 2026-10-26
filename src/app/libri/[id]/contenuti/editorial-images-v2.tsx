"use client";

import type { KdpSectionBlock } from "@/lib/kdp/section-blocks";
import { EditorialImageForm, EditorialImageNode } from "./editorial-image-forms";

export type ImageDestination = { value: string; title: string };
export function imageDestinations(subsections: { id: string; title: string }[], chapter: boolean): ImageDestination[] {
  const groups = [{ id: "", title: "Introduzione" }, ...subsections];
  return [
    ...groups.flatMap(s => (["before", "after"] as const).map(edge => ({ value: `group|${s.id}|${edge}`, title: `${s.title}: ${edge === "before" ? "prima" : "dopo"} il testo` }))),
    ...(chapter ? groups.map(s => ({ value: `chapter|${s.id}|after`, title: s.id ? `Tra sottosezioni: dopo ${s.title}` : "Prima della prima sottosezione" })) : []),
  ];
}

export function EditorialImagesV2({ blocks, images, destinations }: {
  blocks: KdpSectionBlock[]; images: Record<string, { url?: string; alt?: string }>; destinations: ImageDestination[];
}) {
  return <>{blocks.map(block => <EditorialImageNode key={block.id} block={block} {...images[block.asset_id ?? ""]}
    canMoveUp={false} canMoveDown={false} v2 destinations={[
      ...destinations,
      ...blocks.filter(b => b.id !== block.id).map((b, i) => ({ value: `image|${b.id}|before`, title: `Prima dell’immagine ${i + 1}` })),
    ]} />)}</>;
}

export function AddImageV2({ bookId, sectionId, subsectionId, chapter = false }: {
  bookId: string; sectionId: string; subsectionId?: string; chapter?: boolean;
}) {
  return <details className="editorial-image-add"><summary className="secondary-button">+ Aggiungi immagine {chapter ? "tra sottosezioni" : "al testo"}</summary>
    <EditorialImageForm bookId={bookId} sectionId={sectionId} subsectionId={subsectionId} chapter={chapter} v2 />
  </details>;
}
