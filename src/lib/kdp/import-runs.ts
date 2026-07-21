import type { createClient } from "@/lib/supabase/server";
import type { EditorialDraftProject } from "@/lib/kdp/importer/kdp-editorial-draft-v1";
import type { Json, Tables } from "@/types/database";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type KdpImportRun = Tables<"kdp_import_runs">;

export type DraftImportReport = {
  annotationCount: number;
  blockCount: number;
  chapterCount: number;
  duplicate: boolean;
  errorCount: number;
  errors: string[];
  format: string | null;
  imagePlaceholderCount: number;
  sectionCount: number;
  status: string | null;
  subsectionCount: number;
  warningCount: number;
  warnings: string[];
};

export const EMPTY_IMPORT_REPORT: DraftImportReport = {
  annotationCount: 0,
  blockCount: 0,
  chapterCount: 0,
  duplicate: false,
  errorCount: 0,
  errors: [],
  format: null,
  imagePlaceholderCount: 0,
  sectionCount: 0,
  status: null,
  subsectionCount: 0,
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

function getIssueMessages(value: Json | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === "string") {
      return [item];
    }

    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof item.message === "string"
    ) {
      return [item.message];
    }

    return [];
  });
}

function getString(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

function getSummary(value: Record<string, Json>) {
  return isRecord(value.summary) ? value.summary : {};
}

function getReportNumber(
  value: Record<string, Json>,
  summary: Record<string, Json>,
  key: string,
) {
  return getNumber(value[key]) || getNumber(summary[key]);
}

export function buildEditorialDraftImportReport(
  project: EditorialDraftProject,
): DraftImportReport {
  const warnings = project.warnings.map((warning) => warning.message);
  const errors = project.errors.map((error) => error.message);

  return {
    annotationCount: project.summary.annotationCount,
    blockCount: project.summary.blockCount + project.summary.subsectionCount,
    chapterCount: project.summary.chapterCount,
    duplicate: false,
    errorCount: errors.length,
    errors,
    format: project.format,
    imagePlaceholderCount: 0,
    sectionCount: project.sections.length,
    status:
      errors.length > 0
        ? "failed"
        : warnings.length > 0
          ? "success_with_warnings"
          : "success",
    subsectionCount: project.summary.subsectionCount,
    warningCount: warnings.length,
    warnings,
  };
}

export function normalizeDraftImportReport(
  value: Json | null,
): DraftImportReport {
  if (!isRecord(value)) {
    return EMPTY_IMPORT_REPORT;
  }

  const summary = getSummary(value);
  const warnings = getIssueMessages(value.warnings);
  const errors = getIssueMessages(value.errors);

  return {
    annotationCount: getReportNumber(value, summary, "annotationCount"),
    blockCount: getReportNumber(value, summary, "blockCount"),
    chapterCount: getReportNumber(value, summary, "chapterCount"),
    duplicate: getBoolean(value.duplicate),
    errorCount:
      getReportNumber(value, summary, "errorCount") || errors.length,
    errors,
    format: getString(value.format) ?? getString(summary.format),
    imagePlaceholderCount: getReportNumber(
      value,
      summary,
      "imagePlaceholderCount",
    ),
    sectionCount: getReportNumber(value, summary, "sectionCount"),
    status: getString(value.status),
    subsectionCount: getReportNumber(value, summary, "subsectionCount"),
    warningCount:
      getReportNumber(value, summary, "warningCount") || warnings.length,
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
