import type { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/types/database";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type KdpImportRun = Tables<"kdp_import_runs">;

export type DraftImportReport = {
  blockCount: number;
  duplicate: boolean;
  imagePlaceholderCount: number;
  sectionCount: number;
  warningCount: number;
  warnings: string[];
};

export const EMPTY_IMPORT_REPORT: DraftImportReport = {
  blockCount: 0,
  duplicate: false,
  imagePlaceholderCount: 0,
  sectionCount: 0,
  warningCount: 0,
  warnings: [],
};

export type ImportRunResult =
  | {
      data: {
        createdAt: string;
        importToken: string;
        report: DraftImportReport;
      };
      error: null;
    }
  | {
      data: null;
      error: string;
    };

function isRecord(value: Json | null): value is Record<string, Json> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getNumber(value: Json | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getBoolean(value: Json | undefined) {
  return typeof value === "boolean" ? value : false;
}

function getWarnings(value: Json | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function normalizeDraftImportReport(
  value: Json | null,
): DraftImportReport {
  if (!isRecord(value)) {
    return EMPTY_IMPORT_REPORT;
  }

  const warnings = getWarnings(value.warnings);

  return {
    blockCount: getNumber(value.blockCount),
    duplicate: getBoolean(value.duplicate),
    imagePlaceholderCount: getNumber(value.imagePlaceholderCount),
    sectionCount: getNumber(value.sectionCount),
    warningCount: getNumber(value.warningCount) || warnings.length,
    warnings,
  };
}

export async function getImportRunReport(
  supabase: KdpSupabaseClient,
  input: {
    bookId: string;
    importToken: string;
  },
): Promise<ImportRunResult> {
  const { data, error } = await supabase
    .from("kdp_import_runs")
    .select("import_token,report,created_at")
    .eq("book_id", input.bookId)
    .eq("import_token", input.importToken)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: "Import completato, ma non riesco a caricare il report.",
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Report import non trovato.",
    };
  }

  return {
    data: {
      createdAt: data.created_at,
      importToken: data.import_token,
      report: normalizeDraftImportReport(data.report),
    },
    error: null,
  };
}
