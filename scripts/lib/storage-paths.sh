#!/usr/bin/env bash

# Print the one existing directory whose name matches the requested path,
# treating only the final component case-insensitively. This protects Unraid
# users from accidentally creating shares such as /mnt/user/media beside an
# existing /mnt/user/Media share.
resolve_existing_directory_case_insensitive() {
  local requested="${1%/}" parent leaf candidate candidate_leaf
  local -a matches=()

  [[ -n "$requested" ]] || return 1
  parent="$(dirname -- "$requested")"
  leaf="$(basename -- "$requested")"
  [[ -d "$parent" ]] || return 1

  while IFS= read -r -d '' candidate; do
    candidate_leaf="$(basename -- "$candidate")"
    if [[ "${candidate_leaf,,}" == "${leaf,,}" ]]; then
      matches+=("$candidate")
    fi
  done < <(find "$parent" -mindepth 1 -maxdepth 1 -type d -print0)

  ((${#matches[@]} == 1)) || {
    ((${#matches[@]} > 1)) && return 2
    return 1
  }
  printf '%s\n' "${matches[0]}"
}
