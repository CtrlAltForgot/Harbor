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

say "Downloading the latest stable Harbor release"
git fetch --force origin 'refs/tags/v*:refs/tags/v*'
target_version="${HARBOR_VERSION:-$(git tag --list 'v[0-9]*' --sort=-version:refname | head -n 1)}"
[[ -n "$target_version" ]] || fail "No Harbor release tags were found."
git rev-parse --verify --quiet "refs/tags/$target_version^{commit}" >/dev/null || fail "Harbor release $target_version was not found."
git diff --quiet && git diff --cached --quiet || fail "This checkout has local changes. Preserve or discard them before updating."
git checkout --detach "$target_version"

# A pull can replace this script while the old process is still executing it.
# Restart once so migrations and prompts always come from the newly pulled version.
if [[ "${HARBOR_UPDATE_REEXEC:-0}" != 1 ]]; then
  export HARBOR_UPDATE_REEXEC=1
  exec "$0" "$@"
fi

if ! grep -q '^PIA_VPN_USERNAME=' .env || ! grep -q '^PIA_VPN_PASSWORD=' .env || ! grep -q '^LAN_NETWORK=' .env || grep -q '^PIA_OPENVPN_REGION=us_chicago$' .env; then
  say "This update migrates qBittorrent into PIA's VPN kill-switch container"
  exec ./scripts/install-unraid.sh
fi

say "Updating the PIA-protected qBittorrent container and rebuilding Harbor"
docker compose pull qbittorrent
docker compose up -d --force-recreate qbittorrent
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
  "Harbor release:   $target_version" \
  "Harbor companion: http://YOUR-UNRAID-IP:$harbor_port" \
  "Existing pairing tokens, settings, history, qBittorrent state, and downloaded files were preserved." \
  "qBittorrent traffic is protected by the PIA VPN container's kill switch."
