export function formatSpeed(bytesPerSecond: number) {
  if (bytesPerSecond <= 0) return "—";
  if (bytesPerSecond < 100_000) {
    const kilobytes = bytesPerSecond / 1_000;
    return `${kilobytes.toFixed(kilobytes < 10 ? 1 : 0)} kB/s`;
  }
  if (bytesPerSecond > 1_000_000_000)
    return `${(bytesPerSecond / 1_000_000_000).toFixed(1)} GB/s`;
  return `${(bytesPerSecond / 1_000_000).toFixed(1)} MB/s`;
}

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

export function transferCounts(
  torrents: Array<{ status: string; downloadSpeed: number }>,
) {
  const unfinished = new Set([
    "queued",
    "downloading",
    "paused",
    "completed",
    "processing",
  ]);
  let active = 0,
    queued = 0;
  for (const torrent of torrents) {
    if (!unfinished.has(torrent.status)) continue;
    if (
      torrent.status === "processing" ||
      (torrent.status === "downloading" && torrent.downloadSpeed > 0)
    )
      active += 1;
    else queued += 1;
  }
  return { active, queued };
}
