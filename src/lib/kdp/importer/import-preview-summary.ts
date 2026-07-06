import type { NormalizedKdpProject } from "./types.ts";

const KDP_DRAFT_V1_IMPORTER_VERSION = "kdp_draft_v1";

export type ImportedDraftPreviewSummary = {
  errorCount: number;
  formatLabel: string;
  generatedPageCount: number;
  parserVersion: string;
  status: NormalizedKdpProject["importReport"]["status"];
  targetPageCount?: number;
  title?: string;
  trimSize?: string;
  warningCount: number;
};

export function getImportedDraftFormatLabel(project: NormalizedKdpProject) {
  if (
    project.source.draftVersion === "KDP_DRAFT_V1" ||
    project.source.parserVersion === KDP_DRAFT_V1_IMPORTER_VERSION
  ) {
    return "KDP_DRAFT_V1";
  }

  if (project.source.draftVersion) {
    return `Legacy ${project.source.draftVersion}`;
  }

  return "Legacy / Parser V0";
}

export function buildImportedDraftPreviewSummary(
  project: NormalizedKdpProject,
): ImportedDraftPreviewSummary {
  return {
    errorCount: project.importReport.summary.errorCount,
    formatLabel: getImportedDraftFormatLabel(project),
    generatedPageCount: project.importReport.summary.generatedPageCount,
    parserVersion: project.source.parserVersion,
    status: project.importReport.status,
    targetPageCount: project.importReport.summary.targetPageCount,
    title: project.importReport.summary.title ?? project.project.title,
    trimSize: project.technicalSpecs.trimSize,
    warningCount: project.importReport.summary.warningCount,
  };
}

export function canCreateBookFromImportedDraftPreview(
  project: NormalizedKdpProject,
) {
  return (
    project.importReport.status !== "failed" &&
    project.importReport.errors.length === 0 &&
    project.pages.length > 0
  );
}
