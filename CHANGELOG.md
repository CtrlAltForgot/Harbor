# Changelog

## 0.1.0 — Unreleased

- Made qBittorrent authoritative for live state: submissions, pause/resume, and removal now require engine confirmation; missing jobs become explicit failures with zero live speed. Added safe optional staging-file deletion during removal and corrected dashed season-pack titles so separately downloaded seasons converge on one show folder.
- Added multi-magnet clipboard import with info-hash deduplication and independent per-torrent failure handling, and changed manual torrent removal to preserve an archived history record across restarts.
- Added an authentication-independent Connection & Pairing settings panel so a changed Unraid pairing code or address can be replaced without locking the desktop out; RPM release 6 includes the recovery flow.
- Fixed immediate desktop exits caused by WebKitGTK Wayland DMA-BUF protocol errors on Nobara; RPM release 2 enables the compatible renderer automatically.
- Removed the accidental Build Plan development overlay and moved desktop API calls to native Rust networking to avoid WebKit LAN-request failures; RPM release 3 provides actionable pairing errors.
- Reworked the dashboard into a top-anchored, full-width transfer workspace; removed redundant/dead sidebar navigation and fixed dark file-priority controls.
- Made verified library organization plus staging cleanup the default, added retroactive per-torrent cleanup controls, and displayed exact Unraid host paths alongside container paths.
- Added safe re-organization from retained staging after correcting an incorrect Docker media-root mapping.
- Added authenticated pairing, persistent queue, duplicate detection, mock transfer engine, local classification, live controls, responsive Harbor interface, and Docker foundation.
- Added real qBittorrent 5.x integration, `.torrent` parsing, verified organization, storage preflight, review corrections, companion-hosted UI, and a buildable Nobara RPM.
- Validated a genuine Creative Commons download and added primary video/subtitle normalization for directory-based movie and episode torrents.
- Added tested guided installers for Unraid and Nobara, including automatic qBittorrent first-boot credential configuration and an included desktop RPM.
- Added persistent in-app Movies/TV/Needs Review selection, optional ambiguity-safe TMDB confirmation, a single existing-media-root mount, and exact organized-path reporting.
- Established GitHub distribution with clone/pull installation instructions, CI verification, GHCR companion publishing, a sanitized bug-report form, and current repository URLs/checksums.
- Reused existing television series folders for later seasons and added collision-safe merging of missing episodes into existing season directories.
