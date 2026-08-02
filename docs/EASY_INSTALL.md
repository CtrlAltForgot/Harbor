# Easy installation: Unraid + Nobara

This installs a dedicated qBittorrent on Unraid. It does not touch qBittorrent on your PC.

## What the installer does

The Unraid installer asks for three folders and two optional ports, then automatically:

- creates persistent appdata/download folders and mounts your existing media share once;
- generates a Harbor pairing code and qBittorrent password;
- starts the LinuxServer qBittorrent container;
- captures qBittorrent's temporary first-boot password without displaying it;
- replaces it with the generated permanent password;
- builds and starts Harbor;
- checks Harbor's HTTP health endpoint;
- saves the generated addresses and credentials to a root-readable `INSTALLATION.txt` file;
- preserves the same credentials when safely rerun for an update.

## Before you begin

You need:

- an Unraid server with Docker enabled;
- Docker Compose v2 (the Unraid Compose Manager plugin provides it);
- `curl`, `openssl`, and preferably `git` on Unraid;
- a Nobara desktop with `sudo` access;
- the host path of your existing media share, commonly `/mnt/user/media`.

Harbor creates a dedicated qBittorrent on Unraid. Your existing PC qBittorrent is not changed.

## Step 1: download Harbor on Unraid

Open **Unraid → Terminal** and clone the GitHub repository into persistent appdata:

```bash
git clone --depth 1 https://github.com/CtrlAltForgot/Harbor.git /mnt/user/appdata/harbor-source
cd /mnt/user/appdata/harbor-source
```

If the `git` command is unavailable, use the GitHub archive instead:

```bash
mkdir -p /mnt/user/appdata/harbor-source
curl -fsSL https://github.com/CtrlAltForgot/Harbor/archive/refs/heads/main.tar.gz \
  | tar -xz --strip-components=1 -C /mnt/user/appdata/harbor-source
cd /mnt/user/appdata/harbor-source
```

Do not install the source under `/tmp`; Unraid clears it during reboot.

## Step 2: run the Unraid installer

From the Harbor source directory, run:

```bash
./scripts/install-unraid.sh
```

Press Enter to accept a default or enter your preferred locations. On standard Unraid installations, PUID `99` and PGID `100` represent `nobody:users` and are the expected defaults.

The installer prints:

- the Harbor web address;
- the Harbor pairing code;
- the dedicated qBittorrent address and generated credentials;
- the path of the saved installation record.

It normally takes a few minutes on the first run while Docker downloads and builds images.

## Step 2a: select your existing library folders

After pairing, open **Settings** in Harbor. Select `/media/Movies`, `/media/TV Shows`, and `/media/Needs Review`, then choose **Save and verify**. These are container views of the Unraid media root selected during installation; Harbor verifies they are writable.

Settings also displays the corresponding Unraid host root, for example `/mnt/user/PCFiles → /media`. Confirm that the host root is the parent containing the Movies and TV Shows folders you actually browse over SMB. If it is wrong, rerun `./scripts/install-unraid.sh` and enter the correct media root; changing a container subfolder cannot change the Docker host mount.

For substantially better title identification, paste a TMDB API Read Access Token in the same screen. TMDB is optional and local filename classification still works without it. Ambiguous matches are held for review rather than guessed.

New torrents default to **Organize and clean downloads**. Harbor copies into the selected library, verifies the result, removes the qBittorrent job without deleting the library copy, deletes only that torrent's staging path, and verifies the staging path is gone. Choose **Keep seeding** explicitly when you want the staging data retained.

The add sheet accepts either one magnet or multiple magnet links copied together from another torrent client. Paste the complete newline-separated block; Harbor shows the number of unique torrents detected and applies the selected category and retention rule to each. A duplicate or invalid entry is reported independently and does not cancel the other additions.

Harbor's queue, organized entries, settings, and audit records are stored in SQLite under the persistent Unraid `/config` mapping. Closing the desktop or restarting the Harbor container does not clear these entries. Deliberately choosing **Remove torrent** deletes that torrent from both qBittorrent and Harbor, so its magnet may be added again later. Updating to release 10 automatically purges records created by the short-lived archived-removal behavior.

