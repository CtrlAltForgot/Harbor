# Troubleshooting

## Desktop flashes blank and immediately closes on Nobara

Update to RPM release `0.1.0-2` or newer. Release 2 automatically uses WebKitGTK's compatible renderer on Wayland and fixes the observed `Error 71 (Protocol error) dispatching to Wayland display` crash.

```bash
cd ~/Harbor
git pull --ff-only
./scripts/install-desktop.sh
```

If it still closes, collect the relevant log without sharing credentials:

```bash
journalctl --user --since "10 minutes ago" --no-pager | grep -i harbor
```

## Pairing reports “Load failed”

Update to RPM release `0.1.0-3` or newer. Release 3 uses Harbor's native desktop network transport instead of WebKit for companion API calls.

Verify the server independently from the desktop PC:

```bash
curl http://YOUR-UNRAID-IP:7331/health
```

The expected response is `{"ok":true,"service":"Harbor Companion"}`. If that works, reopen the updated desktop application and pair again. Harbor now reports an invalid code separately from an unreachable address, closed port, timeout, or malformed response.

## “Organized” points at the wrong media share

Open Settings and check the displayed `Unraid host path → /media` mapping. If the host path is not the parent of the Movies and TV Shows folders you browse over SMB, rerun the Unraid installer and enter the correct media root. Then use **Re-organize & clean staging** on the completed row. Harbor copies from the still-present download into the corrected library, verifies it, and only then removes the qBittorrent job and staging folder.

## “A valid Harbor pairing token is required”

The Unraid pairing code changed after this desktop was paired. Select **Attention needed** or the gear button, open **Connection & pairing**, enter the current server address and pairing code, then select **Pair and reconnect**. The connection panel deliberately remains usable while authenticated settings are unavailable. If needed, **Forget server** clears only the desktop credential and returns to first-run pairing; it does not alter torrents or server data.

## Harbor and qBittorrent show different active torrents

Update both the Unraid companion and desktop to release 10 or newer. qBittorrent is authoritative for live state: Harbor confirms a submitted info hash appears before recording it, confirms pause/resume/removal, and marks a previously live but missing qBittorrent job as **Attention** with zero speed. Organized history remains visible when qBittorrent was intentionally removed by the retention workflow; manually removed Harbor records do not remain visible.

- Pairing fails: confirm the server URL, port 7331, and exact `HARBOR_PAIRING_CODE`. Check the companion log without sharing credentials.
- UI shows disconnected: open `/health` on the server from the desktop. Harbor retries automatically.
- State disappeared: ensure `/config` is mapped persistently and writable by the configured UID/GID.
- Database is locked: run only one companion against a given `/config` directory.
- A torrent is in Needs Review: this is intentional when local classification confidence is below 60%; no destructive organization occurs.
