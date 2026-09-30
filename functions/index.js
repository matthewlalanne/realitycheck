const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onValueUpdated, onValueCreated } = require("firebase-functions/v2/database");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { logger } = require("firebase-functions");
const nodemailer = require("nodemailer");

initializeApp();
const REGION = "us-central1";

// ---------------------------------------------------------------------------
// Email code sign-in
//
// Reality Check has real per-person accounts (unlike Outlast's one shared
// league password), so this is a proper login: a 6-digit code, emailed,
// expiring, single-use, rate-limited. No password to store or leak.
//
// Sent from Matt's Gmail over SMTP with a Gmail app password — free, no
// domain needed, and delivers to anyone. (Resend's free test sender only
// delivers to the Resend account owner until a domain is verified, so
// nobody else ever got a code.) Set the password with
// `firebase functions:secrets:set GMAIL_APP_PASSWORD --project tribe-league-app`.
const GMAIL_USER = "lalanne.matthew@gmail.com";
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

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
  { region: REGION, secrets: [GMAIL_APP_PASSWORD], enforceAppCheck: false },
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

    const mailer = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.value() },
    });
    try {
      await mailer.sendMail({
        from: `Reality Check <${GMAIL_USER}>`,
        to: email,
        subject: `${code} is your Reality Check code`,
        text: `Your sign-in code is ${code}. It expires in 10 minutes.\n\nDidn't request this? You can ignore it.`,
      });
    } catch (err) {
      logger.error("email send failed", err);
      throw new HttpsError("internal", "Couldn't send the code. Try again in a moment.");
    }

    // Saved only after the email actually went out, so a failed send doesn't
    // start the one-minute cooldown (which showed up as a 429 on the retry).
    await ref.set({ email, code, sentAt: Date.now(), expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 });
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

// Deleting a league touches nodes an ordinary member can't write to directly
// (userLeagues/<someone else's uid>, inviteCodes — both server-only by
// design), so this runs as admin rather than a pile of client writes. Wipes
// the league itself and everything filed under its key: chat, predictions,
// season pick, draft boards, read receipts, its invite code, and every
// member's userLeagues entry for it.
exports.deleteLeague = onCall({ region: REGION }, async (request) => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const d = request.data || {};
  const seasonId = String(d.seasonId || "");
  const leagueKey = String(d.leagueKey || "");
  if (!seasonId || !leagueKey) throw new HttpsError("invalid-argument", "Missing league.");

  const db = getDatabase();
  const lg = (await db.ref(`seasons/${seasonId}/leagues/${leagueKey}`).get()).val();
  if (!lg) throw new HttpsError("not-found", "That league doesn't exist.");

  const personId = (lg.memberIds || {})[uid];
  const isCommissioner = (lg.commissionerIds || []).includes(uid) || (personId && (lg.commissionerIds || []).includes(personId));
  const isAdmin = (await db.ref(`admins/${uid}`).get()).val() === true;
  if (!isCommissioner && !isAdmin) throw new HttpsError("permission-denied", "Only a commissioner can delete this league.");

  const removals = {
    [`seasons/${seasonId}/leagues/${leagueKey}`]: null,
    [`seasons/${seasonId}/messages/${leagueKey}`]: null,
    [`seasons/${seasonId}/predictions/${leagueKey}`]: null,
    [`seasons/${seasonId}/winnerPicks/${leagueKey}`]: null,
    [`draftBoards/${leagueKey}`]: null,
    [`reads/${leagueKey}`]: null,
  };
  for (const memberUid of Object.keys(lg.memberIds || {})) {
    removals[`userLeagues/${memberUid}/${leagueKey}`] = null;
  }
  if (lg.inviteCode) removals[`inviteCodes/${lg.inviteCode}`] = null;

  await db.ref().update(removals);
  return { ok: true };
});

