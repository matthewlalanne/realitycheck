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
4. Deep link `playrealitycheck.web.app/join/CODE` -> prefill JoinScreen — done
   2026-09-25, both layers now live: app side (`lib/deepLink.ts`, wired into
   OnboardingFlow) works over `confessional://join/CODE`; the `https://` form
   is now wired too — `apple-app-site-association` (Team ID `W4L7JP7DQ8`) and
   `assetlinks.json` (keystore SHA256 from Matt's `eas credentials`, keystore
   alias `realitycheck` under EAS project `6eb8546d-...`) are deployed to
   `playrealitycheck.web.app/.well-known/`, and `app.json` carries the
   matching `associatedDomains`/`intentFilters`. Untested until the next
   build — needs a real device/app to confirm iOS/Android actually open the
   app instead of Safari. Until confirmed, the 6-letter code typed in by hand
   still always works as a fallback.
5. Native config — done 2026-09-25, merged into `app/app.json` (name
   "Reality Check", slug `realitycheck`, bundle id/package
   `com.mattlalanne.realitycheck`, icon/splash art, associatedDomains/
   intentFilters). `design/app.json.build-settings.json` is now stale — the
   real file is `app/app.json`. No Android Google OAuth client / SHA-1
   needed — `lib/googleAuth.ts` uses one browser-based OAuth (code+PKCE)
   client for both platforms, not native per-platform Google Sign-In.
   Important: the Android keystore Matt set up via `eas credentials` was
   created while `app.json` still said `com.mattlalanne.tribeleague` — it's
   tied to EAS project id `6eb8546d-...` (unchanged), so it should still be
   the one EAS signs with now that the package name matches
   `com.mattlalanne.realitycheck`, but verify this at the first Android
   build (`eas credentials` should show the same SHA256, not offer to
   create a new keystore) — if it doesn't match, `assetlinks.json` needs
   updating.
6. Builds: ONE iOS (TestFlight) + ONE Android APK. Matt is on Expo's free plan
   (15 iOS builds/month, ~3 left in September): ask before any `eas build`.
7. Then OTA fixes only: `eas update --channel <channel> --environment preview`.

## Decisions 2026-09-25 (later in the day)
- Deferred until the app has proven itself across multiple shows: final
  name, a real domain (realitycheck.web.app is reserved by another Firebase
  project), a working web version of the app, and App Store / Play Store
  publishing. Until then: iOS via TestFlight, Android via the APK page.
- Builds run from Matt's Mac (first iOS build needs his Apple 2FA login).
  app.json `slug` stays `tribe-league` — it must match the EAS project.
- `site/android/` is built but not deployed: set `APK_URL` to the EAS .apk
  link, then `firebase deploy --only hosting`.
- Google sign-in can't work in Expo Go (it sends an exp:// redirect Google
  rejects); test with email until the real build.
- Database rules for castPhotos/puzzleImage are committed but not deployed
  (this container can't reach the RTDB endpoint): run
  `firebase deploy --only database --project tribe-league-app` from the Mac.

- Survivor 51 in Reality Check is a one-way copy of Outlast's Denver
  league. Refresh after each episode with `scripts/seed-seasons.sh` (reads
  Outlast, never writes it). Anything done inside Reality Check's copy is
  overwritten on refresh — play Survivor in Outlast. The old
  import-from-outlast.sh was deleted: it wrote the pre-multi-show layout
  and would have replaced every Reality Check avatar.

- Email codes are sent from Matt's Gmail (nodemailer + a Gmail app password
  in the GMAIL_APP_PASSWORD secret). Resend was dropped: its free test sender
  only delivers to the Resend account owner, so nobody else got codes.

## What only Matt (or his Mac) can do
- Firebase deploys: done from here now — `FIREBASE_TOKEN` is in this
  environment and confirmed working (`firebase functions:list` shows all 7
  functions live on `tribe-league-app`, Blaze plan active).
- EAS needs `EXPO_TOKEN` (expo.dev > Access tokens) in the cloud environment —
  not present here, so builds still need Matt's machine/login.
- Apple/Google console steps, TestFlight invites, the iOS simulator.
- Real sign-in testing (his ISP's certificate filter breaks Google sign-in in
  the simulator; use a hotspot or a real iPhone).

## 2026-09-26
- Denver / Survivor 51 removed from Reality Check (played in Outlast only).
  Code side done; DB side is `scripts/remove-denver.sh` (run from the Mac,
  backs up to ~/realitycheck-denver-backup first).
- Commissioner-written bios: `seasons/<s>/leagues/<lg>/castBios/<id>`
  {hometown, occupation, about}; Edit bio on the Bio screen, rules deployed.
  The Boring Stroll (lgmuhnd33efkfd) has all 13 AR39 bios loaded.
- Cast photos for one league from a folder: `scripts/league-cast-photos.sh`.
- The `android-apk` channel now points at the `production` branch (changed on
  EAS, not in eas.json: eas.json is part of the fingerprint, so editing it
  strands every installed build). One `eas update --channel production`
  reaches iOS and Android. APKs built before 2026-09-26 are on an older
  runtime and never update: reinstall from the download page.

## Rules
- Keep replies short; tables over prose. Never state Survivor results.
- Matt wants to stay on free tiers.
- Commit with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
