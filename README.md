# Harbor

Harbor is a personal homelab torrent controller for Nobara and Unraid. The desktop sends magnets or `.torrent` files to the Harbor companion; Harbor controls qBittorrent on the server, monitors transfers, classifies completed content, and copies it into configured media folders only after verifying the result.

The repository is ready for its first real homelab test. Automated and isolated-container tests pass; a real media download has intentionally not been performed without the owner's choice of lawful test content and actual Unraid paths.

## What works

- Pairing-code authentication with persistent hashed client tokens
- Real qBittorrent 5.x Web API authentication, magnet/`.torrent` intake, monitoring, pause/resume/recheck/remove, file priorities, and per-torrent limits
- Exact info-hash duplicate detection, including base32 magnets
- SQLite queue/audit persistence and restart recovery
- Local movie, episode, season-pack, and extension-based classification
- Configurable category volumes with startup readiness reporting
- Verified, collision-safe organization that preserves the source
- Needs Review correction and retention actions after verified organization
- Companion-hosted web UI and a native Nobara RPM

## Development

```bash
npm install
npm run dev
```

Development uses the safe mock engine unless `HARBOR_ENGINE=qbittorrent` is set. Pair with `http://localhost:7331`; the development-only code is `harbor-local`. Run every quality gate with `npm run check`.

## First real homelab test

Follow [the Unraid guide](docs/UNRAID.md), then install the generated Nobara package:

```bash
sudo dnf install ./apps/desktop/src-tauri/target/release/bundle/rpm/Harbor-0.1.0-1.x86_64.rpm
```

Use a small lawful/public-domain torrent and choose a temporary test library mapping—not your only media copy—for the first organization run.

## Repository

- `apps/companion`: Fastify API, SQLite state, qBittorrent adapter, classification and organizer
- `apps/ui`: shared desktop and companion web interface
- `apps/desktop`: Tauri/Nobara package
- `packages/contracts`: shared domain/API types
- `docker/unraid`: draft Unraid template for a future published image

Harbor is designed for trusted LAN access. Do not port-forward ports 7331 or 8080.
