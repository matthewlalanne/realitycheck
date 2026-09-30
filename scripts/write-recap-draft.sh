#!/usr/bin/env bash
# Files Claude's draft for one episode at recapDrafts/<seasonId>/<ep>, where
# the episode editor offers it as "Load draft". Nothing reaches the league
# until an admin loads it and saves. Overwrites an earlier Claude draft for
# that episode but keeps an admin's saved work in progress (`editor`).
#
#   scripts/write-recap-draft.sh amazing-race-39 1 recap.txt stats.json
set -euo pipefail
DST=tribe-league-app
fb() { npx --yes firebase-tools@latest "$@"; }
[[ $# -eq 4 ]] || { echo "usage: $0 <seasonId> <ep> <recap.txt> <stats.json>"; exit 1; }
season=$1 ep=$2
TMP=$(mktemp -d)
python3 - "$3" "$4" "$TMP/draft.json" <<'PY'
import json, sys, time
recap = open(sys.argv[1]).read().strip()
stats = json.load(open(sys.argv[2]))
if len(recap) > 5000: sys.exit(f"recap is {len(recap)} characters; the limit is 5000")
json.dump({"recap": recap, "stats": stats, "createdAt": int(time.time() * 1000)}, open(sys.argv[3], "w"))
PY
fb database:update /recapDrafts/$season/$ep $TMP/draft.json --project $DST --force
rm -rf $TMP
echo "Draft filed at recapDrafts/$season/$ep."
