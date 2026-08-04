# Harbor

[![Verify Harbor](https://github.com/CtrlAltForgot/Harbor/actions/workflows/ci.yml/badge.svg)](https://github.com/CtrlAltForgot/Harbor/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/CtrlAltForgot/Harbor)](https://github.com/CtrlAltForgot/Harbor/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-69c6b6.svg)](LICENSE)

Harbor is a personal homelab torrent controller for Nobara and Unraid. The desktop sends magnets or `.torrent` files to the Harbor companion; Harbor controls qBittorrent on the server, monitors transfers, classifies completed content, and copies it into configured media folders only after verifying the result.

Harbor mounts your existing Unraid media share once and lets you select its Movies, TV Shows, and Needs Review folders from **Settings**. Optional TMDB matching confirms canonical titles and years. Every organized item reports its exact final path.

The repository is ready for homelab use. In addition to automated tests, Harbor completed a genuine 129 MB Creative Commons torrent through qBittorrent, verified and organized all files, applied retention, and recovered history after restart. See [the validation record](docs/VALIDATION.md).

## What works

- Pairing-code authentication with persistent hashed client tokens
- Real qBittorrent 5.x Web API authentication, magnet/`.torrent` intake, monitoring, complete everyday transfer controls, PIA OpenVPN routing with a network kill switch, and sanitized diagnostics
- Live organization feedback with streamed copy progress, verification/finalization phases, a dedicated Sorting filter, and visually distinct sorting rows
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

The guided installer creates a dedicated binhex qBittorrent-VPN container on Unraid, collects your PIA VPN credentials privately, and installs a regional OpenVPN profile. It does not touch qBittorrent on your PC.

For upgrades, run `./scripts/update-unraid.sh` from the existing Harbor checkout on Unraid, then install the desktop RPM from the same release. The updater selects the newest versioned release rather than the changing development branch and preserves downloads, configuration, pairing state, and history.

```bash
# On Unraid
git clone --branch v0.1.0 --depth 1 https://github.com/CtrlAltForgot/Harbor.git /mnt/user/appdata/harbor-source
cd /mnt/user/appdata/harbor-source
./scripts/install-unraid.sh

# On Nobara
curl -fLO https://github.com/CtrlAltForgot/Harbor/releases/download/v0.1.0/Harbor-0.1.0-29.x86_64.rpm
sudo dnf install -y ./Harbor-0.1.0-29.x86_64.rpm
xdg-mime default Harbor.desktop x-scheme-handler/magnet
xdg-mime default Harbor.desktop application/x-bittorrent
```

The Nobara installer registers Harbor as the default handler for browser magnet
links and `.torrent` files. Opening either brings up Harbor's normal confirmation
sheet before anything is sent to the server.

See the complete [easy installation guide](docs/EASY_INSTALL.md). Advanced path and mover details are in [the Unraid guide](docs/UNRAID.md).

## Repository

- `apps/companion`: Fastify API, SQLite state, qBittorrent adapter, classification and organizer
- `apps/ui`: shared desktop and companion web interface
- `apps/desktop`: Tauri/Nobara package
- `packages/contracts`: shared domain/API types
- `docker/unraid`: draft Unraid template for a future published image

Harbor is designed for trusted LAN access. Do not port-forward ports 7331 or 8080.

Source, updates, issues, and automated build status live at [github.com/CtrlAltForgot/Harbor](https://github.com/CtrlAltForgot/Harbor).
