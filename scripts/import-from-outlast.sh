#!/bin/zsh
# One-way copy: READS the live private league (Outlast, survivor-51-porterville)
# and WRITES a cleaned copy into Tribe League's own database (tribe-league-app).
# Never writes to Outlast. Safe to re-run any time to refresh test data; it
# overwrites Tribe League's copy of these nodes.
#
# Left out on purpose: push tokens (so no league member's phone can ever be
# pinged from here), announcements, app-version/typing/read markers, recap
# drafts, and contestant photo paths (CBS headshots).
set -euo pipefail
SRC=survivor-51-porterville
DST=tribe-league-app
TMP=$(mktemp -d)
fb() { npx --yes firebase-tools@latest "$@"; }

for n in league avatars draftBoards; do
  fb database:get /$n --project $SRC > $TMP/$n.json
done

python3 - "$TMP" <<'PY'
import json, sys
t = sys.argv[1]
L = json.load(open(f"{t}/league.json"))
L.pop("pushTokens", None); L.pop("announcements", None)
for c in L.get("contestants", []) or []:
    if c: c.pop("photo", None)
json.dump(L, open(f"{t}/league.json", "w"))
PY

for n in league avatars draftBoards; do
  fb database:set /$n $TMP/$n.json --project $DST --force
done
rm -rf $TMP
echo "Copied league, avatars, draftBoards from $SRC into $DST."
