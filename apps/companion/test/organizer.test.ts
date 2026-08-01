import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildRelativeName,
  organize,
  validateDestination,
} from "../src/organizer.js";

const roots: string[] = [];
afterEach(() =>
  roots
    .splice(0)
    .forEach((root) => rmSync(root, { recursive: true, force: true })),
);
describe("safe organizer", () => {
  it("copies and verifies a movie without removing its source", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "harbor-org-"));
    roots.push(root);
    const source = path.join(root, "Example.Movie.2025.mkv"),
      destination = path.join(root, "movies");
    writeFileSync(source, "lawful fixture");
    const result = await organize(source, destination, {
      category: "movie",
      confidence: 0.9,
      reasons: [],
      title: "Example Movie (2025)",
    });
    expect(readFileSync(result.destination, "utf8")).toBe("lawful fixture");
    expect(readFileSync(source, "utf8")).toBe("lawful fixture");
    expect(result.bytes).toBe(14);
  });
  it("routes an episode to its season folder", () =>
    expect(
      buildRelativeName("show.mkv", {
        category: "tv",
        confidence: 1,
        reasons: [],
        title: "Example Show",
        season: 2,
        episode: 5,
      }),
    ).toBe(
      path.join("Example Show", "Season 02", "Example Show - S02E05.mkv"),
    ));
  it("rejects an existing destination", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "harbor-org-"));
    roots.push(root);
    const source = path.join(root, "book.pdf"),
      destination = path.join(root, "books");
    writeFileSync(source, "one");
    await mkdir(path.join(destination, "Book"), { recursive: true });
    await expect(
      organize(source, destination, {
        category: "book",
        confidence: 1,
        reasons: [],
        title: "Book",
      }),
    ).rejects.toThrow(/already exists/);
  });
  it("reports a non-directory mapping", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "harbor-org-"));
    roots.push(root);
    const file = path.join(root, "not-dir");
    writeFileSync(file, "x");
    await expect(validateDestination(file)).rejects.toThrow();
  });
  it("renames the primary video and matching subtitle inside a movie directory", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "harbor-org-"));
    roots.push(root);
    const source = path.join(root, "release"),
      destination = path.join(root, "movies");
    await mkdir(source);
    writeFileSync(path.join(source, "release.1080p.mkv"), "video");
    writeFileSync(path.join(source, "release.1080p.en.srt"), "subs");
    const result = await organize(source, destination, {
      category: "movie",
      confidence: 1,
      reasons: [],
      title: "Example (2025)",
    });
    expect(
      readFileSync(path.join(result.destination, "Example (2025).mkv"), "utf8"),
    ).toBe("video");
    expect(
      readFileSync(
        path.join(result.destination, "Example (2025).en.srt"),
        "utf8",
      ),
    ).toBe("subs");
  });
  it("normalizes every recognized episode in a season pack", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "harbor-org-"));
    roots.push(root);
    const source = path.join(root, "release"),
      destination = path.join(root, "tv");
    await mkdir(source);
    writeFileSync(path.join(source, "show.s02e01.mkv"), "one");
    writeFileSync(path.join(source, "show.s02e02.mkv"), "two");
    const result = await organize(source, destination, {
      category: "tv",
      confidence: 0.98,
      reasons: [],
      title: "Example Show",
      season: 2,
    });
    expect(
      readFileSync(
        path.join(result.destination, "Example Show - S02E01.mkv"),
        "utf8",
      ),
    ).toBe("one");
    expect(
      readFileSync(
        path.join(result.destination, "Example Show - S02E02.mkv"),
        "utf8",
      ),
    ).toBe("two");
  });
  it("reuses an existing series folder when adding a later season", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "harbor-org-"));
    roots.push(root);
    const source = path.join(root, "release"),
      destination = path.join(root, "tv");
    await mkdir(path.join(destination, "Dog Whisperer", "Season 01"), {
      recursive: true,
    });
    await mkdir(source);
    writeFileSync(path.join(source, "dog.whisperer.s02e01.mkv"), "episode");
    const result = await organize(source, destination, {
      category: "tv",
      confidence: 0.98,
      reasons: [],
      title: "Dog Whisperer with Cesar Millan",
      season: 2,
    });
    expect(result.destination).toBe(
      path.join(destination, "Dog Whisperer", "Season 02"),
    );
    expect(
      readFileSync(
        path.join(result.destination, "Dog Whisperer - S02E01.mkv"),
        "utf8",
      ),
    ).toBe("episode");
  });
  it("merges new episodes into an existing season without overwriting it", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "harbor-org-"));
    roots.push(root);
    const source = path.join(root, "release"),
      destination = path.join(root, "tv"),
      season = path.join(destination, "Example Show", "Season 02");
    await mkdir(season, { recursive: true });
    await mkdir(source);
    writeFileSync(path.join(season, "Example Show - S02E01.mkv"), "existing");
    writeFileSync(path.join(source, "show.s02e02.mkv"), "new");
    const result = await organize(source, destination, {
      category: "tv",
      confidence: 0.98,
      reasons: [],
      title: "Example Show",
      season: 2,
    });
    expect(
      readFileSync(
        path.join(result.destination, "Example Show - S02E01.mkv"),
        "utf8",
      ),
    ).toBe("existing");
    expect(
      readFileSync(
        path.join(result.destination, "Example Show - S02E02.mkv"),
        "utf8",
      ),
    ).toBe("new");
  });
});
