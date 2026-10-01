#!/bin/bash
set -euo pipefail
if [[ $# -ne 1 ]]; then
  echo "usage: copy-web.sh DEST" >&2
  exit 1
fi
DEST="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$DEST/css" "$DEST/js"
cp "$ROOT/index.html" "$DEST/index.html"
cp "$ROOT/css/avrit.css" "$DEST/css/avrit.css"
cp "$ROOT/css/avrit-icon.svg" "$DEST/css/avrit-icon.svg"
cp "$ROOT/js/"*.js "$DEST/js/"
