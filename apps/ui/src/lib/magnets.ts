export function extractMagnets(value: string): string[] {
  const matches = value.match(/magnet:\?[^\s"']+/gi) ?? [];
  const unique = new Map<string, string>();
  for (const magnet of matches) {
    try {
      const url = new URL(magnet);
      const hash = url.searchParams
        .getAll("xt")
        .find((value) => /^urn:btih:/i.test(value))
        ?.slice("urn:btih:".length)
        .toLowerCase();
      if (hash && !unique.has(hash)) unique.set(hash, magnet);
    } catch {
      // The companion performs authoritative validation; malformed links are
      // omitted here so one bad clipboard fragment cannot poison the batch.
    }
  }
  return [...unique.values()];
}
