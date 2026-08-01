import type { Torrent } from "@harbor/contracts";

export type TorrentSort =
  | "added-desc"
  | "added-asc"
  | "name-asc"
  | "name-desc"
  | "progress-desc"
  | "status-asc";

export function sortTorrents(items: Torrent[], sort: TorrentSort): Torrent[] {
  return [...items].sort((a, b) => {
    let result = 0;
    if (sort === "added-desc")
      result = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    else if (sort === "added-asc")
      result = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    else if (sort === "name-asc") result = a.name.localeCompare(b.name);
    else if (sort === "name-desc") result = b.name.localeCompare(a.name);
    else if (sort === "progress-desc") result = b.progress - a.progress;
    else if (sort === "status-asc") result = a.status.localeCompare(b.status);
    return result || a.infoHash.localeCompare(b.infoHash);
  });
}
