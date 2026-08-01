import { createHash } from "node:crypto";

export interface TorrentMetadata { infoHash: string; name: string; files: string[] }

/** Extracts the raw top-level info dictionary so its hash is byte-exact. */
export function parseTorrentFile(input: Buffer): TorrentMetadata {
  if (!input.length || input[0] !== 100) throw new Error("The torrent file is not a valid bencoded dictionary");
  let cursor = 1; let infoStart = -1; let infoEnd = -1; let name = "Uploaded torrent"; let files: string[] = [];
  while (cursor < input.length && input[cursor] !== 101) {
    const key = readString(input, cursor); cursor = key.end;
    if (key.value.toString() === "info") {
      infoStart = cursor; infoEnd = skipValue(input, cursor);
      const decoded = decode(input, cursor); cursor = decoded.end;
      if (decoded.value && typeof decoded.value === "object" && !Buffer.isBuffer(decoded.value)) {
        const info = decoded.value as Record<string, unknown>; name = bufferText(info["name.utf-8"] ?? info.name) || name;
        const entries = Array.isArray(info.files) ? info.files : [];
        files = entries.map(entry => { const item=entry as Record<string,unknown>; const parts=(item["path.utf-8"] ?? item.path) as unknown[]; return Array.isArray(parts) ? parts.map(bufferText).join("/") : ""; }).filter(Boolean);
        if (!files.length) files = [name];
      }
    } else cursor = skipValue(input, cursor);
  }
  if (infoStart < 0 || infoEnd < 0) throw new Error("The torrent file has no info dictionary");
  return { infoHash: createHash("sha1").update(input.subarray(infoStart, infoEnd)).digest("hex"), name, files };
}

function readString(input: Buffer, start: number) { let colon=start;while(colon<input.length&&input[colon]!==58){if(input[colon]!<48||input[colon]!>57)throw new Error("Invalid bencoded string");colon++;}if(colon>=input.length)throw new Error("Truncated bencoded string");const length=Number(input.subarray(start,colon).toString());const from=colon+1,end=from+length;if(!Number.isSafeInteger(length)||end>input.length)throw new Error("Invalid bencoded string length");return{value:input.subarray(from,end),end}; }
function skipValue(input:Buffer,start:number):number{const marker=input[start];if(marker===105){const end=input.indexOf(101,start+1);if(end<0)throw new Error("Truncated integer");return end+1;}if(marker===108){let p=start+1;while(input[p]!==101){p=skipValue(input,p);if(p>=input.length)throw new Error("Truncated list");}return p+1;}if(marker===100){let p=start+1;while(input[p]!==101){p=readString(input,p).end;p=skipValue(input,p);if(p>=input.length)throw new Error("Truncated dictionary");}return p+1;}if(marker!==undefined&&marker>=48&&marker<=57)return readString(input,start).end;throw new Error("Invalid bencoded value");}
function decode(input:Buffer,start:number):{value:unknown;end:number}{const marker=input[start];if(marker===105){const end=input.indexOf(101,start+1);return{value:Number(input.subarray(start+1,end).toString()),end:end+1};}if(marker===108){const value:unknown[]=[];let p=start+1;while(input[p]!==101){const item=decode(input,p);value.push(item.value);p=item.end;}return{value,end:p+1};}if(marker===100){const value:Record<string,unknown>={};let p=start+1;while(input[p]!==101){const key=readString(input,p);const item=decode(input,key.end);value[key.value.toString()]=item.value;p=item.end;}return{value,end:p+1};}const string=readString(input,start);return{value:string.value,end:string.end};}
function bufferText(value:unknown){return Buffer.isBuffer(value)?value.toString("utf8"):typeof value==="string"?value:"";}
