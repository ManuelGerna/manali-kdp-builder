// Production phase 2: only the explicitly approved, already converted canary.
export const EDITORIAL_TEXT_V2_CANARY = Object.freeze({
  bookId: "ca3de2df-6dfc-422a-bf4f-8d54fef09cdf",
  sectionId: "65bda051-5149-4907-85e5-f6a1ee2c60cf",
  subsectionId: "63523ace-914f-40e5-97ee-d3a6127c2acc",
});
export function isEditorialTextV2Canary(bookId: string, sectionId: string, subsectionId: string | null) {
  return bookId === EDITORIAL_TEXT_V2_CANARY.bookId && sectionId === EDITORIAL_TEXT_V2_CANARY.sectionId && subsectionId === EDITORIAL_TEXT_V2_CANARY.subsectionId;
}

// Local development can still exercise synthetic/non-converted groups.
export function editorialTextV2LocalEnabled(env: Record<string, string | undefined> = process.env) {
  if (env.EDITORIAL_TEXT_V2_LOCAL !== "1" || env.NODE_ENV === "production") return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch { return false; }
}
