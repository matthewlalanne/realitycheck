# Reality Check

Formerly Confessional / Tribe League. The bundle/package id is now
`com.mattlalanne.realitycheck` (staged in `design/app.json.build-settings.json`,
applied at the next build). The Firebase project itself is still named
`tribe-league-app` — Firebase project ids can't be renamed in place, only
migrated to a new project, which nothing here has done.

The public version of the Outlast fantasy-league app, built alongside it.
Outlast (`../Outlast`) keeps running the private league for the rest of
Survivor 51 and is never touched from here. Plan: `../Outlast/PUBLIC_LAUNCH.md`.


## Launch sprint: The Amazing Race 39 (premieres Wed 2026-09-30, 9:30 ET/PT)

Goal: Matt and Courtney run a real Amazing Race league on iOS (TestFlight) and
Android (free APK link), plus a read-only copy of Outlast's Denver league
(Outlast stays the official Denver league; data flows one way only).

Decisions (2026-09-25):
- Results, eliminations and tribes are entered **once per season by Matt**
  (admin, gated by his uid), not by league commissioners. Remove
  "Manage episodes & eliminations" and "Tribe names & colors" from
  commissioner tools; move them to an admin-only area.
- Amazing Race: each **team** is one pick; last-one-standing only; no tribes,
  idols or tribe chips. Non-elimination legs = "no one out this week".
- Episodes are an explicit list with their own air times (two-night premiere
  Sep 30 + Oct 1, then Wednesdays), not weekly math.
- Cast comes from public announcements (`data/amazing-race-39.json`); no
  network photos or bios. Commissioners upload photos.
- Stay on free tiers: ask Matt before any `eas build` (Expo free plan: 15 iOS
  builds/month, 3 left in September). Everything else ships via
  `eas update --channel simulator` (and later the release channel).

Work list:
1. Remove Outlast leftovers from the real flow (WhoAreYou / league password
   screens; app must open to sign-in -> my leagues).
2. Data model: shows/seasons/cast/episodes/results under a `seasons/<id>` node;
   leagues reference a season. Migrate the copied Survivor 51 data into it.
3. Real create league (save to DB), join by code/link, lobby with real members.
4. Draft: auto-draft from each member's ranking at the scheduled time
   (Cloud Function), plus "commissioner enters picks" fallback.
5. Per-show vocabulary + feature flags (unit noun, tribes, idols, winner term).
6. Admin results screen (Matt only): mark eliminated per episode, fans out to
   every league on that season.
7. Sign-in: Google on real iPhone; Sign in with Apple (App Store 4.8); Android
   Google OAuth client (needs Matt: SHA-1 from `eas credentials`).
8. Builds: 1 iOS (TestFlight) + 1 Android APK, then OTA fixes only.
9. Solo dry run by Matt (iPhone + second account on simulator/Android) with a
   fake "Test Show" season, then create the real Amazing Race league.

## Separation from Outlast (don't break these)
| | Outlast (live league) | Reality Check (this) |
|---|---|---|
| Code | `../Outlast/survivor-app` | `app/` (copied 2026-09-24) |
| Firebase project | `survivor-51-porterville` | `tribe-league-app` (old name; see note above) |
| App id | `com.mattlalanne.outlast` | `com.mattlalanne.realitycheck` (staged, not built yet) |
| Expo/EAS project | dbe05b04-… | **not created yet** (`eas init`) |

`app/app.json` has no EAS project id or update URL on purpose, so an
`eas update` here can never publish to Outlast's phones. `eas init` will add
this app's own.

## Status
- [x] Code copied; CBS headshots, cast Q&A bios, YouTube shorts, photo credit
      and season logo removed; castaways show initials on their tribe colour
      (`components/CastAvatar.tsx`); "not affiliated" disclaimer in Settings.
- [x] Simulator demo code removed.
- [x] Own Firebase project + Realtime Database, rules deployed.
- [x] League data copied one way from Outlast into `seasons/survivor-51` (`scripts/seed-seasons.sh`; re-run after each episode to refresh — it only ever reads Outlast).
- [x] **Sign-in deployed.** Email code (`requestEmailCode` / `verifyEmailCode`)
      and Google (`googleSignIn`) Cloud Functions are live on `tribe-league-app`
      (confirmed 2026-09-25 via `firebase functions:list`), Blaze plan is
      active, and the Google iOS OAuth client ID is filled in in
      `app/lib/googleAuth.ts`. Untested end-to-end (needs a real device —
      Matt's ISP breaks Google sign-in in the simulator).
- [ ] `eas init` + first build + TestFlight (needs Matt's Expo/Apple login and
      an `EXPO_TOKEN` in this environment — neither is available here).
- [ ] Final name + domain (see PUBLIC_LAUNCH.md §5).

## Auth setup (done)

Steps 1–4 below are complete (verified 2026-09-25: functions live, Google
client ID set). Kept here for reference.

1. ~~Upgrade `tribe-league-app` to the Blaze plan~~ — done.
2. ~~Sign up at resend.com, set `RESEND_API_KEY` secret~~ — done.
3. ~~Deploy the functions~~ — done; `firebase functions:list` shows
   `createLeague`, `joinLeague`, `googleSignIn`, `requestEmailCode`,
   `verifyEmailCode`, `pruneExpiredCodes`, `runScheduledDrafts` all live.
4. ~~Google sign-in client ID in `app/lib/googleAuth.ts`~~ — done.
5. Still needed: a build (`eas build`) once native config is merged — the URL
   scheme and OAuth client are compiled in, so a fresh build is required, not
   just an OTA update. Needs Matt's EAS login/`EXPO_TOKEN` and his go-ahead
   (free plan: ~3 iOS builds left in September).

