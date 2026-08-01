# Harbor homelab plan

Harbor is a personal, open-source homelab tool. The goal is a dependable daily driver on Nobara and Unraid—not a commercial product. Work is prioritized around real downloads, safe file handling, restart recovery, and clear troubleshooting.

## Phase 0 — Working prototype (complete)

- [x] Harbor identity and TypeScript monorepo
- [x] Companion API with SQLite persistence
- [x] Pairing code and authenticated clients
- [x] Magnet validation and duplicate detection
- [x] Deterministic mock downloads and restart recovery
- [x] Basic local classification and Needs Review routing
- [x] Connected desktop-style interface and Tauri foundation
- [x] Docker, Compose, and draft Unraid template
- [x] Initial automated tests and documentation

Result: the complete interaction can be tested safely with the simulator.

## Phase 1 — Real downloads on Unraid

The implementation is complete through the point that requires a user-selected real download on Unraid.

- [x] Add qBittorrent to the Docker Compose stack
- [x] Implement the qBittorrent Web API adapter
- [x] Configure qBittorrent connection details through environment variables
- [x] Submit real magnet links and `.torrent` files
- [x] Read real progress, speed, ETA, peer, seed, and error state
- [x] Pause, resume, retry/recheck, and remove torrents
- [x] List files and change file priorities
- [ ] Support global and per-torrent speed limits
- [x] Support per-torrent speed limits through the API
- [x] Recover Harbor state and pairing after a container restart
- [ ] Test an actual payload and qBittorrent restart with a small lawful/public-domain torrent on Unraid (user test)

Result: Harbor replaces the normal qBittorrent UI for everyday add/monitor/control use.

## Phase 2 — Safe homelab organization

- [x] Configure incomplete, complete, Movies, TV, Games, Music, Books, Software, General, and Review paths
- [x] Validate that mapped paths exist and are writable
- [x] Detect missing mounts, permission failures, and low disk space before moving data
- [x] Inspect actual torrent names and file trees
- [x] Reliably detect common movies, episodes, and season packs
- [x] Provide sensible fallback detection for other categories
- [ ] Preview the chosen destination and final names
- [ ] Use atomic moves on the same filesystem
- [x] Use verified copies with atomic final rename across filesystems
- [ ] Add optional hardlinks only when supported
- [x] Preserve subtitles and companion files through recursive tree copy
- [x] Never remove the source until the result is verified
- [x] Journal completed and failed organization operations
- [ ] Resume an interrupted partial copy rather than safely cleaning/retrying it

Result: completed downloads are routed into the Unraid library without risking the only copy.

## Phase 3 — Review and retention

- [x] Build the real Needs Review screen
- [x] Change category, title, season, and episode
- [x] Re-run organization after a correction
- [ ] Directly edit a one-off destination and final filename
- [ ] Save simple reusable correction rules
- [x] Show organized items in completed history and record audit details
- [x] Implement keep seeding, stop, and remove torrent/keep files
- [ ] Add ratio and time policies
- [ ] Support global defaults with per-category and per-torrent overrides
- [x] Keep torrent removal separate from data deletion and require confirmation
- [ ] Add best-effort undo for recent moves when the original location is available

Result: uncertain downloads are easy to correct and seeding behavior is predictable.

## Phase 4 — Comfortable daily use

- [x] Build and verify a native Tauri RPM for Nobara
- [x] Submit pasted magnet links and selected `.torrent` files from the desktop
- [ ] Register OS-level magnet and `.torrent` file associations
- [ ] Detect magnet links copied to the clipboard
- [ ] Add native completion/attention notifications
- [ ] Store the pairing token in the OS keyring
- [ ] Add settings for server, folders, bandwidth, retention, and appearance
- [x] Serve the same administration UI from the companion container
- [ ] Add logs and a redacted diagnostic export
- [ ] Add a simple configuration/database backup and restore command
- [x] Add PUID/PGID-aware Compose mappings and storage preflight
- [ ] Publish a Harbor image and replace placeholder values in the Unraid template
- [x] Test Harbor container rebuild/restart without losing state
- [ ] Test an actual desktop package upgrade

Result: Harbor is convenient enough to use instead of opening qBittorrent directly.

## Later, only if useful

These are not release blockers for a personal homelab:

- [ ] Local desktop download mode
- [ ] External movie/TV/music/book metadata providers
- [ ] Advanced naming-template language
- [ ] Multiple Unraid servers or multiple users
- [ ] Remote access outside the LAN
- [ ] AppImage/DEB packages in addition to the working RPM
- [ ] Automatic application updates
- [ ] Signed images, formal SBOM publication, or a public release pipeline
- [ ] Unraid Community Applications submission
- [ ] Large plugin/provider ecosystem

## Practical quality bar

Every change should pass type checking and focused automated tests. Critical paths—authentication, duplicate detection, restart recovery, path validation, file verification, and retention—need tests. UI styling details do not need exhaustive tests. Before Harbor touches a real media library, test it against temporary directories and a small lawful torrent fixture.

## Definition of “good enough for daily use”

Harbor is ready for the homelab when it can reliably:

1. Start with Docker on Unraid and recover after restarts.
2. Pair with the Nobara desktop client.
3. Add a magnet or `.torrent` and download it through qBittorrent.
4. Monitor and control the transfer from the desktop.
5. Classify and organize common movie/TV downloads safely.
6. Send uncertain content to review rather than guessing.
7. Apply understandable seeding/retention rules.
8. Explain failures through useful logs without exposing secrets.
