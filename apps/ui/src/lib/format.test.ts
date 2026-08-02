import { describe, expect, it } from "vitest";
import { formatEta, overallDownloadEta, transferCounts } from "./format";

describe("torrent ETA formatting", () => {
  it("uses hours for long downloads", () => {
    expect(formatEta(127_755)).toBe("35h 29m");
    expect(formatEta(955)).toBe("15m 55s");
  });

  it("uses the longest parallel download as the all-downloads ETA", () => {
    expect(
      overallDownloadEta([
        { status: "downloading", etaSeconds: 900 },
        { status: "downloading", etaSeconds: 7_200 },
        { status: "paused", etaSeconds: 20_000 },
      ]),
    ).toBe("2h 0m");
  });

  it("distinguishes metadata waiting from no active downloads", () => {
    expect(overallDownloadEta([{ status: "downloading", etaSeconds: null }])).toBe("Waiting");
    expect(overallDownloadEta([])).toBe("—");
  });
});

describe("transfer summary counts", () => {
  it("counts only moving downloads and organizers as active", () => {
    expect(
      transferCounts([
        { status: "downloading", downloadSpeed: 500 },
        { status: "processing", downloadSpeed: 0 },
        { status: "downloading", downloadSpeed: 0 },
        { status: "queued", downloadSpeed: 0 },
        { status: "paused", downloadSpeed: 0 },
        { status: "organized", downloadSpeed: 0 },
      ]),
    ).toEqual({ active: 2, queued: 3 });
  });
});
