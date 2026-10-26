"use client";

import { createContext, useContext, type ReactNode } from "react";
import { EditorialImageForm, EditorialImageNode } from "./editorial-image-forms";
import { EditorialSubsectionTextEditor } from "./editorial-text-editor";
import { openingTextSnapshots } from "@/lib/kdp/editorial-text-editor";
import { readEditorialSectionText, type EditorialTextGroupRead } from "@/lib/kdp/editorial-text-v2";
import { isEditorialTextV2Canary } from "@/lib/kdp/editorial-text-v2-gate";
import { EditorialTextV2Editor } from "./editorial-text-v2-editor";
import { EditorialGroupV2View } from "./editorial-text-v2-render";
import { AddImageV2, EditorialImagesV2, imageDestinations, type ImageDestination } from "./editorial-images-v2";
import { chapterImages, readImagePlacement } from "@/lib/kdp/editorial-image-placement";
const ImageContext = createContext<Record<string, { url?: string; alt?: string }>>({});
const ImageDestinationContext = createContext<ImageDestination[]>([]);

import { EditorialDisclosure, EditorialRevisionContext, EditorialDraftProvider, EditorialTextV2Context } from "./editorial-disclosure";
import {
  buildEditorialBlockHierarchy,
  isEditorialTextContent,
  getEditorialSectionTitle,
  readEditorialMap,
} from "@/lib/kdp/editorial-hierarchy";
import type { KdpSectionBlock } from "@/lib/kdp/section-blocks";
import type { KdpSection } from "@/lib/kdp/sections";
import {
  DeleteSectionForm,
  MoveSectionForm,
} from "./section-actions";
import {
  AddEditorialSubsectionForm,
  AddEditorialTextForm,
  DeleteEditorialSubsectionForm,
  EditEditorialBlockForm,
  EditEditorialSectionForm,
  MoveEditorialSubsectionForm,
  MoveEditorialTextForm,
  DeleteEditorialTextForm,
} from "./editorial-builder-forms";

type EditorialBuilderProps = {
  blocksBySection: Map<string, KdpSectionBlock[]>;
  sections: KdpSection[];
  images?: Record<string, { url?: string; alt?: string }>;
  textEditorV2Enabled?: boolean;
};

function GroupEditor({ section, blocks, revision, text, images, children }: {
  section: KdpSection; blocks: KdpSectionBlock[]; revision: number; text: EditorialTextGroupRead;
  images: Record<string, { url?: string; alt?: string }>; children: ReactNode;
}) {
  const localV2 = useContext(EditorialTextV2Context);
  const destinations = useContext(ImageDestinationContext);
  if (localV2 || (text.format === "v2" && isEditorialTextV2Canary(section.book_id, section.id, text.group.subsection_id))) {
    return <EditorialTextV2Editor bookId={section.book_id} sectionId={section.id} revision={revision} group={text.group} images={images} imageDestinations={destinations}>
      <AddImageV2 bookId={section.book_id} sectionId={section.id} subsectionId={text.group.subsection_id ?? undefined} />
    </EditorialTextV2Editor>;
  }
  if (text.format === "v2") return <EditorialGroupV2View group={{ ...text.group, nodes: text.group.nodes.filter(node => node.kind === "text" ||
    readImagePlacement(text.group.source.blocks.find(b => b.id === node.id)?.editor_notes ?? null)?.scope !== "chapter") }} images={images} />;
  return <EditorialSubsectionTextEditor bookId={section.book_id} sectionId={section.id} subsectionId={text.group.subsection_id}
    revision={revision} blocks={text.group.subsection_id === null ? openingTextSnapshots(section.id, section.body, blocks) : blocks} images={images}>{children}</EditorialSubsectionTextEditor>;
}

function getSectionKind(sectionType: string) {
  if (sectionType === "introduction") return "Introduzione";
  if (sectionType === "chapter") return "Capitolo";
  if (sectionType === "conclusion") return "Conclusione";
  return "Sezione";
}

