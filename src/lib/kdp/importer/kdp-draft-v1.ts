export const KDP_DRAFT_V1_HEADER = "KDP_DRAFT_V1";

export type KdpDraftV1PageType =
  | "callout"
  | "cover"
  | "divider"
  | "fields"
  | "habit_tracker"
  | "intro"
  | "notes"
  | "table"
  | "text"
  | "worksheet";

export type KdpDraftV1FieldIntent = "long" | "medium" | "short";

export type KdpDraftV1TableMode =
  | "fixed_capacity"
  | "fixed_rows"
  | "open_ended";

export type KdpDraftV1Book = {
  interior?: string;
  language?: string;
  subtitle?: string;
  targetPages?: number;
  theme?: string;
  title?: string;
  trimSize?: string;
};

export type KdpDraftV1Field = {
  intent?: KdpDraftV1FieldIntent;
  label: string;
};

export type KdpDraftV1TextBlock = {
  lines: string[];
  type: "text";
};

export type KdpDraftV1CalloutBlock = {
  lines: string[];
  type: "callout";
};

export type KdpDraftV1FieldsBlock = {
  fields: KdpDraftV1Field[];
  type: "fields";
};

export type KdpDraftV1FieldsGroupBlock = {
  fields: KdpDraftV1Field[];
  title?: string;
  type: "fields_group";
};

export type KdpDraftV1TableBlock = {
  columns: string[];
  rowCount?: number;
  rows: string[][];
  tableMode?: KdpDraftV1TableMode;
  title?: string;
  type: "table";
};

export type KdpDraftV1PromptsBlock = {
  prompts: string[];
  type: "prompts";
};

export type KdpDraftV1ColumnsBlock = {
  columns: string[];
  type: "columns";
};

export type KdpDraftV1RowsBlock = {
  rows: string[][];
  type: "rows";
};

export type KdpDraftV1Block =
  | KdpDraftV1CalloutBlock
  | KdpDraftV1ColumnsBlock
  | KdpDraftV1FieldsBlock
  | KdpDraftV1FieldsGroupBlock
  | KdpDraftV1PromptsBlock
  | KdpDraftV1RowsBlock
  | KdpDraftV1TableBlock
  | KdpDraftV1TextBlock;

export type KdpDraftV1Page = {
  blocks: KdpDraftV1Block[];
  days?: number;
  fill?: string;
  id: string;
  repeat?: number;
  tableMode?: KdpDraftV1TableMode;
  title?: string;
  titlePattern?: string;
  type: KdpDraftV1PageType;
};

export type KdpDraftV1Document = {
  book: KdpDraftV1Book;
  pages: KdpDraftV1Page[];
  version: "KDP_DRAFT_V1";
};

export type KdpDraftV1ErrorCode =
  | "BLOCK_NOT_CLOSED"
  | "BOOK_MISSING"
  | "BOOK_NOT_CLOSED"
  | "FIELD_INTENT_UNSUPPORTED"
  | "HEADER_MISSING"
  | "PAGE_MISSING_ID"
  | "PAGE_MISSING_TITLE"
  | "PAGE_NOT_CLOSED"
  | "PAGE_TYPE_UNSUPPORTED"
  | "TABLE_MODE_UNSUPPORTED"
  | "TOP_LEVEL_UNKNOWN";

export type KdpDraftV1Error = {
  code: KdpDraftV1ErrorCode;
  line: number;
  message: string;
};

export type KdpDraftV1ParseResult = {
  document?: KdpDraftV1Document;
  errors: KdpDraftV1Error[];
  ok: boolean;
};

type DraftLine = {
  lineNumber: number;
  text: string;
};

type Cursor = {
  index: number;
  lines: DraftLine[];
};

type ParseContext = {
  errors: KdpDraftV1Error[];
};

const PAGE_TYPES = new Set<KdpDraftV1PageType>([
  "callout",
  "cover",
  "divider",
  "fields",
  "habit_tracker",
  "intro",
  "notes",
  "table",
  "text",
  "worksheet",
]);

const FIELD_INTENTS = new Set<KdpDraftV1FieldIntent>([
  "long",
  "medium",
  "short",
]);

const TABLE_MODES = new Set<KdpDraftV1TableMode>([
  "fixed_capacity",
  "fixed_rows",
  "open_ended",
]);

function addError(
  context: ParseContext,
  code: KdpDraftV1ErrorCode,
  line: number,
  message: string,
) {
  context.errors.push({ code, line, message });
}

function normalizeDraftLines(rawText: string): DraftLine[] {
  return rawText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line, index) => ({
      lineNumber: index + 1,
      text: line.trim(),
    }))
    .filter((line) => line.text.length > 0);
}

