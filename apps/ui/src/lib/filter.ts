import type { TorrentStatus } from "@harbor/contracts";

export type TorrentFilter = "all" | "active" | "sorting" | "complete" | "review";

export function torrentMatchesFilter(filter: TorrentFilter, status: TorrentStatus) {
  if (filter === "all") return true;
  if (filter === "active") return status === "queued" || status === "downloading";
  if (filter === "sorting") return status === "completed" || status === "processing";
  if (filter === "complete") return status === "organized";
  return status === "review";
}

export function isSortingStatus(status: TorrentStatus) {
  return status === "completed" || status === "processing";
}
