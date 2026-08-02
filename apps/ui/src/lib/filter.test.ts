import { describe, expect, it } from "vitest";
import { displayedProgress, isSortingStatus, torrentMatchesFilter } from "./filter";

describe("torrent status filters", () => {
  it("keeps completed downloads waiting for organization in Sorting", () => {
    expect(torrentMatchesFilter("sorting", "completed")).toBe(true);
    expect(torrentMatchesFilter("sorting", "processing")).toBe(true);
    expect(torrentMatchesFilter("complete", "completed")).toBe(false);
  });

  it("shows only organized results in Completed", () => {
    expect(torrentMatchesFilter("complete", "organized")).toBe(true);
    expect(torrentMatchesFilter("sorting", "organized")).toBe(false);
  });

  it("marks waiting and active organization rows as sorting states", () => {
    expect(isSortingStatus("completed")).toBe(true);
    expect(isSortingStatus("processing")).toBe(true);
    expect(isSortingStatus("organized")).toBe(false);
  });

  it("starts sorting progress at zero until organization actively reports progress", () => {
    expect(displayedProgress("completed", 1)).toBe(0);
    expect(displayedProgress("processing", 1, 0.37)).toBe(0.37);
    expect(displayedProgress("downloading", 0.62)).toBe(0.62);
  });
});
