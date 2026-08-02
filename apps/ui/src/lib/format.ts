export function formatEta(seconds: number | null) {
  if (seconds === null) return "Waiting";
  if (seconds <= 0) return "Done";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function overallDownloadEta(
  torrents: Array<{ status: string; etaSeconds: number | null }>,
) {
  const active = torrents.filter((torrent) => torrent.status === "downloading");
  const estimates = active
    .map((torrent) => torrent.etaSeconds)
    .filter((value): value is number => value !== null && value > 0);
  if (estimates.length) return formatEta(Math.max(...estimates));
  return active.length ? "Waiting" : "—";
}