exports.joinLeague = onCall({ region: REGION }, async (request) => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const d = request.data || {};
  const code = String(d.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const db = getDatabase();
  // A personal invite (claimInvites, from createClaimInvite) makes whoever
  // opens it one specific roster player, picks and history included.
  const claim = (await db.ref(`claimInvites/${code}`).get()).val();
  const idx = claim || (await db.ref(`inviteCodes/${code}`).get()).val();
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

  if (claim) {
    const res = await lgRef.child("memberIds").transaction((m) => {
      m = m || {};
      if (Object.values(m).includes(claim.personId)) return; // abort: someone already has this player
      m[uid] = claim.personId;
      return m;
    });
    if (!res.committed) throw new HttpsError("already-exists", "Someone already joined as that player. Ask the commissioner for a new link.");
    await db.ref(`claimInvites/${code}`).remove();
    return finish(claim.personId);
  }

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
    // The first pass often runs before the league is fetched, with cur ===
    // null. Returning undefined there aborted every join into a non-claimable
    // league ("Couldn't join right now"); returning null instead lets the SDK
    // retry with the real data (and is a no-op if the league is truly gone).
    if (!cur) return null;
    cur.players = cur.players || [];
    if (!cur.players.some((p) => p.id === uid)) cur.players.push({ id: uid, name: playerName });
    cur.memberIds = cur.memberIds || {};
    cur.memberIds[uid] = uid;
    return cur;
  });
  if (!res.committed || !res.snapshot.exists()) throw new HttpsError("aborted", "Couldn't join right now. Try again.");
  return finish(uid);
});

// Personal invite for one roster player who was added by name (no account
// yet). Only whoever opens it becomes that player, so there's no "pick
// yourself" list to grab the wrong name from. Commissioners and admins only.
// Same 6-character format as league codes, so the Join screen takes either.
exports.createClaimInvite = onCall({ region: REGION }, async (request) => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const d = request.data || {};
  const seasonId = String(d.seasonId || "");
  const leagueKey = String(d.leagueKey || "");
  const personId = String(d.personId || "");
  if (!seasonId || !leagueKey || !personId) throw new HttpsError("invalid-argument", "Missing player.");

  const db = getDatabase();
  const lg = (await db.ref(`seasons/${seasonId}/leagues/${leagueKey}`).get()).val();
  if (!lg) throw new HttpsError("not-found", "That league doesn't exist.");
  const me = (lg.memberIds || {})[uid];
  const isCommissioner = (lg.commissionerIds || []).includes(uid) || (me && (lg.commissionerIds || []).includes(me));
  const isAdmin = (await db.ref(`admins/${uid}`).get()).val() === true;
  if (!isCommissioner && !isAdmin) throw new HttpsError("permission-denied", "Only a commissioner can invite players.");

  const people = (lg.players || []).flatMap((p) => (p.members && p.members.length ? p.members : [{ id: p.id, name: p.name }]));
  const person = people.find((p) => p.id === personId);
  if (!person) throw new HttpsError("not-found", "That player isn't in the league.");
  if (Object.values(lg.memberIds || {}).includes(personId)) throw new HttpsError("already-exists", `${person.name} already has an account in this league.`);

  // One live invite per player: reuse it rather than leaving several around.
  const existing = (await db.ref("claimInvites").orderByChild("personId").equalTo(personId).get()).val() || {};
  const reuse = Object.entries(existing).find(([, v]) => v.leagueKey === leagueKey);
  if (reuse) return { code: reuse[0], name: person.name };

  let code = randomCode();
  for (let i = 0; i < 8; i++) {
    const taken = (await db.ref(`inviteCodes/${code}`).get()).exists() || (await db.ref(`claimInvites/${code}`).get()).exists();
    if (!taken) break;
    code = randomCode();
  }
  await db.ref(`claimInvites/${code}`).set({ seasonId, leagueKey, personId, createdBy: uid, createdAt: Date.now() });
  return { code, name: person.name };
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

// ---------------------------------------------------------------------------
// Push notifications
//
// Devices register their Expo push token client-side (app/lib/push.ts) under
// pushTokens/<leagueKey>_<playerId> — one entry per league a phone has open,
// keyed so a lookup for "this player, in this league" is a single get(), no
// scanning. Sending goes straight to Expo's push service (no APNs/FCM keys
// to manage ourselves); Expo relays to Apple/Google from there.
//
// Deliberately contentless (see push.ts's own comment): a title says what
// kind of thing happened, never who said what or who's still in it.
//
// NOTE: per-person toggles (app/lib/notificationPrefs.ts) are stored on the
// device only right now, not synced here — so these can't yet skip someone
// who turned a category off. Every league member gets these two kinds until
// prefs move server-side.
async function sendExpoPush(messages) {
  const list = messages.filter((m) => m && m.to);
  if (!list.length) return;
  // Expo's own limit is 100 messages per request; our leagues are nowhere
  // close, but chunking costs nothing and means this never needs revisiting.
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) logger.error("expo push send failed", { status: res.status, body: await res.text() });
    } catch (err) {
      logger.error("expo push send error", err);
    }
  }
}

