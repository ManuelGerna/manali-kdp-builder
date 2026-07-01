import { generatePages } from "./page-generation.ts";
import type {
  BookSection,
  CoverBrief,
  ImportIssue,
  ImportOptions,
  KdpMetadataDraft,
  NormalizedKdpProject,
  ParsedDraft,
  ProjectInfo,
  QualityChecklist,
  TechnicalSpecs,
  TopLevelBlocks,
  VisualSystem,
} from "./types.ts";
import {
  buildImportReport,
  parseDraftTemplateDefinitions,
  resolveTemplates,
  validateImportedProject,
} from "./validation.ts";
import {
  isRecord,
  normalizeKey,
  parseScalar,
  parseYamlLikeBlock,
  pickExtras,
  readField,
  readNumber,
  readRecord,
  readString,
  readStringArray,
  slugify,
  toStringArray,
} from "./utils.ts";

export const PARSER_VERSION = "0.1.0";

const DEFAULT_SUPPORTED_DRAFT_VERSIONS = ["0.1"] as const;

const TOP_LEVEL_KEYS = new Set(
  [
    "KDP_BUILDER_DRAFT_VERSION",
    "TIPO_PROGETTO",
    "MODALITA_IMPORTAZIONE",
    "MODALITÀ_IMPORTAZIONE",
    "LINGUA_LIBRO",
    "MERCATO_TARGET",
    "TIPO_LIBRO",
    "NOTA_USO_AI",
    "IDEA_LIBRO",
    "SPECIFICHE_TECNICHE",
    "SISTEMA_VISIVO",
    "PIANO_PAGINE",
    "SEQUENZA_PAGINE",
    "TEMPLATE_PAGINA",
    "TESTI_FISSI",
    "BRIEF_COPERTINA",
    "METADATI_KDP_DRAFT",
    "CHECKLIST_QUALITÀ_PRIMA_EXPORT",
    "CHECKLIST_QUALITA_PRIMA_EXPORT",
    "LOGICA_AUTOMAZIONE_KDP_BUILDER",
  ].map(normalizeKey),
);

const CONSUMED_BLOCK_KEYS = new Set(
  [
    "IDEA_LIBRO",
    "SPECIFICHE_TECNICHE",
    "SISTEMA_VISIVO",
    "PIANO_PAGINE",
    "SEQUENZA_PAGINE",
    "TEMPLATE_PAGINA",
    "BRIEF_COPERTINA",
    "METADATI_KDP_DRAFT",
    "CHECKLIST_QUALITÀ_PRIMA_EXPORT",
  ].map(normalizeKey),
);

function issue(input: ImportIssue) {
  return input;
}

function compactRecord<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === undefined) {
        return false;
      }

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      if (isRecord(value)) {
        return Object.keys(value).length > 0;
      }

      return true;
    }),
  ) as Partial<T>;
}

