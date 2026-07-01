export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["\u201c", "\u201d"],
    ["\u00ab", "\u00bb"],
  ];

  for (const [start, end] of pairs) {
    if (trimmed.startsWith(start) && trimmed.endsWith(end)) {
      return trimmed.slice(start.length, -end.length).trim();
    }
  }

  return trimmed;
}

export function parseScalar(value: string): unknown {
  const cleanValue = stripWrappingQuotes(value);
  const lowerValue = cleanValue.toLowerCase();

  if (!cleanValue) {
    return "";
  }

  if (["true", "si", "sì", "yes"].includes(lowerValue)) {
    return true;
  }

  if (["false", "no"].includes(lowerValue)) {
    return false;
  }

  if (/^[+-]?\d+(?:[,.]\d+)?$/.test(cleanValue)) {
    const numberValue = Number(cleanValue.replace(",", "."));

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return cleanValue;
}

export function readField(
  record: Record<string, unknown> | undefined,
  aliases: readonly string[],
) {
  if (!record) {
    return undefined;
  }

  const normalizedAliases = new Set(aliases.map(normalizeKey));

  for (const [key, value] of Object.entries(record)) {
    if (normalizedAliases.has(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
}

export function readString(
  record: Record<string, unknown> | undefined,
  aliases: readonly string[],
) {
  const value = readField(record, aliases);

  if (typeof value === "string") {
    const cleanValue = stripWrappingQuotes(value);

    return cleanValue || undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

export function readNumber(
  record: Record<string, unknown> | undefined,
  aliases: readonly string[],
) {
  const value = readField(record, aliases);

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const match = value.match(/[+-]?\d+(?:[,.]\d+)?/);

    if (match) {
      const numberValue = Number(match[0].replace(",", "."));

      return Number.isFinite(numberValue) ? numberValue : undefined;
    }
  }

  return undefined;
}

export function readRecord(
  record: Record<string, unknown> | undefined,
  aliases: readonly string[],
) {
  const value = readField(record, aliases);

  return isRecord(value) ? value : undefined;
}

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return stripWrappingQuotes(item);
        }

        if (typeof item === "number" || typeof item === "boolean") {
          return String(item);
        }

        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|;/)
      .map((item) => stripWrappingQuotes(item))
      .filter(Boolean);
  }

  return [];
}

export function readStringArray(
  record: Record<string, unknown> | undefined,
  aliases: readonly string[],
) {
  return toStringArray(readField(record, aliases));
}

export function pickExtras(
  record: Record<string, unknown>,
  knownAliases: readonly string[],
) {
  const known = new Set(knownAliases.map(normalizeKey));
  const extras: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeKey(key);

    if (!known.has(normalizedKey)) {
      extras[normalizedKey || key] = value;
    }
  }

  return Object.keys(extras).length > 0 ? extras : undefined;
}

export function slugify(value: string) {
  return normalizeKey(value).replace(/_/g, "-").slice(0, 80);
}

function getIndent(value: string) {
  const match = value.replace(/\t/g, "  ").match(/^ */);

  return match?.[0].length ?? 0;
}

function splitKeyValue(value: string) {
  const separatorIndex = value.indexOf(":");

  if (separatorIndex === -1) {
    return null;
  }

  const key = value.slice(0, separatorIndex).trim();
  const rawValue = value.slice(separatorIndex + 1).trim();

  if (!key) {
    return null;
  }

  return {
    hasValue: rawValue.length > 0,
    key,
    rawValue,
  };
}

type ParsedLine = {
  content: string;
  indent: number;
  lineNumber: number;
  raw: string;
};

type ParseResult = {
  nextIndex: number;
  value: unknown;
};

function parseBullet(content: string) {
  const match = content.match(/^[-*]\s+(.*)$/);

  return match ? match[1].trim() : null;
}

function parseNode(lines: ParsedLine[], startIndex: number): ParseResult {
  const firstLine = lines[startIndex];

  if (!firstLine) {
    return {
      nextIndex: startIndex,
      value: {},
    };
  }

  if (parseBullet(firstLine.content) !== null) {
    return parseArray(lines, startIndex, firstLine.indent);
  }

  return parseObject(lines, startIndex, firstLine.indent);
}

function parseArray(
  lines: ParsedLine[],
  startIndex: number,
  indent: number,
): ParseResult {
  const items: unknown[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (!line || line.indent < indent || line.indent > indent) {
      break;
    }

    const bulletContent = parseBullet(line.content);

    if (bulletContent === null) {
      break;
    }

    if (!bulletContent) {
      const nextLine = lines[index + 1];

      if (nextLine && nextLine.indent > indent) {
        const nested = parseNode(lines, index + 1);
        items.push(nested.value);
        index = nested.nextIndex;
      } else {
        items.push("");
        index += 1;
      }

      continue;
    }

    const keyValue = splitKeyValue(bulletContent);

    if (!keyValue) {
      items.push(parseScalar(bulletContent));
      index += 1;
      continue;
    }

    const item: Record<string, unknown> = {};

    if (keyValue.hasValue) {
      item[keyValue.key] = parseScalar(keyValue.rawValue);
      index += 1;
    } else {
      const nextLine = lines[index + 1];

      if (nextLine && nextLine.indent > indent) {
        const nested = parseNode(lines, index + 1);
        item[keyValue.key] = nested.value;
        index = nested.nextIndex;
      } else {
        item[keyValue.key] = null;
        index += 1;
      }
    }

    const nextLine = lines[index];

    if (nextLine && nextLine.indent > indent) {
      const nested = parseObject(lines, index, nextLine.indent);

      if (isRecord(nested.value)) {
        Object.assign(item, nested.value);
      } else {
        item.items = nested.value;
      }

      index = nested.nextIndex;
    }

    items.push(item);
  }

  return {
    nextIndex: index,
    value: items,
  };
}

function parseObject(
  lines: ParsedLine[],
  startIndex: number,
  indent: number,
): ParseResult {
  const record: Record<string, unknown> = {};
  const textLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (!line || line.indent < indent || line.indent > indent) {
      break;
    }

    if (parseBullet(line.content) !== null) {
      break;
    }

    const keyValue = splitKeyValue(line.content);

    if (!keyValue) {
      textLines.push(line.content);
      index += 1;
      continue;
    }

    if (keyValue.hasValue) {
      record[keyValue.key] = parseScalar(keyValue.rawValue);
      index += 1;
      continue;
    }

    const nextLine = lines[index + 1];

    if (
      nextLine &&
      (nextLine.indent > indent ||
        (nextLine.indent === indent && parseBullet(nextLine.content) !== null))
    ) {
      const nested = parseNode(lines, index + 1);
      record[keyValue.key] = nested.value;
      index = nested.nextIndex;
    } else {
      record[keyValue.key] = null;
      index += 1;
    }
  }

  if (textLines.length > 0) {
    record.__text = textLines.join("\n");
  }

  return {
    nextIndex: index,
    value: record,
  };
}

export function parseYamlLikeBlock(rawBlock: string): unknown {
  const lines = rawBlock
    .replace(/\t/g, "  ")
    .split("\n")
    .map((raw, index): ParsedLine | null => {
      const content = raw.trim();

      if (!content || content.startsWith("#")) {
        return null;
      }

      return {
        content,
        indent: getIndent(raw),
        lineNumber: index + 1,
        raw,
      };
    })
    .filter((line): line is ParsedLine => Boolean(line));

  if (lines.length === 0) {
    return {};
  }

  return parseNode(lines, 0).value;
}
