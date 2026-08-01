import { describe, expect, it } from "vitest";
import { extractMagnets } from "./magnets";

describe("extractMagnets", () => {
  it("extracts newline-separated magnets copied from another client", () => {
    const input = [
      "magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&dn=One",
      "magnet:?xt=urn:btih:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb&dn=Two",
      "magnet:?xt=urn:btih:cccccccccccccccccccccccccccccccccccccccc&dn=Three",
    ].join("\n");
    expect(extractMagnets(input)).toHaveLength(3);
  });

  it("deduplicates by info hash and ignores surrounding clipboard text", () => {
    const input = `Copied links:\nmagnet:?xt=urn:btih:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&dn=One\nmagnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&dn=Duplicate&tr=udp%3A%2F%2Ftracker`;
    expect(extractMagnets(input)).toEqual([
      "magnet:?xt=urn:btih:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&dn=One",
    ]);
  });
});
