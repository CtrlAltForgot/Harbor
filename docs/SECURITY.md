# Security

Harbor defaults to LAN use and should never be port-forwarded. Set a unique `HARBOR_PAIRING_CODE`; treat the resulting bearer token like a password. Tokens are generated from 192 bits of OS randomness and stored only as SHA-256 digests in SQLite. API logs redact authorization and uploaded torrent bodies.

Current MVP limitations: HTTP transport relies on a trusted private network, pairing codes do not yet expire, browser storage is used by the web development shell, and there is no rate limiter. Before production, use TLS via a LAN reverse proxy; the Tauri client will store credentials in the OS keyring, pairing will become time-limited, and token revocation/rate limits will be added.

Report security issues privately. Diagnostic exports must omit tokens, pairing codes, provider keys, cookies, tracker credentials, and raw torrent metadata.