function EditorialTextNode({
  block,
  canMoveDown,
  canMoveUp,
  destinations,
  currentSubsectionId,
  toolsOnly = false,
}: {
  block: KdpSectionBlock;
  canMoveDown: boolean;
  canMoveUp: boolean;
  destinations: { id: string; title: string }[];
  currentSubsectionId?: string;
  toolsOnly?: boolean;
}) {
  return (
    <div className="editorial-text-node scroll-target" id={`${toolsOnly ? "organize-" : ""}block-${block.id}`}>
      <div className="editorial-node-content">
        {toolsOnly ? <p>{block.title || block.body?.split(/\r\n|\r|\n/)[0]}</p> : <>
        {block.title ? <h4>{block.title}</h4> : null}
        {block.body ? <p className="editorial-prose">{block.body}</p> : null}

          <EditorialDisclosure className="editorial-edit-panel">
            <summary className="ghost-button">Modifica testo</summary>
            <EditEditorialBlockForm block={block} />
          </EditorialDisclosure>
        </>}

        <EditorialDisclosure className="editorial-text-tools">
          <summary className="ghost-button">Organizza testo</summary>
          <div className="editorial-inline-actions">
          {canMoveUp ? (
            <MoveEditorialTextForm
              block={block}
              direction="up"
            />
          ) : null}
          {canMoveDown ? (
            <MoveEditorialTextForm
              block={block}
              direction="down"
            />
          ) : null}
          <DeleteEditorialTextForm block={block} subsectionId={currentSubsectionId} />
          </div>
          {destinations.length > 0 ? (
            <EditorialDisclosure className="editorial-edit-panel">
              <summary className="ghost-button">Sposta in una sottosezione</summary>
              <MoveEditorialTextForm block={block} destinations={destinations} currentSubsectionId={currentSubsectionId} />
            </EditorialDisclosure>
          ) : null}
        </EditorialDisclosure>
      </div>
    </div>
  );
}

function EditorialTextList({ blocks, destinations, currentSubsectionId, toolsOnly = false }: {
  blocks: KdpSectionBlock[];
  destinations: { id: string; title: string }[];
  currentSubsectionId?: string;
  toolsOnly?: boolean;
}) {
  const images = useContext(ImageContext);
  const textBlocks = blocks.filter(b => isEditorialTextContent(b) || b.block_type === "image");

  if (textBlocks.length === 0) {
    return <p className="editorial-empty-copy">Nessun testo ancora.</p>;
  }

  return (
    <div className="editorial-text-list">
      {textBlocks.map((block, index) => (
        block.block_type === "image" ? <EditorialImageNode key={block.id} block={block} anchorPrefix={toolsOnly ? "organize-" : ""} {...images[block.asset_id ?? ""]} canMoveUp={index > 0} canMoveDown={index < textBlocks.length - 1} /> : <EditorialTextNode
          block={block}
          canMoveDown={index < textBlocks.length - 1}
          canMoveUp={index > 0}
          key={block.id}
          destinations={destinations}
          currentSubsectionId={currentSubsectionId}
          toolsOnly={toolsOnly}
        />
      ))}
    </div>
  );
}

export function EditorialOpeningTextEditor({ section, blocks, revision, destinations, images, text }: {
  section: KdpSection; blocks: KdpSectionBlock[]; revision: number;
  destinations: { id: string; title: string }[];
  images: Record<string, { url?: string; alt?: string }>;
  text?: EditorialTextGroupRead;
}) {
  // Direct callers may supply only opening rows; preserve the V1 path as well.
  if (!text) return <EditorialSubsectionTextEditor bookId={section.book_id} sectionId={section.id}
    subsectionId={null} revision={revision} blocks={openingTextSnapshots(section.id, section.body, blocks)} images={images}>
    <EditorialDisclosure className="editorial-text-tools"><summary className="ghost-button">Organizza paragrafi e immagini</summary><EditorialTextList blocks={blocks} destinations={destinations} toolsOnly /></EditorialDisclosure>
    <details><summary>+ Aggiungi immagine</summary><EditorialImageForm bookId={section.book_id} sectionId={section.id} /></details>
  </EditorialSubsectionTextEditor>;
  return <GroupEditor section={section} blocks={blocks} revision={revision} text={text} images={images}>
    <EditorialDisclosure className="editorial-text-tools">
      <summary className="ghost-button">Organizza paragrafi e immagini</summary>
      <EditorialTextList blocks={blocks} destinations={destinations} toolsOnly />
    </EditorialDisclosure>
    <details><summary>+ Aggiungi immagine</summary><EditorialImageForm bookId={section.book_id} sectionId={section.id} /></details>
  </GroupEditor>;
}

