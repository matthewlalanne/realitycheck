#!/bin/zsh
# Copies Outlast's cast photos into Reality Check, scoped to the Denver
# league only (seasons/survivor-51/leagues/denver/castPhotos) — never into
# seasons/survivor-51/contestants, which every league on this season reads.
#
# These are CBS's official cast photos, not custom uploads. Copying them into
# Reality Check — even scoped to one league — means this app is hosting and
# displaying CBS's photos, which is exactly what this app was built to avoid
# doing elsewhere. Only run this if you've decided that's an acceptable risk
# for your own private league.
#
# Read-only against Outlast; writes only Reality Check's own database.
set -euo pipefail
SRC=survivor-51-porterville
DST=tribe-league-app
TMP=$(mktemp -d)
fb() { npx --yes firebase-tools@latest "$@"; }

fb database:get /league --project $SRC > $TMP/outlast.json

python3 - "$TMP" <<'PY'
import base64, json, sys, urllib.request

t = sys.argv[1]
L = json.load(open(f"{t}/outlast.json"))
cast_photos = {}
for c in L.get("contestants") or []:
    if not c or not c.get("photo"):
        continue
    photo = c["photo"]
    if photo.startswith("data:image/"):
        cast_photos[c["id"]] = photo
        continue
    try:
        req = urllib.request.Request(photo, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0]
    except Exception as e:
        print(f"  skip {c['id']}: couldn't fetch photo ({e})")
        continue
    uri = f"data:{content_type};base64,{base64.b64encode(data).decode()}"
    # Matches the app's own upload-size cap (database.rules.json). A full-res
    # CBS photo can run bigger; those get skipped rather than failing the
    # whole batch — add that one by hand in-app instead (it resizes first).
    if len(uri) >= 120000:
        print(f"  skip {c['id']}: photo too large ({len(uri)} chars) — add it in-app instead")
        continue
    cast_photos[c["id"]] = uri

json.dump({"seasons/survivor-51/leagues/denver/castPhotos": cast_photos}, open(f"{t}/update.json", "w"))
print(f"Copying {len(cast_photos)} photo(s) into Denver only.")
PY

fb database:update / $TMP/update.json --project $DST --force
rm -rf $TMP
echo "Done."
