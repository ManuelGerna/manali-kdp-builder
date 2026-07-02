import {
  buildImportedPagePreviewModel,
  type ImportedPagePreviewModel,
  type ImportedPreviewBlock,
  type ImportedPreviewEntry,
  type ImportedPreviewTable,
} from "./imported-page-preview.ts";
import type { Json } from "../../types/database.ts";

export type ImportedPrintWarningCode =
  | "CONTENT_MAY_OVERFLOW"
  | "EMPTY_CONTENT"
  | "TABLE_DENSE"
  | "UNKNOWN_TEMPLATE";

export type ImportedPrintWarning = {
  code: ImportedPrintWarningCode;
  message: string;
  pageNumber?: number;
};

export type ImportedPrintPageSize = {
  heightIn: number;
  label: string;
  source: "book_settings" | "fallback" | "technical_specs";
  widthIn: number;
};

export type ImportedPrintMargins = {
  bottomIn: number;
  insideIn: number;
  outsideIn: number;
  source: "fallback" | "technical_specs";
  topIn: number;
};

export type ImportedPrintDocumentSettings = {
  margins: ImportedPrintMargins;
  pageSize: ImportedPrintPageSize;
};

export type ImportedPrintBlock =
  | {
      items: string[];
      type: "list";
    }
  | {
      entries: ImportedPreviewEntry[];
      type: "fallback";
    }
  | {
      fields: string[];
      type: "fields";
    }
  | {
      prompts: string[];
      type: "prompts";
    }
  | {
      tables: ImportedPreviewTable[];
      type: "tables";
    }
  | {
      text: string[];
      type: "text";
    }
  | {
      blocks: ImportedPrintBlock[];
      subtitle?: string;
      title?: string;
      type: "group";
    };

export type ImportedPrintPageInput = {
  content: Json;
  pageNumber: number;
  sourceType?: string | null;
  status?: string | null;
  templateId?: string | null;
  title?: string | null;
};

export type ImportedPrintBookSettingsInput = {
  trimSize?: string | null;
};

export type BuildImportedPrintRenderModelInput = {
  bookSettings?: ImportedPrintBookSettingsInput | null;
  normalizedProject?: Json | null;
  pages: ImportedPrintPageInput[];
};

export type ImportedPrintPage = {
  blocks: ImportedPrintBlock[];
  pageNumber: number;
  sourceType: string | null;
  status: string;
  subtitle?: string;
  templateId: string | null;
  title: string;
  warnings: ImportedPrintWarning[];
};

export type ImportedPrintRenderModel = {
  pages: ImportedPrintPage[];
  settings: ImportedPrintDocumentSettings;
  warnings: ImportedPrintWarning[];
};

const FALLBACK_PAGE_SIZE = {
  heightIn: 10,
  label: "7 x 10 in",
  source: "fallback",
  widthIn: 7,
} satisfies ImportedPrintPageSize;

const FALLBACK_MARGINS = {
  bottomIn: 0.5,
  insideIn: 0.65,
  outsideIn: 0.45,
  source: "fallback",
  topIn: 0.45,
} satisfies ImportedPrintMargins;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRecordValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseInches(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  const stringValue = getString(value);

  if (!stringValue) {
    return null;
  }

  const match = stringValue.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  const parsed = match ? Number(match[1]) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseTrimSize(value: unknown) {
  const stringValue = getString(value);

  if (!stringValue) {
    return null;
  }

  const normalized = stringValue
    .replace(",", ".")
    .replace(/\u00d7/g, "x")
    .toLowerCase();
  const match = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:x|by)\s*(\d+(?:\.\d+)?)/,
  );

  if (!match) {
    return null;
  }

  const widthIn = Number(match[1]);
  const heightIn = Number(match[2]);

  if (!Number.isFinite(widthIn) || !Number.isFinite(heightIn)) {
    return null;
  }

  return {
    heightIn,
    label: `${widthIn} x ${heightIn} in`,
    widthIn,
  };
}

function getTechnicalSpecs(normalizedProject: Json | null | undefined) {
  if (!isRecord(normalizedProject)) {
    return null;
  }

  const value = getRecordValue(normalizedProject, [
    "technicalSpecs",
    "technical_specs",
    "specifiche_tecniche",
  ]);

  return isRecord(value) ? value : null;
}

function getTechnicalMargins(technicalSpecs: Record<string, unknown> | null) {
  if (!technicalSpecs) {
    return null;
  }

  const marginsValue = getRecordValue(technicalSpecs, ["margins", "margini"]);

  if (!isRecord(marginsValue)) {
    return null;
  }

  const insideIn = parseInches(
    getRecordValue(marginsValue, ["inside", "inner", "interno"]),
  );
  const outsideIn = parseInches(
    getRecordValue(marginsValue, ["outside", "outer", "esterno"]),
  );
  const topIn = parseInches(getRecordValue(marginsValue, ["top", "alto"]));
  const bottomIn = parseInches(
    getRecordValue(marginsValue, ["bottom", "basso"]),
  );

  if (!insideIn && !outsideIn && !topIn && !bottomIn) {
    return null;
  }

  return {
    bottomIn: bottomIn ?? FALLBACK_MARGINS.bottomIn,
    insideIn: insideIn ?? FALLBACK_MARGINS.insideIn,
    outsideIn: outsideIn ?? FALLBACK_MARGINS.outsideIn,
    source: "technical_specs",
    topIn: topIn ?? FALLBACK_MARGINS.topIn,
  } satisfies ImportedPrintMargins;
}

