import { describe, expect, it } from "vitest";
import { classify } from "../src/classifier.js";
import { parseMagnet } from "../src/engine.js";
describe("local classifier",()=>{
  it.each([["Some.Show.S02E05.1080p",2,5],["Some Show 2x05",2,5]])("recognizes episodes",(name,season,episode)=>{expect(classify(name)).toMatchObject({category:"tv",season,episode,title:"Some Show"});});
  it("recognizes season packs",()=>expect(classify("Some.Show.Season.03.Complete")).toMatchObject({category:"tv",season:3}));
  it("recognizes and cleans movie-shaped releases",()=>expect(classify("Example.Movie.2025.1080p",["Example.Movie.2025.mkv"])).toMatchObject({category:"movie",title:"Example Movie (2025)"}));
  it("routes uncertain items to review",()=>expect(classify("assorted files",["readme.txt"])).toMatchObject({category:"review"}));
  it("normalizes base32 magnet hashes for qBittorrent matching",()=>expect(parseMagnet("magnet:?xt=urn:btih:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA").hash).toBe("0000000000000000000000000000000000000000"));
  it("rejects incorrectly sized magnet hashes",()=>expect(()=>parseMagnet("magnet:?xt=urn:btih:abc")).toThrow(/invalid/i));
});
