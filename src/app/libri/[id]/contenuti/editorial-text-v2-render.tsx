import type { EditorialTextGroupV2, LiteralDocument } from "@/lib/kdp/editorial-text-v2";
import { EditorialImagePreview } from "./editorial-image-forms";

export function EditorialDocumentV2({ doc, print = false }: { doc: LiteralDocument; print?: boolean }) {
  return <div className="editorial-v2-document">{doc.content.filter(p => !print || p.attrs.visibility === "print").map((p, index) =>
    <p key={index}>{(p.content ?? []).map((node, i) => node.type === "hardBreak" ? <br key={i} /> :
      node.marks?.some(mark => mark.type === "bold") ? <strong key={i}>{node.text}</strong> : <span key={i}>{node.text}</span>)}
      {!p.content?.length && <br />}</p>)}</div>;
}

export function EditorialGroupV2View({ group, images = {}, print = false }: {
  group: EditorialTextGroupV2; images?: Record<string, { url?: string; alt?: string }>; print?: boolean;
}) {
  const blocks = new Map(group.source.blocks.map(block => [block.id, block]));
  return <>{group.nodes.map(node => {
    if (node.kind === "text") return <EditorialDocumentV2 key={node.id} doc={node.doc} print={print} />;
    const block = blocks.get(node.id)!;
    if (print && block.print_visibility !== "print") return null;
    if (["image", "image_prompt"].includes(block.block_type)) return <div key={block.id} id={`block-${block.id}`} contentEditable={false} className="editorial-writing-image">
      <EditorialImagePreview notes={block.editor_notes} {...images[block.asset_id ?? ""]} />
    </div>;
    if (block.block_type === "internal_note" || block.block_type === "page_break") return null;
    return <div key={block.id} id={`block-${block.id}`}><h4>{block.title}</h4>{block.body !== null && <p className="editorial-prose">{block.body}</p>}</div>;
  })}</>;
}
