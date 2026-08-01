# Development log

## 2026-08-01

Selected the Harbor identity and a TypeScript/Fastify/SQLite + React/Tauri architecture. Chose process-isolated qBittorrent integration after license/operations review. Implemented the first secure simulated vertical slice. Current limitations: no real qBittorrent adapter, uploaded torrent parsing, file organizer, native packaging, or production secret store. Next priority is the qBittorrent adapter and multipart torrent intake.

Reframed the roadmap for a personal open-source homelab project. Reliable real downloads, safe organization, restart recovery, and useful troubleshooting are required; commercial-release infrastructure and broad platform polish are optional.

Implemented and locally verified the qBittorrent 5.2 adapter, exact `.torrent` parsing, base32 magnet normalization, real controls, file priorities/limits, storage preflight, verified-copy organization, correction workflow, static web administration bundle, and Nobara RPM. Isolated Docker verification covered pairing, real engine authentication, magnet intake, synchronization, pause/resume, duplicate rejection, and restart recovery without downloading content. The next required validation is a user-selected lawful torrent on the actual Unraid paths.

Completed a genuine end-to-end download using WebTorrent's official Creative Commons Sintel torrent. qBittorrent downloaded 129,302,391 bytes from real peers; Harbor organized the movie, retained nine subtitles and artwork, produced an independently matching MP4 SHA-256, applied remove-torrent/keep-files retention, and recovered organized history without duplication after restart. Added primary-video and matching-subtitle normalization for directory torrents. Only the user's Unraid-specific mounts/cache/mover environment remains externally testable.

Added a guided Unraid installer and prebuilt-RPM Nobara installer. A completely fresh isolated run verified folder/credential generation, automatic qBittorrent temporary-password replacement, Harbor build/startup, engine/storage readiness, and a second idempotent run preserving credentials. The fresh test exposed and fixed the qBittorrent requirement that internal and published Web UI ports match.

Aligned Harbor with an existing Jellyfin-style media share: Docker now mounts one media root, the real Settings screen selects and validates Movies/TV/Needs Review destinations, and completed records retain their exact organized path. Added modular TMDB title/year confirmation with strict ambiguity gating and tests. No metadata provider can honestly guarantee 100%; weak or tied results intentionally go to Needs Review.

Moved distribution to `github.com/CtrlAltForgot/Harbor`. Added source verification and container-publishing workflows, updated the Unraid template to the real repository/GHCR coordinates, added safe issue/security guidance, and changed fresh installation and updates to `git clone`/`git pull` with an archive fallback.

Added library-aware television routing for incremental collections. Canonical titles can reuse one uniquely matching existing series folder (including a conservative longer-title prefix alias), new seasons land beside old seasons, and missing episodes can merge into an existing season only after a no-overwrite collision preflight and post-merge size verification.

Reproduced the installed desktop's immediate exit on Nobara Wayland from the journal (`Error 71 (Protocol error) dispatching to Wayland display`). Verified that disabling WebKitGTK's DMA-BUF renderer keeps Harbor running, moved the compatibility setting into pre-WebKit Rust startup, and incremented the RPM package release so existing installations upgrade correctly.
