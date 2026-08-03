#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$script_dir/.." && pwd)"
cd "$repo_dir"
# shellcheck source=scripts/lib/storage-paths.sh
source "$script_dir/lib/storage-paths.sh"

say() { printf '\n\033[1;36mHarbor:\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31mHarbor install failed:\033[0m %s\n' "$*" >&2; exit 1; }
command -v docker >/dev/null || fail "Docker is required. Run this from an Unraid terminal."
docker compose version >/dev/null 2>&1 || fail "Docker Compose is required. Install the Unraid Compose Manager plugin or Docker Compose v2."
command -v curl >/dev/null || fail "curl is required."
command -v openssl >/dev/null || fail "openssl is required to generate local credentials."
command -v unzip >/dev/null || fail "unzip is required to install PIA's OpenVPN profile."

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then default_uid=99; default_gid=100; else default_uid="$(id -u)"; default_gid="$(id -g)"; fi
default_root="${HARBOR_INSTALL_ROOT:-/mnt/user}"
[[ -d /mnt/user ]] || default_root="${HARBOR_INSTALL_ROOT:-$repo_dir/harbor-data}"

appdata_root="${HARBOR_APPDATA_ROOT:-$default_root/appdata/harbor-stack}"
downloads_root="${HARBOR_DOWNLOADS_ROOT:-$default_root/downloads/harbor}"
media_root="${HARBOR_MEDIA_ROOT:-$default_root/media}"
puid="${PUID:-$default_uid}"; pgid="${PGID:-$default_gid}"
harbor_port="${HARBOR_HOST_PORT:-7331}"; qbit_port="${QBITTORRENT_WEBUI_PORT:-8080}"; torrent_port="${TORRENTING_PORT:-6881}"

