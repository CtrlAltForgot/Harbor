# Harbor

Harbor is a desktop torrent controller and Unraid companion. The desktop sends work to your server; the server owns downloading, classification, organization, and retention. This repository currently contains the first end-to-end vertical slice using a deterministic download simulator, so it is safe to evaluate without downloading torrent data.

## Run the first vertical slice

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, pair with `http://localhost:7331` and code `harbor-local`, then add a magnet. The default code is development-only. The production container requires you to provide a new value.

Run all quality checks with `npm run check`. See [the development guide](docs/DEVELOPMENT.md), [architecture](docs/ARCHITECTURE.md), and [project plan](PROJECT_PLAN.md).

## Repository

- `apps/companion`: authenticated Fastify API, SQLite state, engine boundary, classification
- `apps/ui`: React interface shared by desktop and companion web surfaces
- `apps/desktop`: Tauri desktop wrapper
- `packages/contracts`: shared API/domain types
- `docker/unraid`: future Community Applications template

Harbor is LAN-only by default. Do not port-forward it. Production use with real downloads begins after the qBittorrent adapter and organization safety gates in Milestones 2 and 3.
