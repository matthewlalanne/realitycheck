#!/usr/bin/env bash
# Makes someone a show admin (admins/<uid> = true): they get Settings > Show
# admin, can enter results for every league, and see Claude's recap drafts.
# They need to have signed in to the app once first.
#
#   scripts/make-admin.sh someone@gmail.com   # email-code account
#   scripts/make-admin.sh Courtney            # or by display name
#   scripts/make-admin.sh <uid>               # or by uid directly
set -euo pipefail
DST=tribe-league-app
fb() { npx --yes firebase-tools@latest "$@"; }
[[ $# -eq 1 ]] || { echo "usage: $0 <name-or-uid>"; exit 1; }

uid=$(fb database:get /users --project $DST | python3 -c '
import base64, json, sys
q = sys.argv[1]; users = json.load(sys.stdin) or {}
if "@" in q:  # email sign-in uids are email_<base64url(email), unpadded>
  q = "email_" + base64.urlsafe_b64encode(q.lower().encode()).decode().rstrip("=")
  if q not in users: sys.exit(f"No account for that email yet ({q}); they need to sign in once.")
if q in users: print(q); sys.exit()
hits = [u for u, v in users.items() if q.lower() in str((v or {}).get("name", "")).lower()]
if len(hits) != 1:
  for u in hits: print("  " + u + "  " + str(users[u].get("name")), file=sys.stderr)
  sys.exit(f"{len(hits)} users match {q!r}; pass their email or uid instead.")
print(hits[0])' "$1")

fb database:set /admins/$uid true --project $DST --force
echo "admins/$uid = true"
