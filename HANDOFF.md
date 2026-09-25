# Handoff (2026-09-25) — read this first

Reality Check: public, multi-show fantasy TV app (Expo/React Native in `app/`,
Firebase project `tribe-league-app`, site https://playrealitycheck.web.app).
Owner: Matt. **Never touch Outlast** (`survivor-51-porterville`, EAS project
dbe05b04-…). First real test: The Amazing Race 39, premieres Wed 2026-09-30
9:30 ET/PT (two-night premiere, Oct 1 too). Plan and decisions: README.md.

## Done and working (verified in the iOS simulator)
- Real accounts (Google + email code) -> `users/<uid>`, `userLeagues/<uid>`.
- Seasons at `seasons/<id>` (cast, meta.episodes schedule, leagues). Catalog at
  `seasonCatalog`. Seeded: survivor-51 (Denver league, claimable, code JQBMGM),
  amazing-race-39 (13 teams), test-show-1 (admin-only dry-run show).
- Create league / join by code via callable functions `createLeague`,
  `joinLeague` (functions/index.js). Auto draft: scheduled `runScheduledDrafts`.
- Per-show wording/features via `lib/season.ts` (`termsFor`). Admin-only
  screens (episodes/eliminations, tribes) behind `admins/<uid>`.
- Alpenglow theme + gradients; brand splash shared with the welcome screen.
- Rules: `database.rules.json` (deployed). Seed script: `scripts/seed-seasons.sh`.

## Remaining work (in order)
1. Check the admin results screen (EpisodeManager/EpisodeEditor) works for
   teams (no tribes/idols) and that marking a team out updates every league.
2. Predictions/standings/Cast/Draft screens with Amazing Race data (teams,
   `detail` = relationship, `members`); fix any castaway-only assumptions.
3. Sign in with Apple (App Store 4.8 for external TestFlight).
4. Deep link `playrealitycheck.web.app/join/CODE` -> prefill JoinScreen.
5. Native config, applied at build time only (changes the EAS fingerprint, so
   do NOT commit it earlier or OTA stops reaching the current simulator
   build): `design/app.json.build-settings.json` has the splash/icon/android
   adaptive-icon values; also set `expo.name` to "Reality Check", Android
   package id, Android Google OAuth client (needs Matt: SHA-1 via
   `eas credentials`).
6. Builds: ONE iOS (TestFlight) + ONE Android APK. Matt is on Expo's free plan
   (15 iOS builds/month, ~3 left in September): ask before any `eas build`.
7. Then OTA fixes only: `eas update --channel <channel> --environment preview`.

## What only Matt (or his Mac) can do
- Firebase deploys and DB seeding need the Firebase CLI logged in to
  tribe-league-app. A cloud session has no login: give it `FIREBASE_TOKEN`
  (`firebase login:ci`) or hand deploy commands to Matt.
- EAS needs `EXPO_TOKEN` (expo.dev > Access tokens) in the cloud environment.
- Apple/Google console steps, TestFlight invites, the iOS simulator.
- Real sign-in testing (his ISP's certificate filter breaks Google sign-in in
  the simulator; use a hotspot or a real iPhone).

## Rules
- Keep replies short; tables over prose. Never state Survivor results.
- Matt wants to stay on free tiers.
- Commit with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
