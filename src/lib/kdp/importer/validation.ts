import type {
  BookPage,
  BookSection,
  ImportIssue,
  ImportReport,
  ImportSummary,
  NormalizedKdpProject,
  TemplateDefinition,
  TemplateRegistryInput,
  TemplateUsageSummary,
} from "./types.ts";
import { isRecord, readString } from "./utils.ts";

export type TemplateResolutionResult = {
  issues: ImportIssue[];
  pages: BookPage[];
  templates: TemplateUsageSummary;
};

function issue(input: ImportIssue) {
  return input;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((first, second) =>
    first.localeCompare(second),
  );
}

function normalizeRegistryIds(registry: TemplateRegistryInput | undefined) {
  if (!registry) {
    return undefined;
  }

  if (Array.isArray(registry)) {
    return new Set(
      registry
        .map((item) => (typeof item === "string" ? item : item.id))
        .filter(Boolean),
    );
  }

  return new Set(
    Object.entries(registry)
      .map(([key, definition]) => definition.id || key)
      .filter(Boolean),
  );
}

function markPageWarning(page: BookPage, warning: string): BookPage {
  return {
    ...page,
    status: page.status === "error" ? "error" : "needs_review",
    warnings: [...(page.warnings ?? []), warning],
  };
}

function markPageError(page: BookPage, error: string): BookPage {
  return {
    ...page,
    errors: [...(page.errors ?? []), error],
    status: "error",
  };
}

export function parseDraftTemplateDefinitions(value: unknown): TemplateDefinition[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).map(([id, definition]) => {
    const rawDefinition = isRecord(definition) ? definition : {};
    const name = readString(rawDefinition, ["name", "nome", "tipo_layout"]);
    const version = readString(rawDefinition, ["version", "versione"]);
    const category = readString(rawDefinition, ["category", "categoria"]);

    return {
      id,
      ...(name ? { name } : {}),
      ...(version ? { version } : {}),
      ...(category ? { category } : {}),
      rawDefinition,
    };
  });
}

export function resolveTemplates(input: {
  draftTemplates: TemplateDefinition[];
  pages: BookPage[];
  templateRegistry?: TemplateRegistryInput;
}): TemplateResolutionResult {
  const usageByTemplateId: Record<string, number> = {};

  for (const page of input.pages) {
    if (!page.templateId) {
      continue;
    }

    usageByTemplateId[page.templateId] =
      (usageByTemplateId[page.templateId] ?? 0) + 1;
  }

  const requestedTemplateIds = uniqueSorted(Object.keys(usageByTemplateId));
  const registryIds =
    normalizeRegistryIds(input.templateRegistry) ??
    (input.draftTemplates.length > 0
      ? new Set(input.draftTemplates.map((template) => template.id))
      : undefined);
  const definedTemplateIds = uniqueSorted(
    input.draftTemplates.map((template) => template.id),
  );
  const foundTemplateIds = registryIds
    ? requestedTemplateIds.filter((id) => registryIds.has(id))
    : undefined;
  const missingTemplateIds = registryIds
    ? requestedTemplateIds.filter((id) => !registryIds.has(id))
    : undefined;
  const missingTemplateSet = new Set(missingTemplateIds ?? []);
  const issues: ImportIssue[] = [];

  const pages = input.pages.map((page, index) => {
    if (!page.templateId || !missingTemplateSet.has(page.templateId)) {
      return page;
    }

    issues.push(
      issue({
        code: "TEMPLATE_NOT_FOUND",
        message: "Template id was requested but not found in the registry.",
        pageNumber: page.pageNumber,
        path: `pages[${index}].templateId`,
        severity: "warning",
        templateId: page.templateId,
      }),
    );

    return markPageWarning(page, "Template not found in registry.");
  });

  return {
    issues,
    pages,
    templates: {
      requestedTemplateIds,
      usageByTemplateId,
      ...(definedTemplateIds.length > 0 ? { definedTemplateIds } : {}),
      ...(foundTemplateIds ? { foundTemplateIds } : {}),
      ...(missingTemplateIds ? { missingTemplateIds } : {}),
    },
  };
}

function formatMissingPages(missingPages: number[]) {
  const visiblePages = missingPages.slice(0, 20).join(", ");

  return missingPages.length > 20
    ? `${visiblePages}, ... (${missingPages.length} total)`
    : visiblePages;
}

