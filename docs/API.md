# Companion API v1

Base URL: `http://SERVER:7331`. All `/api/v1/*` routes except pairing require `Authorization: Bearer TOKEN`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v1/pair` | Exchange `{code,label}` for a token |
| GET | `/api/v1/status` | Server/engine state and aggregate speeds |
| GET | `/api/v1/settings` | Media destinations and metadata-provider state (never secrets) |
| GET | `/api/v1/settings/directories` | List folders inside the mounted media root |
| PUT | `/api/v1/settings` | Validate and save folder/provider settings |
| GET | `/api/v1/torrents` | Current torrent snapshot |
| POST | `/api/v1/torrents` | Submit `{magnet,category,retention,mode}` |
| GET | `/api/v1/torrents/:id` | Torrent details |
| POST | `/api/v1/torrents/:id/pause` | Pause |
| POST | `/api/v1/torrents/:id/resume` | Resume |
| POST | `/api/v1/torrents/:id/retry` | Retry |
| POST | `/api/v1/torrents/:id/recheck` | Ask qBittorrent to recheck data |
| POST | `/api/v1/torrents/:id/files/priority` | Set `{ids,priority}` |
| POST | `/api/v1/torrents/:id/limits` | Set byte/sec `{download,upload}` limits |
| PATCH | `/api/v1/torrents/:id/classification` | Confirm or correct category/title/episode data |
| DELETE | `/api/v1/torrents/:id` | Remove queue record; never deletes data in this version |
| WS | `/api/v1/events` | Snapshot and update messages |

Duplicate info hashes return `409` with the existing torrent. Errors use `{ "error": "human-readable message" }`.

After verified organization, torrent records contain `organizedPath`, the exact final filesystem location displayed by Harbor.
