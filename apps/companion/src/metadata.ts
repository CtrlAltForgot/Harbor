import type { Classification } from "@harbor/contracts";

interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
}

export class TmdbMatcher {
  constructor(
    private token: string,
    private language = "en-US",
    private fetcher: typeof fetch = fetch,
  ) {}
  async refine(input: Classification): Promise<Classification> {
    if (!this.token || !(["movie", "tv"] as string[]).includes(input.category))
      return input;
    const kind = input.category === "movie" ? "movie" : "tv";
    const url = new URL(`https://api.themoviedb.org/3/search/${kind}`);
    url.searchParams.set(
      "query",
      input.title.replace(/\s*\((?:19|20)\d{2}\)\s*$/, ""),
    );
    url.searchParams.set("language", this.language);
    url.searchParams.set("include_adult", "false");
    if (input.year)
      url.searchParams.set(
        kind === "movie" ? "primary_release_year" : "first_air_date_year",
        String(input.year),
      );
    const response = await this.fetcher(url, {
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/json",
      },
    });
    if (!response.ok)
      throw new Error(`TMDB lookup failed (${response.status})`);
    const results =
      ((await response.json()) as { results?: TmdbResult[] }).results ?? [];
    const wanted = normalize(input.title);
    const scored = results
      .map((result) => {
        const names = [
          result.title,
          result.name,
          result.original_title,
          result.original_name,
        ].filter(Boolean) as string[];
        const nameScore = Math.max(
          0,
          ...names.map((name) => similarity(wanted, normalize(name))),
        );
        const date = result.release_date ?? result.first_air_date;
        const resultYear = date ? Number(date.slice(0, 4)) : undefined;
        const yearScore =
          input.year && resultYear
            ? input.year === resultYear
              ? 0.12
              : -0.18
            : 0;
        return { result, score: nameScore + yearScore, resultYear };
      })
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const runner = scored[1];
    if (
      !best ||
      best.score < 0.86 ||
      (runner && best.score - runner.score < 0.08)
    )
      return {
        ...input,
        reasons: [
          ...input.reasons,
          "TMDB did not return one unambiguous match",
          "strong local classification retained",
        ],
      };
    const canonical = best.result.title ?? best.result.name ?? input.title;
    return {
      ...input,
      title: canonical,
      year: best.resultYear ?? input.year,
      metadataId: best.result.id,
      metadataSource: "tmdb",
      confidence: Math.max(input.confidence, 0.98),
      reasons: [...input.reasons, "unambiguous TMDB title match"],
    };
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\s*[([]?(?:19|20)\d{2}[)\]]?\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const aa = new Set(a.split(" ")),
    bb = new Set(b.split(" "));
  let common = 0;
  for (const word of aa) if (bb.has(word)) common++;
  return (2 * common) / (aa.size + bb.size);
}
