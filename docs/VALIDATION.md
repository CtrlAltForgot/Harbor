# End-to-end validation

## 2026-08-01 — Creative Commons Sintel

Harbor was tested against the real LinuxServer qBittorrent 5.2.3 container using WebTorrent's official Creative Commons `sintel.torrent`.

Validated sequence:

1. Harbor and qBittorrent started through the production Compose topology.
2. Storage preflight passed all incomplete and category mounts.
3. The 20.3 KiB `.torrent` was uploaded through Harbor's authenticated API.
4. qBittorrent downloaded 129,302,391 bytes across 11 files from real peers.
5. Harbor synchronized progress, two peers, completion, and the complete file list.
6. Harbor classified the manually selected movie, copied it to `/media/movies/Sintel`, verified the recursive byte count, and atomically published the destination.
7. The source and organized trees were independently measured at exactly 129,302,391 bytes each.
8. Source and organized `Sintel.mp4` files shared SHA-256 `1dc6f2ca9762dfcc7d1b1843129a3e4f351d1fe935dea2241c7b359c11ebc1d8`.
9. Nine subtitle files and `poster.jpg` were present with identical sizes in both trees.
10. The `remove torrent, keep files` retention policy removed qBittorrent metadata while retaining both file trees.
11. Harbor was restarted; the organized status persisted and no duplicate destination appeared.
12. Test records and both generated data copies were removed after verification.

This proves the containerized download/organization path. Unraid-specific host paths, ownership, free space, cache pools, and mover configuration remain environmental inputs and are checked by Harbor at runtime.
