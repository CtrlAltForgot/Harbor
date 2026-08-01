# Troubleshooting

- Pairing fails: confirm the server URL, port 7331, and exact `HARBOR_PAIRING_CODE`. Check the companion log without sharing credentials.
- UI shows disconnected: open `/health` on the server from the desktop. Harbor retries automatically.
- State disappeared: ensure `/config` is mapped persistently and writable by the configured UID/GID.
- Database is locked: run only one companion against a given `/config` directory.
- A torrent is in Needs Review: this is intentional when local classification confidence is below 60%; no destructive organization occurs.