function getParsedBlock(parsedDraft: ParsedDraft, aliases: readonly string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeKey));

  for (const [key, value] of Object.entries(parsedDraft.parsedBlocks)) {
    if (normalizedAliases.has(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
}

function getRawBlock(blocks: Record<string, string>, aliases: readonly string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeKey));

  for (const [key, value] of Object.entries(blocks)) {
    if (normalizedAliases.has(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
}

function isTopLevelDraftKey(key: string) {
  if (TOP_LEVEL_KEYS.has(normalizeKey(key))) {
    return true;
  }

  return /^[A-Z0-9_À-ÖØ-Þ]+$/u.test(key.trim()) && key.trim().length > 1;
}

function extractMarkdownDraft(rawText: string) {
  const matches = [...rawText.matchAll(/```(?:text|txt|yaml|yml)?\s*\n([\s\S]*?)\n```/gi)];

  if (matches.length === 0) {
    return undefined;
  }

  const draftMatch =
    matches.find((match) =>
      /KDP_BUILDER_DRAFT_VERSION|SEQUENZA_PAGINE|SPECIFICHE_TECNICHE/.test(
        match[1],
      ),
    ) ?? matches[0];

  return draftMatch[1];
}

export function normalizeRawText(rawText: string): {
  effectiveText: string;
  issues: ImportIssue[];
  rawText: string;
} {
  const normalizedText = String(rawText ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  const markdownDraft = extractMarkdownDraft(normalizedText);
  const issues: ImportIssue[] = [];

  if (markdownDraft !== undefined) {
    issues.push(
      issue({
        code: "MARKDOWN_CODE_FENCE_USED",
        message: "A markdown code fence was detected and used as draft input.",
        path: "source.rawText",
        severity: "warning",
      }),
    );
  }

  return {
    effectiveText: markdownDraft ?? normalizedText,
    issues,
    rawText,
  };
}

export function detectDraftVersion(rawText: string) {
  const match = rawText.match(/^\s*KDP_BUILDER_DRAFT_VERSION\s*:\s*([^\n]+)/im);
  const version = match ? String(parseScalar(match[1])).trim() : undefined;

  return version || undefined;
}

export function splitTopLevelBlocks(rawText: string): TopLevelBlocks {
  const rootFields: Record<string, unknown> = {};
  const rawBlocks: Record<string, string> = {};
  const orphanText: string[] = [];
  const lines = rawText.split("\n");
  let currentBlockKey: string | null = null;
  let currentBlockLines: string[] = [];

  function flushBlock() {
    if (!currentBlockKey) {
      return;
    }

    rawBlocks[currentBlockKey] = currentBlockLines.join("\n").trim();
    currentBlockKey = null;
    currentBlockLines = [];
  }

  for (const rawLine of lines) {
    const topLevelMatch = rawLine.match(/^([A-Z0-9_À-ÖØ-Þ]+)\s*:\s*(.*)$/u);

    if (topLevelMatch && isTopLevelDraftKey(topLevelMatch[1])) {
      flushBlock();

      const blockKey = normalizeKey(topLevelMatch[1]);
      const rawValue = topLevelMatch[2].trim();

      if (rawValue) {
        rootFields[topLevelMatch[1]] = parseScalar(rawValue);
        continue;
      }

      currentBlockKey = blockKey;
      currentBlockLines = [];
      continue;
    }

    if (currentBlockKey) {
      currentBlockLines.push(rawLine);
      continue;
    }

    if (rawLine.trim()) {
      orphanText.push(rawLine);
    }
  }

  flushBlock();

  return {
    orphanText,
    rawBlocks,
    rootFields,
  };
}

export function parseDraftBlocks(blocks: TopLevelBlocks): ParsedDraft {
  const parsedBlocks = Object.fromEntries(
    Object.entries(blocks.rawBlocks).map(([key, value]) => [
      key,
      parseYamlLikeBlock(value),
    ]),
  );

  return {
    orphanText: blocks.orphanText,
    parsedBlocks,
    rawBlocks: blocks.rawBlocks,
    rootFields: blocks.rootFields,
  };
}

function normalizeBleed(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const cleanValue = value.toLowerCase();

  if (cleanValue.includes("no bleed") || cleanValue.includes("senza bleed")) {
    return false;
  }

  if (cleanValue === "no" || cleanValue === "false") {
    return false;
  }

  if (cleanValue.includes("bleed") || cleanValue === "true") {
    return true;
  }

  return value;
}

function normalizeProjectInfo(input: {
  coverBrief: CoverBrief | undefined;
  ideaBlock: unknown;
  kdpMetadata: KdpMetadataDraft | undefined;
  rootFields: Record<string, unknown>;
}): ProjectInfo {
  const idea = isRecord(input.ideaBlock) ? input.ideaBlock : undefined;
  const notes = [
    readString(input.rootFields, ["NOTA_USO_AI", "nota_uso_ai"]),
    readString(idea, ["pubblico_target", "target_audience"]),
    readString(idea, ["promessa_principale", "main_promise"]),
  ].filter((value): value is string => Boolean(value));

  return compactRecord<ProjectInfo>({
    bookType: readString(input.rootFields, ["TIPO_LIBRO", "book_type"]),
    importMode: readString(input.rootFields, [
      "MODALITA_IMPORTAZIONE",
      "MODALITÀ_IMPORTAZIONE",
      "import_mode",
    ]),
    language: readString(input.rootFields, ["LINGUA_LIBRO", "language"]),
    notes,
    positioning: readString(idea, ["posizionamento", "positioning"]),
    projectType: readString(input.rootFields, ["TIPO_PROGETTO", "project_type"]),
    subtitle:
      readString(idea, ["sottotitolo", "subtitle"]) ??
      input.kdpMetadata?.subtitle ??
      input.coverBrief?.subtitle,
    targetMarket: readString(input.rootFields, ["MERCATO_TARGET", "target_market"]),
    title:
      readString(idea, ["titolo_provvisorio", "titolo", "title"]) ??
      input.kdpMetadata?.title ??
      input.coverBrief?.title,
    tone: readString(idea, ["tono", "tone"]),
  });
}

function normalizeTechnicalSpecs(input: {
  issues: ImportIssue[];
  pagePlanBlock: unknown;
  technicalBlock: unknown;
}): TechnicalSpecs {
  const technical = isRecord(input.technicalBlock) ? input.technicalBlock : undefined;
  const pagePlan = isRecord(input.pagePlanBlock) ? input.pagePlanBlock : undefined;
  const targetFromTechnical = readNumber(technical, [
    "numero_pagine_target",
    "target_page_count",
    "targetPageCount",
  ]);
  const targetFromPlan = readNumber(pagePlan, [
    "totale_pagine",
    "total_pages",
    "target_page_count",
  ]);
  const margins = readRecord(technical, [
    "margini",
    "margini_consigliati",
    "recommended_margins",
  ]);
  const bleedValue = readField(technical, ["bleed"]);

  if (
    targetFromTechnical !== undefined &&
    targetFromPlan !== undefined &&
    targetFromTechnical !== targetFromPlan
  ) {
    input.issues.push(
      issue({
        code: "TARGET_PAGE_COUNT_DECLARATION_MISMATCH",
        message:
          "Technical specs and page plan declare different target page counts.",
        path: "technicalSpecs.targetPageCount",
        severity: "warning",
      }),
    );
  }

  return compactRecord<TechnicalSpecs>({
    binding: readString(technical, ["rilegatura", "binding"]),
    bleed: normalizeBleed(bleedValue),
    designGoal: readString(technical, ["obiettivo_design", "design_goal"]),
    interiorColor: readString(technical, ["interno", "interior", "interior_color"]),
    margins: margins
      ? compactRecord({
          bottom: readString(margins, ["basso", "bottom"]),
          inside: readString(margins, ["interno", "inside", "inner"]),
          outside: readString(margins, ["esterno", "outside", "outer"]),
          top: readString(margins, ["alto", "top"]),
        })
      : undefined,
    orientation: readString(technical, ["orientamento", "orientation"]),
    paperType: readString(technical, ["carta", "paper", "paper_type"]),
    targetPageCount: targetFromTechnical ?? targetFromPlan,
    trimSize: readString(technical, ["formato", "trim_size", "trimSize"]),
    visualDensity: readString(technical, ["densita_visiva", "visual_density"]),
  });
}

function normalizeVisualSystem(visualBlock: unknown): VisualSystem | undefined {
  if (!isRecord(visualBlock)) {
    return undefined;
  }

  const typography = readRecord(visualBlock, ["tipografia", "typography"]);
  const normalized = compactRecord<VisualSystem>({
    avoid: readStringArray(visualBlock, ["evitare", "avoid"]),
    colorMode: readString(visualBlock, [
      "modalita_colore",
      "modalità_colore",
      "color_mode",
    ]),
    mood: readString(visualBlock, ["atmosfera", "mood"]),
    recurringElements: readStringArray(visualBlock, [
      "elementi_ricorrenti",
      "recurring_elements",
    ]),
    styleName: readString(visualBlock, ["nome_stile", "style_name"]),
    typography: typography
      ? compactRecord({
          body: readString(typography, ["body", "corpo"]),
          headings: readString(typography, ["headings", "titoli"]),
          labels: readString(typography, ["labels", "etichette"]),
        })
      : undefined,
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeSections(pagePlanBlock: unknown): BookSection[] {
  if (!isRecord(pagePlanBlock)) {
    return [];
  }

  const sectionsValue = readField(pagePlanBlock, ["sezioni", "sections"]);

  if (!Array.isArray(sectionsValue)) {
    return [];
  }

  let nextStartPage = 1;

  return sectionsValue.filter(isRecord).map((section, index) => {
    const title =
      readString(section, ["titolo_sezione", "titolo", "title"]) ??
      `Section ${index + 1}`;
    const id =
      readString(section, ["id_sezione", "id", "section_id"]) ??
      slugify(title) ??
      `section-${index + 1}`;
    const expectedPageCount = readNumber(section, [
      "pagine",
      "page_count",
      "expected_page_count",
    ]);
    const declaredStartPage = readNumber(section, [
      "pagina_inizio",
      "start_page",
      "startPage",
    ]);
    const declaredEndPage = readNumber(section, [
      "pagina_fine",
      "end_page",
      "endPage",
    ]);
    const startPage =
      declaredStartPage ??
      (expectedPageCount !== undefined ? nextStartPage : undefined);
    const endPage =
      declaredEndPage ??
      (startPage !== undefined && expectedPageCount !== undefined
        ? startPage + expectedPageCount - 1
        : undefined);

    if (endPage !== undefined) {
      nextStartPage = endPage + 1;
    }

    return compactRecord<BookSection>({
      actualPageCount: 0,
      endPage,
      expectedPageCount,
      id,
      startPage,
      status: "ok",
      title,
    }) as BookSection;
  });
}

function normalizeCoverBrief(coverBlock: unknown): CoverBrief | undefined {
  if (!isRecord(coverBlock)) {
    return undefined;
  }

  const knownAliases = [
    "titolo_copertina",
    "titolo",
    "sottotitolo_copertina",
    "sottotitolo",
    "autore_placeholder",
    "author_placeholder",
    "stile_copertina",
    "stile",
    "target_feeling",
    "direzione_visiva",
    "visual_direction",
    "evitare",
    "avoid",
    "prompt",
    "priorita_thumbnail",
    "thumbnail_priorities",
  ];
  const normalized = compactRecord<CoverBrief>({
    authorPlaceholder: readString(coverBlock, [
      "autore_placeholder",
      "author_placeholder",
    ]),
    avoid: readStringArray(coverBlock, ["evitare", "avoid"]),
    prompt: readString(coverBlock, ["prompt"]),
    style: readString(coverBlock, ["stile_copertina", "stile", "style"]),
    subtitle: readString(coverBlock, [
      "sottotitolo_copertina",
      "sottotitolo",
      "subtitle",
    ]),
    targetFeeling: readString(coverBlock, ["target_feeling", "sensazione_target"]),
    thumbnailPriorities: readStringArray(coverBlock, [
      "priorita_thumbnail",
      "thumbnail_priorities",
    ]),
    title: readString(coverBlock, ["titolo_copertina", "titolo", "title"]),
    visualDirection: readStringArray(coverBlock, [
      "direzione_visiva",
      "visual_direction",
    ]),
    extras: pickExtras(coverBlock, knownAliases),
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeKdpMetadata(
  metadataBlock: unknown,
): KdpMetadataDraft | undefined {
  if (!isRecord(metadataBlock)) {
    return undefined;
  }

  const knownAliases = [
    "titolo",
    "title",
    "sottotitolo",
    "subtitle",
    "descrizione",
    "description",
    "punti_elenco",
    "bullet_points",
    "keyword_seed",
    "keyword_seeds",
    "note_compliance",
    "compliance_notes",
  ];
  const normalized = compactRecord<KdpMetadataDraft>({
    bulletPoints: readStringArray(metadataBlock, [
      "punti_elenco",
      "bullet_points",
    ]),
    complianceNotes: readStringArray(metadataBlock, [
      "note_compliance",
      "compliance_notes",
    ]),
    description: readString(metadataBlock, ["descrizione", "description"]),
    extras: pickExtras(metadataBlock, knownAliases),
    keywordSeeds: readStringArray(metadataBlock, [
      "keyword_seed",
      "keyword_seeds",
    ]),
    subtitle: readString(metadataBlock, ["sottotitolo", "subtitle"]),
    title: readString(metadataBlock, ["titolo", "title"]),
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeQualityChecklist(
  checklistBlock: unknown,
): QualityChecklist | undefined {
  if (!isRecord(checklistBlock)) {
    return undefined;
  }

  const knownAliases = ["interno", "interior", "copertina", "cover", "kdp"];
  const extras: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(checklistBlock)) {
    const normalizedKey = normalizeKey(key);

    if (!knownAliases.map(normalizeKey).includes(normalizedKey)) {
      const values = toStringArray(value);

      if (values.length > 0) {
        extras[normalizedKey || key] = values;
      }
    }
  }

  const normalized = compactRecord<QualityChecklist>({
    cover: readStringArray(checklistBlock, ["copertina", "cover"]),
    extras: Object.keys(extras).length > 0 ? extras : undefined,
    interior: readStringArray(checklistBlock, ["interno", "interior"]),
    kdp: readStringArray(checklistBlock, ["kdp"]),
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildExtras(parsedDraft: ParsedDraft, draftTemplates: unknown) {
  const unrecognizedBlocks = Object.keys(parsedDraft.rawBlocks).filter(
    (key) => !CONSUMED_BLOCK_KEYS.has(normalizeKey(key)),
  );

  return compactRecord({
    orphanText: parsedDraft.orphanText,
    rawBlocks: parsedDraft.rawBlocks,
    templateDefinitions: draftTemplates,
    unrecognizedBlocks,
  });
}

function createBaseProject(input: {
  importedAt: string;
  issues: ImportIssue[];
  rawText: string;
}): NormalizedKdpProject {
  const source = {
    importedAt: input.importedAt,
    parserVersion: PARSER_VERSION,
    rawText: input.rawText,
  };
  const project = {
    importReport: buildImportReport({
      issues: input.issues,
      project: {
        pages: [],
        project: {},
        sections: [],
        technicalSpecs: {},
        templates: {
          requestedTemplateIds: [],
          usageByTemplateId: {},
        },
      },
      source,
    }),
    pages: [],
    project: {},
    sections: [],
    source,
    technicalSpecs: {},
    templates: {
      requestedTemplateIds: [],
      usageByTemplateId: {},
    },
  };

  return project;
}

export function importKdpBuilderDraft(
  rawText: string,
  options: ImportOptions = {},
): NormalizedKdpProject {
  const importedAt = options.importedAt ?? new Date().toISOString();
  const received = normalizeRawText(rawText);
  const issues = [...received.issues];

  if (!received.effectiveText.trim()) {
    issues.push(
      issue({
        code: "EMPTY_DRAFT",
        message: "Draft text is empty.",
        path: "source.rawText",
        severity: "error",
      }),
    );

    return createBaseProject({
      importedAt,
      issues,
      rawText: received.rawText,
    });
  }

  const draftVersion = detectDraftVersion(received.effectiveText);
  const supportedDraftVersions =
    options.supportedDraftVersions ?? DEFAULT_SUPPORTED_DRAFT_VERSIONS;

  if (!draftVersion) {
    issues.push(
      issue({
        code: "DRAFT_VERSION_MISSING",
        message: "Draft version is missing; legacy fallback parser was used.",
        path: "source.draftVersion",
        severity: "warning",
      }),
    );
  } else if (!supportedDraftVersions.includes(draftVersion)) {
    issues.push(
      issue({
        code: "DRAFT_VERSION_UNSUPPORTED",
        message: "Draft version is not explicitly supported by this parser.",
        path: "source.draftVersion",
        rawSnippet: draftVersion,
        severity: "warning",
      }),
    );
  }

  const source = {
    ...(draftVersion ? { draftVersion } : {}),
    importedAt,
    parserVersion: PARSER_VERSION,
    rawText: received.rawText,
  };
  const splitBlocks = splitTopLevelBlocks(received.effectiveText);
  const parsedDraft = parseDraftBlocks(splitBlocks);
  const coverBrief = normalizeCoverBrief(
    getParsedBlock(parsedDraft, ["BRIEF_COPERTINA"]),
  );
  const kdpMetadata = normalizeKdpMetadata(
    getParsedBlock(parsedDraft, ["METADATI_KDP_DRAFT"]),
  );
  const qualityChecklist = normalizeQualityChecklist(
    getParsedBlock(parsedDraft, ["CHECKLIST_QUALITÀ_PRIMA_EXPORT"]),
  );
  const project = normalizeProjectInfo({
    coverBrief,
    ideaBlock: getParsedBlock(parsedDraft, ["IDEA_LIBRO"]),
    kdpMetadata,
    rootFields: parsedDraft.rootFields,
  });
  const technicalSpecs = normalizeTechnicalSpecs({
    issues,
    pagePlanBlock: getParsedBlock(parsedDraft, ["PIANO_PAGINE"]),
    technicalBlock: getParsedBlock(parsedDraft, ["SPECIFICHE_TECNICHE"]),
  });
  const visualSystem = normalizeVisualSystem(
    getParsedBlock(parsedDraft, ["SISTEMA_VISIVO"]),
  );
  const sections = normalizeSections(getParsedBlock(parsedDraft, ["PIANO_PAGINE"]));
  const pageGeneration = generatePages(
    getParsedBlock(parsedDraft, ["SEQUENZA_PAGINE"]),
    sections,
  );
  issues.push(...pageGeneration.issues);

  const rawTemplateBlock = getRawBlock(parsedDraft.rawBlocks, ["TEMPLATE_PAGINA"]);
  const parsedTemplateBlock = getParsedBlock(parsedDraft, ["TEMPLATE_PAGINA"]);
  const draftTemplates = parseDraftTemplateDefinitions(parsedTemplateBlock);
  const templateResolution = resolveTemplates({
    draftTemplates,
    pages: pageGeneration.pages,
    templateRegistry: options.templateRegistry,
  });
  issues.push(...templateResolution.issues);

  const validation = validateImportedProject({
    pages: templateResolution.pages,
    requireCompletePageSequence: options.requireCompletePageSequence,
    sections,
    targetPageCount: technicalSpecs.targetPageCount,
  });
  issues.push(...validation.issues);

  const extras = buildExtras(parsedDraft, rawTemplateBlock ?? parsedTemplateBlock);
  const projectBeforeReport = {
    ...(coverBrief ? { coverBrief } : {}),
    ...(extras && Object.keys(extras).length > 0 ? { extras } : {}),
    ...(kdpMetadata ? { kdpMetadata } : {}),
    ...(qualityChecklist ? { qualityChecklist } : {}),
    ...(visualSystem ? { visualSystem } : {}),
    importReport: {
      errors: [],
      status: "success",
      summary: {
        errorCount: 0,
        expandedPageCount: 0,
        fixedPageCount: 0,
        generatedPageCount: 0,
        parserVersion: PARSER_VERSION,
        requestedTemplateCount: 0,
        sectionCount: 0,
        warningCount: 0,
      },
      warnings: [],
    },
    pages: validation.pages,
    project,
    sections: validation.sections,
    source,
    technicalSpecs,
    templates: templateResolution.templates,
  } satisfies NormalizedKdpProject;

  return {
    ...projectBeforeReport,
    importReport: buildImportReport({
      issues,
      project: projectBeforeReport,
      source,
    }),
  };
}
