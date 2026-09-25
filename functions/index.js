const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { logger } = require("firebase-functions");
const { Resend } = require("resend");

initializeApp();
const REGION = "us-central1";

// ---------------------------------------------------------------------------
// Email code sign-in
//
// Reality Check has real per-person accounts (unlike Outlast's one shared
// league password), so this is a proper login: a 6-digit code, emailed,
// expiring, single-use, rate-limited. No password to store or leak.
//
// RESEND_API_KEY: from resend.com (free tier is plenty for this). Set with
// `firebase functions:secrets:set RESEND_API_KEY --project tribe-league-app`.
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes, matches the app's copy
const CODE_COOLDOWN_MS = 60 * 1000; // one send per email per minute
const MAX_ATTEMPTS = 5; // wrong-code guesses before the code is burned

function normalizeEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

// Firebase uid can't contain '.', '#', '$', '[', ']', '/' — emails do.
function uidForEmail(email) {
  return "email_" + Buffer.from(email).toString("base64url");
}

function sixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

exports.requestEmailCode = onCall(
  { region: REGION, secrets: [RESEND_API_KEY], enforceAppCheck: false },
  async (request) => {
    const email = normalizeEmail(request.data && request.data.email);
    if (!email) throw new HttpsError("invalid-argument", "Enter a valid email address.");

    const db = getDatabase();
    const ref = db.ref(`authCodes/${uidForEmail(email)}`);
    const existing = (await ref.get()).val();
    if (existing && Date.now() - existing.sentAt < CODE_COOLDOWN_MS) {
      throw new HttpsError("resource-exhausted", "Give it a few seconds before requesting another code.");
    }

    const code = sixDigitCode();
    await ref.set({ email, code, sentAt: Date.now(), expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 });

    const resend = new Resend(RESEND_API_KEY.value());
    try {
      await resend.emails.send({
        from: "Reality Check <sign-in@playrealitycheck.app>",
        to: email,
        subject: `${code} is your Reality Check code`,
        text: `Your sign-in code is ${code}. It expires in 10 minutes.\n\nDidn't request this? You can ignore it.`,
      });
    } catch (err) {
      logger.error("email send failed", err);
      throw new HttpsError("internal", "Couldn't send the code. Try again in a moment.");
    }

    return { ok: true };
  },
);

exports.verifyEmailCode = onCall(
  { region: REGION, enforceAppCheck: false },
  async (request) => {
    const email = normalizeEmail(request.data && request.data.email);
    const supplied = String((request.data && request.data.code) || "").trim();
    if (!email || !/^\d{6}$/.test(supplied)) {
      throw new HttpsError("invalid-argument", "Enter the 6-digit code.");
    }

    const uid = uidForEmail(email);
    const ref = getDatabase().ref(`authCodes/${uid}`);
    const rec = (await ref.get()).val();
    if (!rec) throw new HttpsError("not-found", "Request a new code.");
    if (Date.now() > rec.expiresAt) {
      await ref.remove();
      throw new HttpsError("deadline-exceeded", "That code expired. Request a new one.");
    }
    if ((rec.attempts || 0) >= MAX_ATTEMPTS) {
      await ref.remove();
      throw new HttpsError("resource-exhausted", "Too many tries. Request a new code.");
    }
    if (rec.code !== supplied) {
      await ref.update({ attempts: (rec.attempts || 0) + 1 });
      throw new HttpsError("permission-denied", "That code doesn't match.");
    }

    await ref.remove(); // single-use
    const token = await getAuth().createCustomToken(uid, { method: "email", email });
    // Best-effort: keep the auth user's email set, for anything reading auth.token.email.
    try { await getAuth().updateUser(uid, { email }); } catch { try { await getAuth().createUser({ uid, email }); } catch { /* ignore */ } }
    return { token };
  },
);

// ---------------------------------------------------------------------------
// Google sign-in
//
// The client does the OAuth dance (expo-auth-session) and hands us the
// resulting Google ID token. We verify it server-side and mint our own
// Firebase custom token, rather than trusting the client to call
// signInWithCredential directly — this project's Auth is server-issued
// tokens only, same shape as Outlast's leagueSignIn and the email flow above.
exports.googleSignIn = onCall(
  { region: REGION, enforceAppCheck: false },
  async (request) => {
    const idToken = request.data && request.data.idToken;
    if (typeof idToken !== "string" || !idToken) {
      throw new HttpsError("invalid-argument", "Missing Google credential.");
    }

    // Verify the Google ID token against Google's own public keys — no
    // Firebase Auth "Google provider" setup required for this check itself,
    // though the app's OAuth client (see README) still has to exist.
    let payload;
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (!res.ok) throw new Error(`tokeninfo ${res.status}`);
      payload = await res.json();
    } catch (err) {
      logger.error("google token verify failed", err);
      throw new HttpsError("unauthenticated", "Couldn't verify that with Google.");
    }
    if (!payload.email || payload.email_verified !== "true") {
      throw new HttpsError("unauthenticated", "That Google account has no verified email.");
    }

    const uid = "google_" + payload.sub;
    const token = await getAuth().createCustomToken(uid, { method: "google", email: payload.email });
    try {
      await getAuth().updateUser(uid, { email: payload.email, displayName: payload.name || undefined, photoURL: payload.picture || undefined });
    } catch {
      try { await getAuth().createUser({ uid, email: payload.email, displayName: payload.name || undefined, photoURL: payload.picture || undefined }); } catch { /* ignore */ }
    }
    return { token, email: payload.email, name: payload.name || null, photoUrl: payload.picture || null };
  },
);

// ---------------------------------------------------------------------------
// Clears expired sign-in codes so authCodes doesn't grow forever.
exports.pruneExpiredCodes = onSchedule(
  { schedule: "every 24 hours", region: REGION },
  async () => {
    const db = getDatabase();
    const snap = await db.ref("authCodes").get();
    const now = Date.now();
    const updates = {};
    snap.forEach((child) => {
      if ((child.val().expiresAt || 0) < now) updates[child.key] = null;
    });
    if (Object.keys(updates).length) await db.ref("authCodes").update(updates);
  },
);
