// A response cap must never silently turn a complete book into a partial one.
export async function readCompleteCollection<T extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; count: number | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []; const seen = new Set<string>(); let total: number | null = null;
  for (;;) {
    const page = await fetchPage(rows.length, rows.length + 499);
    if (page.error || !page.data || page.count === null || (total !== null && page.count !== total)) {
      throw new Error("Caricamento incompleto o contenuto cambiato. Ricarica il libro.");
    }
    total = page.count;
    for (const row of page.data) {
      if (seen.has(row.id)) throw new Error("Il contenuto è cambiato durante il caricamento. Riprova.");
      seen.add(row.id); rows.push(row);
    }
    if (rows.length === total) return rows;
    if (!page.data.length || rows.length > total) throw new Error("Caricamento incompleto. Riprova.");
  }
}
