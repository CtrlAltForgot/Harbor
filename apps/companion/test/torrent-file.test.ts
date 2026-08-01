import { createHash } from "node:crypto";
import { describe,expect,it } from "vitest";
import { parseTorrentFile } from "../src/torrent-file.js";

describe("torrent file parsing",()=>{
  it("hashes the byte-exact info dictionary and reads its files",()=>{const info=Buffer.from("d5:filesld6:lengthi12e4:pathl8:Show.mkveee4:name9:Test Showe");const torrent=Buffer.concat([Buffer.from("d8:announce14:http://tracker4:info"),info,Buffer.from("e")]);const parsed=parseTorrentFile(torrent);expect(parsed.infoHash).toBe(createHash("sha1").update(info).digest("hex"));expect(parsed.name).toBe("Test Show");expect(parsed.files).toEqual(["Show.mkv"]);});
  it("rejects a dictionary without info",()=>expect(()=>parseTorrentFile(Buffer.from("d3:fooi1ee"))).toThrow(/no info/i));
});
