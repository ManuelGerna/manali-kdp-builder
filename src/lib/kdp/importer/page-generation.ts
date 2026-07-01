import type {
  BookPage,
  BookSection,
  ImportIssue,
  PageContent,
  PageDefinition,
  TableContent,
} from "./types.ts";
import {
  isRecord,
  normalizeKey,
  readField,
  readNumber,
  readString,
  readStringArray,
} from "./utils.ts";

const STRUCTURAL_PAGE_FIELDS = [
  "numero_pagina",
  "page_number",
  "pagina",
  "intervallo_pagine",
  "page_range",
  "range",
  "template_id",
  "templateid",
  "template",
  "template_version",
  "ripeti",
  "repeat",
  "repeat_count",
  "titolo",
  "title",
  "titolo_pattern",
  "title_pattern",
  "section_id",
  "id_sezione",
  "section",
  "layout_hints",
  "layout",
];

const KNOWN_CONTENT_FIELDS = [
  "testo",
  "text",
  "body",
  "campi",
  "fields",
  "prompt",
  "prompts",
  "rotazione_prompt",
  "rotation_prompt",
  "rotation_prompts",
  "tabella",
  "table",
  "tabelle",
  "tables",
  "footer_text",
  "footer",
];

export type PageGenerationResult = {
  pages: BookPage[];
  issues: ImportIssue[];
};

export type ParsedPageRange =
  | {
      endPage: number;
      ok: true;
      startPage: number;
    }
  | {
      ok: false;
      rawValue: string;
    };

function issue(input: Omit<ImportIssue, "severity"> & {
  severity: ImportIssue["severity"];
}) {
  return input;
}

function getTemplateId(definition: PageDefinition) {
  return readString(definition, ["template_id", "templateId", "template"]);
}

function getSectionId(definition: PageDefinition) {
  return readString(definition, ["section_id", "id_sezione", "section"]);
}

function getPageTitle(definition: PageDefinition) {
  return readString(definition, ["titolo", "title", "titolo_pattern", "title_pattern"]);
}

function getLayoutHints(definition: PageDefinition) {
  const value = readField(definition, ["layout_hints", "layout"]);

  return isRecord(value) ? value : undefined;
}

function normalizeRows(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const rows = value.filter(
    (item): item is string | Record<string, unknown> =>
      typeof item === "string" || isRecord(item),
  );

  return rows.length > 0 ? rows : undefined;
}

function normalizeTable(value: unknown): TableContent | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const columns = readStringArray(value, ["colonne", "columns"]);

  if (columns.length === 0) {
    return undefined;
  }

  const rows = normalizeRows(readField(value, ["righe", "rows"]));
  const rowCount = readNumber(value, ["numero_righe", "row_count", "rows_count"]);
  const notes = readString(value, ["note", "notes"]);

  return {
    columns,
    ...(rows ? { rows } : {}),
    ...(rowCount ? { rowCount } : {}),
    ...(notes ? { notes } : {}),
  };
}

function normalizeTables(value: unknown): TableContent[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tables = value
    .map(normalizeTable)
    .filter((table): table is TableContent => Boolean(table));

  return tables.length > 0 ? tables : undefined;
}

function getRotationPrompts(definition: PageDefinition) {
  return readStringArray(definition, [
    "rotazione_prompt",
    "rotation_prompt",
    "rotation_prompts",
    "prompt_rotation",
  ]);
}

function getKnownFieldSet() {
  return new Set(
    [...STRUCTURAL_PAGE_FIELDS, ...KNOWN_CONTENT_FIELDS].map(normalizeKey),
  );
}

function buildPageContent(
  definition: PageDefinition,
  rotationPrompt: string | undefined,
) {
  const content: PageContent = {};
  const text = readString(definition, ["testo", "text", "body"]);
  const fields = readStringArray(definition, ["campi", "fields"]);
  const prompts = readStringArray(definition, ["prompts"]);
  const directPrompt = readString(definition, ["prompt"]);
  const table = normalizeTable(readField(definition, ["tabella", "table"]));
  const tables = normalizeTables(readField(definition, ["tabelle", "tables"]));
  const footerText = readString(definition, ["footer_text", "footer"]);
  const known = getKnownFieldSet();

  if (text) {
    content.text = text;
  }

  if (fields.length > 0) {
    content.fields = fields;
  }

  if (prompts.length > 0) {
    content.prompts = prompts;
  }

  if (directPrompt) {
    content.prompt = directPrompt;
  }

  if (rotationPrompt) {
    content.prompt = rotationPrompt;
  }

  if (table) {
    content.table = table;
  }

  if (tables) {
    content.tables = tables;
  }

  if (footerText) {
    content.footerText = footerText;
  }

  for (const [key, value] of Object.entries(definition)) {
    const normalizedKey = normalizeKey(key);

    if (!known.has(normalizedKey)) {
      content[normalizedKey || key] = value;
    }
  }

  return content;
}

function createPage(input: {
  definition: PageDefinition;
  pageIndexInDefinition: number;
  pageNumber: number;
  sourceRef: string;
  sourceType: BookPage["sourceType"];
  totalPagesInDefinition: number;
}) {
  const templateId = getTemplateId(input.definition);
  const rotationPrompts = getRotationPrompts(input.definition);
  const rotationPrompt =
    rotationPrompts.length > 0
      ? rotationPrompts[input.pageIndexInDefinition % rotationPrompts.length]
      : undefined;
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!templateId) {
    warnings.push("Missing template_id.");
  }

  const page: BookPage = {
    pageNumber: input.pageNumber,
    sourceRef: input.sourceRef,
    sourceType: input.sourceType,
    ...(getSectionId(input.definition)
      ? { sectionId: getSectionId(input.definition) }
      : {}),
    ...(templateId ? { templateId } : {}),
    ...(getPageTitle(input.definition)
      ? { title: getPageTitle(input.definition) }
      : {}),
    content: buildPageContent(input.definition, rotationPrompt),
    ...(getLayoutHints(input.definition)
      ? { layoutHints: getLayoutHints(input.definition) }
      : {}),
    status: templateId ? "ready" : "needs_review",
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(errors.length > 0 ? { errors } : {}),
  };

  if (rotationPrompts.length > input.totalPagesInDefinition) {
    page.warnings = [
      ...(page.warnings ?? []),
      "Rotation content has more items than generated pages; extra items were ignored.",
    ];
  }

  return page;
}

