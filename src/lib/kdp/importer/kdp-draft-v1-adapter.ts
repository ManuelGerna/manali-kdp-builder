import type {
  BuildImportedPrintRenderModelInput,
  ImportedPrintPageInput,
} from "../imported-page-print-renderer.ts";
import type { Json } from "../../../types/database.ts";
import type {
  KdpDraftV1Block,
  KdpDraftV1Document,
  KdpDraftV1Field,
  KdpDraftV1Page,
  KdpDraftV1PageType,
  KdpDraftV1RowsBlock,
  KdpDraftV1TableBlock,
} from "./kdp-draft-v1.ts";

export type KdpDraftV1AdapterErrorCode =
  | "BLOCK_TYPE_UNSUPPORTED"
  | "FIELDS_MISSING"
  | "HABIT_TRACKER_DAYS_MISSING"
  | "HABIT_TRACKER_ROWS_MISSING"
  | "PAGE_TYPE_UNSUPPORTED"
  | "PROMPTS_MISSING"
  | "REPEAT_INVALID"
  | "ROWS_MISSING"
  | "TABLE_COLUMNS_MISSING";

export type KdpDraftV1AdapterError = {
  code: KdpDraftV1AdapterErrorCode;
  message: string;
  pageId?: string;
  path: string;
};

export type KdpDraftV1ImportedPagesAdapterResult = {
  errors: KdpDraftV1AdapterError[];
  model: BuildImportedPrintRenderModelInput;
  ok: boolean;
};

type AdapterContext = {
  errors: KdpDraftV1AdapterError[];
};

type AdaptedContentBlock = Record<string, Json | undefined>;

const SUPPORTED_PAGE_TYPES = new Set<KdpDraftV1PageType>([
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

function addError(
  context: AdapterContext,
  error: KdpDraftV1AdapterError,
) {
  context.errors.push(error);
}

function fieldLabels(fields: KdpDraftV1Field[]) {
  return fields.map((field) => field.label);
}

function fieldIntentMetadata(fields: KdpDraftV1Field[]): Json {
  return fields.map((field) => ({
    intent: field.intent,
    label: field.label,
  }));
}

function compactObject(input: Record<string, Json | undefined>): Json {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Json;
}

function getRowsAsItems(blocks: KdpDraftV1Block[]) {
  return blocks
    .filter((block): block is KdpDraftV1RowsBlock => block.type === "rows")
    .flatMap((block) =>
      block.rows
        .map((row) => row.filter(Boolean).join(" | ").trim())
        .filter(Boolean),
    );
}

function rowColumnNames(rows: string[][]) {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));

  return Array.from({ length: columnCount }, (_, index) => `Valore ${index + 1}`);
}

function replaceTitlePattern(pattern: string, index: number) {
  return pattern.replace(/\{\{\s*n\s*\}\}/g, String(index));
}

function getConcretePageTitle(page: KdpDraftV1Page, repeatIndex: number) {
  if (page.titlePattern) {
    return replaceTitlePattern(page.titlePattern, repeatIndex);
  }

  return page.title ?? `Pagina ${repeatIndex}`;
}

function getRepeatCount(
  page: KdpDraftV1Page,
  context: AdapterContext,
  path: string,
) {
  const repeat = page.repeat ?? 1;

  if (!Number.isInteger(repeat) || repeat < 1) {
    addError(context, {
      code: "REPEAT_INVALID",
      message: "repeat must be a positive integer.",
      pageId: page.id,
      path: `${path}.repeat`,
    });
    return 0;
  }

  return repeat;
}

function tableToContent(
  table: KdpDraftV1TableBlock,
  context: AdapterContext,
  path: string,
  pageId: string,
): Json | null {
  if (table.columns.length === 0) {
    addError(context, {
      code: "TABLE_COLUMNS_MISSING",
      message: "TABLE must define at least one column.",
      pageId,
      path: `${path}.columns`,
    });
    return null;
  }

  return compactObject({
    columns: table.columns,
    rowCount: table.rowCount ?? table.rows.length,
    rows: table.rows,
    table_mode: table.tableMode,
    title: table.title,
  });
}

