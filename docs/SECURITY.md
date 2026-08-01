# Security

Harbor defaults to LAN use and should never be port-forwarded. Set a unique `HARBOR_PAIRING_CODE`; treat the resulting bearer token like a password. Tokens are generated from 192 bits of OS randomness and stored only as SHA-256 digests in SQLite. API logs redact authorization and uploaded torrent bodies.

Current homelab limitations: HTTP transport relies on a trusted private network, pairing codes do not expire, browser/Tauri web storage holds the Harbor token, and there is no rate limiter or token-revocation UI. Do not expose Harbor outside the LAN. A trusted LAN reverse proxy may add TLS if desired.

Report security issues privately. Diagnostic exports must omit tokens, pairing codes, provider keys, cookies, tracker credentials, and raw torrent metadata.
