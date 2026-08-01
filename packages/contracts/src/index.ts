export const categories = ["auto", "movie", "tv", "game", "music", "software", "book", "general", "review"] as const;
export type Category = (typeof categories)[number];
export type TorrentStatus = "queued" | "downloading" | "paused" | "completed" | "processing" | "review" | "organized" | "failed";
export type RetentionPolicy = "seed" | "stop" | "remove" | "ask";

export interface TorrentFile { id: number; name: string; size: number; progress: number; priority: number }
export interface Classification { category: Exclude<Category, "auto">; confidence: number; reasons: string[]; title: string; season?: number; episode?: number }
export interface Torrent {
  id: string; infoHash: string; name: string; source: "magnet" | "torrent"; mode: "server" | "local";
  status: TorrentStatus; progress: number; downloadSpeed: number; uploadSpeed: number; etaSeconds: number | null;
  seeds: number; peers: number; size: number; downloaded: number; category: Category; classification: Classification;
  destination: string; retention: RetentionPolicy; createdAt: string; completedAt?: string; error?: string; files: TorrentFile[];
}
export interface ServerStatus { name: string; version: string; paired: boolean; engine: "mock" | "qbittorrent"; uptime: number; downloadSpeed: number; uploadSpeed: number }
export interface AddTorrentRequest { magnet?: string; torrentBase64?: string; fileName?: string; category?: Category; retention?: RetentionPolicy; mode?: "server" | "local" }
export interface PairResponse { token: string; serverName: string }
export interface EventMessage { type: "snapshot" | "torrent.updated" | "torrent.removed"; torrents?: Torrent[]; torrent?: Torrent; torrentId?: string }
