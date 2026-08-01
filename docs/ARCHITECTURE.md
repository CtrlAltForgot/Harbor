# Architecture

## Decisions

The companion is a Node 22 TypeScript service using Fastify, SQLite in WAL mode, and a narrow `TorrentEngine` boundary. React/Vite provides one design system for the Tauri desktop and later companion administration surface. Tauri keeps the Linux desktop package small and allows native protocol, notification, and secure-secret integrations without shipping a full browser runtime.

qBittorrent is the production torrent engine. Harbor controls its Web API and does not implement BitTorrent. The deterministic mock engine remains available for UI/testing without network traffic. Shared TypeScript contracts keep the UI and server aligned.

```text
Tauri desktop / browser UI
        │ HTTPS/Bearer + WebSocket
        ▼
Harbor Companion API ── SQLite (queue, config, tokens, audit)
        │
        ├── Mock engine (development)
        └── qBittorrent Web API (Milestone 2)
                    │
              incomplete staging
                    ▼
 classifier → operation plan → verified organizer → retention
```

Pairing exchanges a short-lived/out-of-band code for a random 192-bit bearer token. Only a SHA-256 digest is stored server-side. Tokens and torrent file bodies are redacted from structured logs. TLS termination can be supplied by a trusted LAN reverse proxy; the API binds to LAN interfaces and is not intended for public exposure.

The organizer copies to a uniquely named partial target, verifies the recursive byte count, and atomically renames it. The staging source is preserved. Low-confidence classification routes to review, and retention runs only after organization succeeds. Operation history is stored in the SQLite audit table.
