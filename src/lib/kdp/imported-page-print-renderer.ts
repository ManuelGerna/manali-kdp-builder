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
      ordered?: boolean;
      type: "list";
    }
  | {
      entries: ImportedPreviewEntry[];
      type: "fallback";
    }
  | {
      fields: string[];
      layout?: "grid" | "stack";
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
  hasPrintableHeader: boolean;
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

const PRINT_TITLE_KEYS = ["title", "titolo"] as const;
const PRINT_HANDLED_KEYS = new Set([
  "blocks",
  "blocchi",
  "body",
  "campi",
  "campicompilabili",
  "columns",
  "colonne",
  "colonnetabella",
  "description",
  "descrizione",
  "elementi",
  "fields",
  "footertext",
  "formfields",
  "inputfields",
  "items",
  "list",
  "lista",
  "liste",
  "lists",
  "note",
  "notes",
  "numerorighe",
  "prompt",
  "promptfinale",
  "prompts",
  "punti",
  "righe",
  "rotazioneprompt",
  "rowcount",
  "rows",
  "sottotitolo",
  "subtitle",
  "table",
  "tabella",
  "tables",
  "tabelle",
  "testo",
  "text",
  "title",
  "titolo",
  "type",
  "tipo",
]);
const PRINT_TECHNICAL_KEYS = new Set([
  "debug",
  "errors",
  "extras",
  "importrunid",
  "normalizedsectionid",
  "raw",
  "rawtext",
  "sectionid",
  "sourceref",
  "sourcetype",
  "status",
  "templateid",
  "warnings",
]);
const HABIT_GRID_DAY_KEYS = ["days", "giorni"] as const;
const HABIT_GRID_ITEM_KEYS = [
  "abitudini",
  "habits",
  "items",
  "elementi",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeKey(value: string) {
  return value.replace(/[\s_-]/g, "").toLowerCase();
}

function normalizeLabel(value: string) {
  return value.replaceAll("_", " ");
}

function isTechnicalKey(value: string) {
  return PRINT_TECHNICAL_KEYS.has(normalizeKey(value));
}

function isHandledPrintKey(value: string) {
  return PRINT_HANDLED_KEYS.has(normalizeKey(value));
}

function hasKeyFragment(value: string, fragments: string[]) {
  const normalized = normalizeKey(value);

  return fragments.some((fragment) => normalized.includes(fragment));
}

function isHeaderKey(value: string) {
  return hasKeyFragment(value, ["header", "intestazione", "testata"]);
}

function isStateKey(value: string) {
  return hasKeyFragment(value, ["meta", "stato", "status"]);
}

function isTableKey(value: string) {
  return hasKeyFragment(value, ["grid", "griglia", "table", "tabella"]);
}

function isBlockKey(value: string) {
  return hasKeyFragment(value, ["block", "blocco", "group", "gruppo"]);
}

function isFinalKey(value: string) {
  return hasKeyFragment(value, ["final", "finale", "chiusura"]);
}

function isPromptKey(value: string) {
  return hasKeyFragment(value, ["note", "notes", "prompt", "riflessione"]);
}

function isFieldKey(value: string) {
  return hasKeyFragment(value, ["campi", "fields", "form", "input"]);
}

function getFieldBlock(fields: string[]): ImportedPrintBlock | null {
  const cleanFields = fields.map((field) => field.trim()).filter(Boolean);

  if (cleanFields.length === 0) {
    return null;
  }

  return {
    fields: cleanFields,
    layout: cleanFields.length >= 2 ? "grid" : "stack",
    type: "fields",
  };
}

function isListKey(value: string) {
  return hasKeyFragment(value, [
    "elementi",
    "items",
    "list",
    "lista",
    "passaggi",
    "punti",
    "steps",
  ]);
}

function getEntryOrder(key: string) {
  if (isHeaderKey(key)) {
    return 10;
  }

  if (isStateKey(key)) {
    return 20;
  }

  if (isTableKey(key)) {
    return 30;
  }

  if (isBlockKey(key)) {
    return 40;
  }

  if (isFinalKey(key) || isPromptKey(key)) {
    return 50;
  }

  if (isListKey(key)) {
    return 45;
  }

  if (isFieldKey(key)) {
    return 25;
  }

  return 60;
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

function toText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return String(value).trim();
  }

  return "";
}

function splitListText(value: string) {
  const text = value.trim();

  if (!text) {
    return [];
  }

  const separator = text.includes("\n")
    ? /\r?\n/
    : text.includes(" | ")
      ? /\s+\|\s+/
      : text.includes("; ")
        ? /;\s+/
        : null;

  if (!separator) {
    return [text];
  }

  return text
    .split(separator)
    .map((item) => item.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function toTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (isRecord(item)) {
          const label = toText(item.label ?? item.name ?? item.campo ?? item.key);
          const itemValue = toText(item.value ?? item.valore ?? item.text);

          if (label && itemValue) {
            return [`${label}: ${itemValue}`];
          }

          return label || itemValue ? [label || itemValue] : [];
        }

        return splitListText(toText(item));
      })
      .filter(Boolean);
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => {
        const itemValue = toText(item);
        return itemValue ? `${normalizeLabel(key)}: ${itemValue}` : "";
      })
      .filter(Boolean);
  }

  return splitListText(toText(value));
}

