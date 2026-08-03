#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$script_dir/.." && pwd)"
cd "$repo_dir"

say() { printf '\n\033[1;36mHarbor:\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31mHarbor update failed:\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null || fail "Git is required."
command -v docker >/dev/null || fail "Docker is required. Run this from an Unraid terminal."
command -v curl >/dev/null || fail "curl is required for the health check."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required."
[[ -f .env ]] || fail "No Harbor .env was found here. Run ./scripts/install-unraid.sh for the first installation."

say "Downloading the latest Harbor source"
git pull --ff-only

if ! grep -q '^PIA_VPN_USERNAME=' .env || ! grep -q '^PIA_VPN_PASSWORD=' .env || ! grep -q '^LAN_NETWORK=' .env; then
  say "This update migrates qBittorrent into PIA's VPN kill-switch container"
  exec ./scripts/install-unraid.sh
fi

say "Updating the PIA-protected qBittorrent container and rebuilding Harbor"
docker compose pull qbittorrent
docker compose up -d --build harbor

harbor_port="$(sed -n 's/^HARBOR_HOST_PORT=//p' .env | tail -n 1)"
harbor_port="${harbor_port:-7331}"
ready=0
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:$harbor_port/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[[ "$ready" == 1 ]] || fail "The updated companion did not become healthy. Run: docker compose logs harbor"

say "Update complete"
printf '%s\n' \
  "Harbor companion: http://YOUR-UNRAID-IP:$harbor_port" \
  "Existing pairing tokens, settings, history, qBittorrent state, and downloaded files were preserved." \
  "qBittorrent traffic is protected by the PIA VPN container's kill switch."
