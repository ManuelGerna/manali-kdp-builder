import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLoadedDraftTextFile,
  applyManualDraftTextEdit,
  DRAFT_TEXT_FILE_ERRORS,
  MAX_DRAFT_TEXT_FILE_SIZE_BYTES,
  MAX_DRAFT_TEXT_FILE_SIZE_LABEL,
  readDraftTextFile,
  removeDraftTextFileReference,
  type DraftTextFile,
  type DraftTextInputState,
} from "../draft-text-file.ts";
import { parseDraftWithSelectedParser } from "../import-selection.ts";

function textFile({
  content,
  name = "manoscritto.txt",
  size = new TextEncoder().encode(content).byteLength,
  type = "text/plain",
}: {
  content: string;
  name?: string;
  size?: number;
  type?: string;
}): DraftTextFile {
  return {
    name,
    size,
    type,
    async text() {
      return content;
    },
  };
}

const INITIAL_STATE: DraftTextInputState = {
  draftText: "Testo incollato in precedenza",
  selectedFileName: null,
};

test("accepts text/plain TXT and preserves LF, blank lines and spaces", async () => {
  const content = "  Titolo  \n\nRiga con spazi finali  \nPunteggiatura: sì!\n";
  const result = await readDraftTextFile(textFile({ content }));

  assert.equal(result.error, null);
  assert.equal(result.data?.text, content);
  assert.equal(result.data?.fileName, "manoscritto.txt");
  assert.equal(result.data?.text.startsWith("  "), true);
  assert.equal(result.data?.text.includes("\n\n"), true);
  assert.equal(result.data?.text.endsWith("\n"), true);
});

test("preserves CRLF from File.text and allows semantic LF normalization", async () => {
  const crlfContent = "Titolo\r\n\r\nPrimo paragrafo\r\nSecondo paragrafo";
  const result = await readDraftTextFile(textFile({ content: crlfContent }));

  assert.equal(result.error, null);
  assert.equal(result.data?.text, crlfContent);
  assert.equal(
    result.data?.text.replace(/\r\n/gu, "\n"),
    "Titolo\n\nPrimo paragrafo\nSecondo paragrafo",
  );
});

test("editorial parsing treats CRLF and LF as the same content", () => {
  const lfContent = "Titolo\n\nCAPITOLO 1\n\nPrimo paragrafo.\n\nSecondo paragrafo.";
  const crlfContent = lfContent.replace(/\n/gu, "\r\n");
  const fromLf = parseDraftWithSelectedParser(lfContent, "editorial");
  const fromCrlf = parseDraftWithSelectedParser(crlfContent, "editorial");

  assert.equal("kind" in fromLf && fromLf.kind, "editorial");
  assert.equal("kind" in fromCrlf && fromCrlf.kind, "editorial");

  if ("kind" in fromLf && "kind" in fromCrlf) {
    assert.deepEqual(fromCrlf.sections, fromLf.sections);
    assert.deepEqual(fromCrlf.summary, fromLf.summary);
  }
});

test("rejects an empty file", async () => {
  const result = await readDraftTextFile(textFile({ content: "", size: 0 }));

  assert.equal(result.data, null);
  assert.equal(result.error, DRAFT_TEXT_FILE_ERRORS.empty);
});

test("reports when no file is selected", async () => {
  const result = await readDraftTextFile(null);

  assert.equal(result.data, null);
  assert.equal(result.error, DRAFT_TEXT_FILE_ERRORS.missing);
});

test("rejects a file without the TXT extension", async () => {
  const result = await readDraftTextFile(
    textFile({ content: "testo", name: "manoscritto.pdf" }),
  );

  assert.equal(result.data, null);
  assert.equal(result.error, DRAFT_TEXT_FILE_ERRORS.unsupported);
});

test("accepts a file at the exact 3 MiB limit", async () => {
  const result = await readDraftTextFile(
    textFile({
      content: "testo",
      size: MAX_DRAFT_TEXT_FILE_SIZE_BYTES,
    }),
  );

  assert.equal(MAX_DRAFT_TEXT_FILE_SIZE_BYTES, 3 * 1024 * 1024);
  assert.equal(MAX_DRAFT_TEXT_FILE_SIZE_LABEL, "3 MB");
  assert.equal(result.error, null);
  assert.equal(result.data?.text, "testo");
});

