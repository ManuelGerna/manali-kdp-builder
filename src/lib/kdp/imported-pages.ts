import type { createClient } from "../supabase/server.ts";
import type { RepositoryResult } from "./books.ts";
import type { Tables } from "../../types/database.ts";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type KdpImportedPage = Tables<"kdp_imported_pages">;
export type KdpImportedPageSection = Pick<
  Tables<"kdp_sections">,
  "id" | "sort_order" | "title"
>;
export type KdpImportedPageRun = Tables<"kdp_import_runs">;

export type ImportedPageGroup = {
  key: string;
  pages: KdpImportedPage[];
  section: KdpImportedPageSection | null;
  title: string;
};

export type ImportedPagesSummary = {
  pageCount: number;
  sectionCount: number;
  statusCounts: Record<string, number>;
  sourceTypeCounts: Record<string, number>;
  templateIds: string[];
  templateCount: number;
  unassignedPageCount: number;
};

export type ImportedPagesReadModel = {
  importRun: KdpImportedPageRun | null;
  pages: KdpImportedPage[];
  summary: ImportedPagesSummary;
};

function sortByPageNumber(first: KdpImportedPage, second: KdpImportedPage) {
  if (first.page_number !== second.page_number) {
    return first.page_number - second.page_number;
  }

  return first.created_at.localeCompare(second.created_at);
}

function incrementCounter(counter: Record<string, number>, key: string | null) {
  const normalized = key?.trim() || "non_rilevato";
  counter[normalized] = (counter[normalized] ?? 0) + 1;
}

export function buildImportedPagesSummary(
  pages: KdpImportedPage[],
  sections: KdpImportedPageSection[] = [],
): ImportedPagesSummary {
  const statusCounts: Record<string, number> = {};
  const sourceTypeCounts: Record<string, number> = {};
  const templateIds = new Set<string>();

  for (const page of pages) {
    incrementCounter(statusCounts, page.status);
    incrementCounter(sourceTypeCounts, page.source_type);

    if (page.template_id?.trim()) {
      templateIds.add(page.template_id);
    }
  }

  return {
    pageCount: pages.length,
    sectionCount: sections.length,
    statusCounts,
    sourceTypeCounts,
    templateCount: templateIds.size,
    templateIds: [...templateIds].sort((first, second) =>
      first.localeCompare(second),
    ),
    unassignedPageCount: pages.filter((page) => !page.section_id).length,
  };
}

export function groupImportedPagesBySection(
  pages: KdpImportedPage[],
  sections: KdpImportedPageSection[],
): ImportedPageGroup[] {
  const sortedPages = [...pages].sort(sortByPageNumber);
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const pagesBySectionId = new Map<string, KdpImportedPage[]>();
  const unassignedPages: KdpImportedPage[] = [];

  for (const page of sortedPages) {
    if (!page.section_id) {
      unassignedPages.push(page);
      continue;
    }

    const sectionPages = pagesBySectionId.get(page.section_id) ?? [];
    sectionPages.push(page);
    pagesBySectionId.set(page.section_id, sectionPages);
  }

  const groups: ImportedPageGroup[] = sections
    .filter((section) => pagesBySectionId.has(section.id))
    .sort((first, second) => {
      if (first.sort_order !== second.sort_order) {
        return first.sort_order - second.sort_order;
      }

      return (first.title ?? "").localeCompare(second.title ?? "");
    })
    .map((section, index) => ({
      key: section.id,
      pages: pagesBySectionId.get(section.id) ?? [],
      section,
      title: section.title || `Sezione ${section.sort_order || index + 1}`,
    }));

  for (const [sectionId, sectionPages] of pagesBySectionId.entries()) {
    if (sectionById.has(sectionId)) {
      continue;
    }

    groups.push({
      key: `missing-${sectionId}`,
      pages: sectionPages,
      section: null,
      title: "Sezione non disponibile",
    });
  }

  if (unassignedPages.length > 0) {
    groups.push({
      key: "unassigned",
      pages: unassignedPages,
      section: null,
      title: "Pagine senza sezione",
    });
  }

  return groups;
}

export async function getLatestGenericImportRun(
  supabase: KdpSupabaseClient,
  bookId: string,
): Promise<RepositoryResult<KdpImportedPageRun | null>> {
  const { data, error } = await supabase
    .from("kdp_import_runs")
    .select("*")
    .eq("book_id", bookId)
    .eq("import_kind", "generic_draft_v0")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: "Non riesco a caricare il run di importazione piu recente.",
    };
  }

  return {
    data: data ?? null,
    error: null,
  };
}

export async function getImportedPagesReadModel(
  supabase: KdpSupabaseClient,
  input: {
    bookId: string;
    sections: KdpImportedPageSection[];
  },
): Promise<RepositoryResult<ImportedPagesReadModel>> {
  const importRunResult = await getLatestGenericImportRun(
    supabase,
    input.bookId,
  );

  if (importRunResult.data === null && importRunResult.error) {
    return importRunResult;
  }

  let query = supabase
    .from("kdp_imported_pages")
    .select("*")
    .eq("book_id", input.bookId)
    .order("page_number", { ascending: true });

  if (importRunResult.data?.id) {
    query = query.eq("import_run_id", importRunResult.data.id);
  }

  const { data, error } = await query;

  if (error) {
    return {
      data: null,
      error: "Non riesco a caricare le pagine importate del libretto.",
    };
  }

  const pages = data ?? [];

  return {
    data: {
      importRun: importRunResult.data,
      pages,
      summary: buildImportedPagesSummary(pages, input.sections),
    },
    error: null,
  };
}
