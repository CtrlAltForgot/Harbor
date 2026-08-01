# Unraid first-test installation

Harbor can control your existing qBittorrent container, which is the simplest setup. The bundled Compose service is useful for local development, but qBittorrent's LinuxServer image generates a temporary password on first boot; set a permanent Web UI password before connecting Harbor.

## 1. Prepare qBittorrent

In qBittorrent's Web UI:

1. Set a non-default username and strong password under Web UI authentication.
2. Confirm the Web UI is reachable from another container or at your Unraid LAN address.
3. Keep authentication enabled. Do not enable subnet authentication bypass for Harbor.
4. Note the container-visible download path. Harbor and qBittorrent must see incomplete data at the same internal path, normally `/downloads/incomplete`.

## 2. Create Harbor appdata and test folders

Create a persistent appdata directory and temporary first-test category folders. Assign them to the same PUID/PGID used by qBittorrent. Example host paths:

```text
/mnt/user/appdata/harbor
/mnt/user/downloads/incomplete
/mnt/user/harbor-test/movies
/mnt/user/harbor-test/tv
/mnt/user/harbor-test/general
/mnt/user/harbor-test/review
```

Harbor's download and organizer have passed a genuine Creative Commons torrent test. Using temporary folders for the first Unraid run is still recommended solely to confirm your share ownership and cache/mover configuration, not to validate Harbor's basic download path.

## 3. Configure Harbor

Required environment variables:

| Variable | Example |
|---|---|
| `HARBOR_PAIRING_CODE` | a long random first-pairing secret |
| `HARBOR_ENGINE` | `qbittorrent` |
| `QBITTORRENT_URL` | `http://192.168.1.10:8080` or Docker DNS name |
| `QBITTORRENT_USERNAME` | your qBittorrent Web UI user |
| `QBITTORRENT_PASSWORD` | your permanent qBittorrent Web UI password |
| `HARBOR_INCOMPLETE_DIR` | `/downloads/incomplete` |

Map these container paths to explicit Unraid host paths:

```text
/config
/downloads/incomplete
/downloads/complete
/media/movies
/media/tv
/media/games
/media/music
/media/software
/media/books
/media/general
/media/review
```

The container runs as PUID/PGID 1000 in Compose by default. Set `PUID` and `PGID` to the owner of your Unraid shares. Harbor reports every missing or unwritable mapping in its status response and desktop banner.

Until an image is published, build on the server with `docker compose build harbor`, or transfer the locally built image. The draft XML template cannot pull from its placeholder repository yet.

## 4. Cache, mover, and filesystem rules

- Do not let the mover relocate incomplete files while qBittorrent is writing them.
- Harbor currently uses a verified copy and atomic final rename, preserving the staging source. This is safe across shares but temporarily requires space for both copies.
- Harbor refuses existing destinations instead of overwriting them.
- Retention is applied only after the destination's byte count is verified.
- A future hardlink optimization is optional; the current first-test path does not assume hardlink support.

## 5. First test

1. Open `http://UNRAID-IP:7331/health`; expect `{"ok":true,...}`.
2. Open `http://UNRAID-IP:7331` or Harbor Desktop and pair using your code.
3. Confirm the interface reports qBittorrent online and no storage issues.
4. Add one small lawful/public-domain torrent and manually choose General or Movie.
5. Pause and resume it once.
6. Restart Harbor while it downloads and confirm the row returns.
7. After completion, verify the source remains in staging and the test-library copy is readable.
8. If Harbor requests review, correct the title/category and confirm organization.

If anything fails, stop after that one test and return the Harbor and qBittorrent logs with passwords/tokens removed.
