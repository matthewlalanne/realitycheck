#!/bin/zsh
# Copies Outlast's photos into Reality Check for the Denver league only:
#  - cast photos -> seasons/survivor-51/leagues/denver/castPhotos (never the
#    shared seasons/survivor-51/contestants, which every league reads)
#  - player photos -> avatars, only for people who don't have one yet here,
#    so nobody's Reality Check photo gets overwritten.
#
# The cast photos are CBS's official headshots — Matt chose to copy them into
# his own private league knowing that.
#
# Outlast stores cast photos as relative paths ("headshots/....webp") to files
# in its own project folder, so this looks for them under ~/Outlast (or the
# folder given as the first argument). Read-only against Outlast.
# Resizing uses `sips`, which ships with macOS.
set -euo pipefail
SRC=survivor-51-porterville
DST=tribe-league-app
OUTLAST_DIR=${1:-$HOME/Outlast}
TMP=$(mktemp -d)
fb() { npx --yes firebase-tools@latest "$@"; }

if [[ ! -d $OUTLAST_DIR ]]; then
  echo "Can't find the Outlast folder at $OUTLAST_DIR — run: $0 /path/to/Outlast"
  exit 1
fi

fb database:get /league --project $SRC > $TMP/outlast.json
fb database:get /avatars --project $SRC > $TMP/outlast-avatars.json
fb database:get /avatars --project $DST > $TMP/rc-avatars.json

python3 - "$TMP" "$OUTLAST_DIR" <<'PY'
import base64, json, os, subprocess, sys

t, outlast = sys.argv[1], sys.argv[2]
L = json.load(open(f"{t}/outlast.json")) or {}

# Index every file under the Outlast folder by name once (skip node_modules).
by_name = {}
for root, dirs, files in os.walk(outlast):
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "ios", "android")]
    for f in files:
        by_name.setdefault(f, os.path.join(root, f))

cast_photos = {}
for c in L.get("contestants") or []:
    if not c or not c.get("photo"):
        continue
    src = by_name.get(os.path.basename(c["photo"]))
    if not src:
        print(f"  skip {c['id']}: {os.path.basename(c['photo'])} not found under {outlast}")
        continue
    out = f"{t}/{c['id']}.jpg"
    # Same size/quality the app uses for its own cast-photo uploads.
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "60", "-Z", "400", src, "--out", out],
                   check=True, capture_output=True)
    uri = "data:image/jpeg;base64," + base64.b64encode(open(out, "rb").read()).decode()
    if len(uri) >= 120000:
        print(f"  skip {c['id']}: still too large after resizing")
        continue
    cast_photos[c["id"]] = uri

up = {}
for cid, uri in cast_photos.items():
    up[f"seasons/survivor-51/leagues/denver/castPhotos/{cid}"] = uri

# Player photos: only fill in people who have none in Reality Check yet.
oa = json.load(open(f"{t}/outlast-avatars.json")) or {}
ra = json.load(open(f"{t}/rc-avatars.json")) or {}
added = 0
for key, uri in oa.items():
    pid = key.split("_", 1)[1] if key.startswith("denver_") else key
    if pid in ra or not isinstance(uri, str) or not uri.startswith("data:image/"):
        continue
    up[f"avatars/{pid}"] = uri
    added += 1

json.dump(up, open(f"{t}/update.json", "w"))
print(f"Copying {len(cast_photos)} cast photo(s) and {added} player photo(s).")
PY

fb database:update / $TMP/update.json --project $DST --force
rm -rf $TMP
echo "Done — reopen the Denver league in the app."
