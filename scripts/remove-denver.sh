#!/bin/zsh
# Removes the Denver league (and the Survivor 51 season it lived in) from
# Reality Check completely. Denver is played in Outlast only. Never touches
# Outlast's own project. Backs everything up to ~/realitycheck-denver-backup
# first.
#
# Deletes: seasons/survivor-51 (Denver league, chat, picks, predictions),
# its catalog entry and invite code, every member's userLeagues/*/denver,
# the old read-only /league copy of Outlast, draftBoards/{denver,porterville},
# reads/denver, and the avatars copied from Outlast (nick, matt,
# porterville_matt, jowayne).
set -euo pipefail
DST=tribe-league-app
BK=~/realitycheck-denver-backup
mkdir -p $BK
fb() { npx --yes firebase-tools@latest "$@"; }

for k in seasons/survivor-51 league draftBoards avatars reads/denver userLeagues inviteCodes; do
  fb database:get /$k --project $DST -o "$BK/${k//\//_}.json"
done

python3 - "$BK" <<'PY'
import json, sys
bk = sys.argv[1]
removals = {
  "seasons/survivor-51": None, "seasonCatalog/survivor-51": None, "league": None,
  "draftBoards/denver": None, "draftBoards/porterville": None, "reads/denver": None,
}
for a in ("nick", "matt", "porterville_matt", "jowayne"):
  removals[f"avatars/{a}"] = None
for uid, lgs in (json.load(open(f"{bk}/userLeagues.json")) or {}).items():
  for lg, v in (lgs or {}).items():
    if lg == "denver" or (v or {}).get("seasonId") == "survivor-51":
      removals[f"userLeagues/{uid}/{lg}"] = None
for code, v in (json.load(open(f"{bk}/inviteCodes.json")) or {}).items():
  if (v or {}).get("seasonId") == "survivor-51":
    removals[f"inviteCodes/{code}"] = None
json.dump(removals, open(f"{bk}/removals.json", "w"), indent=1)
print("\n".join(removals))
PY

fb database:update / $BK/removals.json --project $DST --force
echo "Denver removed. Backup in $BK."
