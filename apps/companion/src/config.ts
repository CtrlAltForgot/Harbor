import path from "node:path";

export interface Config {
  host: string; port: number; dataDir: string; pairingCode: string; engine: "mock" | "qbittorrent";
  destinations: Record<string, string>;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const dataDir = overrides.dataDir ?? process.env.HARBOR_DATA_DIR ?? path.resolve("data");
  return {
    host: overrides.host ?? process.env.HARBOR_HOST ?? "0.0.0.0",
    port: overrides.port ?? Number(process.env.HARBOR_PORT ?? 7331), dataDir,
    pairingCode: overrides.pairingCode ?? process.env.HARBOR_PAIRING_CODE ?? "harbor-local",
    engine: overrides.engine ?? (process.env.HARBOR_ENGINE === "qbittorrent" ? "qbittorrent" : "mock"),
    destinations: { movie: "/media/movies", tv: "/media/tv", game: "/media/games", music: "/media/music", software: "/media/software", book: "/media/books", general: "/media/general", review: "/media/review" }
  };
}