/** One player's registered token for one league, or null if they never opened it on a device with push enabled. */
async function tokenFor(db, leagueKey, playerId) {
  const snap = await db.ref(`pushTokens/${leagueKey}_${playerId}`).get();
  const v = snap.val();
  return v && v.token ? v.token : null;
}

function pushMessage(to, title, body, data) {
  return { to, title, body, data, sound: "default", priority: "high" };
}

// Same snake-draft math as app/lib/state.ts (draftOrderOf/draftSequence/
// sequenceOf) — reimplemented here rather than imported, same as
// autoDraftLeague's own snake() above: functions run as plain Node, not
// through the app's bundler.
function serverDraftOrderOf(lg) {
  const ids = (lg.players || []).map((p) => p.id);
  if (!lg.draftOrder || !lg.draftOrder.length) return ids;
  const known = lg.draftOrder.filter((id) => ids.includes(id));
  const added = ids.filter((id) => !known.includes(id));
  return [...known, ...added];
}
function serverSequenceOf(lg) {
  const order = serverDraftOrderOf(lg);
  const seq = snake(order, lg.picksPerPlayer || 0);
  return lg.pickOrder && lg.pickOrder.length === seq.length ? lg.pickOrder : seq;
}

// Fires on every draft state change (start, each pick, undo, reset) and
// pushes only the person now on the clock — covers "the draft just started,
// you're up first" and "it's your turn" with the same check.
exports.notifyDraftTurn = onValueUpdated(
  { ref: "/seasons/{seasonId}/leagues/{leagueKey}/draftState", region: REGION },
  async (event) => {
    const after = event.data.after.val();
    if (!after || !after.started || after.complete) return;
    const { seasonId, leagueKey } = event.params;
    const db = getDatabase();
    const lg = (await db.ref(`seasons/${seasonId}/leagues/${leagueKey}`).get()).val();
    if (!lg) return;
    const seq = serverSequenceOf(lg);
    const onClockId = seq[after.currentPickIndex || 0];
    if (!onClockId) return;

    const before = event.data.before.val();
    const wasOnClockId = before && before.started && !before.complete
      ? serverSequenceOf(lg)[before.currentPickIndex || 0]
      : null;
    // Only the moment someone NEW comes on the clock — not every write to
    // draftState (an undo, for instance, can restore the same person).
    if (onClockId === wasOnClockId) return;

    const token = await tokenFor(db, leagueKey, onClockId);
    if (!token) return;
    await sendExpoPush([
      pushMessage(token, lg.name, "You're on the clock — it's your turn to pick.", {
        type: "draft", leagueKey, seasonId,
      }),
    ]);
  },
);

// Fires on every new chat message; notifies everyone else in the league.
exports.notifyNewMessage = onValueCreated(
  { ref: "/seasons/{seasonId}/messages/{leagueKey}/{messageId}", region: REGION },
  async (event) => {
    const msg = event.data.val();
    if (!msg || !msg.authorId) return;
    const { seasonId, leagueKey } = event.params;
    const db = getDatabase();
    const lg = (await db.ref(`seasons/${seasonId}/leagues/${leagueKey}`).get()).val();
    if (!lg) return;

    const people = (lg.players || []).flatMap((p) => (p.members && p.members.length ? p.members : [{ id: p.id, name: p.name }]));
    const others = people.filter((p) => p.id !== msg.authorId);
    if (!others.length) return;

    const authorName = msg.authorName || "Someone";
    const tokens = await Promise.all(others.map((p) => tokenFor(db, leagueKey, p.id)));
    const messages = tokens
      .map((token, i) => token && pushMessage(token, lg.name, `${authorName} sent a message`, {
        type: "message", leagueKey, seasonId,
      }))
      .filter(Boolean);
    await sendExpoPush(messages);
  },
);

