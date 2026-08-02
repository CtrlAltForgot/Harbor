export const categories = [
  "auto",
  "movie",
  "tv",
  "game",
  "music",
  "software",
  "book",
  "general",
  "review",
] as const;
export type Category = (typeof categories)[number];
export type TorrentStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "processing"
  | "review"
  | "organized"
  | "failed";
export type RetentionPolicy = "seed" | "stop" | "remove" | "ask";

export interface TorrentFile {
  id: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
}
export interface OrganizationProgress {
  phase: "preparing" | "copying" | "verifying" | "finalizing";
  progress: number;
  bytesProcessed: number;
  totalBytes: number;
  filesProcessed: number;
  totalFiles: number;
}
export interface Classification {
  category: Exclude<Category, "auto">;
  confidence: number;
  reasons: string[];
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  metadataId?: number;
  metadataSource?: "tmdb";
}
export interface Torrent {
  id: string;
  infoHash: string;
  name: string;
  source: "magnet" | "torrent";
  mode: "server" | "local";
  status: TorrentStatus;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  etaSeconds: number | null;
  seeds: number;
  peers: number;
  size: number;
  downloaded: number;
  category: Category;
  classification: Classification;
  destination: string;
  organizedPath?: string;
  organizedHostPath?: string;
  retention: RetentionPolicy;
  createdAt: string;
  completedAt?: string;
  error?: string;
  files: TorrentFile[];
  organization?: OrganizationProgress;
}
export interface ServerStatus {
  name: string;
  version: string;
  paired: boolean;
  engine: "mock" | "qbittorrent";
  engineConnected?: boolean;
  engineError?: string;
  storageReady?: boolean;
  storageIssues?: string[];
  uptime: number;
  downloadSpeed: number;
  uploadSpeed: number;
}
export interface HarborSettings {
  mediaRoot: string;
  mediaHostRoot?: string;
  moviesDir: string;
  tvDir: string;
  reviewDir: string;
  tmdbConfigured: boolean;
  metadataLanguage: string;
}
export interface QbitPreferences {
  savePath: string;
  tempPath: string;
  tempPathEnabled: boolean;
  createSubfolder: boolean;
  preallocateAll: boolean;
  incompleteExtension: boolean;
  startPaused: boolean;
  listenPort: number;
  upnp: boolean;
  maxConnections: number;
  maxConnectionsPerTorrent: number;
  maxUploadsPerTorrent: number;
  downloadLimit: number;
  uploadLimit: number;
  alternativeDownloadLimit: number;
  alternativeUploadLimit: number;
  queueingEnabled: boolean;
  maxActiveDownloads: number;
  maxActiveUploads: number;
  maxActiveTorrents: number;
  dontCountSlowTorrents: boolean;
  dht: boolean;
  pex: boolean;
  lsd: boolean;
  encryption: number;
  anonymousMode: boolean;
  maxRatioEnabled: boolean;
  maxRatio: number;
  maxRatioAction: number;
  maxSeedingTimeEnabled: boolean;
  maxSeedingTime: number;
  schedulerEnabled: boolean;
  scheduleFromHour: number;
  scheduleFromMinute: number;
  scheduleToHour: number;
  scheduleToMinute: number;
  schedulerDays: number;
  proxyType: number;
  proxyAddress: string;
  proxyPort: number;
  proxyPeerConnections: boolean;
  proxyAuthEnabled: boolean;
  proxyUsername: string;
  proxyPassword: string;
  proxyPasswordConfigured: boolean;
  proxyTorrentsOnly: boolean;
}
export interface QbitEngineInfo {
  version: string;
  webApiVersion: string;
  connectionStatus: string;
  alternativeSpeedLimits: boolean;
  freeSpace: number;
  recentLogs: Array<{ id: number; timestamp: number; type: number; message: string }>;
}
export interface AddTorrentRequest {
  magnet?: string;
  torrentBase64?: string;
  fileName?: string;
  category?: Category;
  retention?: RetentionPolicy;
  mode?: "server" | "local";
}
export interface PairResponse {
  token: string;
  serverName: string;
}
export interface EventMessage {
  type: "snapshot" | "torrent.updated" | "torrent.removed";
  torrents?: Torrent[];
  torrent?: Torrent;
  torrentId?: string;
}
