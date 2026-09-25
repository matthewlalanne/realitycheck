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
- [x] League data copied one way (`scripts/import-from-outlast.sh`, re-runnable).
- [x] **Sign-in code written.** Email code (`requestEmailCode` /
      `verifyEmailCode`) and Google (`googleSignIn`) as Cloud Functions in
      `functions/`, wired into the app's onboarding screens. Not deployed or
      testable yet — needs the one-time setup below.
- [ ] Cloud Functions (push notifications, sign-in) need the Firebase
      **Blaze** plan on `tribe-league-app` (Matt: billing in the console).
- [ ] `eas init` + first build + TestFlight (needs Matt's Expo/Apple login).
- [ ] Final name + domain (see PUBLIC_LAUNCH.md §5).

## Auth setup (needs Matt — one time)

Nothing below can be done from here; each needs your own Google/Apple account.

1. **Upgrade `tribe-league-app` to the Blaze plan** (pay-as-you-go). Required
   to deploy any Cloud Function. Console → Project settings → Usage and
   billing → Modify plan. At this size the bill should be $0–low.
2. **Sign up at [resend.com](https://resend.com)** (free tier: 3,000
   emails/month) and verify a sending domain (or use their shared test domain
   to start). Copy the API key, then run:
   `firebase functions:secrets:set RESEND_API_KEY --project tribe-league-app`
   Paste the key when prompted.
3. **Deploy the functions:** `cd functions && npm install && cd .. && firebase deploy --only functions --project tribe-league-app`
4. **Google sign-in client ID:** Firebase console → Authentication → Sign-in
   method → enable **Google** (this auto-creates an OAuth client). Then
   Google Cloud console → APIs & Services → Credentials → find the
   **iOS** OAuth client Firebase created (or create one, type "iOS", bundle
   id `com.mattlalanne.realitycheck` once the rename is built — see the
   naming note above) → copy its Client ID. Paste it into
   `app/lib/googleAuth.ts` as `GOOGLE_IOS_CLIENT_ID`, replacing `REPLACE_ME`.
5. Rebuild (`eas build --profile simulator` or a real build) — the URL scheme
   and OAuth client are compiled in, so this needs a fresh build, not just an
   OTA update.

Until step 4 is done, "Continue with Google" will fail with an auth error;
"Continue with email" only needs steps 1–3.