// ---------------------------------------------------------------------------
// Pick reminders
//
// A nudge 12 hours before an episode airs, to anyone in a league who hasn't
// made that week's prediction yet. Same air-time math as the app's own
// lib/countdown.ts (episodeAirTime/slotFor) — the schedule is stored as
// wall-clock time in the network's ET/PT slot, and both sides have to agree
// on the same absolute instant or this fires at the wrong time relative to
// what players see. Eastern is the reference zone here (there's no "device"
// on the server); ET and PT share the same primetime instant either way.

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_LEAD_MS = 12 * 60 * 60 * 1000; // 12 hours before air

function nthSunday(y, m, n) {
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
}
function isDaylightTimeET(y, m, d) {
  const day = Date.UTC(y, m, d);
  return day >= Date.UTC(y, 2, nthSunday(y, 2, 2)) && day < Date.UTC(y, 10, nthSunday(y, 10, 1));
}

// Mirrors lib/countdown.ts's slotFor + episodeAirTime, Eastern-referenced.
function episodeAirUtc(episodes, ep) {
  const nums = Object.keys(episodes || {}).map(Number).filter((n) => n >= 1).sort((a, b) => a - b);
  if (!nums.length) return null;
  let base = nums[0];
  let text = episodes[String(nums[0])];
  for (const n of nums) if (n <= ep) { base = n; text = episodes[String(n)]; }
  const [date, time] = text.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "20:00").split(":").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d) + (ep - base) * 7 * DAY_MS);
  const yy = day.getUTCFullYear(), mo = day.getUTCMonth(), dd = day.getUTCDate();
  const offset = -5 + (isDaylightTimeET(yy, mo, dd) ? 1 : 0); // ET: -5 std, -4 daylight
  return Date.UTC(yy, mo, dd, hh - offset, mm);
}

// The next episode whose air time hasn't passed yet, same as the app's
// upcomingEpisodeNumber — capped so a season with no schedule can't spin.
function upcomingEpisode(episodes, now) {
  for (let ep = 1; ep <= 200; ep++) {
    const at = episodeAirUtc(episodes, ep);
    if (at === null) return null;
    if (at > now) return { ep, airAt: at };
  }
  return null;
}

exports.sendPickReminders = onSchedule({ schedule: "every 15 minutes", region: REGION }, async () => {
  const db = getDatabase();
  const now = Date.now();
  const catalog = (await db.ref("seasonCatalog").get()).val() || {};

  for (const seasonId of Object.keys(catalog)) {
    const meta = (await db.ref(`seasons/${seasonId}/meta`).get()).val();
    const upcoming = meta && upcomingEpisode(meta.episodes, now);
    if (!upcoming) continue;
    const { ep, airAt } = upcoming;
    // Only in the window from 12h-before up to air itself — once it airs,
    // a reminder to pick is just noise.
    if (now < airAt - REMINDER_LEAD_MS || now >= airAt) continue;

    const sentRef = db.ref(`pickReminderSent/${seasonId}/${ep}`);
    if ((await sentRef.get()).val()) continue;
    await sentRef.set(true);

    const leagues = (await db.ref(`seasons/${seasonId}/leagues`).get()).val() || {};
    for (const [leagueKey, lg] of Object.entries(leagues)) {
      if (!lg) continue;
      const picked = (await db.ref(`seasons/${seasonId}/predictions/${leagueKey}/${ep}`).get()).val() || {};
      const people = (lg.players || []).flatMap((p) => (p.members && p.members.length ? p.members : [{ id: p.id, name: p.name }]));
      const unpicked = people.filter((p) => !picked[p.id]);
      if (!unpicked.length) continue;
      const tokens = await Promise.all(unpicked.map((p) => tokenFor(db, leagueKey, p.id)));
      const messages = tokens
        .map((token) => token && pushMessage(token, lg.name, "This week's pick locks in a few hours — you haven't picked yet.", {
          type: "predictions", leagueKey, seasonId,
        }))
        .filter(Boolean);
      await sendExpoPush(messages);
    }
    logger.info("pick reminders sent", { seasonId, ep });
  }
});
