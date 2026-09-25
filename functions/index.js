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
// Leagues: create and join
//
// Leagues live inside their season record (seasons/<seasonId>/leagues/<key>).
// Clients can't add themselves to a league — the rules only let existing
// members write — so both of these run here with admin rights:
//   inviteCodes/<CODE>        -> { seasonId, leagueKey }
//   userLeagues/<uid>/<key>   -> { seasonId, name, personId, joinedAt }
//   ...leagues/<key>/memberIds/<uid> -> the roster id that person plays as

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function randomCode() {
  let c = "";
  for (let i = 0; i < 6; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return c;
}

function cleanName(raw, max = 40) {
  const s = String(raw || "").trim().replace(/\s+/g, " ").slice(0, max);
  if (!s) throw new HttpsError("invalid-argument", "Add your name first.");
  return s;
}

exports.createLeague = onCall({ region: REGION }, async (request) => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const d = request.data || {};
  const db = getDatabase();

  const seasonId = String(d.seasonId || "");
  const catalog = (await db.ref(`seasonCatalog/${seasonId}`).get()).val();
  if (!catalog || !catalog.open) throw new HttpsError("failed-precondition", "That season isn't open for new leagues.");

  const name = cleanName(d.name, 60);
  const playerName = cleanName(d.playerName);
  const picksPerPlayer = Math.max(1, Math.min(10, Number(d.picksPerPlayer) || 2));
  const style = d.style === "points" ? "points" : "last-standing";
  const draftMode = ["live", "auto", "offline"].includes(d.draftMode) ? d.draftMode : "live";
  const draftAt = typeof d.draftAt === "string" && !Number.isNaN(Date.parse(d.draftAt)) ? d.draftAt : null;

  let code = randomCode();
  for (let i = 0; i < 8 && (await db.ref(`inviteCodes/${code}`).get()).exists(); i++) code = randomCode();
  const leagueKey = "lg" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const league = {
    name,
    picksPerPlayer,
    maxOwners: d.sharedPicks === false ? 1 : 2,
    style,
    draftMode,
    draftAt,
    players: [{ id: uid, name: playerName }],
    memberIds: { [uid]: uid },
    commissionerIds: [uid],
    inviteCode: code,
    draftState: { started: false, currentPickIndex: 0, complete: false },
    createdAt: Date.now(),
  };
  await db.ref().update({
    [`seasons/${seasonId}/leagues/${leagueKey}`]: league,
    [`inviteCodes/${code}`]: { seasonId, leagueKey },
    [`userLeagues/${uid}/${leagueKey}`]: { seasonId, name, personId: uid, joinedAt: Date.now() },
  });
  return { seasonId, leagueKey, code, personId: uid };
});

exports.joinLeague = onCall({ region: REGION }, async (request) => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const d = request.data || {};
  const code = String(d.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const db = getDatabase();
  const idx = (await db.ref(`inviteCodes/${code}`).get()).val();
  if (!idx) throw new HttpsError("not-found", "No league with that code.");
  const { seasonId, leagueKey } = idx;
  const lgRef = db.ref(`seasons/${seasonId}/leagues/${leagueKey}`);
  const lg = (await lgRef.get()).val();
  if (!lg) throw new HttpsError("not-found", "No league with that code.");

  const finish = async (personId) => {
    await db.ref(`userLeagues/${uid}/${leagueKey}`).set({ seasonId, name: lg.name, personId, joinedAt: Date.now() });
    return { status: "joined", seasonId, leagueKey, personId, name: lg.name };
  };

  const memberIds = lg.memberIds || {};
  if (memberIds[uid]) return finish(memberIds[uid]);

  // A league copied in with its roster already filled (claimable) lets people
  // take over an existing player — their picks and history come with them.
  const claimed = new Set(Object.values(memberIds));
  const people = (lg.players || []).flatMap((p) => (p.members && p.members.length ? p.members : [{ id: p.id, name: p.name }]));
  const open = lg.claimable ? people.filter((p) => !claimed.has(p.id)) : [];

  if (open.length && !d.claimId) return { status: "choose", seasonId, leagueKey, name: lg.name, open };

  if (d.claimId && d.claimId !== "new") {
    if (!open.some((p) => p.id === d.claimId)) throw new HttpsError("already-exists", "Someone already claimed that player.");
    const res = await lgRef.child("memberIds").transaction((m) => {
      m = m || {};
      if (Object.values(m).includes(d.claimId)) return; // abort: taken meanwhile
      m[uid] = d.claimId;
      return m;
    });
    if (!res.committed) throw new HttpsError("already-exists", "Someone already claimed that player.");
    return finish(d.claimId);
  }

  if (lg.draftState && lg.draftState.started) {
    throw new HttpsError("failed-precondition", "This league has already drafted. Ask the commissioner to add you.");
  }
  const playerName = cleanName(d.playerName);
  const res = await lgRef.transaction((cur) => {
    if (!cur) return; // abort
    cur.players = cur.players || [];
    if (!cur.players.some((p) => p.id === uid)) cur.players.push({ id: uid, name: playerName });
    cur.memberIds = cur.memberIds || {};
    cur.memberIds[uid] = uid;
    return cur;
  });
  if (!res.committed) throw new HttpsError("aborted", "Couldn't join right now. Try again.");
  return finish(uid);
});

