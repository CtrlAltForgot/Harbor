# Development log

## 2026-08-01

Selected the Harbor identity and a TypeScript/Fastify/SQLite + React/Tauri architecture. Chose process-isolated qBittorrent integration after license/operations review. Implemented the first secure simulated vertical slice. Current limitations: no real qBittorrent adapter, uploaded torrent parsing, file organizer, native packaging, or production secret store. Next priority is the qBittorrent adapter and multipart torrent intake.

Reframed the roadmap for a personal open-source homelab project. Reliable real downloads, safe organization, restart recovery, and useful troubleshooting are required; commercial-release infrastructure and broad platform polish are optional.

Implemented and locally verified the qBittorrent 5.2 adapter, exact `.torrent` parsing, base32 magnet normalization, real controls, file priorities/limits, storage preflight, verified-copy organization, correction workflow, static web administration bundle, and Nobara RPM. Isolated Docker verification covered pairing, real engine authentication, magnet intake, synchronization, pause/resume, duplicate rejection, and restart recovery without downloading content. The next required validation is a user-selected lawful torrent on the actual Unraid paths.
