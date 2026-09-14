import { buildEditorialBlockHierarchy, isEditorialTextContent, getEditorialSectionTitle, readEditorialMap } from "@/lib/kdp/editorial-hierarchy";
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
  return block.print_visibility === "print" && isEditorialTextContent(block);
}

function PreviewText({ block }: { block: KdpSectionBlock }) {
  return (
    <div className="book-preview-text">
      {block.title ? <h4>{block.title}</h4> : null}
      {block.body ? <p>{block.body}</p> : null}
    </div>
  );
}


export function EditorialPreview({ sections, blocks }: { sections: KdpSection[]; blocks: KdpSectionBlock[] }) {
  const blocksBySection = groupBlocksBySection(blocks);
  let chapterCounter = 0;
  const editorialSections = sections.map((section) => {
    if (section.section_type === "chapter") chapterCounter += 1;

    const blocks = blocksBySection.get(section.id) ?? [];
    const hierarchy = buildEditorialBlockHierarchy(blocks, readEditorialMap(section.settings, blocks));
    // Visibility must not erase a structural boundary and merge unrelated text.
    hierarchy.subsections = hierarchy.subsections.filter(({ marker, blocks }) =>
      marker.print_visibility === "print" || blocks.some(isEditorialPreviewBlock),
    );

    return {
      hierarchy,
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
            {editorialSections.map(({ hierarchy, section, title }) => {
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

                  {section.body ? (
                    <p className="book-preview-lead">{section.body}</p>
                  ) : null}

                  {openingBlocks.map((block) => (
                    <PreviewText block={block} key={block.id} />
                  ))}

                  {hierarchy.subsections.map((subsection) => (
                    <section
                      className="book-preview-subsection"
                      id={`preview-subsection-${subsection.marker.id}`}
                      key={subsection.marker.id}
                    >
                      {subsection.marker.print_visibility === "print" ? <h3>{subsection.marker.title}</h3> : null}
                      {subsection.marker.print_visibility === "print" && subsection.marker.body ? (
                        <p className="book-preview-lead">{subsection.marker.body}</p>
                      ) : null}
                      {subsection.blocks
                        .filter(isEditorialPreviewBlock)
                        .map((block) => (
                          <PreviewText block={block} key={block.id} />
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
