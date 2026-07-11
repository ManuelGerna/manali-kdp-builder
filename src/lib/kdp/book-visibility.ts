export const BOOK_VISIBILITIES = ["private", "public"] as const;

export type BookVisibility = (typeof BOOK_VISIBILITIES)[number];

export const DEFAULT_BOOK_VISIBILITY: BookVisibility = "private";

export const BOOK_VISIBILITY_LABELS: Record<BookVisibility, string> = {
  private: "Privato",
  public: "Pubblico",
};

export const BOOK_VISIBILITY_DESCRIPTIONS: Record<BookVisibility, string> = {
  private: "Visibile solo a te",
  public: "Visibile e modificabile da entrambi gli account",
};

export const BOOK_VISIBILITY_OPTIONS = BOOK_VISIBILITIES.map((value) => ({
  value,
  label: BOOK_VISIBILITY_LABELS[value],
  description: BOOK_VISIBILITY_DESCRIPTIONS[value],
}));

export type BookVisibilityBadge = {
  className: string;
  label: string;
  visibility: BookVisibility;
};

export type BookVisibilitySource = {
  created_by?: string | null;
  visibility?: string | null;
};

type FormDataLike = Pick<FormData, "get">;

export function isBookVisibility(value: string): value is BookVisibility {
  return BOOK_VISIBILITIES.includes(value as BookVisibility);
}

export function normalizeBookVisibility(
  value: string | null | undefined,
): BookVisibility {
  return value === "public" ? "public" : DEFAULT_BOOK_VISIBILITY;
}

export function getBookVisibilityFromFormData(
  formData: FormDataLike,
): BookVisibility {
  return normalizeBookVisibility(String(formData.get("visibility") ?? ""));
}

export function getBookVisibilityBadge(
  value: string | null | undefined,
): BookVisibilityBadge {
  const visibility = normalizeBookVisibility(value);

  return {
    className: `visibility-badge visibility-${visibility}`,
    label: BOOK_VISIBILITY_LABELS[visibility],
    visibility,
  };
}

export function getBookVisibilityPersistenceFields(
  value: string | null | undefined,
) {
  return {
    visibility: normalizeBookVisibility(value),
  };
}

export function isBookVisibleToUser(
  book: BookVisibilitySource,
  userId: string,
) {
  return (
    book.created_by === userId ||
    normalizeBookVisibility(book.visibility) === "public"
  );
}
