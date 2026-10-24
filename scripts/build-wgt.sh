#!/usr/bin/env bash
# Build an UNSIGNED Tizen widget (dist/TVHome-unsigned.wgt) containing only the app files.
# It cannot be installed on a Samsung TV as-is: sign it with Tizen Studio and your Samsung
# certificate profile first (see INSTALL.md, "Sign and install").
set -euo pipefail
cd "$(dirname "$0")/.."

# Files and folders that make up the app. Everything else (tests/, tracking/, scripts/,
# node_modules/, package*.json, docs, dist/) stays out. See .buildignore for the list.
APP_FILES=(config.xml index.html css js images fonts)

for item in "${APP_FILES[@]}"; do
  [ -e "$item" ] || { echo "Missing $item" >&2; exit 1; }
done
mkdir -p dist
OUT="dist/TVHome-unsigned.wgt"
STAGE="dist/TVHome"
rm -f "$OUT"
rm -rf "$STAGE"

# Clean copy of just the app, for `tizen package -t wgt -s <profile> -- dist/TVHome` (INSTALL.md).
mkdir -p "$STAGE"
cp -R "${APP_FILES[@]}" "$STAGE"/
find "$STAGE" -name '.*' -type f -delete
if command -v zip >/dev/null; then
  # -X: no extra file attributes; -r: recurse; skip hidden files such as .DS_Store.
  zip -q -X -r "$OUT" "${APP_FILES[@]}" -x '*/.*' -x '.*'
elif command -v python3 >/dev/null; then
  python3 - "$OUT" "${APP_FILES[@]}" <<'PY'
import os, sys, zipfile
out, items = sys.argv[1], sys.argv[2:]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for item in items:
        paths = [item] if os.path.isfile(item) else sorted(
            os.path.join(root, f) for root, dirs, files in os.walk(item)
            for f in files if not f.startswith('.'))
        for p in paths:
            z.write(p, p)
PY
else
  echo "Need zip or python3 to build the package" >&2; exit 1
fi
echo "Built $OUT (unsigned) and the folder $STAGE/ to sign with Tizen Studio"
unzip -l "$OUT"
