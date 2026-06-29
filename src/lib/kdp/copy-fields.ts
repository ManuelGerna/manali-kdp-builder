import {
  AI_USAGE_LABELS,
  DEFAULT_BOOK_SETTINGS,
  LANGUAGE_OPTIONS,
  type AiUsageType,
} from "@/lib/kdp/constants";
import type { KdpBook, KdpBookSettings } from "@/lib/kdp/books";

export type KdpCopyField = {
  id: string;
  label: string;
  value: string;
};

export type KdpCopyFieldGroup = {
  id: string;
  title: string;
  fields: KdpCopyField[];
};

type BuildKdpCopyFieldsInput = {
  book: KdpBook;
  settings: KdpBookSettings | null;
};

const ITALIAN_KEYWORDS = [
  "cristalli per principianti",
  "guida cristalli",
  "cristalli e significati",
  "journal cristalli",
  "pietre naturali",
  "affermazioni quotidiane",
  "mindfulness journaling",
] as const;

const ENGLISH_KEYWORDS = [
  "crystals for beginners",
  "crystal guide",
  "crystal meanings",
  "crystal journal",
  "natural stones",
  "daily affirmations",
  "mindfulness journaling",
] as const;

function getLanguageLabel(language: string) {
  return (
    LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ??
    language.toUpperCase()
  );
}

function getAiUsageLabel(aiUsageType: string) {
  return AI_USAGE_LABELS[aiUsageType as AiUsageType] ?? aiUsageType;
}

function getDescription(book: KdpBook) {
  const subtitle = book.subtitle ? ` ${book.subtitle}.` : "";

  if (book.language === "en") {
    return `${book.title} is a practical workbook created for readers who want a clear, accessible way to explore crystals, notes, reflections, and personal journaling.${subtitle} Use this KDP description as a starting point and review it manually before publishing.`;
  }

  return `${book.title} e' un libretto pratico pensato per chi vuole esplorare cristalli, significati, appunti e pagine di journaling in modo semplice e ordinato.${subtitle} Usa questa descrizione come base KDP e rivedila manualmente prima della pubblicazione.`;
}

function getKeywords(language: string) {
  return language === "en" ? ENGLISH_KEYWORDS : ITALIAN_KEYWORDS;
}

function getCategorySuggestions(language: string) {
  if (language === "en") {
    return [
      "Books > Body, Mind & Spirit > Crystals",
      "Books > Self-Help > Journaling",
    ] as const;
  }

  return [
    "Libri > Mente, corpo e spirito > Cristalli",
    "Libri > Self-help > Journaling",
  ] as const;
}

function getAiUsageNote(aiUsageType: string) {
  if (aiUsageType === "ai_assisted") {
    return "Testi scritti dall'autore e revisionati con supporto AI per correzione, chiarezza e tono editoriale. Verificare manualmente la disclosure richiesta da KDP.";
  }

  if (aiUsageType === "ai_generated") {
    return "Alcuni contenuti testuali sono stati generati con AI e revisionati manualmente. Verificare manualmente la disclosure richiesta da KDP.";
  }

  if (aiUsageType === "mixed") {
    return "Il libro contiene contenuti scritti dall'autore e contenuti generati o rielaborati con AI, tutti da revisionare manualmente. Verificare la disclosure richiesta da KDP.";
  }

  return "Nessun uso AI dichiarato per questo libretto. Verificare comunque manualmente le policy KDP prima della pubblicazione.";
}

function getBleedLabel(bleed: boolean) {
  return bleed ? "Bleed" : "No bleed";
}

function getInteriorLabel(interiorType: string) {
  if (interiorType === "black_and_white") {
    return "Black & white interior";
  }

  return interiorType;
}

