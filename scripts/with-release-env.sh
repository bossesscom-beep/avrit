#!/bin/bash
# Loads Avrit release variables from outside the repository, then runs the
# given command. Key files are checked for owner-only permissions and never printed.
set -euo pipefail
ENV_FILE="${AVRIT_RELEASE_ENV:-$HOME/.config/avrit/release.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Avrit release env is missing." >&2
  exit 1
fi
if [[ "$(stat -f '%Lp' "$ENV_FILE")" != "600" ]]; then
  echo "Avrit release env must be mode 600." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

check_key() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "A release key file is missing." >&2
    exit 1
  fi
  local mode
  mode="$(stat -f '%Lp' "$file")"
  if [[ "$mode" != "600" ]]; then
    echo "A release key file must be mode 600." >&2
    exit 1
  fi
}

check_key "$ASC_KEY_PATH"
check_key "$PLAY_JSON_KEY"
if [[ -n "${ANDROID_KEYSTORE_PATH:-}" ]]; then
  check_key "$ANDROID_KEYSTORE_PATH"
fi

if [[ $# -lt 1 ]]; then
  echo "usage: with-release-env.sh COMMAND..." >&2
  exit 1
fi
exec "$@"