export function validateImportedProject(input: {
  pages: BookPage[];
  requireCompletePageSequence?: boolean;
  sections: BookSection[];
  targetPageCount?: number;
}): {
  issues: ImportIssue[];
  pages: BookPage[];
  sections: BookSection[];
} {
  const issues: ImportIssue[] = [];
  let pages = [...input.pages];

  if (pages.length === 0) {
    issues.push(
      issue({
        code: "NO_PAGES_GENERATED",
        message: "No importable pages were generated.",
        path: "pages",
        severity: "error",
      }),
    );
  }

  const pagesByNumber = new Map<number, number[]>();

  pages.forEach((page, index) => {
    const existing = pagesByNumber.get(page.pageNumber) ?? [];
    existing.push(index);
    pagesByNumber.set(page.pageNumber, existing);
  });

  for (const [pageNumber, indexes] of pagesByNumber.entries()) {
    if (indexes.length <= 1) {
      continue;
    }

    issues.push(
      issue({
        code: "PAGE_DUPLICATE",
        message: "Multiple definitions generated the same page number.",
        pageNumber,
        path: "pages",
        severity: "error",
      }),
    );

    pages = pages.map((page, index) =>
      indexes.includes(index)
        ? markPageError(page, "Duplicate page number.")
        : page,
    );
  }

  if (input.targetPageCount !== undefined) {
    if (pages.length !== input.targetPageCount) {
      issues.push(
        issue({
          code: "TARGET_PAGE_COUNT_MISMATCH",
          message: "Generated page count does not match target page count.",
          path: "technicalSpecs.targetPageCount",
          rawSnippet: String(input.targetPageCount),
          severity: input.requireCompletePageSequence ? "error" : "warning",
        }),
      );
    }

    const generatedNumbers = new Set(pages.map((page) => page.pageNumber));
    const missingPages: number[] = [];

    for (let pageNumber = 1; pageNumber <= input.targetPageCount; pageNumber += 1) {
      if (!generatedNumbers.has(pageNumber)) {
        missingPages.push(pageNumber);
      }
    }

    if (missingPages.length > 0) {
      issues.push(
        issue({
          code: "PAGE_MISSING",
          message: `Missing page numbers: ${formatMissingPages(missingPages)}.`,
          path: "pages",
          severity: input.requireCompletePageSequence ? "error" : "warning",
        }),
      );
    }
  }

  const actualCountBySection = new Map<string, number>();

  for (const page of pages) {
    if (!page.sectionId) {
      continue;
    }

    actualCountBySection.set(
      page.sectionId,
      (actualCountBySection.get(page.sectionId) ?? 0) + 1,
    );
  }

  const sections = input.sections.map((section) => {
    const actualPageCount = actualCountBySection.get(section.id) ?? 0;
    const warnings = [...(section.warnings ?? [])];

    if (
      section.expectedPageCount !== undefined &&
      section.expectedPageCount !== actualPageCount
    ) {
      const warning =
        "Section expected page count does not match assigned page count.";
      warnings.push(warning);
      issues.push(
        issue({
          code: "SECTION_PAGE_COUNT_MISMATCH",
          message: warning,
          path: `sections.${section.id}`,
          severity: "warning",
        }),
      );
    }

    return {
      ...section,
      actualPageCount,
      status: warnings.length > 0 ? "warning" : section.status,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  });

  return {
    issues,
    pages,
    sections,
  };
}

export function buildImportReport(input: {
  issues: ImportIssue[];
  project: Pick<NormalizedKdpProject, "pages" | "project" | "sections" | "technicalSpecs" | "templates">;
  source: Pick<NormalizedKdpProject["source"], "draftVersion" | "parserVersion">;
}): ImportReport {
  const warnings = input.issues.filter((item) => item.severity === "warning");
  const errors = input.issues.filter((item) => item.severity === "error");
  const summary: ImportSummary = {
    draftVersion: input.source.draftVersion,
    errorCount: errors.length,
    expandedPageCount: input.project.pages.filter(
      (page) => page.sourceType === "expanded_range",
    ).length,
    fixedPageCount: input.project.pages.filter(
      (page) => page.sourceType === "single",
    ).length,
    generatedPageCount: input.project.pages.length,
    missingTemplateCount: input.project.templates.missingTemplateIds?.length ?? 0,
    parserVersion: input.source.parserVersion,
    requestedTemplateCount: input.project.templates.requestedTemplateIds.length,
    sectionCount: input.project.sections.length,
    targetPageCount: input.project.technicalSpecs.targetPageCount,
    title: input.project.project.title,
    warningCount: warnings.length,
  };

  return {
    errors,
    status:
      errors.length > 0
        ? "failed"
        : warnings.length > 0
          ? "success_with_warnings"
          : "success",
    summary,
    warnings,
  };
}
