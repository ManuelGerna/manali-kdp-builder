import { importKdpBuilderDraft } from "./parser.ts";
import {
  parseKdpEditorialDraftV1,
  type EditorialDraftProject,
} from "./kdp-editorial-draft-v1.ts";
import type {
  ImportOptions,
  NormalizedKdpProject,
} from "./types.ts";

export const DRAFT_PARSER_MODES = ["structured", "editorial"] as const;

export type DraftParserMode = (typeof DRAFT_PARSER_MODES)[number];

export function normalizeDraftParserMode(
  value: string | null | undefined,
): DraftParserMode {
  return value === "editorial" ? "editorial" : "structured";
}

export function parseDraftWithSelectedParser(
  rawText: string,
  mode: DraftParserMode,
  options: ImportOptions = {},
): EditorialDraftProject | NormalizedKdpProject {
  return mode === "editorial"
    ? parseKdpEditorialDraftV1(rawText, {
        importedAt: options.importedAt,
      })
    : importKdpBuilderDraft(rawText, options);
}
