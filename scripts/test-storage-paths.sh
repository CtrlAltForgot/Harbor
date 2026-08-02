#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/storage-paths.sh
source "$script_dir/lib/storage-paths.sh"

test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
mkdir -p "$test_root/Media"

[[ "$(resolve_existing_directory_case_insensitive "$test_root/Media")" == "$test_root/Media" ]]
[[ "$(resolve_existing_directory_case_insensitive "$test_root/media")" == "$test_root/Media" ]]

if resolve_existing_directory_case_insensitive "$test_root/Missing" >/dev/null; then
  printf 'missing directories must be rejected\n' >&2
  exit 1
fi

mkdir -p "$test_root/media"
set +e
resolve_existing_directory_case_insensitive "$test_root/MEDIA" >/dev/null
status=$?
set -e
[[ "$status" == 2 ]] || {
  printf 'case-conflicting directories must be reported as ambiguous\n' >&2
  exit 1
}

printf 'storage path tests passed\n'
