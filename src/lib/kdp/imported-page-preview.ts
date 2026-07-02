import type { Json } from "../../types/database.ts";

export type ImportedPreviewTable = {
  columns: string[];
  rows: Array<Record<string, string> | string[] | string>;
  rowCount: number;
  title?: string;
};

export type ImportedPreviewEntry = {
  label: string;
  value: string;
};

export type ImportedPreviewBlock = {
  blocks: ImportedPreviewBlock[];
  fields: string[];
  lists: string[][];
  prompts: string[];
  subtitle?: string;
  tables: ImportedPreviewTable[];
  text: string[];
  title?: string;
  type?: string;
};

export type ImportedPagePreviewModel = {
  blocks: ImportedPreviewBlock[];
  fields: string[];
  fallbackEntries: ImportedPreviewEntry[];
  isEmpty: boolean;
  lists: string[][];
  prompts: string[];
  subtitle?: string;
  tables: ImportedPreviewTable[];
  technicalEntries: ImportedPreviewEntry[];
  text: string[];
};

const TEXT_KEYS = [
  "body",
  "description",
  "descrizione",
  "footerText",
  "footer_text",
  "note",
  "notes",
  "testo",
  "text",
] as const;

const FIELD_KEYS = [
  "campi",
  "campi_compilabili",
  "fields",
  "form_fields",
  "input_fields",
] as const;

const PROMPT_KEYS = [
  "prompt",
  "prompt_finale",
  "prompts",
  "rotazione_prompt",
] as const;

const LIST_KEYS = [
  "elementi",
  "items",
  "list",
  "lista",
  "liste",
  "lists",
  "punti",
] as const;

const SUBTITLE_KEYS = ["sottotitolo", "subtitle"] as const;

const TABLE_KEYS = ["table", "tabella"] as const;
const TABLES_KEYS = ["tables", "tabelle"] as const;

