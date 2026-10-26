import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import HardBreak from "@tiptap/extension-hard-break";
import Bold from "@tiptap/extension-bold";
import { UndoRedo } from "@tiptap/extensions";

const LiteralParagraph = Paragraph.extend({
  addAttributes() {
    return {
      sourceId: { default: null, rendered: false, keepOnSplit: false },
      field: { default: null, rendered: false, keepOnSplit: false },
      visibility: { default: "print", rendered: false },
      layout: { default: "default", rendered: false },
    };
  },
});
const LiteralHardBreak = HardBreak.extend({
  addAttributes() { return { ending: { default: "\n", rendered: false } }; },
});

export function editorialTextV2Extensions() {
  // Empty groups/runs are empty documents, not invented source paragraphs.
  return [Document.extend({ content: "paragraph*" }), LiteralParagraph, Text, LiteralHardBreak, Bold, UndoRedo];
}
