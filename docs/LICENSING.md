# Licensing and torrent engine review

Harbor's original code is released under the permissive MIT License. It may be used, modified, bundled, sublicensed, and redistributed, including commercially, provided the copyright and license notice remain. The warranty disclaimer also remains.

qBittorrent is GPL-2.0-or-later. Its source may be studied, modified, and redistributed under the GPL with corresponding source and notices. Harbor plans to run an unmodified qBittorrent process/container and communicate over its documented HTTP API rather than copy or link its code. qBittorrent is distributed separately in Compose, preserving a clear process boundary. Distributors must still satisfy qBittorrent's GPL obligations for the qBittorrent image itself.

libtorrent-rasterbar is BSD-3-Clause and permits modification, redistribution, and binary bundling with copyright/license/disclaimer preservation. It offers tighter embedding but increases native build, lifecycle, and protocol-state responsibility. Transmission is GPL-2.0-or-later and also offers RPC. qBittorrent was selected because it is mature, familiar to the target user, exposes the needed controls, persists session state, and is well supported in containers.

Exact dependency versions and license notices will be generated into the release SBOM before distribution. This is an engineering summary, not legal advice.

The desktop uses Tauri and its official notification and JavaScript API packages under their MIT/Apache-2.0 licensing. React and Lucide are MIT licensed. These dependencies permit bundling and redistribution with their notices preserved.