function adaptBlock(
  block: KdpDraftV1Block,
  context: AdapterContext,
  path: string,
  pageId: string,
): AdaptedContentBlock | null {
  if (block.type === "text") {
    return {
      extras: { blockType: "text" },
      text: block.lines,
    };
  }

  if (block.type === "callout") {
    return {
      extras: { blockType: "callout" },
      text: block.lines,
      title: "Callout",
    };
  }

  if (block.type === "fields") {
    if (block.fields.length === 0) {
      addError(context, {
        code: "FIELDS_MISSING",
        message: "FIELDS block must contain at least one field.",
        pageId,
        path: `${path}.fields`,
      });
      return null;
    }

    return {
      extras: {
        blockType: "fields",
        fieldIntents: fieldIntentMetadata(block.fields),
      },
      fields: fieldLabels(block.fields),
    };
  }

  if (block.type === "fields_group") {
    if (block.fields.length === 0) {
      addError(context, {
        code: "FIELDS_MISSING",
        message: "FIELDS_GROUP block must contain at least one field.",
        pageId,
        path: `${path}.fields`,
      });
      return null;
    }

    return {
      extras: {
        blockType: "fields_group",
        fieldIntents: fieldIntentMetadata(block.fields),
      },
      fields: fieldLabels(block.fields),
      title: block.title,
    };
  }

  if (block.type === "table") {
    const table = tableToContent(block, context, path, pageId);

    return table
      ? {
          extras: {
            blockType: "table",
            tableMode: block.tableMode,
          },
          table,
        }
      : null;
  }

  if (block.type === "columns") {
    if (block.columns.length === 0) {
      addError(context, {
        code: "FIELDS_MISSING",
        message: "COLUMNS block must contain at least one column.",
        pageId,
        path: `${path}.columns`,
      });
      return null;
    }

    return {
      extras: { blockType: "columns" },
      items: block.columns,
      title: "Colonne",
    };
  }

  if (block.type === "rows") {
    if (block.rows.length === 0) {
      addError(context, {
        code: "ROWS_MISSING",
        message: "ROWS block must contain at least one row.",
        pageId,
        path: `${path}.rows`,
      });
      return null;
    }

    return {
      extras: { blockType: "rows" },
      table: {
        columns: rowColumnNames(block.rows),
        rowCount: block.rows.length,
        rows: block.rows,
      },
    };
  }

  if (block.type === "prompts") {
    if (block.prompts.length === 0) {
      addError(context, {
        code: "PROMPTS_MISSING",
        message: "PROMPTS block must contain at least one prompt.",
        pageId,
        path: `${path}.prompts`,
      });
      return null;
    }

    return {
      extras: { blockType: "prompts" },
      prompts: block.prompts,
    };
  }

  addError(context, {
    code: "BLOCK_TYPE_UNSUPPORTED",
    message: `Unsupported block type "${(block as { type?: string }).type ?? "unknown"}".`,
    pageId,
    path,
  });
  return null;
}

function adaptPageBlocks(
  page: KdpDraftV1Page,
  context: AdapterContext,
  path: string,
) {
  return page.blocks
    .map((block, index) =>
      adaptBlock(block, context, `${path}.blocks[${index}]`, page.id),
    )
    .filter((block): block is AdaptedContentBlock => Boolean(block));
}