test("rejects a file over 3 MiB with the correct message", async () => {
  const result = await readDraftTextFile(
    textFile({
      content: "testo",
      size: MAX_DRAFT_TEXT_FILE_SIZE_BYTES + 1,
    }),
  );

  assert.equal(result.data, null);
  assert.equal(
    result.error,
    "Il file supera la dimensione massima consentita di 3 MB.",
  );
  assert.equal(result.error, DRAFT_TEXT_FILE_ERRORS.tooLarge);
});

test("accepts a TXT file with the text/plain MIME type", async () => {
  const result = await readDraftTextFile(
    textFile({ content: "contenuto", type: "text/plain" }),
  );

  assert.equal(result.error, null);
  assert.equal(result.data?.text, "contenuto");
});

test("accepts a TXT file when the MIME type is missing", async () => {
  const result = await readDraftTextFile(
    textFile({ content: "contenuto", name: "MANOSCRITTO.TXT", type: "" }),
  );

  assert.equal(result.error, null);
  assert.equal(result.data?.text, "contenuto");
});

test("rejects a TXT file with a non-text MIME type", async () => {
  const result = await readDraftTextFile(
    textFile({ content: "contenuto", name: "immagine.txt", type: "image/png" }),
  );

  assert.equal(result.data, null);
  assert.equal(result.error, DRAFT_TEXT_FILE_ERRORS.unsupported);
});

test("hides technical errors when reading fails", async () => {
  const file = textFile({ content: "contenuto" });
  file.text = async () => {
    throw new Error("Errore tecnico da non mostrare");
  };

  const result = await readDraftTextFile(file);

  assert.equal(result.data, null);
  assert.equal(result.error, DRAFT_TEXT_FILE_ERRORS.read);
});

test("a second loaded file replaces the previous textarea text", () => {
  const first = applyLoadedDraftTextFile(INITIAL_STATE, {
    fileName: "primo.txt",
    text: "Primo contenuto",
  });
  const second = applyLoadedDraftTextFile(first, {
    fileName: "secondo.txt",
    text: "Secondo contenuto",
  });

  assert.equal(second.draftText, "Secondo contenuto");
  assert.equal(second.selectedFileName, "secondo.txt");
});

test("a manual edit becomes the form text and keeps the file name", () => {
  const loaded = applyLoadedDraftTextFile(INITIAL_STATE, {
    fileName: "origine.txt",
    text: "Contenuto originale",
  });
  const edited = applyManualDraftTextEdit(loaded, "Contenuto modificato");

  assert.equal(edited.draftText, "Contenuto modificato");
  assert.equal(edited.selectedFileName, "origine.txt");
});

test("removing the file reference keeps the textarea text", () => {
  const loaded = applyLoadedDraftTextFile(INITIAL_STATE, {
    fileName: "origine.txt",
    text: "Contenuto da conservare",
  });
  const removed = removeDraftTextFileReference(loaded);

  assert.equal(removed.draftText, "Contenuto da conservare");
  assert.equal(removed.selectedFileName, null);
});

test("Libro editoriale uses the editorial parser", () => {
  const project = parseDraftWithSelectedParser(
    "Titolo del libro\n\nCAPITOLO 1\n\nTesto del capitolo.",
    "editorial",
  );

  assert.equal("kind" in project && project.kind, "editorial");
});

test("Bozza strutturata keeps using the historical parser", () => {
  const project = parseDraftWithSelectedParser(
    "KDP_BUILDER_DRAFT_VERSION: 0.1\n\nIDEA_LIBRO:\ntitolo_provvisorio: Test",
    "structured",
  );

  assert.equal("importReport" in project, true);
  assert.equal("kind" in project, false);
});

test("both selected parsers receive the same textarea text", () => {
  const textareaText = "  Titolo\n\nTesto con punteggiatura, spazi  e righe vuote.\n";
  const editorial = parseDraftWithSelectedParser(textareaText, "editorial");
  const structured = parseDraftWithSelectedParser(textareaText, "structured");

  assert.equal(editorial.source.rawText, textareaText);
  assert.equal(structured.source.rawText, textareaText);
});
