import path from "node:path";

export interface Config {
  host: string;
  port: number;
  dataDir: string;
  pairingCode: string;
  engine: "mock" | "qbittorrent";
  qbitUrl: string;
  qbitUsername: string;
  qbitPassword: string;
  incompleteDir: string;
  uiDir?: string;
  mediaRoot: string;
  destinations: Record<string, string>;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const dataDir =
    overrides.dataDir ?? process.env.HARBOR_DATA_DIR ?? path.resolve("data");
  return {
    host: overrides.host ?? process.env.HARBOR_HOST ?? "0.0.0.0",
    port: overrides.port ?? Number(process.env.HARBOR_PORT ?? 7331),
    dataDir,
    pairingCode:
      overrides.pairingCode ??
      process.env.HARBOR_PAIRING_CODE ??
      "harbor-local",
    engine:
      overrides.engine ??
      (process.env.HARBOR_ENGINE === "qbittorrent" ? "qbittorrent" : "mock"),
    qbitUrl:
      overrides.qbitUrl ??
      process.env.QBITTORRENT_URL ??
      "http://qbittorrent:8080",
    qbitUsername:
      overrides.qbitUsername ?? process.env.QBITTORRENT_USERNAME ?? "admin",
    qbitPassword:
      overrides.qbitPassword ?? process.env.QBITTORRENT_PASSWORD ?? "",
    incompleteDir:
      overrides.incompleteDir ??
      process.env.HARBOR_INCOMPLETE_DIR ??
      "/downloads/incomplete",
    mediaRoot: overrides.mediaRoot ?? process.env.HARBOR_MEDIA_ROOT ?? "/media",
    uiDir: overrides.uiDir ?? process.env.HARBOR_UI_DIR,
    destinations: overrides.destinations ?? {
      movie: process.env.HARBOR_MOVIES_DIR ?? "/media/Movies",
      tv: process.env.HARBOR_TV_DIR ?? "/media/TV Shows",
      game: process.env.HARBOR_GAMES_DIR ?? "/media/Games",
      music: process.env.HARBOR_MUSIC_DIR ?? "/media/Music",
      software: process.env.HARBOR_SOFTWARE_DIR ?? "/media/Software",
      book: process.env.HARBOR_BOOKS_DIR ?? "/media/Books",
      general: process.env.HARBOR_GENERAL_DIR ?? "/media/General",
      review: process.env.HARBOR_REVIEW_DIR ?? "/media/Needs Review",
    },
  };
}
