#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$script_dir/.." && pwd)"
cd "$repo_dir"

fail(){ printf 'Harbor desktop install failed: %s\n' "$*" >&2; exit 1; }
desktop_version="$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$repo_dir/apps/desktop/src-tauri/tauri.conf.json" | head -n 1)"
rpm_release="$(sed -n 's/.*"release": "\([^"]*\)".*/\1/p' "$repo_dir/apps/desktop/src-tauri/tauri.conf.json" | head -n 1)"
rpm_path="$repo_dir/release/Harbor-$desktop_version-$rpm_release.x86_64.rpm"
if [[ -n "$rpm_path" && -f "$rpm_path" ]]; then
  printf 'Using the included Harbor Desktop RPM.\n'
else
  command -v npm >/dev/null || fail "No prebuilt RPM was found; Node.js 22+ and npm are required to build from source."
  command -v cargo >/dev/null || fail "No prebuilt RPM was found; Rust/Cargo is required to build from source."
  printf 'Building Harbor Desktop for Nobara...\n'
  npm install
  npm run build -w @harbor/desktop
  rpm_path="$(find "$repo_dir/apps/desktop/src-tauri/target/release/bundle/rpm" -maxdepth 1 -type f -name 'Harbor-*.x86_64.rpm' -print -quit)"
  [[ -n "$rpm_path" && -f "$rpm_path" ]] || fail "The desktop build did not produce an x86_64 RPM."
fi

if [[ "${HARBOR_BUILD_ONLY:-0}" == 1 ]]; then printf 'RPM ready: %s\n' "$rpm_path"; exit 0; fi
command -v sudo >/dev/null || fail "sudo is required to install the RPM. Build succeeded at $rpm_path"
sudo dnf install -y "$rpm_path"
if command -v gio >/dev/null; then
  gio mime x-scheme-handler/magnet Harbor.desktop
  gio mime application/x-bittorrent Harbor.desktop
elif command -v xdg-mime >/dev/null; then
  xdg-mime default Harbor.desktop x-scheme-handler/magnet
  xdg-mime default Harbor.desktop application/x-bittorrent
fi
printf '\nHarbor Desktop is installed and registered for magnet links and .torrent files.\n'
