# Tribe League (working name)

The public version of the Outlast fantasy-league app, built alongside it.
Outlast (`../Outlast`) keeps running the private league for the rest of
Survivor 51 and is never touched from here. Plan: `../Outlast/PUBLIC_LAUNCH.md`.

## Separation from Outlast (don't break these)
| | Outlast (live league) | Tribe League (this) |
|---|---|---|
| Code | `../Outlast/survivor-app` | `app/` (copied 2026-09-24) |
| Firebase project | `survivor-51-porterville` | `tribe-league-app` |
| App id | `com.mattlalanne.outlast` | `com.mattlalanne.tribeleague` |
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
   id `com.mattlalanne.tribeleague`) → copy its Client ID. Paste it into
   `app/lib/googleAuth.ts` as `GOOGLE_IOS_CLIENT_ID`, replacing `REPLACE_ME`.
5. Rebuild (`eas build --profile simulator` or a real build) — the URL scheme
   and OAuth client are compiled in, so this needs a fresh build, not just an
   OTA update.

Until step 4 is done, "Continue with Google" will fail with an auth error;
"Continue with email" only needs steps 1–3.

