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

For substantially better title identification, paste a TMDB API Read Access Token in the same screen. TMDB is optional and local filename classification still works without it. Ambiguous matches are held for review rather than guessed.

## Step 3: install Harbor Desktop on Nobara

Open a terminal on the Nobara PC. Download Harbor and run the desktop installer:

```bash
git clone --depth 1 https://github.com/CtrlAltForgot/Harbor.git ~/Harbor
cd ~/Harbor
./scripts/install-desktop.sh
```

If you already cloned Harbor elsewhere, use that directory instead. The script installs the included RPM using `dnf`, and Harbor then appears in the application menu. The included RPM SHA-256 is:

```text
0f41fcbaa1e73bf63faa7ce652497346fc6a1574632e0fb1083d9146ee720a3a
```

## Step 4: pair

1. Open Harbor Desktop.
2. Enter `http://YOUR-UNRAID-IP:7331` unless you chose another port.
3. Enter the pairing code printed by the Unraid installer.
4. Harbor should show **qBittorrent engine · Online** with no storage warning.

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
