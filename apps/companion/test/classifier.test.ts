import { describe, expect, it } from "vitest";
import { classify } from "../src/classifier.js";
describe("local classifier",()=>{
  it.each([["Some.Show.S02E05.1080p",2,5],["Some Show 2x05",2,5]])("recognizes episodes",(name,season,episode)=>{expect(classify(name)).toMatchObject({category:"tv",season,episode});});
  it("recognizes season packs",()=>expect(classify("Some.Show.Season.03.Complete")).toMatchObject({category:"tv",season:3}));
  it("recognizes movie-shaped releases",()=>expect(classify("Example Movie 2025",["Example.Movie.2025.mkv"])).toMatchObject({category:"movie"}));
  it("routes uncertain items to review",()=>expect(classify("assorted files",["readme.txt"])).toMatchObject({category:"review"}));
});
