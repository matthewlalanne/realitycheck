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
1. ~~Admin results screen works for teams~~ — done 2026-09-25: Survivor-only
   sections (vote/immunity/reward/idols/journey/merge) now hide behind
   `terms.hasStats/hasIdols/hasTribes`; eliminations already fan out to every
   league since they write to the shared `seasons/<id>` record.
2. ~~Predictions/standings/Cast/Draft/Bio for Amazing Race~~ — done
   2026-09-25: BioScreen was reading the tapped contestant from the bundled
   Survivor-51 list, so opening any Amazing Race team's bio was a blank
   screen; switched to live season data. Cast/Bio now show `detail`
   (relationship) instead of "Age undefined" for teams. Memory game was the
   same bug (always dealt Survivor faces) — also switched to live data; it
   only ever shows a league's uploaded photos or initials, no bundled images.
3. ~~Sign in with Apple~~ — dropped. Google + email code only.
4. Deep link `playrealitycheck.web.app/join/CODE` -> prefill JoinScreen — app
   side done 2026-09-25 (`lib/deepLink.ts`, wired into OnboardingFlow): works
   today over the `confessional://join/CODE` scheme, no build needed. The
   `https://` form needs two things only Matt can do before it'll open the
   app instead of Safari: (a) `associatedDomains`/`intentFilters` are staged
   in `design/app.json.build-settings.json` (applied at the build below); (b)
   host `/.well-known/apple-app-site-association` (needs the Apple Team ID)
   and `/.well-known/assetlinks.json` (needs the Android signing cert's
   SHA256, from `eas credentials`) on the Firebase Hosting site. Until then
   the shared link still falls back to opening the website and the 6-letter
   code always works typed in by hand.
5. Native config — done 2026-09-25, staged in `design/app.json.build-settings.json`
   (name "Reality Check", bundle id/package `com.mattlalanne.realitycheck`,
   the new icon/splash art Matt sent, associatedDomains/intentFilters). Not
   yet merged into `app.json` on purpose — see the rule at the top of this
   item — will be applied right before the build below. Correction: no
   Android Google OAuth client / SHA-1 is needed — `lib/googleAuth.ts` uses
   one browser-based OAuth (code+PKCE) client for both platforms, not native
   per-platform Google Sign-In, so `eas credentials` isn't part of this.
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