function coercePageDefinitions(value: unknown): PageDefinition[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  const nestedPages = readField(value, ["pages", "pagine", "sequenza_pagine"]);

  if (Array.isArray(nestedPages)) {
    return nestedPages.filter(isRecord);
  }

  if (
    readField(value, ["numero_pagina", "page_number", "intervallo_pagine", "page_range"])
  ) {
    return [value];
  }

  return [];
}

export function parsePageRange(value: unknown): ParsedPageRange {
  const rawValue =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
  const normalizedValue = rawValue.trim();
  const match = normalizedValue.match(
    /^(\d+)\s*(?:-|–|—|to|a)\s*(\d+)$/i,
  );

  if (!match) {
    return {
      ok: false,
      rawValue,
    };
  }

  const startPage = Number(match[1]);
  const endPage = Number(match[2]);

  if (
    !Number.isInteger(startPage) ||
    !Number.isInteger(endPage) ||
    startPage < 1 ||
    endPage < startPage
  ) {
    return {
      ok: false,
      rawValue,
    };
  }

  return {
    endPage,
    ok: true,
    startPage,
  };
}

function assignSectionsToPages(pages: BookPage[], sections: BookSection[]) {
  if (sections.length === 0) {
    return pages;
  }

  return pages.map((page) => {
    if (page.sectionId) {
      return page;
    }

    const matchingSection = sections.find(
      (section) =>
        typeof section.startPage === "number" &&
        typeof section.endPage === "number" &&
        page.pageNumber >= section.startPage &&
        page.pageNumber <= section.endPage,
    );

    return matchingSection
      ? {
          ...page,
          sectionId: matchingSection.id,
        }
      : page;
  });
}

export function generatePages(
  sequenceBlock: unknown,
  sections: BookSection[],
): PageGenerationResult {
  const definitions = coercePageDefinitions(sequenceBlock);
  const pages: BookPage[] = [];
  const issues: ImportIssue[] = [];

  definitions.forEach((definition, index) => {
    const sourcePath = `SEQUENZA_PAGINE[${index}]`;
    const pageNumber = readNumber(definition, ["numero_pagina", "page_number", "pagina"]);
    const rangeValue = readField(definition, [
      "intervallo_pagine",
      "page_range",
      "range",
    ]);
    const repeatCount = readNumber(definition, ["ripeti", "repeat", "repeat_count"]);
    const rotationPrompts = getRotationPrompts(definition);

    if (rangeValue !== undefined) {
      const range = parsePageRange(rangeValue);

      if (!range.ok) {
        issues.push(
          issue({
            code: "PAGE_RANGE_INVALID",
            message: "Page range could not be interpreted.",
            path: `${sourcePath}.intervallo_pagine`,
            rawSnippet: range.rawValue,
            severity: "error",
          }),
        );
        return;
      }

      const generatedCount = range.endPage - range.startPage + 1;

      if (repeatCount !== undefined && repeatCount !== generatedCount) {
        issues.push(
          issue({
            code: "PAGE_RANGE_REPEAT_MISMATCH",
            message:
              "repeat count does not match the inclusive page range; range was used as source of truth.",
            path: `${sourcePath}.ripeti`,
            rawSnippet: String(repeatCount),
            severity: "warning",
          }),
        );
      }

      if (rotationPrompts.length > generatedCount) {
        issues.push(
          issue({
            code: "ROTATION_CONTENT_TRUNCATED",
            message:
              "Rotation content has more items than generated pages; extra items were ignored.",
            path: `${sourcePath}.rotazione_prompt`,
            severity: "warning",
          }),
        );
      }

      for (let page = range.startPage; page <= range.endPage; page += 1) {
        pages.push(
          createPage({
            definition,
            pageIndexInDefinition: page - range.startPage,
            pageNumber: page,
            sourceRef: `${range.startPage}-${range.endPage}`,
            sourceType: "expanded_range",
            totalPagesInDefinition: generatedCount,
          }),
        );
      }

      return;
    }

    if (pageNumber !== undefined && Number.isInteger(pageNumber) && pageNumber > 0) {
      pages.push(
        createPage({
          definition,
          pageIndexInDefinition: 0,
          pageNumber,
          sourceRef: String(pageNumber),
          sourceType: "single",
          totalPagesInDefinition: 1,
        }),
      );

      return;
    }

    issues.push(
      issue({
        code: "PAGE_NUMBER_MISSING",
        message: "Page definition has neither numero_pagina nor intervallo_pagine.",
        path: sourcePath,
        severity: "warning",
      }),
    );
  });

  const assignedPages = assignSectionsToPages(
    pages.sort((first, second) => first.pageNumber - second.pageNumber),
    sections,
  );

  for (const [index, page] of assignedPages.entries()) {
    if (!page.templateId) {
      issues.push(
        issue({
          code: "TEMPLATE_ID_MISSING",
          message: "Page has no template_id.",
          pageNumber: page.pageNumber,
          path: `pages[${index}].templateId`,
          severity: "warning",
        }),
      );
    }
  }

  return {
    issues,
    pages: assignedPages,
  };
}
