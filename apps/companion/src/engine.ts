import { createHash, randomUUID } from "node:crypto";
import type { AddTorrentRequest, Torrent } from "@harbor/contracts";
import { classify } from "./classifier.js";
import { parseTorrentFile } from "./torrent-file.js";

export function parseMagnet(value: string) {
  let url: URL; try { url = new URL(value); } catch { throw new Error("The magnet link is malformed"); }
  if (url.protocol !== "magnet:") throw new Error("Only magnet links are accepted");
  const xt = url.searchParams.get("xt") ?? ""; const match = xt.match(/^urn:btih:([a-z0-9]+)$/i);
  if (!match) throw new Error("The magnet link has no valid BitTorrent info hash");
  const raw=match[1]!;if(!/^[a-f0-9]{40}$/i.test(raw)&&!/^[a-z2-7]{32}$/i.test(raw))throw new Error("The magnet link has an invalid BitTorrent v1 info hash");const hash=raw.length===32?decodeBase32(raw):raw.toLowerCase();
  return { hash, name: url.searchParams.get("dn") || `Torrent ${hash.slice(0, 8)}` };
}
export function createTorrent(input: AddTorrentRequest, destinations: Record<string,string>): Torrent {
  let infoHash: string, name: string, source: Torrent["source"];
  if (input.magnet) { ({ hash: infoHash, name } = parseMagnet(input.magnet)); source = "magnet"; }
  else if (input.torrentBase64) { const metadata=parseTorrentFile(Buffer.from(input.torrentBase64,"base64"));infoHash=metadata.infoHash;name=metadata.name||input.fileName?.replace(/\.torrent$/i,"")||"Uploaded torrent";source="torrent"; }
  else throw new Error("Provide a magnet link or torrent file");
  const detected = classify(name); const category = input.category && input.category !== "auto" ? input.category : detected.category;
  return { id: randomUUID(), infoHash, name, source, mode: input.mode ?? "server", status: "queued", progress: 0, downloadSpeed: 0, uploadSpeed: 0, etaSeconds: null, seeds: 0, peers: 0, size: 2_400_000_000, downloaded: 0, category: input.category ?? "auto", classification: category === detected.category ? detected : { category: category as any, confidence: 1, reasons: ["manual selection"], title: detected.title }, destination: destinations[category] ?? destinations.review!, retention: input.retention ?? "seed", createdAt: new Date().toISOString(), files: [{ id: 0, name, size: 2_400_000_000, progress: 0, priority: 1 }] };
}

export function tick(torrent: Torrent): Torrent {
  if (!(torrent.status === "queued" || torrent.status === "downloading")) return torrent;
  const progress = Math.min(1, torrent.progress + .0125); const completed = progress >= 1;
  return { ...torrent, status: completed ? (torrent.classification.confidence < .6 ? "review" : "organized") : "downloading", progress, downloaded: Math.round(torrent.size * progress), downloadSpeed: completed ? 0 : 8_400_000, uploadSpeed: completed ? 460_000 : 90_000, etaSeconds: completed ? 0 : Math.ceil((torrent.size * (1-progress))/8_400_000), seeds: 24, peers: 8, completedAt: completed ? torrent.completedAt ?? new Date().toISOString() : undefined, files: torrent.files.map(f => ({...f, progress})) };
}
function decodeBase32(value:string){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits=0,buffer=0;const output:number[]=[];for(const character of value.toUpperCase()){const index=alphabet.indexOf(character);if(index<0)throw new Error("Invalid base32 info hash");buffer=(buffer<<5)|index;bits+=5;if(bits>=8){bits-=8;output.push((buffer>>bits)&255);}}return Buffer.from(output).toString("hex");}