// ---------------------------------------------------------------------------
// Auto draft
//
// A league set to 'auto' drafts itself at its draftAt time: snake order, each
// person's turn takes the first still-available name on their own ranking
// (draftBoards/<league>/<person>/order), then falls back to cast order.
// Runs every minute; a league is only ever drafted once (draftState.started).

function snake(order, rounds) {
  const seq = [];
  for (let r = 0; r < rounds; r++) seq.push(...(r % 2 === 0 ? order : [...order].reverse()));
  return seq;
}

async function autoDraftLeague(db, seasonId, leagueKey, lg, cast) {
  const players = (lg.players || []).map((p) => p.id);
  if (!players.length) return;
  const maxOwners = lg.maxOwners || 2;
  const boards = (await db.ref(`draftBoards/${leagueKey}`).get()).val() || {};
  let order = Array.isArray(lg.draftOrder) && lg.draftOrder.length === players.length ? lg.draftOrder : null;
  if (!order) {
    order = [...players];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  }
  const seq = Array.isArray(lg.pickOrder) && lg.pickOrder.length === players.length * lg.picksPerPlayer
    ? lg.pickOrder : snake(order, lg.picksPerPlayer || 1);
  const owners = {};
  const history = [];
  const castIds = cast.filter(Boolean).map((c) => c.id);
  for (const pid of seq) {
    const board = (boards[pid] && boards[pid].order) || [];
    const ranked = [...board.filter((id) => castIds.includes(id)), ...castIds];
    const open = (id) => (owners[id] || []).length < maxOwners && !(owners[id] || []).includes(pid);
    // Prefer someone nobody has taken yet while unpicked names remain, so the
    // field is covered before anyone doubles up.
    const unpicked = ranked.filter((id) => !(owners[id] || []).length);
    const pick = unpicked.find(open) || ranked.find(open);
    if (!pick) continue;
    owners[pick] = [...(owners[pick] || []), pid];
    history.push({ contestantId: pick, playerId: pid, at: Date.now() });
  }
  await db.ref(`seasons/${seasonId}/leagues/${leagueKey}`).update({
    picks: owners,
    draftOrder: order,
    draftState: { started: true, complete: true, currentPickIndex: seq.length, history },
  });
  logger.info("auto drafted", { seasonId, leagueKey, picks: history.length });
}

exports.runScheduledDrafts = onSchedule({ schedule: "every 1 minutes", region: REGION }, async () => {
  const db = getDatabase();
  const catalog = (await db.ref("seasonCatalog").get()).val() || {};
  const now = Date.now();
  for (const seasonId of Object.keys(catalog)) {
    const leagues = (await db.ref(`seasons/${seasonId}/leagues`).get()).val() || {};
    const due = Object.entries(leagues).filter(([, lg]) =>
      lg && lg.draftMode === "auto" && lg.draftAt && Date.parse(lg.draftAt) <= now && !(lg.draftState && lg.draftState.started));
    if (!due.length) continue;
    const cast = (await db.ref(`seasons/${seasonId}/contestants`).get()).val() || [];
    for (const [key, lg] of due) {
      try { await autoDraftLeague(db, seasonId, key, lg, cast); } catch (err) { logger.error("auto draft failed", { seasonId, key, err }); }
    }
  }
});

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
