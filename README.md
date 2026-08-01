# Harbor

[![Verify Harbor](https://github.com/CtrlAltForgot/Harbor/actions/workflows/ci.yml/badge.svg)](https://github.com/CtrlAltForgot/Harbor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-69c6b6.svg)](LICENSE)

Harbor is a personal homelab torrent controller for Nobara and Unraid. The desktop sends magnets or `.torrent` files to the Harbor companion; Harbor controls qBittorrent on the server, monitors transfers, classifies completed content, and copies it into configured media folders only after verifying the result.

Harbor mounts your existing Unraid media share once and lets you select its Movies, TV Shows, and Needs Review folders from **Settings**. Optional TMDB matching confirms canonical titles and years. Every organized item reports its exact final path.

The repository is ready for homelab use. In addition to automated tests, Harbor completed a genuine 129 MB Creative Commons torrent through qBittorrent, verified and organized all files, applied retention, and recovered history after restart. See [the validation record](docs/VALIDATION.md).

## What works

- Pairing-code authentication with persistent hashed client tokens
- Real qBittorrent 5.x Web API authentication, magnet/`.torrent` intake, monitoring, pause/resume/recheck/remove, file priorities, and per-torrent limits
- Exact info-hash duplicate detection, including base32 magnets
- SQLite queue/audit persistence and restart recovery
- Local movie, episode, season-pack, and extension-based classification with optional TMDB confirmation
- In-app media folder selection with server-side path and permission validation
- Verified, collision-safe organization that preserves the source
- Existing-series reuse when adding later seasons, including safe missing-episode merges without overwrites
- Needs Review correction and retention actions after verified organization
- Companion-hosted web UI and a native Nobara RPM

## Development

```bash
npm install
npm run dev
```

Development uses the safe mock engine unless `HARBOR_ENGINE=qbittorrent` is set. Pair with `http://localhost:7331`; the development-only code is `harbor-local`. Run every quality gate with `npm run check`.

## Easy installation

The guided installer creates and configures a dedicated qBittorrent container on Unraid; it does not touch qBittorrent on your PC.

```bash
# On Unraid
git clone --depth 1 https://github.com/CtrlAltForgot/Harbor.git /mnt/user/appdata/harbor-source
cd /mnt/user/appdata/harbor-source
./scripts/install-unraid.sh

# On Nobara
git clone --depth 1 https://github.com/CtrlAltForgot/Harbor.git ~/Harbor
cd ~/Harbor
./scripts/install-desktop.sh
```

See the complete [easy installation guide](docs/EASY_INSTALL.md). Advanced path and mover details are in [the Unraid guide](docs/UNRAID.md).

## Repository

- `apps/companion`: Fastify API, SQLite state, qBittorrent adapter, classification and organizer
- `apps/ui`: shared desktop and companion web interface
- `apps/desktop`: Tauri/Nobara package
- `packages/contracts`: shared domain/API types
- `docker/unraid`: draft Unraid template for a future published image

Harbor is designed for trusted LAN access. Do not port-forward ports 7331 or 8080.

Source, updates, issues, and automated build status live at [github.com/CtrlAltForgot/Harbor](https://github.com/CtrlAltForgot/Harbor).
