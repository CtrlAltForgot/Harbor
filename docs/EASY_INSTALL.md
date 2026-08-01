# Easy installation: Unraid + Nobara

This installs a dedicated qBittorrent on Unraid. It does not touch qBittorrent on your PC.

## What the installer does

The Unraid installer asks for three folders and two optional ports, then automatically:

- creates persistent appdata, download, and category folders;
- generates a Harbor pairing code and qBittorrent password;
- starts the LinuxServer qBittorrent container;
- captures qBittorrent's temporary first-boot password without displaying it;
- replaces it with the generated permanent password;
- builds and starts Harbor;
- checks Harbor's HTTP health endpoint;
- saves the generated addresses and credentials to a root-readable `INSTALLATION.txt` file;
- preserves the same credentials when safely rerun for an update.

## Step 1: put Harbor on Unraid

Copy this repository to a persistent Unraid folder, for example:

```text
/mnt/user/appdata/harbor-source
```

You can copy it through an SMB share or clone it with Git if Git is installed. Do not keep the source only in `/tmp`; Unraid clears temporary storage on reboot.

## Step 2: run the Unraid installer

Open **Unraid → Terminal**, then run:

```bash
cd /mnt/user/appdata/harbor-source
./scripts/install-unraid.sh
```

Press Enter to accept a default or enter your preferred locations. On standard Unraid installations, PUID `99` and PGID `100` represent `nobody:users` and are the expected defaults.

The installer prints:

- the Harbor web address;
- the Harbor pairing code;
- the dedicated qBittorrent address and generated credentials;
- the path of the saved installation record.

It normally takes a few minutes on the first run while Docker downloads and builds images.

## Step 3: install Harbor Desktop on Nobara

Copy the repository—or just the `release` folder and installer script—to your Nobara PC. From the repository directory run:

```bash
./scripts/install-desktop.sh
```

The script installs the included RPM using `dnf`. Harbor then appears in the application menu. The included RPM SHA-256 is:

```text
1e24e038594d784f76cec76c3f14f9fa677f491bd64846c42674aae180fa6356
```

## Step 4: pair

1. Open Harbor Desktop.
2. Enter `http://YOUR-UNRAID-IP:7331` unless you chose another port.
3. Enter the pairing code printed by the Unraid installer.
4. Harbor should show **qBittorrent engine · Online** with no storage warning.

You can also use the same interface at `http://YOUR-UNRAID-IP:7331` in a browser.

## Updating

Replace/update the source files, then rerun:

```bash
./scripts/install-unraid.sh
```

Accept the same answers. The installer preserves the generated qBittorrent password and Harbor pairing code, rebuilds Harbor, and leaves the persistent queue/configuration in appdata.

On Nobara, rerun `./scripts/install-desktop.sh` after replacing the source or release RPM.

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
