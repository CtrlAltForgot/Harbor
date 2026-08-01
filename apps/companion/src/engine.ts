import { createHash, randomUUID } from "node:crypto";
import type { AddTorrentRequest, Torrent } from "@harbor/contracts";
import { classify } from "./classifier.js";

export function parseMagnet(value: string) {
  let url: URL; try { url = new URL(value); } catch { throw new Error("The magnet link is malformed"); }
  if (url.protocol !== "magnet:") throw new Error("Only magnet links are accepted");
  const xt = url.searchParams.get("xt") ?? ""; const match = xt.match(/^urn:btih:([a-z0-9]+)$/i);
  if (!match) throw new Error("The magnet link has no valid BitTorrent info hash");
  return { hash: match[1]!.toLowerCase(), name: url.searchParams.get("dn") || `Torrent ${match[1]!.slice(0, 8)}` };
}
export function createTorrent(input: AddTorrentRequest, destinations: Record<string,string>): Torrent {
  let infoHash: string, name: string, source: Torrent["source"];
  if (input.magnet) { ({ hash: infoHash, name } = parseMagnet(input.magnet)); source = "magnet"; }
  else if (input.torrentBase64) { infoHash = createHash("sha1").update(Buffer.from(input.torrentBase64, "base64")).digest("hex"); name = input.fileName?.replace(/\.torrent$/i, "") || "Uploaded torrent"; source = "torrent"; }
  else throw new Error("Provide a magnet link or torrent file");
  const detected = classify(name); const category = input.category && input.category !== "auto" ? input.category : detected.category;
  return { id: randomUUID(), infoHash, name, source, mode: input.mode ?? "server", status: "queued", progress: 0, downloadSpeed: 0, uploadSpeed: 0, etaSeconds: null, seeds: 0, peers: 0, size: 2_400_000_000, downloaded: 0, category: input.category ?? "auto", classification: category === detected.category ? detected : { category: category as any, confidence: 1, reasons: ["manual selection"], title: name }, destination: destinations[category] ?? destinations.review!, retention: input.retention ?? "seed", createdAt: new Date().toISOString(), files: [{ id: 0, name, size: 2_400_000_000, progress: 0, priority: 1 }] };
}

export function tick(torrent: Torrent): Torrent {
  if (!(torrent.status === "queued" || torrent.status === "downloading")) return torrent;
  const progress = Math.min(1, torrent.progress + .0125); const completed = progress >= 1;
  return { ...torrent, status: completed ? (torrent.classification.confidence < .6 ? "review" : "organized") : "downloading", progress, downloaded: Math.round(torrent.size * progress), downloadSpeed: completed ? 0 : 8_400_000, uploadSpeed: completed ? 460_000 : 90_000, etaSeconds: completed ? 0 : Math.ceil((torrent.size * (1-progress))/8_400_000), seeds: 24, peers: 8, completedAt: completed ? torrent.completedAt ?? new Date().toISOString() : undefined, files: torrent.files.map(f => ({...f, progress})) };
}