const TECHNICAL_KEYS = new Set([
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

const HANDLED_KEYS = new Set<string>([
  ...TEXT_KEYS,
  ...FIELD_KEYS,
  ...PROMPT_KEYS,
  ...LIST_KEYS,
  ...SUBTITLE_KEYS,
  ...TABLE_KEYS,
  ...TABLES_KEYS,
  "blocks",
  "blocchi",
  "columns",
  "colonne",
  "colonne_tabella",
  "fields",
  "numero_righe",
  "righe",
  "rowCount",
  "rows",
  "title",
  "titolo",
  "type",
  "tipo",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeLabel(value: string) {
  return value.replaceAll("_", " ");
}

function normalizeKey(value: string) {
  return value.replace(/[\s_-]/g, "").toLowerCase();
}

function isTechnicalKey(value: string) {
  return TECHNICAL_KEYS.has(normalizeKey(value));
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

function toTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (isRecord(item)) {
          const label = toText(item.label ?? item.name ?? item.campo ?? item.key);
          const itemValue = toText(item.value ?? item.valore ?? item.text);

          if (label && itemValue) {
            return `${label}: ${itemValue}`;
          }

          return label || itemValue;
        }

        return toText(item);
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

  const text = toText(value);
  return text ? [text] : [];
}

function toRowString(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).join(" | ");
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${normalizeLabel(key)}: ${toText(item)}`)
      .join(" | ");
  }

  return toText(value);
}

function toEntryValue(value: unknown) {
  return isRecord(value) || Array.isArray(value) ? toRowString(value) : toText(value);
}

function toRows(value: unknown): ImportedPreviewTable["rows"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((row) => {
    if (Array.isArray(row)) {
      return row.map(toText);
    }

    if (isRecord(row)) {
      return Object.fromEntries(
        Object.entries(row).map(([key, item]) => [key, toText(item)]),
      );
    }

    return toText(row);
  });
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function collectTextFromKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
) {
  return keys.flatMap((key) => toTextList(source[key]));
}

function collectLists(source: Record<string, unknown>) {
  const lists: string[][] = [];

  for (const key of LIST_KEYS) {
    const value = source[key];

    if (Array.isArray(value) && value.every(Array.isArray)) {
      for (const item of value) {
        const list = toTextList(item);

        if (list.length > 0) {
          lists.push(list);
        }
      }

      continue;
    }

    if (isRecord(value)) {
      for (const item of Object.values(value)) {
        const list = toTextList(item);

        if (list.length > 0) {
          lists.push(list);
        }
      }

      continue;
    }

    const list = toTextList(value);

    if (list.length > 0) {
      lists.push(list);
    }
  }

  return lists;
}

function getColumns(source: Record<string, unknown>) {
  return toTextList(
    source.colonne_tabella ?? source.columns ?? source.colonne,
  );
}

function buildTableFromRecord(
  source: Record<string, unknown>,
  title?: string,
): ImportedPreviewTable | null {
  const columns = getColumns(source);
  const rows = toRows(source.righe ?? source.rows);
  const rowCount =
    getNumber(source.numero_righe) ?? getNumber(source.rowCount) ?? rows.length;

  if (columns.length === 0 && rows.length === 0 && !rowCount) {
    return null;
  }

  return {
    columns,
    rowCount,
    rows,
    title,
  };
}

function collectTables(source: Record<string, unknown>): ImportedPreviewTable[] {
  const tables: ImportedPreviewTable[] = [];
  const directTable = buildTableFromRecord(source);

  if (directTable) {
    tables.push(directTable);
  }

  for (const key of TABLE_KEYS) {
    const tableValue = source[key];

    if (isRecord(tableValue)) {
      const table = buildTableFromRecord(tableValue);

      if (table) {
        tables.push(table);
      }
    }
  }

  for (const key of TABLES_KEYS) {
    const tableList = source[key];

    if (!Array.isArray(tableList)) {
      continue;
    }

    for (const [index, tableValue] of tableList.entries()) {
      if (!isRecord(tableValue)) {
        continue;
      }

      const table = buildTableFromRecord(tableValue, `Tabella ${index + 1}`);

      if (table) {
        tables.push(table);
      }
    }
  }

  return tables;
}

function collectBlocks(source: Record<string, unknown>): ImportedPreviewBlock[] {
  const rawBlocks = source.blocks ?? source.blocchi;

  if (!Array.isArray(rawBlocks)) {
    return [];
  }

  const blocks: ImportedPreviewBlock[] = [];

  for (const block of rawBlocks) {
    if (!isRecord(block)) {
      const text = toText(block);

      if (text) {
        blocks.push({
          blocks: [],
          fields: [],
          lists: [],
          prompts: [],
          tables: [],
          text: [text],
        });
      }

      continue;
    }

    const model = buildImportedPagePreviewModel(block as Json);

    blocks.push({
      blocks: model.blocks,
      fields: model.fields,
      lists: model.lists,
      prompts: model.prompts,
      subtitle: model.subtitle,
      tables: model.tables,
      text: model.text,
      title: toText(block.title ?? block.titolo) || undefined,
      type: toText(block.type ?? block.tipo) || undefined,
    });
  }

  return blocks;
}

function collectFallbackEntries(source: Record<string, unknown>) {
  return Object.entries(source)
    .filter(
      ([key, value]) =>
        !HANDLED_KEYS.has(key) && !isTechnicalKey(key) && value !== undefined,
    )
    .map(([key, value]) => ({
      label: normalizeLabel(key),
      value: toEntryValue(value),
    }))
    .filter((entry) => entry.value);
}

function collectTechnicalEntries(source: Record<string, unknown>) {
  return Object.entries(source)
    .filter(([key, value]) => isTechnicalKey(key) && value !== undefined)
    .map(([key, value]) => ({
      label: normalizeLabel(key),
      value: toEntryValue(value),
    }))
    .filter((entry) => entry.value);
}

export function buildImportedPagePreviewModel(
  content: Json,
): ImportedPagePreviewModel {
  if (!isRecord(content)) {
    const text = toText(content);

    return {
      blocks: [],
      fields: [],
      fallbackEntries: [],
      isEmpty: !text,
      lists: [],
      prompts: [],
      tables: [],
      technicalEntries: [],
      text: text ? [text] : [],
    };
  }

  const text = collectTextFromKeys(content, TEXT_KEYS);
  const fields = collectTextFromKeys(content, FIELD_KEYS);
  const lists = collectLists(content);
  const prompts = collectTextFromKeys(content, PROMPT_KEYS);
  const subtitle = collectTextFromKeys(content, SUBTITLE_KEYS)[0];
  const tables = collectTables(content);
  const blocks = collectBlocks(content);
  const fallbackEntries = collectFallbackEntries(content);
  const technicalEntries = collectTechnicalEntries(content);
  const isEmpty =
    text.length === 0 &&
    fields.length === 0 &&
    lists.length === 0 &&
    prompts.length === 0 &&
    !subtitle &&
    tables.length === 0 &&
    blocks.length === 0 &&
    fallbackEntries.length === 0;

  return {
    blocks,
    fields,
    fallbackEntries,
    isEmpty,
    lists,
    prompts,
    subtitle,
    tables,
    technicalEntries,
    text,
  };
}
