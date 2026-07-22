export const MAX_DRAFT_TEXT_FILE_SIZE_BYTES = 3 * 1024 * 1024;
export const MAX_DRAFT_TEXT_FILE_SIZE_LABEL = "3 MB";

export const DRAFT_TEXT_FILE_ERRORS = {
  empty: "Il file è vuoto.",
  missing: "Nessun file selezionato.",
  read: "Non è stato possibile leggere il file.",
  tooLarge: `Il file supera la dimensione massima consentita di ${MAX_DRAFT_TEXT_FILE_SIZE_LABEL}.`,
  unsupported: "Formato non supportato. Carica un file TXT.",
} as const;

export type DraftTextFile = Pick<File, "name" | "size" | "type" | "text">;

export type LoadedDraftTextFile = {
  fileName: string;
  text: string;
};

export type DraftTextFileReadResult =
  | { data: LoadedDraftTextFile; error: null }
  | { data: null; error: string };

export type DraftTextInputState = {
  /**
   * Preserva la stringa restituita da File.text() finché l'utente non la
   * modifica. Il successivo passaggio HTML tramite textarea può normalizzare
   * tecnicamente CRLF e LF senza cambiare il contenuto editoriale.
   */
  draftText: string;
  selectedFileName: string | null;
};

function hasTxtExtension(fileName: string) {
  return /\.txt$/iu.test(fileName);
}

export function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function validateDraftTextFile(file: DraftTextFile | null) {
  if (!file) {
    return DRAFT_TEXT_FILE_ERRORS.missing;
  }

  if (!hasTxtExtension(file.name)) {
    return DRAFT_TEXT_FILE_ERRORS.unsupported;
  }

  // Il MIME fornito dal browser è un controllo di coerenza, non un confine di
  // sicurezza: il contenuto accettato continua a essere trattato solo come testo.
  if (file.type !== "" && file.type.toLowerCase() !== "text/plain") {
    return DRAFT_TEXT_FILE_ERRORS.unsupported;
  }

  if (file.size === 0) {
    return DRAFT_TEXT_FILE_ERRORS.empty;
  }

  if (file.size > MAX_DRAFT_TEXT_FILE_SIZE_BYTES) {
    return DRAFT_TEXT_FILE_ERRORS.tooLarge;
  }

  return null;
}

export async function readDraftTextFile(
  file: DraftTextFile | null,
): Promise<DraftTextFileReadResult> {
  const validationError = validateDraftTextFile(file);

  if (validationError || !file) {
    return {
      data: null,
      error: validationError ?? DRAFT_TEXT_FILE_ERRORS.missing,
    };
  }

  try {
    const text = await file.text();

    if (text.length === 0) {
      return {
        data: null,
        error: DRAFT_TEXT_FILE_ERRORS.empty,
      };
    }

    return {
      data: {
        fileName: file.name,
        text,
      },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: DRAFT_TEXT_FILE_ERRORS.read,
    };
  }
}

export function applyLoadedDraftTextFile(
  state: DraftTextInputState,
  loadedFile: LoadedDraftTextFile,
): DraftTextInputState {
  return {
    ...state,
    draftText: loadedFile.text,
    selectedFileName: loadedFile.fileName,
  };
}

export function applyManualDraftTextEdit(
  state: DraftTextInputState,
  draftText: string,
): DraftTextInputState {
  return {
    ...state,
    draftText,
  };
}

export function removeDraftTextFileReference(
  state: DraftTextInputState,
): DraftTextInputState {
  return {
    ...state,
    selectedFileName: null,
  };
}
