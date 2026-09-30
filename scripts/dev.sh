#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RUNTIME="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
if ! command -v node >/dev/null 2>&1 && [ -x "$RUNTIME/node/bin/node" ]; then
  PATH="$RUNTIME/node/bin:$RUNTIME/bin/fallback:$PATH"
  export PATH
fi
if [ -d /Applications/Xcode.app/Contents/Developer ]; then
  DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  export DEVELOPER_DIR
fi
for JDK in "$ROOT"/.tools/jdk-*/Contents/Home; do
  if [ -d "$JDK" ]; then JAVA_HOME="$JDK"; export JAVA_HOME; break; fi
done
if [ -d "$ROOT/.tools/android-sdk" ]; then
  ANDROID_HOME="$ROOT/.tools/android-sdk"
  PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
  export ANDROID_HOME PATH
fi
if [ -x "$ROOT/.tools/gems/bin/pod" ]; then
  GEM_HOME="$ROOT/.tools/gems"; GEM_PATH="$GEM_HOME"; PATH="$GEM_HOME/bin:$PATH"
  export GEM_HOME GEM_PATH PATH
fi
cd "$ROOT/apps/mobile"
TASK=${1:-typecheck}
if [ "$#" -gt 0 ]; then shift; fi
case "$TASK" in
  typecheck) exec node node_modules/typescript/bin/tsc --noEmit "$@" ;;
  test) exec node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts "$@" ;;
  export) exec node node_modules/expo/bin/cli export --platform ios --platform android "$@" ;;
  prebuild) exec node node_modules/expo/bin/cli prebuild --no-install "$@" ;;
  ios) exec node node_modules/expo/bin/cli run:ios "$@" ;;
  android) exec node node_modules/expo/bin/cli run:android "$@" ;;
  start) exec node node_modules/expo/bin/cli start "$@" ;;
  prepare-data) exec node scripts/prepare-data.cjs "$@" ;;
  *) echo "Unknown task: $TASK" >&2; exit 2 ;;
esac
