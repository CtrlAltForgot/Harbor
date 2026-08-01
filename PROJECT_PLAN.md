# Harbor delivery plan

Harbor is built in release-sized vertical slices. Every slice must leave the product runnable and must preserve the safety rule: organized data is never deleted by torrent cleanup.

## Milestone 1 — Connected foundation (current)

- [x] Product identity, architecture, contracts, and repository structure
- [x] Companion persistence, pairing tokens, authenticated API, audit foundation
- [x] Magnet submission, duplicate detection, local classification, mock progress, restart recovery
- [x] Desktop-grade responsive UI, pairing, server-mode add sheet, monitoring and controls
- [x] Docker build, Compose development setup, configurable Unraid volume contract
- [x] Initial API, security, licensing, development, backup, and troubleshooting docs
- [x] Automated API and classifier tests; typecheck and production builds

Exit: a user can pair, add a magnet, watch simulated progress, pause/resume/remove it, and see low-confidence content enter Needs Review.

## Milestone 2 — Real downloads

- [ ] qBittorrent Web API adapter with capability/health checks and reconnect policy
- [ ] `.torrent` multipart submission and pre-start file selection
- [ ] Live peer, tracker, file, priority, queue, ratio, and bandwidth controls
- [ ] Safe qBittorrent credentials storage and redacted diagnostic export
- [ ] Integration tests against an isolated qBittorrent container

## Milestone 3 — Safe organization

- [ ] Path mapping validation, permission probes, free-space checks, and mount-loss detection
- [ ] Inspect completed trees; classify movies, episodes, season packs, music, games, software, and books
- [ ] Naming-template compiler and collision-safe planning preview
- [ ] Same-filesystem atomic move, optional verified hardlink, and verified copy fallback
- [ ] Operation journal, resumable processing, undo metadata, and Needs Review corrections
- [ ] Retention evaluator with global/category/torrent precedence and destructive-action gates

## Milestone 4 — Production desktop and Unraid release

- [ ] Complete Tauri permissions, native `.torrent`/magnet handlers, clipboard detection, notifications, and secret-store integration
- [ ] Settings, logs, backup/restore, pairing management, appearance, accessibility, keyboard navigation
- [ ] Unraid Community Applications template validation, PUID/PGID handling, cache/array guidance
- [ ] Signed AppImage/RPM builds, container SBOM, image signing, update/migration rehearsal
- [ ] End-to-end acceptance test using a lawful public-domain torrent

## Continuous quality gates

API compatibility tests, migration tests, fixture-based classifier tests, failure injection, type checks, production builds, accessibility checks, dependency/license review, and documentation updates are required at every milestone.
