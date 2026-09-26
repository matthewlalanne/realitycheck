#!/bin/zsh
# Loads cast photos into ONE league (only that league sees them).
#
#   scripts/league-cast-photos.sh <folder> [leagueKey] [seasonId]
#
# <folder> holds one image per team named by its id, e.g. matter.jpg,
# johnson.png (ids in data/amazing-race-39.json). Each is shrunk to 400px
# wide JPEG with macOS `sips`, same as an in-app upload. Defaults to The
# Boring Stroll on Amazing Race 39.
set -euo pipefail
DIR=${1:?folder of <teamId>.jpg images}
LG=${2:-lgmuhnd33efkfd}
SEASON=${3:-amazing-race-39}
DST=tribe-league-app
TMP=$(mktemp -d)
for f in $DIR/*.(jpg|jpeg|png|webp|JPG|JPEG|PNG)(N); do
  id=${${f:t}:r}
  sips -s format jpeg -s formatOptions 60 --resampleWidth 400 "$f" --out "$TMP/$id.jpg" >/dev/null
done
python3 - "$TMP" <<'PY'
import base64, glob, json, os, sys
t = sys.argv[1]
up = {}
for p in glob.glob(f"{t}/*.jpg"):
    uri = "data:image/jpeg;base64," + base64.b64encode(open(p, "rb").read()).decode()
    if len(uri) >= 120000: sys.exit(f"{p} too big after resize")
    up[os.path.basename(p)[:-4]] = uri
json.dump(up, open(f"{t}/up.json", "w"))
print("Uploading:", ", ".join(sorted(up)))
PY
npx --yes firebase-tools@latest database:update /seasons/$SEASON/leagues/$LG/castPhotos $TMP/up.json --project $DST --force
rm -rf $TMP
echo "Done."