read_saved_value() {
  local value
  value="$(sed -n "s/^$1=//p" .env | tail -n 1)"
  if [[ "$value" == \'*\' ]]; then value="${value:1:${#value}-2}"; value="${value//\\\'/\'}"; fi
  printf '%s' "$value"
}
dotenv_quote() { local value="${1//\'/\\\'}"; printf "'%s'" "$value"; }
default_lan_network="${LAN_NETWORK:-$(ip -4 route show 2>/dev/null | awk '$1 ~ /\// && $0 ~ / dev (br0|bond0|eth0)( |$)/ { print $1; exit }')}"
default_lan_network="${default_lan_network:-192.168.1.0/24}"
pia_username="${PIA_VPN_USERNAME:-}"
pia_password="${PIA_VPN_PASSWORD:-}"
pia_region="${PIA_OPENVPN_REGION:-ca_toronto}"
lan_network="$default_lan_network"
if [[ -f .env ]]; then
  saved_config_path="$(read_saved_value HARBOR_CONFIG_PATH)"
  saved_downloads_root="$(read_saved_value DOWNLOADS_ROOT)"
  saved_media_root="$(read_saved_value MEDIA_ROOT_PATH)"
  saved_puid="$(read_saved_value PUID)"; saved_pgid="$(read_saved_value PGID)"
  saved_harbor_port="$(read_saved_value HARBOR_HOST_PORT)"; saved_qbit_port="$(read_saved_value QBITTORRENT_WEBUI_PORT)"
  saved_pia_username="$(read_saved_value PIA_VPN_USERNAME)"; saved_pia_password="$(read_saved_value PIA_VPN_PASSWORD)"
  saved_pia_region="$(read_saved_value PIA_OPENVPN_REGION)"; saved_lan_network="$(read_saved_value LAN_NETWORK)"
  [[ -n "$saved_config_path" && -z "${HARBOR_APPDATA_ROOT+x}" ]] && appdata_root="$(dirname -- "$saved_config_path")"
  [[ -n "$saved_downloads_root" && -z "${HARBOR_DOWNLOADS_ROOT+x}" ]] && downloads_root="$saved_downloads_root"
  [[ -n "$saved_media_root" && -z "${HARBOR_MEDIA_ROOT+x}" ]] && media_root="$saved_media_root"
  [[ -n "$saved_puid" && -z "${PUID+x}" ]] && puid="$saved_puid"
  [[ -n "$saved_pgid" && -z "${PGID+x}" ]] && pgid="$saved_pgid"
  [[ -n "$saved_harbor_port" && -z "${HARBOR_HOST_PORT+x}" ]] && harbor_port="$saved_harbor_port"
  [[ -n "$saved_qbit_port" && -z "${QBITTORRENT_WEBUI_PORT+x}" ]] && qbit_port="$saved_qbit_port"
  [[ -n "$saved_pia_username" && -z "${PIA_VPN_USERNAME+x}" ]] && pia_username="$saved_pia_username"
  [[ -n "$saved_pia_password" && -z "${PIA_VPN_PASSWORD+x}" ]] && pia_password="$saved_pia_password"
  [[ -n "$saved_pia_region" && -z "${PIA_OPENVPN_REGION+x}" ]] && pia_region="$saved_pia_region"
  [[ -n "$saved_lan_network" && -z "${LAN_NETWORK+x}" ]] && lan_network="$saved_lan_network"
fi

if [[ "${HARBOR_NONINTERACTIVE:-0}" != 1 ]]; then
  say "This installs a dedicated qBittorrent and Harbor stack on Unraid. Your PC qBittorrent is untouched."
  printf 'Appdata folder [%s]: ' "$appdata_root"; read -r answer; appdata_root="${answer:-$appdata_root}"
  printf 'Download folder [%s]: ' "$downloads_root"; read -r answer; downloads_root="${answer:-$downloads_root}"
  printf 'Media root (Movies/TV/etc. live below it) [%s]: ' "$media_root"; read -r answer; media_root="${answer:-$media_root}"
  printf 'Unraid PUID [%s]: ' "$puid"; read -r answer; puid="${answer:-$puid}"
  printf 'Unraid PGID [%s]: ' "$pgid"; read -r answer; pgid="${answer:-$pgid}"
  printf 'Harbor port [%s]: ' "$harbor_port"; read -r answer; harbor_port="${answer:-$harbor_port}"
  printf 'qBittorrent Web UI port [%s]: ' "$qbit_port"; read -r answer; qbit_port="${answer:-$qbit_port}"
  printf 'PIA VPN username%s: ' "${pia_username:+ [$pia_username]}"; read -r answer; pia_username="${answer:-$pia_username}"
  if [[ -n "$pia_password" ]]; then
    printf 'PIA VPN password [press Enter to keep saved password]: '
  else
    printf 'PIA VPN password: '
  fi
  read -rs answer; printf '\n'; pia_password="${answer:-$pia_password}"
  printf 'PIA OpenVPN region [%s]: ' "$pia_region"; read -r answer; pia_region="${answer:-$pia_region}"
  printf 'Unraid LAN network in CIDR form [%s]: ' "$lan_network"; read -r answer; lan_network="${answer:-$lan_network}"
fi

for value in "$puid" "$pgid" "$harbor_port" "$qbit_port" "$torrent_port"; do [[ "$value" =~ ^[0-9]+$ ]] || fail "UID, GID, and ports must be numbers."; done
[[ "$harbor_port" != "$qbit_port" ]] || fail "Harbor and qBittorrent must use different ports."
[[ -n "$pia_username" && -n "$pia_password" ]] || fail "PIA VPN username and password are required."
[[ "$pia_region" =~ ^[A-Za-z0-9_-]+$ ]] || fail "PIA region may contain only letters, numbers, underscores, and hyphens."
[[ "$lan_network" =~ ^[0-9.]+/[0-9]{1,2}$ ]] || fail "LAN network must use IPv4 CIDR notation, for example 192.168.1.0/24."

resolved_media_root=""
if resolved_media_root="$(resolve_existing_directory_case_insensitive "$media_root")"; then
  if [[ "$resolved_media_root" != "$media_root" ]]; then
    say "Using existing media root $resolved_media_root (matched the entered path without regard to capitalization)."
  fi
  media_root="$resolved_media_root"
else
  path_status=$?
  if [[ "$path_status" == 2 ]]; then
    fail "Multiple folders differ only by capitalization near $media_root. Merge the duplicate Unraid shares before installing Harbor."
  fi
  fail "Media root $media_root does not exist. Harbor will not create a new Unraid share; create or select the existing media root and rerun setup."
fi

previous_qbit_password=""
previous_pairing_code=""
if [[ -f .env ]]; then previous_qbit_password="$(read_saved_value QBITTORRENT_PASSWORD)"; previous_pairing_code="$(read_saved_value HARBOR_PAIRING_CODE)"; fi
pairing_code="${HARBOR_PAIRING_CODE:-${previous_pairing_code:-$(openssl rand -hex 16)}}"
qbit_password="${QBITTORRENT_PASSWORD:-${previous_qbit_password:-$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)}}"
timezone="${TZ:-America/Chicago}"

movies_name="Movies"; tv_name="TV Shows"; review_name="Needs Review"
[[ -d "$media_root/movies" && ! -d "$media_root/Movies" ]] && movies_name="movies"
[[ -d "$media_root/tv" && ! -d "$media_root/TV Shows" ]] && tv_name="tv"
[[ -d "$media_root/review" && ! -d "$media_root/Needs Review" ]] && review_name="review"

paths=(
  "$appdata_root/harbor" "$appdata_root/qbittorrent"
  "$downloads_root/incomplete" "$downloads_root/complete"
  "$media_root/$movies_name" "$media_root/$tv_name" "$media_root/Games" "$media_root/Music"
  "$media_root/Software" "$media_root/Books" "$media_root/General" "$media_root/$review_name"
)
say "Creating persistent folders"
for storage_path in "${paths[@]}"; do
  if [[ ! -d "$storage_path" ]]; then
    mkdir -p "$storage_path"
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then chown "$puid:$pgid" "$storage_path"; fi
  fi
done

umask 077
cat > .env <<EOF
HARBOR_PAIRING_CODE=$pairing_code
HARBOR_HOST_PORT=$harbor_port
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=$qbit_password
QBITTORRENT_WEBUI_PORT=$qbit_port
TORRENTING_PORT=$torrent_port
PIA_VPN_USERNAME=$(dotenv_quote "$pia_username")
PIA_VPN_PASSWORD=$(dotenv_quote "$pia_password")
PIA_OPENVPN_REGION=$pia_region
LAN_NETWORK=$lan_network
PUID=$puid
PGID=$pgid
TZ=$timezone
HARBOR_CONFIG_PATH=$appdata_root/harbor
QBITTORRENT_CONFIG_PATH=$appdata_root/qbittorrent
DOWNLOADS_ROOT=$downloads_root
INCOMPLETE_PATH=$downloads_root/incomplete
COMPLETE_PATH=$downloads_root/complete
MEDIA_ROOT_PATH=$media_root
HARBOR_MOVIES_DIR=/media/$movies_name
HARBOR_TV_DIR=/media/$tv_name
HARBOR_REVIEW_DIR=/media/$review_name
EOF

say "Installing the PIA OpenVPN profile for $pia_region"
vpn_tmp_dir="$(mktemp -d)"
if ! curl --fail --location --silent --show-error \
  --output "$vpn_tmp_dir/openvpn.zip" \
  https://www.privateinternetaccess.com/openvpn/openvpn.zip; then
  rm -rf -- "$vpn_tmp_dir"
  fail "PIA's OpenVPN profiles could not be downloaded."
fi
unzip -q "$vpn_tmp_dir/openvpn.zip" -d "$vpn_tmp_dir/profiles"
profile_path="$vpn_tmp_dir/profiles/$pia_region.ovpn"
[[ -f "$profile_path" ]] || { rm -rf -- "$vpn_tmp_dir"; fail "PIA region '$pia_region' was not found in the OpenVPN profile bundle."; }
mkdir -p "$appdata_root/qbittorrent/openvpn"
find "$appdata_root/qbittorrent/openvpn" -maxdepth 1 -type f \( -name '*.ovpn' -o -name '*.crt' -o -name '*.pem' \) -delete
cp "$profile_path" "$appdata_root/qbittorrent/openvpn/"
find "$vpn_tmp_dir/profiles" -maxdepth 1 -type f \( -name '*.crt' -o -name '*.pem' \) -exec cp {} "$appdata_root/qbittorrent/openvpn/" \;
rm -rf -- "$vpn_tmp_dir"
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then chown -R "$puid:$pgid" "$appdata_root/qbittorrent/openvpn"; fi

say "Starting qBittorrent inside the PIA VPN kill-switch container"
docker compose up -d qbittorrent
temporary_password=""
login_password=""
cookie_file="$(mktemp)"; trap 'rm -f "$cookie_file"' EXIT
qbit_origin="http://127.0.0.1:$qbit_port"
for _ in {1..60}; do
  : > "$cookie_file"
  login_status="$(curl -sS -o /dev/null -w '%{http_code}' -c "$cookie_file" -H "Referer: $qbit_origin" --data-urlencode 'username=admin' --data-urlencode "password=$qbit_password" "$qbit_origin/api/v2/auth/login" 2>/dev/null || true)"
  if [[ "$login_status" == 200 || "$login_status" == 204 ]] && grep -q 'SID' "$cookie_file"; then login_password="$qbit_password"; break; fi
  temporary_password="$(docker compose logs --no-color qbittorrent 2>/dev/null | sed -n 's/.*temporary password is provided for this session: //p' | tail -n 1)"
  if [[ -z "$temporary_password" && -f "$appdata_root/qbittorrent/supervisord.log" ]]; then
    temporary_password="$(sed -n 's/.*temporary password is provided for this session: //p' "$appdata_root/qbittorrent/supervisord.log" | tail -n 1)"
  fi
  if [[ -n "$temporary_password" ]]; then login_password="$temporary_password"; break; fi
  sleep 2
done
[[ -n "$login_password" ]] || fail "Could not obtain or reuse qBittorrent credentials. Run: docker compose logs qbittorrent"

login_status="$(curl -sS -o /dev/null -w '%{http_code}' -c "$cookie_file" -H "Referer: $qbit_origin" --data-urlencode 'username=admin' --data-urlencode "password=$login_password" "$qbit_origin/api/v2/auth/login")"
if [[ "$login_status" != 200 && "$login_status" != 204 ]] || ! grep -q 'SID' "$cookie_file"; then fail "Could not authenticate with the new qBittorrent container (HTTP $login_status)."; fi
if [[ "$login_password" != "$qbit_password" ]]; then
  preferences="$(printf '{"web_ui_username":"admin","web_ui_password":"%s"}' "$qbit_password")"
  curl -fsS -b "$cookie_file" -H "Referer: $qbit_origin" --data-urlencode "json=$preferences" "$qbit_origin/api/v2/app/setPreferences" >/dev/null
  sleep 1
  : > "$cookie_file"
  login_status="$(curl -sS -o /dev/null -w '%{http_code}' -c "$cookie_file" -H "Referer: $qbit_origin" --data-urlencode 'username=admin' --data-urlencode "password=$qbit_password" "$qbit_origin/api/v2/auth/login")"
  if [[ "$login_status" != 200 && "$login_status" != 204 ]] || ! grep -q 'SID' "$cookie_file"; then fail "qBittorrent did not accept its generated permanent password."; fi
fi

say "Building and starting Harbor"
docker compose up -d --build harbor
ready=0
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:$harbor_port/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[[ "$ready" == 1 ]] || fail "Harbor did not become healthy. Run: docker compose logs harbor"

cat > "$appdata_root/INSTALLATION.txt" <<EOF
Harbor URL: http://UNRAID-IP:$harbor_port
Harbor pairing code: $pairing_code
qBittorrent URL: http://UNRAID-IP:$qbit_port
qBittorrent username: admin
qBittorrent password: $qbit_password
PIA VPN: OpenVPN ($pia_region), kill switch enabled
Configuration source: $repo_dir/.env
EOF
chmod 600 "$appdata_root/INSTALLATION.txt"

say "Installation complete"
printf '%s\n' \
  "Open Harbor:       http://YOUR-UNRAID-IP:$harbor_port" \
  "Pairing code:      $pairing_code" \
  "qBittorrent UI:    http://YOUR-UNRAID-IP:$qbit_port" \
  "qBittorrent user:  admin" \
  "qBittorrent pass:  $qbit_password" \
  "PIA VPN:           OpenVPN ($pia_region), kill switch enabled" \
  "Saved credentials: $appdata_root/INSTALLATION.txt"
