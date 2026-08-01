#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$script_dir/.." && pwd)"
cd "$repo_dir"

fail(){ printf 'Harbor desktop install failed: %s\n' "$*" >&2; exit 1; }
rpm_path="$repo_dir/release/Harbor-0.1.0-4.x86_64.rpm"
if [[ -f "$rpm_path" ]]; then
  printf 'Using the included Harbor Desktop RPM.\n'
else
  command -v npm >/dev/null || fail "No prebuilt RPM was found; Node.js 22+ and npm are required to build from source."
  command -v cargo >/dev/null || fail "No prebuilt RPM was found; Rust/Cargo is required to build from source."
  printf 'Building Harbor Desktop for Nobara...\n'
  npm install
  npm run build -w @harbor/desktop
  rpm_path="$repo_dir/apps/desktop/src-tauri/target/release/bundle/rpm/Harbor-0.1.0-4.x86_64.rpm"
  [[ -f "$rpm_path" ]] || fail "The RPM build did not produce $rpm_path"
fi

if [[ "${HARBOR_BUILD_ONLY:-0}" == 1 ]]; then printf 'RPM ready: %s\n' "$rpm_path"; exit 0; fi
command -v sudo >/dev/null || fail "sudo is required to install the RPM. Build succeeded at $rpm_path"
sudo dnf install -y "$rpm_path"
printf '\nHarbor Desktop is installed. Launch Harbor from your application menu.\n'
