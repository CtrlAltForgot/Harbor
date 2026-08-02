# Companion API v1

Base URL: `http://SERVER:7331`. All `/api/v1/*` routes except pairing require `Authorization: Bearer TOKEN`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v1/pair` | Exchange `{code,label}` for a token |
| GET | `/api/v1/status` | Server/engine state and aggregate speeds |
| GET | `/api/v1/settings` | Media destinations and metadata-provider state (never secrets) |
| GET | `/api/v1/settings/directories` | List folders inside the mounted media root |
| PUT | `/api/v1/settings` | Validate and save folder/provider settings |
| GET | `/api/v1/engine/preferences` | Read Harbor's supported qBittorrent preferences (passwords are never returned) |
| PUT | `/api/v1/engine/preferences` | Validate, write, and read back qBittorrent preferences |
| GET | `/api/v1/engine/info` | Version, connection/free-space state, speed mode, and sanitized recent logs |
| POST | `/api/v1/engine/alternative-speed-limits/toggle` | Toggle alternative speed limits immediately |
| GET | `/api/v1/torrents` | Current torrent snapshot |
| POST | `/api/v1/torrents` | Submit `{magnet,category,retention,mode}` |
| GET | `/api/v1/torrents/:id` | Torrent details |
| POST | `/api/v1/torrents/:id/pause` | Pause |
| POST | `/api/v1/torrents/:id/resume` | Resume |
| POST | `/api/v1/torrents/:id/retry` | Retry |
| POST | `/api/v1/torrents/:id/recheck` | Ask qBittorrent to recheck data |
| POST | `/api/v1/torrents/:id/reannounce` | Reannounce to configured trackers |
| POST | `/api/v1/torrents/:id/queue-up` | Raise queue position |
| POST | `/api/v1/torrents/:id/queue-down` | Lower queue position |
| POST | `/api/v1/torrents/:id/queue-top` | Move to the top of the queue |
| POST | `/api/v1/torrents/:id/queue-bottom` | Move to the bottom of the queue |
| POST | `/api/v1/torrents/:id/files/priority` | Set `{ids,priority}` |
| POST | `/api/v1/torrents/:id/limits` | Set byte/sec `{download,upload}` limits |
| PATCH | `/api/v1/torrents/:id/classification` | Confirm or correct category/title/episode data |
| PATCH | `/api/v1/torrents/:id/retention` | Change `{retention}`; cleanup can be applied to an already organized torrent |
| DELETE | `/api/v1/torrents/:id` | Remove from qBittorrent and Harbor; optional `{deleteFiles:true}` deletes only guarded staging data, never organized media |
| WS | `/api/v1/events` | Snapshot and update messages |

Duplicate info hashes return `409` with the existing torrent. Errors use `{ "error": "human-readable message" }`.

After verified organization, torrent records contain `organizedPath` and, when installed through Compose, `organizedHostPath`. The latter is the exact Unraid host location displayed by Harbor.