function getRecordText(
  source: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = toText(source[key]);

    if (value) {
      return value;
    }
  }

  return undefined;
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

function getRowColumnCount(row: ImportedPreviewTable["rows"][number]) {
  if (Array.isArray(row)) {
    return row.length;
  }

  if (isRecord(row)) {
    return Object.keys(row).length;
  }

  return row ? 1 : 0;
}

function getTableLayout(
  columns: string[],
  rows: ImportedPreviewTable["rows"],
  rowCount: number,
): ImportedPreviewTable["layout"] {
  const columnCount =
    columns.length > 0
      ? columns.length
      : Math.max(0, ...rows.map(getRowColumnCount));

  return columnCount >= 5 || rowCount >= 10 ? "compact" : "standard";
}

function getTableBlockFromRows(
  key: string,
  rowsValue: unknown[],
): ImportedPrintBlock | null {
  if (!rowsValue.every(isRecord)) {
    return null;
  }

  const columns = Array.from(
    new Set(rowsValue.flatMap((row) => Object.keys(row))),
  );
  const rows = rowsValue.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([rowKey, rowValue]) => [rowKey, toText(rowValue)]),
    ),
  );

  if (columns.length === 0 || rows.length === 0) {
    return null;
  }

  return {
    tables: [
      {
        columns,
        layout: getTableLayout(columns, rows, rows.length),
        rowCount: rows.length,
        rows,
        title: normalizeLabel(key),
      },
    ],
    type: "tables",
  };
}

function getHabitGridBlock(
  source: Record<string, unknown>,
  title?: string,
): ImportedPrintBlock | null {
  const days = HABIT_GRID_DAY_KEYS.flatMap((key) => toTextList(source[key]));
  const items = HABIT_GRID_ITEM_KEYS.flatMap((key) => toTextList(source[key]));

  if (days.length === 0 || items.length === 0) {
    return null;
  }

  const columns = ["Elemento", ...days];
  const rows = items.map((item) =>
    Object.fromEntries(columns.map((column) => [column, column === "Elemento" ? item : ""])),
  );

  return {
    tables: [
      {
        columns,
        layout: getTableLayout(columns, rows, rows.length),
        rowCount: rows.length,
        rows,
        title,
      },
    ],
    type: "tables",
  };
}

function hasHabitGrid(source: Record<string, unknown>) {
  const days = HABIT_GRID_DAY_KEYS.some((key) => toTextList(source[key]).length > 0);
  const items = HABIT_GRID_ITEM_KEYS.some((key) => toTextList(source[key]).length > 0);

  return days && items;
}

function isHabitGridKey(key: string) {
  const normalized = normalizeKey(key);

  return [...HABIT_GRID_DAY_KEYS, ...HABIT_GRID_ITEM_KEYS].some(
    (itemKey) => normalizeKey(itemKey) === normalized,
  );
}

function getEntryBlocks(key: string, value: unknown): ImportedPrintBlock[] {
  if (value === undefined || isTechnicalKey(key)) {
    return [];
  }

  if (isRecord(value)) {
    const habitGrid = getHabitGridBlock(value, normalizeLabel(key));

    if (habitGrid) {
      return [habitGrid];
    }

    if (isTableKey(key)) {
      const tableModel = buildImportedPagePreviewModel(value as Json);

      if (tableModel.tables.length > 0) {
        return [
          {
            tables: tableModel.tables.map((table) => ({
              ...table,
              title: table.title ?? normalizeLabel(key),
            })),
            type: "tables",
          },
        ];
      }
    }

    const nestedBlocks = getRecordPrintBlocks(value);

    if (nestedBlocks.length === 0) {
      return [];
    }

    return [
      {
        blocks: nestedBlocks,
        title: normalizeLabel(key),
        type: "group",
      },
    ];
  }

  if (Array.isArray(value)) {
    const tableBlock = getTableBlockFromRows(key, value);

    if (tableBlock) {
      return [tableBlock];
    }

    const list = toTextList(value);

    if (list.length === 0) {
      return [];
    }

    return [
      {
        items: list,
        ordered: isListKey(key) && hasKeyFragment(key, ["passaggi", "steps"]),
        type: "list",
      },
    ];
  }

  const list = isListKey(key) ? toTextList(value) : [];

  if (list.length > 1) {
    return [
      {
        items: list,
        ordered: hasKeyFragment(key, ["passaggi", "steps"]),
        type: "list",
      },
    ];
  }

  const text = toText(value);

  if (!text) {
    const fieldBlock = getFieldBlock([normalizeLabel(key)]);

    return fieldBlock ? [fieldBlock] : [];
  }

  if (isPromptKey(key) || isFinalKey(key)) {
    return [
      {
        prompts: [text],
        type: "prompts",
      },
    ];
  }

  if (isFieldKey(key) || isHeaderKey(key) || isStateKey(key)) {
    const fieldBlock = getFieldBlock([`${normalizeLabel(key)}: ${text}`]);

    return fieldBlock ? [fieldBlock] : [];
  }

  if (text.length <= 90) {
    const fieldBlock = getFieldBlock([`${normalizeLabel(key)}: ${text}`]);

    return fieldBlock ? [fieldBlock] : [];
  }

  return [
    {
      entries: [
        {
          label: normalizeLabel(key),
          value: text,
        },
      ],
      type: "fallback",
    },
  ];
}

