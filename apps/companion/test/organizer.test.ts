import { afterEach,describe,expect,it } from "vitest";
import { mkdtempSync,readFileSync,rmSync,writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildRelativeName,organize,validateDestination } from "../src/organizer.js";

const roots:string[]=[];afterEach(()=>roots.splice(0).forEach(root=>rmSync(root,{recursive:true,force:true})));
describe("safe organizer",()=>{
  it("copies and verifies a movie without removing its source",async()=>{const root=mkdtempSync(path.join(tmpdir(),"harbor-org-"));roots.push(root);const source=path.join(root,"Example.Movie.2025.mkv"),destination=path.join(root,"movies");writeFileSync(source,"lawful fixture");const result=await organize(source,destination,{category:"movie",confidence:.9,reasons:[],title:"Example Movie (2025)"});expect(readFileSync(result.destination,"utf8")).toBe("lawful fixture");expect(readFileSync(source,"utf8")).toBe("lawful fixture");expect(result.bytes).toBe(14);});
  it("routes an episode to its season folder",()=>expect(buildRelativeName("show.mkv",{category:"tv",confidence:1,reasons:[],title:"Example Show",season:2,episode:5})).toBe(path.join("Example Show","Season 02","Example Show - S02E05.mkv")));
  it("rejects an existing destination",async()=>{const root=mkdtempSync(path.join(tmpdir(),"harbor-org-"));roots.push(root);const source=path.join(root,"book.pdf"),destination=path.join(root,"books");writeFileSync(source,"one");await mkdir(path.join(destination,"Book"),{recursive:true});await expect(organize(source,destination,{category:"book",confidence:1,reasons:[],title:"Book"})).rejects.toThrow(/already exists/);});
  it("reports a non-directory mapping",async()=>{const root=mkdtempSync(path.join(tmpdir(),"harbor-org-"));roots.push(root);const file=path.join(root,"not-dir");writeFileSync(file,"x");await expect(validateDestination(file)).rejects.toThrow();});
});