function parseKeyValue(value: string) {
  const separatorIndex = value.indexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  return {
    key: value.slice(0, separatorIndex).trim().toLowerCase(),
    value: stripWrappingQuotes(value.slice(separatorIndex + 1).trim()),
  };
}

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }

  return value;
}

function readPositiveInteger(value: string) {
  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : undefined;
}

function parseTableMode(
  value: string,
  context: ParseContext,
  lineNumber: number,
) {
  if (TABLE_MODES.has(value as KdpDraftV1TableMode)) {
    return value as KdpDraftV1TableMode;
  }

  addError(
    context,
    "TABLE_MODE_UNSUPPORTED",
    lineNumber,
    `Unsupported table_mode "${value}".`,
  );
  return undefined;
}

function parseFieldIntent(
  value: string,
  context: ParseContext,
  lineNumber: number,
) {
  if (FIELD_INTENTS.has(value as KdpDraftV1FieldIntent)) {
    return value as KdpDraftV1FieldIntent;
  }

  addError(
    context,
    "FIELD_INTENT_UNSUPPORTED",
    lineNumber,
    `Unsupported field intent "${value}".`,
  );
  return undefined;
}

function cleanListItem(value: string) {
  return value.replace(/^[-*]\s+/, "").trim();
}

function parseFieldLine(
  value: string,
  context: ParseContext,
  lineNumber: number,
): KdpDraftV1Field | null {
  const cleanValue = cleanListItem(value);
  const [rawLabel, rawIntent, ...extraParts] = cleanValue.split("|");
  const label = rawLabel.trim();

  if (!label) {
    return null;
  }

  const intentValue = rawIntent?.trim();
  const intent =
    intentValue && intentValue.length > 0
      ? parseFieldIntent(intentValue, context, lineNumber)
      : undefined;

  if (extraParts.length > 0) {
    return {
      intent,
      label: [label, ...extraParts.map((part) => part.trim())].join(" | "),
    };
  }

  return { intent, label };
}

function parseRowLine(value: string) {
  return cleanListItem(value)
    .split("|")
    .map((cell) => cell.trim());
}

function parseTextBlock(
  cursor: Cursor,
  endMarker: string,
  context: ParseContext,
) {
  const lines: string[] = [];
  const startLine = cursor.lines[cursor.index]?.lineNumber ?? 1;

  cursor.index += 1;
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.text === endMarker) {
      cursor.index += 1;
      return lines;
    }

    lines.push(line.text);
    cursor.index += 1;
  }

  addError(
    context,
    "BLOCK_NOT_CLOSED",
    startLine,
    `${endMarker.replace(/^END_/, "")} block is not closed.`,
  );
  return lines;
}

function parseFieldsBlock(cursor: Cursor, context: ParseContext) {
  const fields: KdpDraftV1Field[] = [];
  const startLine = cursor.lines[cursor.index]?.lineNumber ?? 1;

  cursor.index += 1;
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.text === "END_FIELDS") {
      cursor.index += 1;
      return fields;
    }

    const field = parseFieldLine(line.text, context, line.lineNumber);

    if (field) {
      fields.push(field);
    }

    cursor.index += 1;
  }

  addError(context, "BLOCK_NOT_CLOSED", startLine, "FIELDS block is not closed.");
  return fields;
}

function parseColumnsBlock(cursor: Cursor, context: ParseContext) {
  const columns: string[] = [];
  const startLine = cursor.lines[cursor.index]?.lineNumber ?? 1;

  cursor.index += 1;
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.text === "END_COLUMNS") {
      cursor.index += 1;
      return columns;
    }

    const column = cleanListItem(line.text);

    if (column) {
      columns.push(column);
    }

    cursor.index += 1;
  }

  addError(context, "BLOCK_NOT_CLOSED", startLine, "COLUMNS block is not closed.");
  return columns;
}

function parseRowsBlock(cursor: Cursor, context: ParseContext) {
  const rows: string[][] = [];
  const startLine = cursor.lines[cursor.index]?.lineNumber ?? 1;

  cursor.index += 1;
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.text === "END_ROWS") {
      cursor.index += 1;
      return rows;
    }

    const row = parseRowLine(line.text);

    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }

    cursor.index += 1;
  }

  addError(context, "BLOCK_NOT_CLOSED", startLine, "ROWS block is not closed.");
  return rows;
}

function parsePromptsBlock(cursor: Cursor, context: ParseContext) {
  const prompts: string[] = [];
  const startLine = cursor.lines[cursor.index]?.lineNumber ?? 1;

  cursor.index += 1;
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.text === "END_PROMPTS") {
      cursor.index += 1;
      return prompts;
    }

    const prompt = cleanListItem(line.text);

    if (prompt) {
      prompts.push(prompt);
    }

    cursor.index += 1;
  }

  addError(context, "BLOCK_NOT_CLOSED", startLine, "PROMPTS block is not closed.");
  return prompts;
}

