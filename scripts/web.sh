#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUNTIME="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
if ! command -v node >/dev/null 2>&1; then
  PATH="$RUNTIME/node/bin:$RUNTIME/bin/fallback:$PATH"
  export PATH
fi
cd "$ROOT/apps/web"
TASK=${1:-dev}
case "$TASK" in
  build) node node_modules/typescript/bin/tsc --noEmit; exec node node_modules/vite/bin/vite.js build ;;
  dev) exec node node_modules/vite/bin/vite.js --host 127.0.0.1 ;;
  preview) exec node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 ;;
  *) echo 'Usage: scripts/web.sh dev|build|preview' >&2; exit 2 ;;
esac
