"use server";

import {
  importKdpBuilderDraft,
  type NormalizedKdpProject,
} from "@/lib/kdp/importer";

export type GenericDraftImportFormState = {
  fields?: {
    draft_text?: string;
  };
  message: string | null;
  preview: NormalizedKdpProject | null;
};

const MAX_DRAFT_LENGTH = 120000;

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function validateGenericDraftText(draftText: string) {
  if (!draftText) {
    return "Incolla una bozza prima di analizzarla.";
  }

  if (draftText.length > MAX_DRAFT_LENGTH) {
    return "La bozza e' troppo lunga per il Parser V0. Dividila in piu' parti.";
  }

  return null;
}

export async function analyzeGenericDraftAction(
  _previousState: GenericDraftImportFormState,
  formData: FormData,
): Promise<GenericDraftImportFormState> {
  const draftText = getString(formData, "draft_text");
  const fields = {
    draft_text: draftText,
  };
  const validationError = validateGenericDraftText(draftText);

  if (validationError) {
    return {
      fields,
      message: validationError,
      preview: null,
    };
  }

  try {
    return {
      fields,
      message: null,
      preview: importKdpBuilderDraft(draftText),
    };
  } catch (error: unknown) {
    console.error("[kdp-generic-draft-import:action]", {
      errorName: getErrorName(error),
      event: "generic_importer_failed",
    });

    return {
      fields,
      message:
        "Non riesco ad analizzare questa bozza con il Parser V0. Controlla il formato e riprova.",
      preview: null,
    };
  }
}