function parseFieldsGroupBlock(
  cursor: Cursor,
  context: ParseContext,
): KdpDraftV1FieldsGroupBlock {
  const startLine = cursor.lines[cursor.index]?.lineNumber ?? 1;
  const group: KdpDraftV1FieldsGroupBlock = {
    fields: [],
    type: "fields_group",
  };

  cursor.index += 1;
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.text === "END_FIELDS_GROUP") {
      cursor.index += 1;
      return group;
    }

    if (line.text === "FIELDS") {
      group.fields.push(...parseFieldsBlock(cursor, context));
      continue;
    }

    const keyValue = parseKeyValue(line.text);

    if (keyValue?.key === "title") {
      group.title = keyValue.value;
    } else if (line.text.startsWith("-")) {
      const field = parseFieldLine(line.text, context, line.lineNumber);

      if (field) {
        group.fields.push(field);
      }
    }

    cursor.index += 1;
  }

  addError(
    context,
    "BLOCK_NOT_CLOSED",
    startLine,
    "FIELDS_GROUP block is not closed.",
  );
  return group;
}

function parseTableBlock(
  cursor: Cursor,
  context: ParseContext,
): KdpDraftV1TableBlock {
  const startLine = cursor.lines[cursor.index]?.lineNumber ?? 1;
  const table: KdpDraftV1TableBlock = {
    columns: [],
    rows: [],
    type: "table",
  };

  cursor.index += 1;
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.text === "END_TABLE") {
      cursor.index += 1;
      return table;
    }

    if (line.text === "COLUMNS") {
      table.columns = parseColumnsBlock(cursor, context);
      continue;
    }

    if (line.text === "ROWS") {
      table.rows = parseRowsBlock(cursor, context);
      continue;
    }

    const keyValue = parseKeyValue(line.text);

    if (keyValue) {
      if (keyValue.key === "title") {
        table.title = keyValue.value;
      } else if (keyValue.key === "table_mode") {
        table.tableMode = parseTableMode(
          keyValue.value,
          context,
          line.lineNumber,
        );
      } else if (keyValue.key === "rows") {
        table.rowCount = readPositiveInteger(keyValue.value);
      }
    }

    cursor.index += 1;
  }

  addError(context, "BLOCK_NOT_CLOSED", startLine, "TABLE block is not closed.");
  return table;
}

function parsePageBlock(cursor: Cursor, context: ParseContext): KdpDraftV1Block | null {
  const line = cursor.lines[cursor.index];

  if (!line) {
    return null;
  }

  if (line.text === "TEXT") {
    return { lines: parseTextBlock(cursor, "END_TEXT", context), type: "text" };
  }

  if (line.text === "CALLOUT") {
    return {
      lines: parseTextBlock(cursor, "END_CALLOUT", context),
      type: "callout",
    };
  }

  if (line.text === "FIELDS") {
    return { fields: parseFieldsBlock(cursor, context), type: "fields" };
  }

  if (line.text === "FIELDS_GROUP") {
    return parseFieldsGroupBlock(cursor, context);
  }

  if (line.text === "TABLE") {
    return parseTableBlock(cursor, context);
  }

  if (line.text === "COLUMNS") {
    return { columns: parseColumnsBlock(cursor, context), type: "columns" };
  }

  if (line.text === "ROWS") {
    return { rows: parseRowsBlock(cursor, context), type: "rows" };
  }

  if (line.text === "PROMPTS") {
    return {
      prompts: parsePromptsBlock(cursor, context),
      type: "prompts",
    };
  }

  return null;
}

function parseBook(cursor: Cursor, context: ParseContext) {
  const startLine = cursor.lines[cursor.index]?.lineNumber ?? 1;
  const book: KdpDraftV1Book = {};

  cursor.index += 1;
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.text === "END_BOOK") {
      cursor.index += 1;
      return book;
    }

    const keyValue = parseKeyValue(line.text);

    if (keyValue) {
      if (keyValue.key === "title") {
        book.title = keyValue.value;
      } else if (keyValue.key === "subtitle") {
        book.subtitle = keyValue.value;
      } else if (keyValue.key === "language") {
        book.language = keyValue.value;
      } else if (keyValue.key === "trim_size") {
        book.trimSize = keyValue.value;
      } else if (keyValue.key === "interior") {
        book.interior = keyValue.value;
      } else if (keyValue.key === "theme") {
        book.theme = keyValue.value;
      } else if (keyValue.key === "target_pages") {
        book.targetPages = readPositiveInteger(keyValue.value);
      }
    }

    cursor.index += 1;
  }

  addError(context, "BOOK_NOT_CLOSED", startLine, "BOOK block is not closed.");
  return book;
}