function EditorialSectionNode({
  blocks,
  chapterNumber,
  index,
  section,
  sectionCount,
}: {
  blocks: KdpSectionBlock[];
  chapterNumber: number | null;
  index: number;
  section: KdpSection;
  sectionCount: number;
}) {
  const images = useContext(ImageContext);
  const map = readEditorialMap(section.settings, blocks);
  const hierarchy = buildEditorialBlockHierarchy(blocks, map);
  const text = readEditorialSectionText(section, blocks);
  const localV2 = useContext(EditorialTextV2Context);
  const v2Mode = localV2 || text.opening.format === "v2" || text.subsections.some(s => s.text.format === "v2");
  const title = getEditorialSectionTitle(section, chapterNumber);
  const destinations = hierarchy.subsections.map(({ marker }) => ({ id: marker.id, title: marker.title?.trim() || "Senza titolo" }));
  const sectionKind = getSectionKind(section.section_type);

  return (
    <EditorialRevisionContext.Provider value={map.revision}>
    <ImageDestinationContext.Provider value={imageDestinations(destinations, section.section_type === "chapter")}>
    <EditorialDisclosure className="editorial-section-node scroll-target" id={`section-${section.id}`} targets={blocks.map(b => `block-${b.id}`)}>
      <summary className="editorial-node-summary editorial-section-summary">
        <span className="editorial-node-label">{sectionKind}</span>
        <span className="editorial-section-title">{title}</span>
        <span className="editorial-child-count">
          {hierarchy.subsections.length > 0
            ? `${hierarchy.subsections.length} ${hierarchy.subsections.length === 1 ? "sottosezione" : "sottosezioni"}`
            : "Testo"}
        </span>
      </summary>

      <div className="editorial-section-content">
        {section.subtitle ? (
          <p className="editorial-section-subtitle">{section.subtitle}</p>
        ) : null}

        {hierarchy.subsections.length === 0 ? (
            <EditorialOpeningTextEditor section={section} blocks={hierarchy.openingBlocks} revision={map.revision} destinations={destinations} images={images} text={text.opening} />
          ) : (
          <EditorialDisclosure className="editorial-opening-node">
            <summary className="editorial-node-summary editorial-subsection-summary">
              <span className="editorial-node-label">Apertura</span>
              <span>Testo introduttivo</span>
            </summary>
            <div className="editorial-subsection-content">
              <EditorialOpeningTextEditor section={section} blocks={hierarchy.openingBlocks} revision={map.revision} destinations={destinations} images={images} text={text.opening} />
            </div>
          </EditorialDisclosure>)}

        <div className="editorial-subsection-list">
          {v2Mode && section.section_type === "chapter" && <>
            <EditorialImagesV2 blocks={chapterImages(blocks, null)} images={images} destinations={imageDestinations(destinations, true)} />
            <AddImageV2 bookId={section.book_id} sectionId={section.id} chapter />
          </>}
          {hierarchy.subsections.map((subsection, subsectionIndex) => {
            const subsectionTitle = subsection.marker.title?.trim() || "Senza titolo";
            const textCount = subsection.blocks.filter(isEditorialTextContent).length;
            const subsectionText = text.subsections.find(s => s.marker.id === subsection.marker.id)!.text;

            return (
              <div key={subsection.marker.id} className="editorial-subsection-with-images"><EditorialDisclosure
                className="editorial-subsection-node scroll-target"
                id={`block-${subsection.marker.id}`}
                key={subsection.marker.id}
                targets={subsection.blocks.map(b => `block-${b.id}`)}
              >
                <summary className="editorial-node-summary editorial-subsection-summary">
                  <span className="editorial-node-label">Sottosezione</span>
                  <span>{subsectionTitle}</span>
                  <span className="editorial-child-count">
                    {localV2 || subsectionText.format === "v2" ? "Testo" : `${textCount} ${textCount === 1 ? "testo" : "testi"}`}
                  </span>
                </summary>
                <div className="editorial-subsection-content">
                  {!localV2 && subsectionText.format === "v1" && subsection.marker.body ? <p className="editorial-prose">{subsection.marker.body}</p> : null}
                  <GroupEditor section={section} revision={map.revision} blocks={subsection.blocks} images={images}
                    text={subsectionText}>
                  <EditorialDisclosure className="editorial-text-tools">
                    <summary className="ghost-button">Organizza paragrafi e immagini</summary>
                    <EditorialTextList blocks={subsection.blocks} destinations={destinations} currentSubsectionId={subsection.marker.id} toolsOnly />
                  </EditorialDisclosure>

                  <details><summary>+ Aggiungi immagine</summary><EditorialImageForm bookId={section.book_id} sectionId={section.id} subsectionId={subsection.marker.id} /></details>
                  <div className="editorial-subsection-actions">
                    <div className="editorial-order-actions" aria-label="Riordina sottosezione">
                      {subsectionIndex > 0 ? (
                        <MoveEditorialSubsectionForm
                          bookId={section.book_id}
                          direction="up"
                          sectionId={section.id}
                          subsectionId={subsection.marker.id}
                        />
                      ) : null}
                      {subsectionIndex < hierarchy.subsections.length - 1 ? (
                        <MoveEditorialSubsectionForm
                          bookId={section.book_id}
                          direction="down"
                          sectionId={section.id}
                          subsectionId={subsection.marker.id}
                        />
                      ) : null}
                    </div>

                      <EditorialDisclosure className="editorial-edit-panel">
                        <summary className="ghost-button">Modifica titolo</summary>
                        <EditEditorialBlockForm block={subsection.marker} subsection />
                      </EditorialDisclosure>

                    <EditorialDisclosure className="editorial-add-panel">
                      <summary className="ghost-button">+ Aggiungi testo</summary>
                      <AddEditorialTextForm
                        bookId={section.book_id}
                        sectionId={section.id}
                        subsectionId={subsection.marker.id}
                      />
                    </EditorialDisclosure>

                    <EditorialDisclosure className="editorial-add-panel">
                      <summary className="ghost-button">+ Sottosezione dello stesso livello</summary>
                      <AddEditorialSubsectionForm bookId={section.book_id} sectionId={section.id} />
                    </EditorialDisclosure>

                    <DeleteEditorialSubsectionForm
                      bookId={section.book_id}
                      sectionId={section.id}
                      subsectionId={subsection.marker.id}
                      title={subsectionTitle}
                    />
                  </div>
                  </GroupEditor>
                </div>
              </EditorialDisclosure>
              {v2Mode && section.section_type === "chapter" && <>
                <EditorialImagesV2 blocks={chapterImages(blocks, subsection.marker.id)} images={images} destinations={imageDestinations(destinations, true)} />
                <AddImageV2 bookId={section.book_id} sectionId={section.id} subsectionId={subsection.marker.id} chapter />
              </>}
              </div>
            );
          })}
        </div>

        {hierarchy.subsections.length === 0 &&
        !hierarchy.openingBlocks.some(isEditorialTextContent) &&
        !section.body ? (
          <p className="editorial-empty-copy">
            Questo capitolo è vuoto. Aggiungi una sottosezione o del testo.
          </p>
        ) : null}

        <fieldset className="editorial-section-tools" disabled={v2Mode}>
          <EditorialDisclosure className="editorial-add-panel">
            <summary className="secondary-button">+ Sottosezione</summary>
            <AddEditorialSubsectionForm
              bookId={section.book_id}
              sectionId={section.id}
            />
          </EditorialDisclosure>
          {!v2Mode && <EditorialDisclosure className="editorial-add-panel">
            <summary className="ghost-button">+ Testo introduttivo</summary>
            <AddEditorialTextForm
              bookId={section.book_id}
              sectionId={section.id}
            />
          </EditorialDisclosure>}
          <EditorialDisclosure className="editorial-edit-panel">
            <summary className="ghost-button">Modifica {sectionKind.toLowerCase()}</summary>
            <EditEditorialSectionForm key={section.updated_at} section={section} hideBody />
          </EditorialDisclosure>
        </fieldset>

        <div className="editorial-section-danger-zone">
          <MoveSectionForm
            bookId={section.book_id}
            direction="up"
            disabled={index === 0}
            sectionId={section.id}
          />
          <MoveSectionForm
            bookId={section.book_id}
            direction="down"
            disabled={index === sectionCount - 1}
            sectionId={section.id}
          />
          <DeleteSectionForm
            bookId={section.book_id}
            sectionId={section.id}
            title={title}
          />
        </div>
      </div>
    </EditorialDisclosure>
    </ImageDestinationContext.Provider>
    </EditorialRevisionContext.Provider>
  );
}

