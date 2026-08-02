import { describe, expect, it } from "vitest";
import type { Torrent } from "@harbor/contracts";
import { sortTorrents } from "./sort";

const torrent = (name: string, createdAt: string, progress: number) =>
  ({ name, createdAt, progress, infoHash: name } as Torrent);

describe("torrent sorting", () => {
  it("keeps the default order tied to creation time, not live updates", () => {
    const older = torrent("Older", "2026-01-01T00:00:00Z", 0.9);
    const newer = torrent("Newer", "2026-01-02T00:00:00Z", 0.1);
    expect(sortTorrents([older, newer], "added-desc")).toEqual([newer, older]);
    older.progress = 1;
    newer.progress = 0.2;
    expect(sortTorrents([newer, older], "added-desc")).toEqual([newer, older]);
  });

  it("supports explicit alphabetical and progress sorting", () => {
    const b = torrent("Bravo", "2026-01-01T00:00:00Z", 0.2);
    const a = torrent("Alpha", "2026-01-02T00:00:00Z", 0.8);
    expect(sortTorrents([b, a], "name-asc")).toEqual([a, b]);
    expect(sortTorrents([b, a], "progress-desc")).toEqual([a, b]);
  });

  it("sorts the Sorting tab by organization progress instead of download completion", () => {
    const waiting = {
      ...torrent("Waiting", "2026-01-01T00:00:00Z", 1),
      status: "completed",
    } as Torrent;
    const moving = {
      ...torrent("Moving", "2026-01-02T00:00:00Z", 1),
      status: "processing",
      organization: { progress: 0.42 },
    } as Torrent;
    expect(sortTorrents([waiting, moving], "progress-desc")).toEqual([
      moving,
      waiting,
    ]);
  });
});