Removing a torrent opens a confirmation screen with **Also delete original downloaded files** disabled by default. When enabled, Harbor permits deletion only for the torrent path inside its configured incomplete-download directory. A verified organized Movies/TV library copy is outside that boundary and is never deleted by this action. With or without the checkbox, the removed torrent is no longer retained in Harbor's list.

For television, separate downloads are consolidated as `TV Shows/Show Name/Season NN/Show Name - SnnEnn.ext`. Existing show and season folders are reused, new episodes are merged only after collision checks, and Harbor never overwrites an existing episode. Season-pack names such as `The First 48 - Season 3`, `Season 5`, and `Season 6` normalize to the same `The First 48` show directory.

The downloads list defaults to **Newest added**, which is stable: progress and status refreshes never move existing rows. The sort selector also supports oldest added, name, progress, and status, and remembers the chosen order on that desktop.

You can drag one `.torrent` file anywhere over the Harbor Desktop window. Harbor validates the file, opens the normal Add Torrent confirmation sheet, and does not start it until you confirm the category and cleanup policy.

Closing Harbor Desktop hides it in the system tray by default. Use **Open Harbor** or **Quit Harbor** from the tray menu. With desktop notifications enabled in Settings, Harbor notifies on organization or Needs Review transitions while it is running in the tray. The desktop is only a remote control: downloads, identification, and organization continue on Unraid even when the desktop application is fully quit.

The **qBittorrent settings** area uses a category list on the left and live engine settings on the right. Download behavior, connection port/limits, global and alternative speeds, queueing, DHT/PeX/LSD, encryption, and anonymous mode are written to qBittorrent and read back before Harbor reports success. Container download paths are intentionally read-only because changing them outside Harbor could bypass organization and deletion safeguards.

## Step 3: install Harbor Desktop on Nobara

Open a terminal on the Nobara PC. Download Harbor and run the desktop installer:

```bash
git clone --depth 1 https://github.com/CtrlAltForgot/Harbor.git ~/Harbor
cd ~/Harbor
./scripts/install-desktop.sh
```

If you already cloned Harbor elsewhere, use that directory instead. The script installs the included RPM using `dnf`, and Harbor then appears in the application menu. The included RPM SHA-256 is:

```text
b8a874ef61a81200230e75d56c13a1554513047ad94c02fc54380518d3b6392e
```

## Step 4: pair

1. Open Harbor Desktop.
2. Enter `http://YOUR-UNRAID-IP:7331` unless you chose another port.
3. Enter the pairing code printed by the Unraid installer.
4. Harbor should show **qBittorrent engine · Online** with no storage warning.

If the pairing code or Unraid address changes later, open the gear button, use **Connection & pairing**, enter the current code, and select **Pair and reconnect**. This panel remains available even when the old credential has already been rejected. **Forget server** returns Harbor to the first-run pairing screen.

You can also use the same interface at `http://YOUR-UNRAID-IP:7331` in a browser.

## Updating

For a Git installation on Unraid:

```bash
cd /mnt/user/appdata/harbor-source
git pull --ff-only
./scripts/install-unraid.sh
```

Accept the same answers. The installer preserves the generated qBittorrent password and Harbor pairing code, rebuilds Harbor, and leaves the persistent queue/configuration in appdata.

For a Git installation on Nobara:

```bash
cd ~/Harbor
git pull --ff-only
./scripts/install-desktop.sh
```

Archive-based installs can be updated by downloading the current archive into a new source folder and rerunning the installer. Never overwrite or publish the generated `.env` file.

## Useful commands

From the Harbor source directory on Unraid:

```bash
docker compose ps
docker compose logs --tail 100 harbor
docker compose logs --tail 100 qbittorrent
docker compose restart harbor
docker compose stop
docker compose up -d
```

The `.env` file and `INSTALLATION.txt` contain credentials. Do not post them in screenshots or logs.

## Uninstalling

Stop and remove the containers without deleting downloads or appdata:

```bash
docker compose down
```

The installer never deletes media, downloads, or appdata. Remove those folders manually only if you deliberately want to erase Harbor and qBittorrent state.
