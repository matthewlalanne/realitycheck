#!/bin/zsh
# Deletes the "Test Show" (test-show-1) dry-run season, including any leagues
# created under it and the dangling userLeagues/inviteCodes entries those
# leagues left behind (a plain `database:remove /seasons/test-show-1` would
# leave those pointing at a season that no longer exists).
set -euo pipefail
DST=tribe-league-app
TMP=$(mktemp -d)
fb() { npx --yes firebase-tools@latest "$@"; }

fb database:get /seasons/test-show-1/leagues --project $DST > $TMP/leagues.json 2>/dev/null || echo 'null' > $TMP/leagues.json

python3 - "$TMP" <<'PY'
import json, sys
t = sys.argv[1]
leagues = json.load(open(f"{t}/leagues.json")) or {}
removals = {"seasons/test-show-1": None, "seasonCatalog/test-show-1": None}
for lg_key, lg in leagues.items():
    for uid in (lg.get("memberIds") or {}):
        removals[f"userLeagues/{uid}/{lg_key}"] = None
    code = lg.get("inviteCode")
    if code:
        removals[f"inviteCodes/{code}"] = None
json.dump(removals, open(f"{t}/removals.json", "w"))
print(f"Removing test-show-1 and {len(leagues)} league(s) under it.")
PY

fb database:update / $TMP/removals.json --project $DST --force
rm -rf $TMP
echo "Done. Create the new league from Settings > All leagues > Create a league."
