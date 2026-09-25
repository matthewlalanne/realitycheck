#!/bin/zsh
# Builds Reality Check's season records. Safe to re-run.
#
#  - survivor-51: READS the live Outlast record (survivor-51-porterville, never
#    written) and copies the cast, results and the Denver league into
#    seasons/survivor-51. Denver is "claimable": members join with its code and
#    pick which existing player they are. Re-running refreshes everything from
#    Outlast but keeps Denver's invite code and anyone who already claimed.
#  - amazing-race-39: cast from data/amazing-race-39.json. Only seeded once;
#    re-running never touches its results or leagues.
#  - test-show-1: a made-up show for dry runs (admins only). Seeded once.
#  - admins/<Matt's uid> = true.
set -euo pipefail
SRC=survivor-51-porterville
DST=tribe-league-app
ROOT=${0:A:h:h}
TMP=$(mktemp -d)
fb() { npx --yes firebase-tools@latest "$@"; }

fb database:get /league --project $SRC > $TMP/outlast.json
fb database:get /seasons --project $DST > $TMP/seasons.json
fb database:get /seasonCatalog --project $DST > $TMP/catalog.json

python3 - "$TMP" "$ROOT" <<'PY'
import json, re, sys, random
t, root = sys.argv[1], sys.argv[2]
L = json.load(open(f"{t}/outlast.json"))
seasons = json.load(open(f"{t}/seasons.json")) or {}
MATT = "google_100307017603801615752"
ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
code = lambda: "".join(random.choice(ALPHA) for _ in range(6))
up = {}

# ---- Survivor 51 (refreshed from Outlast every run) ----------------------------
static = {}
src = open(f"{root}/app/data/realData.ts").read()
for m in re.finditer(r"id: '([^']+)', name: '([^']*)', age: (\d+), from: '([^']*)'", src):
    static[m.group(1)] = {"age": int(m.group(3)), "from": m.group(4)}
cast = []
for c in L.get("contestants") or []:
    if not c: continue
    c = dict(c); c.pop("photo", None)
    c.update({k: v for k, v in static.get(c["id"], {}).items() if k not in c})
    cast.append(c)

old_dv = ((seasons.get("survivor-51") or {}).get("leagues") or {}).get("denver") or {}
dv = dict(L["leagues"]["denver"])
dv["claimable"] = True
dv["commissionerIds"] = ["courtney", "matt"]
dv["inviteCode"] = old_dv.get("inviteCode") or code()
dv["memberIds"] = old_dv.get("memberIds") or {MATT: "matt"}
dv["draftMode"] = "live"
dv["style"] = "last-standing"

s51 = {
  "meta": {"showId": "survivor", "showName": "Survivor", "label": "Season 51", "unit": "castaway",
           "episodes": {"1": "2026-09-23T20:00"},
           "features": {"tribes": True, "idols": True, "stats": True, "recaps": True}},
  "contestants": cast,
  "leagues": {"denver": dv},
}
for k in ("tribes", "episodeNotes", "episodeTitles", "episodeStats", "game", "week", "season", "title"):
  if k in L: s51[k] = L[k]
for k in ("predictions", "winnerPicks", "messages"):
  if L.get(k, {}).get("denver"): s51[k] = {"denver": L[k]["denver"]}
up["seasons/survivor-51"] = s51
up[f"inviteCodes/{dv['inviteCode']}"] = {"seasonId": "survivor-51", "leagueKey": "denver"}
for uid, pid in dv["memberIds"].items():
  up[f"userLeagues/{uid}/denver"] = {"seasonId": "survivor-51", "name": dv["name"], "personId": pid, "joinedAt": 1}
up["seasonCatalog/survivor-51"] = {"showId": "survivor", "showName": "Survivor", "label": "Season 51", "open": True, "castCount": len(cast)}

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
print("Denver invite code:", dv["inviteCode"])
PY

fb database:update / $TMP/update.json --project $DST --force
rm -rf $TMP
echo "Seeded seasons in $DST."