function adaptHabitTrackerContent(
  page: KdpDraftV1Page,
  context: AdapterContext,
  path: string,
) {
  const items = getRowsAsItems(page.blocks);
  const nonRowsBlocks = page.blocks.filter((block) => block.type !== "rows");
  const blocks = nonRowsBlocks
    .map((block, index) =>
      adaptBlock(block, context, `${path}.blocks[${index}]`, page.id),
    )
    .filter((block): block is AdaptedContentBlock => Boolean(block));

  if (!page.days) {
    addError(context, {
      code: "HABIT_TRACKER_DAYS_MISSING",
      message: "habit_tracker page must define days.",
      pageId: page.id,
      path: `${path}.days`,
    });
  }

  if (items.length === 0) {
    addError(context, {
      code: "HABIT_TRACKER_ROWS_MISSING",
      message: "habit_tracker page must define ROWS habits.",
      pageId: page.id,
      path: `${path}.blocks`,
    });
  }

  return compactObject({
    abitudini: items,
    blocks: blocks.length > 0 ? blocks : undefined,
    days: page.days,
    extras: {
      draftPageId: page.id,
      fill: page.fill,
      pageType: page.type,
      repeat: page.repeat,
      titlePattern: page.titlePattern,
    },
    title: page.title,
    type: page.type,
  });
}

function adaptPageContent(
  page: KdpDraftV1Page,
  context: AdapterContext,
  path: string,
  repeatIndex: number,
  repeatCount: number,
) {
  if (page.type === "habit_tracker") {
    return adaptHabitTrackerContent(page, context, path);
  }

  const blocks = adaptPageBlocks(page, context, path);

  return compactObject({
    blocks: blocks.length > 0 ? blocks : undefined,
    extras: {
      draftPageId: page.id,
      fill: page.fill,
      pageType: page.type,
      repeat: page.repeat,
      repeatCount,
      repeatIndex,
      tableMode: page.tableMode,
      titlePattern: page.titlePattern,
    },
    title: getConcretePageTitle(page, repeatIndex),
    type: page.type,
  });
}

function buildNormalizedProject(document: KdpDraftV1Document): Json {
  return {
    extras: {
      kdpDraftV1: {
        book: document.book,
      },
    },
    project: {
      language: document.book.language,
      subtitle: document.book.subtitle,
      title: document.book.title,
    },
    source: {
      draftVersion: document.version,
      parserVersion: "kdp_draft_v1",
    },
    technicalSpecs: {
      interiorColor: document.book.interior,
      targetPageCount: document.book.targetPages,
      trimSize: document.book.trimSize,
    },
    visualSystem: {
      colorMode: document.book.theme,
      styleName: document.book.theme,
    },
  };
}

function adaptPage(
  page: KdpDraftV1Page,
  context: AdapterContext,
  pageIndex: number,
  startingPageNumber: number,
) {
  const path = `pages[${pageIndex}]`;
  const pages: ImportedPrintPageInput[] = [];

  if (!SUPPORTED_PAGE_TYPES.has(page.type)) {
    addError(context, {
      code: "PAGE_TYPE_UNSUPPORTED",
      message: `Unsupported page type "${(page as { type?: string }).type ?? "unknown"}".`,
      pageId: page.id,
      path: `${path}.type`,
    });
    return pages;
  }

  const repeatCount = getRepeatCount(page, context, path);

  for (let repeatIndex = 1; repeatIndex <= repeatCount; repeatIndex += 1) {
    const title = getConcretePageTitle(page, repeatIndex);

    pages.push({
      content: adaptPageContent(page, context, path, repeatIndex, repeatCount),
      pageNumber: startingPageNumber + repeatIndex - 1,
      sourceType: "kdp_draft_v1",
      status: "ready",
      templateId: `kdp_draft_v1_${page.type}`,
      title,
    });
  }

  return pages;
}

export function adaptKdpDraftV1ToImportedPages(
  document: KdpDraftV1Document,
): KdpDraftV1ImportedPagesAdapterResult {
  const context: AdapterContext = { errors: [] };
  const pages: ImportedPrintPageInput[] = [];
  let nextPageNumber = 1;

  for (const [pageIndex, page] of document.pages.entries()) {
    const adaptedPages = adaptPage(page, context, pageIndex, nextPageNumber);
    pages.push(...adaptedPages);
    nextPageNumber += adaptedPages.length;
  }

  return {
    errors: context.errors,
    model: {
      bookSettings: {
        trimSize: document.book.trimSize,
      },
      normalizedProject: buildNormalizedProject(document),
      pages,
    },
    ok: context.errors.length === 0,
  };
}
