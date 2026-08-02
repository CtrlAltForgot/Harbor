import { describe, expect, it } from "vitest";
import { floatingMenuPosition, nearestRowScroll } from "./layout";

describe("floating torrent action menu", () => {
  it("opens upward and remains inside the viewport for a bottom row", () => {
    const result = floatingMenuPosition(
      { top: 720, right: 1180, bottom: 758 },
      1200,
      800,
    );
    expect(result.top).toBeGreaterThanOrEqual(12);
    expect(result.top + result.maxHeight).toBeLessThanOrEqual(720);
    expect(result.left + 190).toBeLessThanOrEqual(1188);
  });

  it("opens below a top row and constrains short viewports", () => {
    const result = floatingMenuPosition(
      { top: 80, right: 240, bottom: 118 },
      600,
      360,
    );
    expect(result.top).toBe(124);
    expect(result.maxHeight).toBeLessThanOrEqual(230);
  });
});

describe("torrent list row alignment", () => {
  it("settles fractional scrolling onto the nearest complete row", () => {
    expect(nearestRowScroll(47, [0, 88, 176])).toBe(88);
    expect(nearestRowScroll(24, [0, 88, 176])).toBe(0);
  });
});
