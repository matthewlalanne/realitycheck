#!/bin/zsh
# Builds Reality Check's season records. Safe to re-run.
#
#  - amazing-race-39: cast from data/amazing-race-39.json. Only seeded once;
#    re-running never touches its results or leagues.
#  - test-show-1: a made-up show for dry runs (admins only). Seeded once.
#  - admins/<Matt's uid> = true.
set -euo pipefail
DST=tribe-league-app
ROOT=${0:A:h:h}
TMP=$(mktemp -d)
fb() { npx --yes firebase-tools@latest "$@"; }

fb database:get /seasons --project $DST > $TMP/seasons.json
fb database:get /seasonCatalog --project $DST > $TMP/catalog.json

python3 - "$TMP" "$ROOT" <<'PY'
import json, re, sys, random
t, root = sys.argv[1], sys.argv[2]
seasons = json.load(open(f"{t}/seasons.json")) or {}
MATT = "google_100307017603801615752"
ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
code = lambda: "".join(random.choice(ALPHA) for _ in range(6))
up = {}

# ---- The Amazing Race 39 (seeded once) -----------------------------------------
ar = json.load(open(f"{root}/data/amazing-race-39.json"))
if "amazing-race-39" not in seasons:
  firsts = lambda m: " & ".join(n.split()[0] for n in m)
  up["seasons/amazing-race-39/meta"] = {
    "showId": "amazing-race", "showName": "The Amazing Race", "label": "Season 39", "unit": "team",
    "episodes": {str(e["n"]): e["airsLocal"] for e in ar["episodes"]}, "features": {}}
  up["seasons/amazing-race-39/contestants"] = [
    {"id": tm["id"], "name": firsts(tm["members"]), "detail": tm["relationship"], "from": tm["hometown"],
     "members": tm["members"]} for tm in ar["teams"]]
up["seasonCatalog/amazing-race-39"] = {"showId": "amazing-race", "showName": "The Amazing Race", "label": "Season 39", "open": True, "castCount": len(ar["teams"])}

# ---- Test show for dry runs (seeded once, admins only) ----------------------------
if "test-show-1" not in seasons:
  teams = [("Avery & Blake", "Best Friends"), ("Casey & Drew", "Siblings"), ("Emery & Finn", "Married"),
           ("Gray & Harper", "Dating"), ("Indy & Jules", "Cousins"), ("Kai & Lane", "Coworkers"),
           ("Morgan & Nico", "Father & Son"), ("Oakley & Parker", "Roommates")]
  up["seasons/test-show-1/meta"] = {
    "showId": "test-show", "showName": "Test Show", "label": "Dry Run", "unit": "team",
    "episodes": {"1": "2026-09-27T20:00", "2": "2026-09-28T20:00", "3": "2026-09-29T20:00"}, "features": {}}
  up["seasons/test-show-1/contestants"] = [
    {"id": f"t{i+1}", "name": n, "detail": d, "from": "Anytown, USA", "members": n.split(" & ")} for i, (n, d) in enumerate(teams)]
up["seasonCatalog/test-show-1"] = {"showId": "test-show", "showName": "Test Show", "label": "Dry Run", "open": True, "adminOnly": True, "castCount": 8}

up[f"admins/{MATT}"] = True
json.dump(up, open(f"{t}/update.json", "w"))
PY

fb database:update / $TMP/update.json --project $DST --force
rm -rf $TMP
echo "Seeded seasons in $DST."
