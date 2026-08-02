# Changelog

## 0.1.0 — Unreleased

- Moved fully downloaded torrents awaiting organization into the Sorting tab and orange sorting state; Completed now contains only verified organized results.
- Prevented the Unraid installer from silently creating case-conflicting media shares: an entered `/mnt/user/media` now resolves to an existing `/mnt/user/Media`, missing roots are rejected, ambiguous duplicates stop setup safely, and repair reruns preserve existing custom path and port defaults.
- Made Harbor a single-instance desktop application: launching it again restores, unminimizes, and focuses the existing window instead of creating duplicate processes.
- Fixed bodyless torrent controls such as Reannounce being rejected as empty JSON requests; browser and native transports now send content type only when a body exists, and qBittorrent failures retain action-specific details.
- Made transfer speeds adaptive across the header, summary, and torrent rows: sub-0.1 MB/s values use kB/s, normal values use MB/s, and speeds above 1000 MB/s use GB/s.
- Added a Queued summary metric and made Active reflect only torrents currently transferring data or being organized; waiting, stalled, and paused unfinished jobs now count as queued.
- Added real byte/file organization progress with preparing, copying, verifying, and finalizing phases; sorting rows now use an orange folder-sync identity, their own filter, and clearer destination text. Fixed qBittorrent settings saves when disabled ratio/time limits use the engine's `-1` sentinel, with field-specific validation errors.
- Prevented long queues from flex-shrinking the summary metrics out of view; only the torrent list now grows and scrolls within remaining space.
- Prevented partially hidden torrent rows after window resizing by snapping the scrolling transfer surface to complete row boundaries beneath its sticky header.
- Changed long torrent ETAs from unwieldy minute totals to hours/minutes and added an all-downloads ETA summary based on the longest currently downloading transfer.
- Made the transfer list consume the full remaining window height at every display scale and moved torrent action menus to a viewport-aware floating layer so long menus cannot be clipped by the scrolling list.
- Added a safe one-command Unraid companion updater and an actionable desktop warning when the companion is too old for the installed desktop, replacing the misleading generic “Not found” settings error.
- Expanded Harbor's qBittorrent administration tree with global seeding limits, scheduled alternative speeds, authenticated proxy controls with write-only passwords, sanitized engine diagnostics, per-torrent speed limits, tracker reannounce, and queue-position controls.
- Added close-to-tray behavior, native completion/organization/review notifications, native drag-and-drop `.torrent` intake, a desktop-independence explanation, fully dark settings selectors, and a functional category-tree editor for practical qBittorrent download, connection, speed, queueing, and privacy settings.
- Forced WebKit's native sort selector into Harbor's dark color scheme so the selected value and menu options remain readable on Nobara.
- Removed torrent archiving: manual removal now deletes the Harbor record, permits the same info hash to be added again, and migration 2 purges all legacy archived records automatically.
- Stopped live synchronization from reordering torrent rows, added a persistent sort control, and made creation time the stable default ordering in both the API and desktop.
- Made qBittorrent authoritative for live state: submissions, pause/resume, and removal now require engine confirmation; missing jobs become explicit failures with zero live speed. Added safe optional staging-file deletion during removal and corrected dashed season-pack titles so separately downloaded seasons converge on one show folder.
- Added multi-magnet clipboard import with info-hash deduplication and independent per-torrent failure handling.
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