function getPaperLabel(paperType: string) {
  if (paperType === "white") {
    return "White paper";
  }

  return paperType;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getInteriorFileName(book: KdpBook, trimSize: string) {
  const slug = slugify(book.title) || "kdp-book";

  return `${slug}-interior-${trimSize}-bw.pdf`;
}

function getFieldValue(fieldGroups: KdpCopyFieldGroup[], fieldId: string) {
  return (
    fieldGroups
      .flatMap((group) => group.fields)
      .find((field) => field.id === fieldId)?.value ?? ""
  );
}

function getGroupFields(fieldGroups: KdpCopyFieldGroup[], groupId: string) {
  return fieldGroups.find((group) => group.id === groupId)?.fields ?? [];
}

function formatLabelBlock(label: string, value: string) {
  return `${label}:\n${value}`;
}

function formatNumberedValues(fields: KdpCopyField[]) {
  return fields.map((field, index) => `${index + 1}. ${field.value}`);
}

export function getKdpFieldsTextFileName(title: string) {
  const slug = slugify(title);

  return slug ? `${slug}-kdp-fields.txt` : "kdp-fields.txt";
}

export function formatKdpFieldsAsText(fieldGroups: KdpCopyFieldGroup[]) {
  const keywordFields = getGroupFields(
    fieldGroups,
    "description-keywords",
  ).filter((field) => field.id.startsWith("keyword-"));
  const categoryFields = getGroupFields(fieldGroups, "categories");

  return [
    "DATI PER AMAZON KDP",
    "",
    formatLabelBlock("Titolo", getFieldValue(fieldGroups, "title")),
    "",
    formatLabelBlock("Sottotitolo", getFieldValue(fieldGroups, "subtitle")),
    "",
    formatLabelBlock(
      "Nome autore / pen name",
      getFieldValue(fieldGroups, "author"),
    ),
    "",
    formatLabelBlock("Lingua", getFieldValue(fieldGroups, "language")),
    "",
    "DESCRIZIONE",
    getFieldValue(fieldGroups, "description"),
    "",
    "KEYWORD",
    ...formatNumberedValues(keywordFields),
    "",
    "CATEGORIE SUGGERITE",
    ...formatNumberedValues(categoryFields),
    "",
    "IMPOSTAZIONI PAPERBACK",
    formatLabelBlock("Trim size", getFieldValue(fieldGroups, "trim-size")),
    "",
    formatLabelBlock("Interno", getFieldValue(fieldGroups, "interior")),
    "",
    formatLabelBlock("Carta", getFieldValue(fieldGroups, "paper")),
    "",
    formatLabelBlock("Bleed", getFieldValue(fieldGroups, "bleed")),
    "",
    "AI E FILE FUTURO",
    formatLabelBlock("Nota uso AI", getFieldValue(fieldGroups, "ai-note")),
    "",
    formatLabelBlock(
      "Nome file consigliato per interior PDF",
      getFieldValue(fieldGroups, "interior-file"),
    ),
    "",
  ].join("\n");
}

export function buildKdpCopyFieldGroups({
  book,
  settings,
}: BuildKdpCopyFieldsInput): KdpCopyFieldGroup[] {
  const trimSize = settings?.trim_size ?? DEFAULT_BOOK_SETTINGS.trimSize;
  const interiorType =
    settings?.interior_type ?? DEFAULT_BOOK_SETTINGS.interiorType;
  const paperType = settings?.paper_type ?? DEFAULT_BOOK_SETTINGS.paperType;
  const bleed = settings?.bleed ?? DEFAULT_BOOK_SETTINGS.bleed;
  const keywords = getKeywords(book.language);
  const categories = getCategorySuggestions(book.language);

  return [
    {
      id: "book-details",
      title: "Dettagli libro",
      fields: [
        {
          id: "title",
          label: "Titolo",
          value: book.title,
        },
        {
          id: "subtitle",
          label: "Sottotitolo",
          value: book.subtitle || "",
        },
        {
          id: "author",
          label: "Nome autore / pen name",
          value: book.author_name,
        },
        {
          id: "language",
          label: "Lingua",
          value: getLanguageLabel(book.language),
        },
      ],
    },
    {
      id: "description-keywords",
      title: "Descrizione e keyword",
      fields: [
        {
          id: "description",
          label: "Descrizione libro",
          value: getDescription(book),
        },
        ...keywords.map((keyword, index) => ({
          id: `keyword-${index + 1}`,
          label: `Keyword ${index + 1}`,
          value: keyword,
        })),
      ],
    },
    {
      id: "categories",
      title: "Categorie suggerite",
      fields: [
        {
          id: "category-1",
          label: "Categoria suggerita 1",
          value: categories[0],
        },
        {
          id: "category-2",
          label: "Categoria suggerita 2",
          value: categories[1],
        },
      ],
    },
    {
      id: "print-settings",
      title: "Impostazioni paperback",
      fields: [
        {
          id: "trim-size",
          label: "Trim size",
          value: trimSize,
        },
        {
          id: "interior",
          label: "Interno",
          value: getInteriorLabel(interiorType),
        },
        {
          id: "paper",
          label: "Carta",
          value: getPaperLabel(paperType),
        },
        {
          id: "bleed",
          label: "Bleed",
          value: getBleedLabel(bleed),
        },
      ],
    },
    {
      id: "ai-file",
      title: "AI e file futuro",
      fields: [
        {
          id: "ai-note",
          label: "Nota uso AI",
          value: `${getAiUsageLabel(book.ai_usage_type)}. ${getAiUsageNote(
            book.ai_usage_type,
          )}`,
        },
        {
          id: "interior-file",
          label: "Nome file consigliato per interior PDF futuro",
          value: getInteriorFileName(book, trimSize),
        },
      ],
    },
  ];
}