function getEntryBlockOrder(key: string, block: ImportedPrintBlock) {
  const baseOrder = getEntryOrder(key);

  if (block.type === "fields") {
    return Math.min(baseOrder, 25);
  }

  if (block.type === "tables") {
    return Math.min(baseOrder, 30);
  }

  if (block.type === "prompts") {
    return Math.max(baseOrder, 55);
  }

  return baseOrder;
}

function getRecordPrintBlocks(source: Record<string, unknown>) {
  const model = buildImportedPagePreviewModel(source as Json);
  const orderedBlocks: Array<{ block: ImportedPrintBlock; order: number }> = [];

  for (const block of getPageBlocks(model, false)) {
    if (block.type === "text") {
      orderedBlocks.push({ block, order: 12 });
      continue;
    }

    if (block.type === "fields") {
      orderedBlocks.push({ block, order: 15 });
      continue;
    }

    if (block.type === "tables") {
      orderedBlocks.push({ block, order: 30 });
      continue;
    }

    if (block.type === "group") {
      orderedBlocks.push({ block, order: 40 });
      continue;
    }

    if (block.type === "list") {
      orderedBlocks.push({ block, order: 45 });
      continue;
    }

    if (block.type === "prompts") {
      orderedBlocks.push({ block, order: 55 });
      continue;
    }

    orderedBlocks.push({ block, order: 70 });
  }

  const includesHabitGrid = hasHabitGrid(source);

  for (const [key, value] of Object.entries(source)) {
    if (
      isHandledPrintKey(key) ||
      isTechnicalKey(key) ||
      (includesHabitGrid && isHabitGridKey(key))
    ) {
      continue;
    }

    for (const block of getEntryBlocks(key, value)) {
      orderedBlocks.push({
        block,
        order: getEntryBlockOrder(key, block),
      });
    }
  }

  if (includesHabitGrid) {
    const habitGrid = getHabitGridBlock(source, "Griglia");

    if (habitGrid) {
      orderedBlocks.push({
        block: habitGrid,
        order: 30,
      });
    }
  }

  return orderedBlocks
    .sort((first, second) => first.order - second.order)
    .map(({ block }) => block)
    .reduce<ImportedPrintBlock[]>((blocks, block) => {
      const previous = blocks.at(-1);

      if (previous?.type === "fields" && block.type === "fields") {
        previous.fields.push(...block.fields);
        previous.layout =
          previous.fields.length >= 2 || block.layout === "grid"
            ? "grid"
            : "stack";

        return blocks;
      }

      blocks.push(block);
      return blocks;
    }, []);
}

function getPageBlocks(
  model: ImportedPagePreviewModel,
  includeFallback = true,
): ImportedPrintBlock[] {
  const blocks: ImportedPrintBlock[] = [];

  if (model.text.length > 0) {
    blocks.push({
      text: model.text,
      type: "text",
    });
  }

  if (model.fields.length > 0) {
    const fieldBlock = getFieldBlock(model.fields);

    if (fieldBlock) {
      blocks.push(fieldBlock);
    }
  }

  for (const list of model.lists) {
    blocks.push({
      items: list,
      type: "list",
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

  if (model.prompts.length > 0) {
    blocks.push({
      prompts: model.prompts,
      type: "prompts",
    });
  }

  if (includeFallback && model.fallbackEntries.length > 0) {
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

function getContentTitle(content: Json) {
  return isRecord(content) ? getRecordText(content, PRINT_TITLE_KEYS) : undefined;
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
  hasPrintableHeader: boolean,
) {
  const warnings: ImportedPrintWarning[] = [];

  if (model.isEmpty && !hasPrintableHeader) {
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
  const contentTitle = getContentTitle(page.content);
  const hasPrintableHeader = Boolean(
    page.title?.trim() || contentTitle || contentModel.subtitle,
  );
  const blocks = isRecord(page.content)
    ? getRecordPrintBlocks(page.content)
    : getPageBlocks(contentModel);
  const warnings = getPageWarnings(
    page,
    contentModel,
    blocks,
    hasPrintableHeader,
  );

  return {
    blocks,
    hasPrintableHeader,
    pageNumber: page.pageNumber,
    sourceType: page.sourceType ?? null,
    status: page.status ?? "imported",
    subtitle: contentModel.subtitle,
    templateId: page.templateId ?? null,
    title: page.title || contentTitle || `Pagina ${page.pageNumber}`,
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
