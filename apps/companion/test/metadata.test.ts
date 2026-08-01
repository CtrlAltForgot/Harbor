import { describe, expect, it, vi } from "vitest";
import { TmdbMatcher } from "../src/metadata.js";

describe("TMDB metadata matching", () => {
  it("promotes an unambiguous movie result to a verified canonical match", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              { id: 603, title: "The Matrix", release_date: "1999-03-30" },
            ],
          }),
          { status: 200 },
        ),
    );
    const result = await new TmdbMatcher(
      "secret",
      "en-US",
      fetcher as typeof fetch,
    ).refine({
      category: "movie",
      confidence: 0.84,
      reasons: ["local"],
      title: "The Matrix (1999)",
      year: 1999,
    });
    expect(result).toMatchObject({
      title: "The Matrix",
      year: 1999,
      metadataId: 603,
      metadataSource: "tmdb",
      confidence: 0.98,
    });
  });
  it("refuses to automate an ambiguous title", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              { id: 1, name: "The Office", first_air_date: "2001-01-01" },
              { id: 2, name: "The Office", first_air_date: "2005-01-01" },
            ],
          }),
          { status: 200 },
        ),
    );
    const result = await new TmdbMatcher(
      "secret",
      "en-US",
      fetcher as typeof fetch,
    ).refine({
      category: "tv",
      confidence: 0.96,
      reasons: ["episode pattern"],
      title: "The Office",
      season: 1,
      episode: 1,
    });
    expect(result.confidence).toBeLessThan(0.8);
    expect(result.metadataId).toBeUndefined();
  });
});