function getPageSize(
  input: Pick<
    BuildImportedPrintRenderModelInput,
    "bookSettings" | "normalizedProject"
  >,
) {
  const technicalSpecs = getTechnicalSpecs(input.normalizedProject);
  const technicalTrimSize = technicalSpecs
    ? getRecordValue(technicalSpecs, [
        "trimSize",
        "trim_size",
        "formato",
        "formato_libro",
      ])
    : null;
  const parsedTechnicalTrimSize = parseTrimSize(technicalTrimSize);

  if (parsedTechnicalTrimSize) {
    return {
      ...parsedTechnicalTrimSize,
      source: "technical_specs",
    } satisfies ImportedPrintPageSize;
  }

  const parsedBookTrimSize = parseTrimSize(input.bookSettings?.trimSize);

  if (parsedBookTrimSize) {
    return {
      ...parsedBookTrimSize,
      source: "book_settings",
    } satisfies ImportedPrintPageSize;
  }

  return FALLBACK_PAGE_SIZE;
}

function getMargins(normalizedProject: Json | null | undefined) {
  return getTechnicalMargins(getTechnicalSpecs(normalizedProject)) ??
    FALLBACK_MARGINS;
}

function getPageBlocks(model: ImportedPagePreviewModel): ImportedPrintBlock[] {
  const blocks: ImportedPrintBlock[] = [];

  if (model.text.length > 0) {
    blocks.push({
      text: model.text,
      type: "text",
    });
  }

  if (model.fields.length > 0) {
    blocks.push({
      fields: model.fields,
      type: "fields",
    });
  }

  for (const list of model.lists) {
    blocks.push({
      items: list,
      type: "list",
    });
  }

  if (model.prompts.length > 0) {
    blocks.push({
      prompts: model.prompts,
      type: "prompts",
    });
  }

  if (model.tables.length > 0) {
    blocks.push({
      tables: model.tables,
      type: "tables",
    });
  }

  for (const block of model.blocks) {
    blocks.push(getGroupBlock(block));
  }

  if (model.fallbackEntries.length > 0) {
    blocks.push({
      entries: model.fallbackEntries,
      type: "fallback",
    });
  }

  return blocks;
}

function getGroupBlock(block: ImportedPreviewBlock): ImportedPrintBlock {
  const childModel: ImportedPagePreviewModel = {
    blocks: block.blocks,
    fallbackEntries: [],
    fields: block.fields,
    isEmpty: false,
    lists: block.lists,
    prompts: block.prompts,
    subtitle: block.subtitle,
    tables: block.tables,
    technicalEntries: [],
    text: block.text,
  };

  return {
    blocks: getPageBlocks(childModel),
    subtitle: block.subtitle,
    title: block.title || block.type,
    type: "group",
  };
}

function getContentWeight(blocks: ImportedPrintBlock[]): number {
  return blocks.reduce((total, block) => {
    if (block.type === "text") {
      return total + block.text.length;
    }

    if (block.type === "fields") {
      return total + block.fields.length;
    }

    if (block.type === "prompts") {
      return total + block.prompts.length * 2;
    }

    if (block.type === "list") {
      return total + block.items.length;
    }

    if (block.type === "tables") {
      return (
        total +
        block.tables.reduce(
          (tableTotal, table) => tableTotal + table.rowCount + table.columns.length,
          0,
        )
      );
    }

    if (block.type === "group") {
      return total + getContentWeight(block.blocks);
    }

    return total + block.entries.length;
  }, 0);
}

function getPageWarnings(
  page: ImportedPrintPageInput,
  model: ImportedPagePreviewModel,
  blocks: ImportedPrintBlock[],
) {
  const warnings: ImportedPrintWarning[] = [];

  if (model.isEmpty) {
    warnings.push({
      code: "EMPTY_CONTENT",
      message: "La pagina non contiene elementi stampabili riconosciuti.",
      pageNumber: page.pageNumber,
    });
  }

  if (!page.templateId?.trim()) {
    warnings.push({
      code: "UNKNOWN_TEMPLATE",
      message: "Template mancante: applicato fallback tecnico generico.",
      pageNumber: page.pageNumber,
    });
  }

  // The future PDF renderer must solve dense tables with fixed layout rules,
  // not with internal scrollbars.
  for (const table of model.tables) {
    if (table.layout === "compact") {
      warnings.push({
        code: "TABLE_DENSE",
        message:
          "Tabella densa: usa layout compatto e richiedera controllo nel renderer PDF.",
        pageNumber: page.pageNumber,
      });
    }
  }

  if (getContentWeight(blocks) > 28) {
    warnings.push({
      code: "CONTENT_MAY_OVERFLOW",
      message: "La pagina contiene molti elementi e potrebbe superare l'area sicura.",
      pageNumber: page.pageNumber,
    });
  }

  return warnings;
}

function buildPage(page: ImportedPrintPageInput): ImportedPrintPage {
  const contentModel = buildImportedPagePreviewModel(page.content);
  const blocks = getPageBlocks(contentModel);
  const warnings = getPageWarnings(page, contentModel, blocks);

  return {
    blocks,
    pageNumber: page.pageNumber,
    sourceType: page.sourceType ?? null,
    status: page.status ?? "imported",
    subtitle: contentModel.subtitle,
    templateId: page.templateId ?? null,
    title: page.title || `Pagina ${page.pageNumber}`,
    warnings,
  };
}

export function buildImportedPrintRenderModel(
  input: BuildImportedPrintRenderModelInput,
): ImportedPrintRenderModel {
  const pages = [...input.pages]
    .sort((first, second) => first.pageNumber - second.pageNumber)
    .map(buildPage);
  const warnings = pages.flatMap((page) => page.warnings);

  return {
    pages,
    settings: {
      margins: getMargins(input.normalizedProject),
      pageSize: getPageSize(input),
    },
    warnings,
  };
}