function parsePage(cursor: Cursor, context: ParseContext) {
  const startLine = cursor.lines[cursor.index]?.lineNumber ?? 1;
  const page: Partial<KdpDraftV1Page> & { blocks: KdpDraftV1Block[] } = {
    blocks: [],
  };

  cursor.index += 1;
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.text === "END_PAGE") {
      cursor.index += 1;
      return finalizePage(page, context, startLine);
    }

    const block = parsePageBlock(cursor, context);

    if (block) {
      page.blocks.push(block);
      continue;
    }

    const keyValue = parseKeyValue(line.text);

    if (keyValue) {
      if (keyValue.key === "id") {
        page.id = keyValue.value;
      } else if (keyValue.key === "title") {
        page.title = keyValue.value;
      } else if (keyValue.key === "type") {
        if (PAGE_TYPES.has(keyValue.value as KdpDraftV1PageType)) {
          page.type = keyValue.value as KdpDraftV1PageType;
        } else {
          addError(
            context,
            "PAGE_TYPE_UNSUPPORTED",
            line.lineNumber,
            `Unsupported page type "${keyValue.value}".`,
          );
        }
      } else if (keyValue.key === "repeat") {
        page.repeat = readPositiveInteger(keyValue.value);
      } else if (keyValue.key === "title_pattern") {
        page.titlePattern = keyValue.value;
      } else if (keyValue.key === "table_mode") {
        page.tableMode = parseTableMode(
          keyValue.value,
          context,
          line.lineNumber,
        );
      } else if (keyValue.key === "fill") {
        page.fill = keyValue.value;
      } else if (keyValue.key === "days") {
        page.days = readPositiveInteger(keyValue.value);
      }
    }

    cursor.index += 1;
  }

  addError(context, "PAGE_NOT_CLOSED", startLine, "PAGE block is not closed.");
  return finalizePage(page, context, startLine);
}

function finalizePage(
  page: Partial<KdpDraftV1Page> & { blocks: KdpDraftV1Block[] },
  context: ParseContext,
  lineNumber: number,
): KdpDraftV1Page | null {
  if (!page.id) {
    addError(context, "PAGE_MISSING_ID", lineNumber, "PAGE is missing id.");
  }

  if (!page.title && !page.titlePattern) {
    addError(
      context,
      "PAGE_MISSING_TITLE",
      lineNumber,
      "PAGE is missing title or title_pattern.",
    );
  }

  if (!page.type) {
    addError(
      context,
      "PAGE_TYPE_UNSUPPORTED",
      lineNumber,
      "PAGE is missing or has unsupported type.",
    );
  }

  if (!page.id || !page.type || (!page.title && !page.titlePattern)) {
    return null;
  }

  return {
    blocks: page.blocks,
    days: page.days,
    fill: page.fill,
    id: page.id,
    repeat: page.repeat,
    tableMode: page.tableMode,
    title: page.title,
    titlePattern: page.titlePattern,
    type: page.type,
  };
}

export function parseKdpDraftV1(rawText: string): KdpDraftV1ParseResult {
  const lines = normalizeDraftLines(rawText);
  const context: ParseContext = { errors: [] };

  if (lines[0]?.text !== KDP_DRAFT_V1_HEADER) {
    addError(
      context,
      "HEADER_MISSING",
      lines[0]?.lineNumber ?? 1,
      "Missing KDP_DRAFT_V1 header.",
    );
    return { errors: context.errors, ok: false };
  }

  const cursor: Cursor = {
    index: 1,
    lines,
  };
  let book: KdpDraftV1Book | undefined;
  const pages: KdpDraftV1Page[] = [];

  while (cursor.index < lines.length) {
    const line = lines[cursor.index];

    if (line.text === "BOOK") {
      book = parseBook(cursor, context);
      continue;
    }

    if (line.text === "PAGE") {
      const page = parsePage(cursor, context);

      if (page) {
        pages.push(page);
      }

      continue;
    }

    addError(
      context,
      "TOP_LEVEL_UNKNOWN",
      line.lineNumber,
      `Unknown top-level line "${line.text}".`,
    );
    cursor.index += 1;
  }

  if (!book) {
    addError(context, "BOOK_MISSING", 1, "BOOK block is missing.");
  }

  const document = book
    ? {
        book,
        pages,
        version: KDP_DRAFT_V1_HEADER,
      } satisfies KdpDraftV1Document
    : undefined;

  return {
    document,
    errors: context.errors,
    ok: context.errors.length === 0,
  };
}
