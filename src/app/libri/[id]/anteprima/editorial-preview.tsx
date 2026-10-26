import { isEditorialTextContent, getEditorialSectionTitle } from "@/lib/kdp/editorial-hierarchy";
import { readEditorialSectionText } from "@/lib/kdp/editorial-text-v2";
import { EditorialGroupV2View } from "../contenuti/editorial-text-v2-render";
import { EditorialImagePreview } from "../contenuti/editorial-image-forms";
import type { KdpSectionBlock } from "@/lib/kdp/section-blocks";
import type { KdpSection } from "@/lib/kdp/sections";

function groupBlocksBySection(blocks: KdpSectionBlock[]) {
  const grouped = new Map<string, KdpSectionBlock[]>();

  for (const block of blocks) {
    const sectionBlocks = grouped.get(block.section_id) ?? [];
    sectionBlocks.push(block);
    grouped.set(block.section_id, sectionBlocks);
  }

  return grouped;
}

function isEditorialPreviewBlock(block: KdpSectionBlock) {
  return block.print_visibility === "print" && (isEditorialTextContent(block) || ["image", "image_prompt"].includes(block.block_type));
}

function PreviewText({ block, images }: { block: KdpSectionBlock; images: Record<string, { url?: string; alt?: string }> }) {
  if (["image", "image_prompt"].includes(block.block_type)) return <EditorialImagePreview notes={block.editor_notes} {...images[block.asset_id ?? ""]} />;
  return (
    <div className="book-preview-text">
      {block.title ? <h4>{block.title}</h4> : null}
      {block.body ? <p>{block.body}</p> : null}
    </div>
  );
}


export function EditorialPreview({ sections, blocks, images = {} }: { sections: KdpSection[]; blocks: KdpSectionBlock[]; images?: Record<string, { url?: string; alt?: string }> }) {
  const blocksBySection = groupBlocksBySection(blocks);
  let chapterCounter = 0;
  const editorialSections = sections.map((section) => {
    if (section.section_type === "chapter") chapterCounter += 1;

    const blocks = blocksBySection.get(section.id) ?? [];
    const text = readEditorialSectionText(section, blocks);
    const hierarchy = { openingBlocks: text.opening.group.source.blocks, subsections: text.subsections };
    // Visibility must not erase a structural boundary and merge unrelated text.
    hierarchy.subsections = hierarchy.subsections.filter(({ marker, blocks, text }) =>
      marker.print_visibility === "print" || blocks.some(isEditorialPreviewBlock) ||
      (text.format === "v2" && text.group.nodes.some(n => n.kind === "text" && n.doc.content.some(p => p.attrs.visibility === "print"))),
    );

    return {
      hierarchy,
      text,
      section,
      title: getEditorialSectionTitle(
        section,
        section.section_type === "chapter" ? chapterCounter : null,
      ),
    };
  });

  return (
        <div className="book-preview-layout">
          <nav className="book-preview-toc" aria-label="Indice">
            <p className="book-preview-kicker">Indice</p>
            <h2>Nel libro</h2>
            <ol>
              {editorialSections.map(({ hierarchy, section, title }) => (
                <li key={section.id}>
                  <a href={`#preview-section-${section.id}`}>{title}</a>
                  {hierarchy.subsections.length > 0 ? (
                    <ul>
                      {hierarchy.subsections.filter(({ marker }) => marker.print_visibility === "print").map((subsection) => (
                        <li key={subsection.marker.id}>
                          <a href={`#preview-subsection-${subsection.marker.id}`}>
                            {subsection.marker.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </nav>

          <div className="book-preview-manuscript" aria-label="Contenuto del libro">
            {editorialSections.map(({ hierarchy, section, title, text }) => {
              const openingBlocks = hierarchy.openingBlocks.filter(
                isEditorialPreviewBlock,
              );

              return (
                <article id={`preview-section-${section.id}`} key={section.id}>
                  <header>
                    <p className="book-preview-kicker">
                      {section.section_type === "introduction"
                        ? "Introduzione"
                        : section.section_type === "chapter"
                          ? "Capitolo"
                          : "Sezione"}
                    </p>
                    <h2>{title}</h2>
                    {section.subtitle ? <p>{section.subtitle}</p> : null}
                  </header>

                  {text.opening.format === "v1" && section.body ? (
                    <p className="book-preview-lead">{section.body}</p>
                  ) : null}

                  {text.opening.format === "v2" ? <EditorialGroupV2View group={text.opening.group} images={images} print /> : openingBlocks.map((block) => (
                    <PreviewText block={block} key={block.id} images={images} />
                  ))}

                  {hierarchy.subsections.map((subsection) => (
                    <section
                      className="book-preview-subsection"
                      id={`preview-subsection-${subsection.marker.id}`}
                      key={subsection.marker.id}
                    >
                      {subsection.marker.print_visibility === "print" ? <h3>{subsection.marker.title}</h3> : null}
                      {subsection.text.format === "v1" && subsection.marker.print_visibility === "print" && subsection.marker.body ? (
                        <p className="book-preview-lead">{subsection.marker.body}</p>
                      ) : null}
                      {subsection.text.format === "v2" ? <EditorialGroupV2View group={subsection.text.group} images={images} print /> : subsection.blocks
                        .filter(isEditorialPreviewBlock)
                        .map((block) => (
                          <PreviewText block={block} key={block.id} images={images} />
                        ))}
                    </section>
                  ))}
                </article>
              );
            })}
          </div>
        </div>
  );
}