export function EditorialBuilder({
  blocksBySection,
  sections,
  images = {},
  textEditorV2Enabled = false,
}: EditorialBuilderProps) {
  let chapterNumber = 0;

  return (
    <ImageContext.Provider value={images}><EditorialTextV2Context.Provider value={textEditorV2Enabled}><EditorialDraftProvider>
    <section className="editorial-builder" aria-label="Struttura editoriale del libro">
      <div className="editorial-book-root">
        <span className="editorial-book-mark" aria-hidden="true">B</span>
        <div>
          <p className="editorial-node-label">Libro</p>
          <p className="editorial-book-help">
            Apri un capitolo, poi una sottosezione, per lavorare sul testo.
          </p>
        </div>
      </div>

      <div className="editorial-section-list">
        {sections.map((section, index) => {
          if (section.section_type === "chapter") chapterNumber += 1;

          return (
            <EditorialSectionNode
              blocks={blocksBySection.get(section.id) ?? []}
              chapterNumber={section.section_type === "chapter" ? chapterNumber : null}
              index={index}
              key={section.id}
              section={section}
              sectionCount={sections.length}
            />
          );
        })}
      </div>
    </section>
    </EditorialDraftProvider></EditorialTextV2Context.Provider></ImageContext.Provider>
  );
}
