import { useEffect, useState } from 'react';
import { get, onValue, push, ref, runTransaction, set, update } from 'firebase/database';
import { rtdb } from './firebase';
import { LIMITS, clamp } from './limits';
import { seasonPath, type SeasonMeta } from './season';

// The app is a native client of the SAME Realtime Database record the
// website runs on (`league`). One source of truth: a prediction locked in on
// the site shows up here instantly and vice versa, the Denver draft is the
// same draft on both, eliminations publish everywhere at once.
//
// Writes are always targeted `update()`s or transactions on specific child
// paths — never a whole-record overwrite — so the app can't clobber anything
// the website keeps in that record.
// Every read/write targets the season of the league that's open — see lib/season.ts.
const root_ = () => seasonPath();

/** One person who can sign in. Their id is what identifies them everywhere. */
export type PlayerMember = { id: string; name: string };

/**
 * A roster entry — the thing that drafts, owns castaways and places in the
 * standings. Usually one person, but a couple plays as a single entry with
 * `members` listing the individuals who share it. The entry's own id is what
 * picks are filed under, so turning a solo entry into a team keeps every
 * existing pick exactly where it was.
 */
export type Player = { id: string; name: string; members?: PlayerMember[] };
export type DraftState = { started: boolean; currentPickIndex: number; complete: boolean; history?: { contestantId: string; playerId: string; at: number }[] };
export type LeagueRecord = {
  name: string;
  picksPerPlayer: number;
  winnerId?: string | null;
  draftOrder?: string[];
  /**
   * The exact player for every pick of the draft, slot by slot. Set by the
   * commissioner when the snake order isn't what they want; absent means the
   * snake built from `draftOrder` is used, which is what every league before
   * this one ran on. Ignored unless its length matches the number of slots,
   * so a roster change can never leave a half-valid sequence governing a
   * live draft.
   */
  pickOrder?: string[];
  draftState?: DraftState;
  players: Player[];
  /** The 6-character join code for this league. */
  inviteCode?: string;
  /** Firebase uid -> the person id they play as in this league (a uid for new
   *  leagues; an existing roster id when someone claimed a copied player). */
  memberIds?: Record<string, string>;
  /** Person ids who run this league (draft setup, invite, photos). */
  commissionerIds?: string[];
  /** How many people may own the same pick (1 = no sharing). Default 2. */
  maxOwners?: number;
  /** 'last-standing' (default) or 'points'. */
  style?: 'last-standing' | 'points';
  /** Points leagues only, default off: fold each player's correct weekly
   *  predictions into their point total (lib/points.ts POINTS.predictionCorrect).
   *  Off by default so a league can keep predictions as a separate, lower-stakes
   *  side game if members are wary of picks affecting the real standings. */
  countPredictions?: boolean;
  /** Draft start, ISO. */
  draftAt?: string | null;
  /** How the draft runs: live in the app, or the commissioner enters picks. */
  draftMode?: 'live' | 'auto' | 'offline';
  /** Castaway photos this league uploaded (castaway id -> image URL). Only this league sees them. */
  castPhotos?: Record<string, string>;
  /** This league's own picture for the puzzle game. Falls back to the default art when unset. */
  puzzleImage?: string;
  picks?: Record<string, string[] | string>;
};
export type RemoteContestant = {
  id: string; name: string; age?: number; from?: string; detail?: string; eliminatedWeek?: number | null; tribe?: string | null;
  /** How they left, only meaningful once eliminatedWeek is set. Defaults to 'voted' if absent. */
  exitReason?: 'voted' | 'quit';
  /** Idols/advantages currently held — see lib/advantages.ts. */
  items?: Record<string, { kind: string; ep: number }>;
};
/** A tribe as the commissioner set it up — see lib/tribes.ts. */
export type Tribe = { name: string; color: string };
export type Reactions = Record<string, Record<string, boolean>>; // emoji -> playerId -> true
/** A GIF sent to the chat. `text` is empty on these — see database.rules.json. */
export type ChatGif = { url: string; preview?: string; width?: number; height?: number; title?: string };
export type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
  reactions?: Reactions;
  gif?: ChatGif;
};
export type LeagueRoot = {
  /** Show/season description, schedule and features — see lib/season.ts. */
  meta?: SeasonMeta;
  week?: number;
  episodeNotes?: Record<string, string>;
  leagues: Record<string, LeagueRecord>;
  contestants: RemoteContestant[];
  predictions?: Record<string, Record<string, Record<string, string>>>;
  messages?: Record<string, Record<string, Omit<ChatMessage, 'id'>>>;
  /** league -> playerId -> contestantId they think wins the whole season */
  winnerPicks?: Record<string, Record<string, string>>;
  /** Commissioner switch: while true, every app and the website run the draft on the practice copy. */
  draftPractice?: boolean;
  /** tribeId -> tribe. Castaways point at one through `contestants[i].tribe`. */
  tribes?: Record<string, Tribe>;
  /** episode -> contestantId -> what they did that episode. See lib/seasonStats.ts. */
  episodeStats?: Record<string, Record<string, EpisodeStat>>;
  /** Episode names, entered in the editor. Older recaps carry theirs as the first line instead. */
  episodeTitles?: Record<string, string>;
  /** Season milestones the commissioner marks from the episode editor. */
  game?: { mergeEp?: number | null; juryEp?: number | null };
};

export type EpisodeStat = {
  immunity?: boolean;
  reward?: boolean;
  journey?: boolean;
  idolFound?: boolean;
  /** Played an idol: 'saved' = it cancelled votes that would have sent them home. */
  idolPlay?: 'saved' | 'wasted';
  votes?: number;
};

// Leagues are data, not code — a new one appears as soon as it's written to
// the shared record. This list only fixes the order they're offered in.
export type LeagueKey = string;
export const LEAGUE_KEYS: LeagueKey[] = ['porterville', 'denver', 'coloradoSprings'];

// ---- People vs teams -------------------------------------------------------
// Identity is per person; drafting and standings are per roster entry. These
// three helpers are the only place that distinction needs to be understood.

/** Everyone who can sign in to this league, teams flattened into people. */
export function peopleOf(lg: LeagueRecord): PlayerMember[] {
  return (lg?.players || []).flatMap((p) =>
    p.members?.length ? p.members : [{ id: p.id, name: p.name }],
  );
}

/** The roster entry a person drafts and places under, or null if not a member. */
export function teamIdFor(lg: LeagueRecord | undefined, personId: string): string | null {
  if (!lg || !personId) return null;
  // A direct id hit covers solo players and anyone whose stored identity is
  // still an old team id, so nobody gets locked out by this change.
  if (lg.players.some((p) => p.id === personId)) return personId;
  return lg.players.find((p) => p.members?.some((m) => m.id === personId))?.id ?? null;
}

/** How this person is addressed individually (not their team's name). */
export function personNameIn(lg: LeagueRecord | undefined, personId: string): string | null {
  if (!lg) return null;
  const person = peopleOf(lg).find((m) => m.id === personId);
  if (person) return person.name;
  return lg.players.find((p) => p.id === personId)?.name ?? null;
}

/** Every league this person belongs to, in LEAGUE_KEYS order then the rest. */
export function leaguesForPerson(root: LeagueRoot, personId: string): string[] {
  const all = Object.keys(root?.leagues || {});
  const ordered = [...LEAGUE_KEYS.filter((k) => all.includes(k)), ...all.filter((k) => !LEAGUE_KEYS.includes(k))];
  return ordered.filter((k) => teamIdFor(root.leagues[k], personId));
}

/**
 * `enabled` gates the subscription on being signed in: the record isn't
 * readable before that, so subscribing early would only produce a permission
 * error. Flipping it to true after sign-in starts the listener for real.
 */
export function useLeagueRoot(enabled = true, seasonId?: string | null): { root: LeagueRoot | null; loading: boolean } {
  const [root, setRoot] = useState<LeagueRoot | null>(null);
  useEffect(() => {
    setRoot(null);
    if (!enabled || !seasonId) return;
    return onValue(ref(rtdb, `seasons/${seasonId}`), (snap) => {
      setRoot(snap.exists() ? (snap.val() as LeagueRoot) : null);
    });
  }, [enabled, seasonId]);
  return { root, loading: enabled && root === null };
}

// picks[contestantId] is normally an array of owner ids (Denver allows 2);
// tolerate a bare string from older data too.
export function ownersOf(league: LeagueRecord, contestantId: string): string[] {
  const v = league.picks?.[contestantId];
  if (!v) return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}
export function rosterIds(league: LeagueRecord, playerId: string): string[] {
  return Object.keys(league.picks || {}).filter((cid) => ownersOf(league, cid).includes(playerId));
}
export function isEliminated(c: { eliminatedWeek?: number | null }) {
  return typeof c.eliminatedWeek === 'number';
}
export function eliminatedInEpisode(root: LeagueRoot, ep: number) {
  return (root.contestants || []).filter((c) => c && c.eliminatedWeek === ep);
}
/**
 * The name a castaway actually goes by, for tight spots like the standings
 * pick slots where a full name gets ellipsised away. A quoted nickname wins
 * over the given name — Angelica "Jelly" Loblack is Jelly to everyone — and
 * otherwise it's the first word. Every first name in the season 51 cast is
 * unique, so there's no ambiguity to resolve.
 */
export function shortName(full: string): string {
  const nick = full.match(/["\u201C\u2018']([^"\u201D\u2019']+)["\u201D\u2019']/);
  if (nick && nick[1].trim()) return nick[1].trim();
  return full.trim().split(/\s+/)[0] || full;
}

export function soleSurvivorId(root: LeagueRoot): string | null {
  const remaining = (root.contestants || []).filter((c) => c && !isEliminated(c));
  return remaining.length === 1 ? remaining[0].id : null;
}

export function predsFor(root: LeagueRoot, lgKey: string, ep: number): Record<string, string> {
  return root.predictions?.[lgKey]?.[String(ep)] || {};
}
export function setPrediction(lgKey: string, ep: number, playerId: string, contestantId: string | null) {
  return update(ref(rtdb, root_()), { [`predictions/${lgKey}/${ep}/${playerId}`]: contestantId });
}

// ---- Weekly money pool (Porterville only) ----
// Putting in a pick IS the buy-in: $5, that week only. Skipping a week costs
// nothing, so the pool is whoever actually picked, not the whole league.
export const WEEKLY_BET = 5;

export type Debt = { fromId: string; fromName: string; toId: string; toName: string; cents: number };
export type Settlement = {
  ep: number;
  entrants: { id: string; name: string }[];
  winners: { id: string; name: string }[];
  potCents: number;
  debts: Debt[];
  /** Nobody called it — everyone keeps their money, no debts. */
  push: boolean;
};

export function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

/**
 * Who owes whom for one scored episode. Losers each put in $5, split evenly
 * among whoever called the boot; the split is done in whole cents so the
 * payouts always add back up to the pot exactly (an uneven remainder goes to
 * the first winner alphabetically rather than vanishing to rounding).
 *
 * Returns null while the episode still has no elimination recorded — there's
 * nothing to settle until the commissioner publishes it.
 */
export function weeklySettlement(root: LeagueRoot, lgKey: string, ep: number): Settlement | null {
  const outIds = eliminatedInEpisode(root, ep).map((c) => c.id);
  if (!outIds.length) return null;

  const lg = root.leagues?.[lgKey];
  if (!lg) return null;
  const preds = predsFor(root, lgKey, ep);
  const nameOf = (id: string) => personNameIn(lg, id) || id;

  const entrants = peopleOf(lg)
    .filter((p) => preds[p.id])
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const winners = entrants.filter((p) => outIds.includes(preds[p.id]));
  const losers = entrants.filter((p) => !outIds.includes(preds[p.id]));
  const potCents = entrants.length * WEEKLY_BET * 100;

  // No winner, or everyone won: nothing changes hands either way.
  if (!winners.length || !losers.length) {
    return { ep, entrants, winners, potCents, debts: [], push: !winners.length };
  }

  const stake = WEEKLY_BET * 100;
  const base = Math.floor(stake / winners.length);
  const remainder = stake - base * winners.length;
  const debts: Debt[] = [];
  losers.forEach((loser) => {
    winners.forEach((winner, i) => {
      const cents = base + (i < remainder ? 1 : 0);
      if (cents > 0) {
        debts.push({ fromId: loser.id, fromName: nameOf(loser.id), toId: winner.id, toName: nameOf(winner.id), cents });
      }
    });
  });

  return { ep, entrants, winners, potCents, debts, push: false };
}

/** The most recent episode with a result recorded, at or below `upTo`. */
export function lastScoredEpisode(root: LeagueRoot, upTo: number): number | null {
  for (let ep = upTo; ep >= 1; ep--) {
    if (eliminatedInEpisode(root, ep).length) return ep;
  }
  return null;
}

// Correct weekly picks per player, across every scored episode.
export function predictionLeaderboard(root: LeagueRoot, lgKey: string) {
  const lg = root.leagues[lgKey];
  const tally: Record<string, { id: string; name: string; wins: number; weeks: number[] }> = {};
  // Per person: partners on a shared roster entry still pick, win and settle
  // up individually.
  peopleOf(lg).forEach((p) => { tally[p.id] = { id: p.id, name: p.name, wins: 0, weeks: [] }; });
  const preds = root.predictions?.[lgKey] || {};
  Object.keys(preds).forEach((epStr) => {
    const ep = Number(epStr);
    const outIds = eliminatedInEpisode(root, ep).map((c) => c.id);
    if (!outIds.length) return;
    Object.entries(preds[epStr]).forEach(([pid, cid]) => {
      if (outIds.includes(cid) && tally[pid]) { tally[pid].wins++; tally[pid].weeks.push(ep); }
    });
  });
  return Object.values(tally).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
}

// ---- Chat (league-wide, stored alongside everything else) ----
export function messagesFor(root: LeagueRoot, lgKey: string): ChatMessage[] {
  const raw = root.messages?.[lgKey] || {};
  return Object.entries(raw)
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => a.createdAt - b.createdAt);
}
// The composer caps the text at LIMITS.messageText, but clamp again here: this
// is the last point before the value reaches the database, and an over-length
// one doesn't just fail its own write — it sits in the record and fails every
// draft transaction afterwards. Author name is capped for the same reason.
export function sendMessage(lgKey: string, authorId: string, authorName: string, text: string) {
  return push(ref(rtdb, `${root_()}/messages/${lgKey}`), {
    authorId,
    authorName: clamp(authorName, LIMITS.personName),
    text: clamp(text, LIMITS.messageText),
    createdAt: Date.now(),
  });
}

/**
 * A GIF is a message with no words. Only the fields the rules allow are sent,
 * and the url is capped here for the same reason the text is: a value the
 * database refuses doesn't only fail its own write.
 */
export function sendGif(lgKey: string, authorId: string, authorName: string, gif: ChatGif) {
  const payload: ChatGif = { url: clamp(gif.url, LIMITS.gifUrl) };
  if (gif.preview) payload.preview = clamp(gif.preview, LIMITS.gifUrl);
  if (typeof gif.width === 'number') payload.width = gif.width;
  if (typeof gif.height === 'number') payload.height = gif.height;
  if (gif.title) payload.title = clamp(gif.title, 100);
  return push(ref(rtdb, `${root_()}/messages/${lgKey}`), {
    authorId,
    authorName: clamp(authorName, LIMITS.personName),
    text: '',
    createdAt: Date.now(),
    gif: payload,
  });
}

// Commissioner-only, and only offered behind a confirmation — this wipes the
// league's whole chat for everyone, not just the person who tapped it.
export function clearMessages(lgKey: string) {
  return update(ref(rtdb, root_()), { [`messages/${lgKey}`]: null });
}

// ---- Draft (commissioner setup + atomic picks) ----
// Practice draft: the commissioner switches the whole league into practice
// (`league/draftPractice`). While it's on, every phone and the website point
// the draft — board, picks, setup, announcements — at a separate `rehearsal`
// copy, so the whole group can rehearse together without touching the real
// draft. Everything else (chat, standings, predictions) stays real.
const PRACTICE_ROOT = 'rehearsal';
const draftPath = (practice: boolean) => (practice ? PRACTICE_ROOT : root_());

/** The record the draft should read from: the live one, or the practice copy (null while it loads). */
export function useDraftRoot(liveRoot: LeagueRoot): { practice: boolean; root: LeagueRoot | null } {
  const practice = !!liveRoot?.draftPractice;
  const [practiceRoot, setPracticeRoot] = useState<LeagueRoot | null>(null);
  useEffect(() => {
    if (!practice) { setPracticeRoot(null); return; }
    return onValue(ref(rtdb, PRACTICE_ROOT), (snap) => {
      setPracticeRoot(snap.exists() ? (snap.val() as LeagueRoot) : null);
    });
  }, [practice]);
  return { practice, root: practice ? practiceRoot : liveRoot };
}

// A fresh practice copy of the live record: same players, draft order and
// cast. Leagues whose picks were seeded without a draft (Porterville) keep
// them so they still read as drafted; every other league starts empty.
function practiceCopy(live: LeagueRoot) {
  const leagues: Record<string, LeagueRecord> = {};
  Object.entries(live.leagues || {}).forEach(([k, lg]) => {
    const seeded = !lg.draftState?.started && Object.keys(lg.picks || {}).length > 0;
    leagues[k] = seeded
      ? lg
      : { ...lg, picks: {}, draftState: { started: false, currentPickIndex: 0, complete: false } };
  });
  // JSON round-trip drops undefined fields, which Firebase refuses to store.
  return JSON.parse(JSON.stringify({ contestants: live.contestants || [], leagues }));
}

export function resetPracticeDraft(live: LeagueRoot) {
  return set(ref(rtdb, PRACTICE_ROOT), practiceCopy(live));
}

// Turning practice on always starts from a clean copy, so leftovers from the
// last rehearsal never show up.
export async function setPracticeForEveryone(on: boolean, live: LeagueRoot) {
  if (on) await resetPracticeDraft(live);
  await update(ref(rtdb, root_()), { draftPractice: on ? true : null });
}

export function draftSequence(order: string[], picksPerPlayer: number): string[] {
  const seq: string[] = [];
  for (let r = 0; r < picksPerPlayer; r++) seq.push(...(r % 2 === 0 ? order : [...order].reverse()));
  return seq;
}

/**
 * Whose pick each slot is — the one answer the whole draft turns on, so
 * everything reads it from here: the board, the turn card, the coverage lock
 * and the pick transaction itself.
 *
 * A custom `pickOrder` wins over the snake, but only if it still describes
 * the same number of slots. The website's sync.js and app.js run the
 * identical rule; if this changes, they change with it, or the two disagree
 * about who is on the clock mid-draft.
 */
export function sequenceOf(league: LeagueRecord): string[] {
  const snake = draftSequence(draftOrderOf(league), league.picksPerPlayer || 0);
  const custom = league.pickOrder;
  return custom && custom.length === snake.length ? custom : snake;
}
export function draftOrderOf(league: LeagueRecord): string[] {
  return league.draftOrder && league.draftOrder.length ? league.draftOrder : league.players.map((p) => p.id);
}
function picksMade(league: LeagueRecord) {
  return Object.keys(league.picks || {}).reduce((n, cid) => n + ownersOf(league, cid).length, 0);
}
// Picks left minus castaways nobody owns yet. At zero, every remaining pick
// has to go to an unpicked castaway or someone ends up with no owner.
//
// Takes the cast as plain ids so the draft transaction — which only holds one
// league node, not the record root — can apply exactly the same rule the UI
// shows. draftSlack is the convenience wrapper for callers that do have a root.
export function slackFor(castIds: string[], league: LeagueRecord) {
  const seq = sequenceOf(league);
  const remaining = seq.length - picksMade(league);
  const uncovered = castIds.filter((id) => ownersOf(league, id).length === 0).length;
  return remaining - uncovered;
}
export function draftSlack(root: LeagueRoot, league: LeagueRecord) {
  return slackFor((root.contestants || []).filter(Boolean).map((c) => c.id), league);
}
// The draft is settled once it's marked complete, or when rosters were entered
// by hand without ever running the live draft (Porterville's picks came in that
// way). After that only commissioners see the draft; players have no reason to.
export function draftDone(league: LeagueRecord | undefined): boolean {
  if (!league) return false;
  if (league.draftState?.complete) return true;
  return Object.keys(league.picks ?? {}).length > 0 && !league.draftState?.started;
}

export function currentTurnPlayerId(league: LeagueRecord): string | null {
  const ds = league.draftState;
  if (!ds || !ds.started || ds.complete) return null;
  const seq = sequenceOf(league);
  return seq[ds.currentPickIndex || 0] ?? null;
}
export function isPickEligible(root: LeagueRoot, league: LeagueRecord, contestantId: string, playerId: string) {
  const owners = ownersOf(league, contestantId);
  if (owners.length >= 2 || owners.includes(playerId)) return false;
  if (owners.length > 0 && draftSlack(root, league) <= 0) return false;
  return true;
}

export function setDraftOrder(lgKey: string, order: string[], practice: boolean) {
  return update(ref(rtdb, draftPath(practice)), { [`leagues/${lgKey}/draftOrder`]: order });
}
/**
 * Every pick belonging to one player, moved to the end of the running order
 * with everyone else's slots left exactly as they were. This is the
 * no-show case: four people missing on draft night go to the back in the
 * order you tap them, and the draft runs without waiting on anyone.
 *
 * Their pick count is preserved rather than assumed, so it stays correct on
 * an order that has already been adjusted by hand.
 */
export function sendPicksToEnd(league: LeagueRecord, playerId: string): string[] {
  const seq = sequenceOf(league);
  const mine = seq.filter((id) => id === playerId);
  return [...seq.filter((id) => id !== playerId), ...mine];
}

/** Saves the slot-by-slot order. Null clears it, putting the snake back. */
export function setPickOrder(lgKey: string, pickOrder: string[] | null, practice: boolean) {
  return update(ref(rtdb, draftPath(practice)), { [`leagues/${lgKey}/pickOrder`]: pickOrder });
}

export function startDraft(lgKey: string, order: string[], practice: boolean) {
  return update(ref(rtdb, draftPath(practice)), {
    [`leagues/${lgKey}/draftOrder`]: order,
    [`leagues/${lgKey}/draftState`]: { started: true, currentPickIndex: 0, complete: false, history: [] },
  });
}

export type DraftResult = { ok: true } | { ok: false; reason: string };

/**
 * Turn a rejected write into something the draft screen can actually say out
 * loud. A validation or permission refusal from the rules arrives as a thrown
 * error with PERMISSION_DENIED in it; everything else is treated as the
 * network being the network.
 */
function describeWriteFailure(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  if (/permission_denied|PERMISSION_DENIED/i.test(msg)) return 'write-denied';
  return 'write-failed';
}

// The path the draft transaction runs on: ONE league, not the whole record.
//
// This used to be the record root, and that is what broke the draft in 2026:
// a transaction rewrites everything under its path, Realtime Database runs
// .validate over all of it, and a chat message longer than the rules allow
// made every pick fail with PERMISSION_DENIED. Chat had nothing to do with
// the draft; it was just inside the same write.
//
// Scoped here, a pick can only be refused by something in its own league.
// The website's sync.js transacts on this same path — both platforms must
// agree, or two simultaneous picks at different paths could clobber each
// other instead of retrying.
const draftLeaguePath = (practice: boolean, lgKey: string) => `${draftPath(practice)}/leagues/${lgKey}`;

// The coverage-lock needs to know how many castaways are still unpicked, which
// means reading `contestants` — outside the league node the transaction owns.
// Safe to read separately: the cast doesn't change mid-draft, and the app
// already holds it in the live subscription, so this resolves from cache.
async function contestantIds(practice: boolean): Promise<string[]> {
  const snap = await get(ref(rtdb, `${draftPath(practice)}/contestants`));
  const list = (snap.val() as LeagueRoot['contestants']) || [];
  return list.filter(Boolean).map((c) => c.id);
}

// Same transaction as the website's sync.js draftPick — identical rules and
// identical path, enforced against the same record, so both platforms can
// draft together.
export async function makeDraftPick(lgKey: string, contestantId: string, playerId: string, practice: boolean): Promise<DraftResult> {
  let outcome: DraftResult = { ok: false, reason: 'unknown' };
  // The practice copy has no validation rules on it; the real record has them
  // on every branch. So a pick that always worked in rehearsal can be refused
  // outright on the night — and an uncaught throw here just makes the tap do
  // nothing, with nothing on screen to say why. Catch it and name it instead.
  try {
    const cast = await contestantIds(practice);
    const res = await runTransaction(ref(rtdb, draftLeaguePath(practice, lgKey)), (lg: LeagueRecord | null) => {
      // `return;` aborts. Returning the null would ask Firebase to DELETE the
      // league, which is never what an absent record should mean.
      if (!lg) { outcome = { ok: false, reason: 'no-league' }; return; }
      const ds = lg.draftState || { started: false, currentPickIndex: 0, complete: false, history: [] };
      if (!ds.started || ds.complete) { outcome = { ok: false, reason: ds.complete ? 'complete' : 'not-started' }; return; }
      const seq = sequenceOf(lg);
      if (ds.currentPickIndex >= seq.length) { outcome = { ok: false, reason: 'complete' }; return; }
      if (seq[ds.currentPickIndex] !== playerId) { outcome = { ok: false, reason: 'not-your-turn' }; return; }

      lg.picks = lg.picks || {};
      const owners = ownersOf(lg, contestantId);
      if (owners.length >= (lg.maxOwners ?? 2)) { outcome = { ok: false, reason: 'taken' }; return; }
      if (owners.includes(playerId)) { outcome = { ok: false, reason: 'already-yours' }; return; }
      if (owners.length > 0 && slackFor(cast, lg) <= 0) { outcome = { ok: false, reason: 'locked' }; return; }

      lg.picks[contestantId] = [...owners, playerId];
      ds.currentPickIndex += 1;
      ds.history = [...(ds.history || []), { contestantId, playerId, at: Date.now() }];
      if (ds.currentPickIndex >= seq.length) ds.complete = true;
      lg.draftState = ds;
      outcome = { ok: true };
      return lg;
    });
    // The logic said yes but the database didn't take it — a rules rejection or
    // too many collisions. Either way it is NOT a completed pick.
    if (outcome.ok && !res.committed) outcome = { ok: false, reason: 'rejected' };
  } catch (e) {
    outcome = { ok: false, reason: describeWriteFailure(e) };
  }
  return outcome;
}

export async function undoDraftPick(lgKey: string, practice: boolean): Promise<DraftResult> {
  let outcome: DraftResult = { ok: false, reason: 'unknown' };
  try {
    const res = await runTransaction(ref(rtdb, draftLeaguePath(practice, lgKey)), (lg: LeagueRecord | null) => {
      const ds = lg?.draftState;
      if (!lg || !ds || !ds.history || !ds.history.length) { outcome = { ok: false, reason: 'empty' }; return; }
      const last = ds.history.pop()!;
      const owners = ownersOf(lg, last.contestantId);
      const i = owners.lastIndexOf(last.playerId);
      if (i !== -1) owners.splice(i, 1);
      if (owners.length) lg.picks![last.contestantId] = owners;
      else if (lg.picks) delete lg.picks[last.contestantId];
      ds.currentPickIndex = Math.max(0, (ds.currentPickIndex || 0) - 1);
      ds.complete = false;
      lg.draftState = ds;
      outcome = { ok: true };
      return lg;
    });
    if (outcome.ok && !res.committed) outcome = { ok: false, reason: 'rejected' };
  } catch (e) {
    outcome = { ok: false, reason: describeWriteFailure(e) };
  }
  return outcome;
}

// Commissioner-only, behind a confirmation. Clears every pick and puts the
/**
 * Closes the draft where it stands: nobody is on the clock any more and no
 * further picks are accepted, on the app or the website.
 *
 * This exists because picks entered by hand (the site's Manual Draft Entry,
 * used for anyone who wasn't there) land straight in `picks` without moving
 * the turn counter — so a finished draft can still read as in-progress, with
 * someone shown on the clock who has already been given their castaways.
 * Reset was the only other control, and that wipes every pick.
 *
 * Runs as a transaction on the league node like every other draft write, so
 * it can't collide with a pick landing at the same moment.
 */
export async function completeDraft(lgKey: string, practice: boolean): Promise<DraftResult> {
  let outcome: DraftResult = { ok: false, reason: 'unknown' };
  try {
    const res = await runTransaction(ref(rtdb, draftLeaguePath(practice, lgKey)), (lg: LeagueRecord | null) => {
      if (!lg) { outcome = { ok: false, reason: 'no-league' }; return; }
      const ds = lg.draftState;
      if (!ds || !ds.started) { outcome = { ok: false, reason: 'not-started' }; return; }
      if (ds.complete) { outcome = { ok: false, reason: 'complete' }; return; }
      ds.currentPickIndex = sequenceOf(lg).length;
      ds.complete = true;
      lg.draftState = ds;
      outcome = { ok: true };
      return lg;
    });
    if (outcome.ok && !res.committed) outcome = { ok: false, reason: 'rejected' };
  } catch (e) {
    outcome = { ok: false, reason: describeWriteFailure(e) };
  }
  return outcome;
}

// draft back to not-started; the draft order is kept.
export function resetDraft(lgKey: string, practice: boolean) {
  return update(ref(rtdb, draftPath(practice)), {
    [`leagues/${lgKey}/picks`]: null,
    [`leagues/${lgKey}/draftState`]: { started: false, currentPickIndex: 0, complete: false },
  });
}

export const DRAFT_FAIL_MESSAGES: Record<string, string> = {
  'not-your-turn': "It's not your turn.",
  taken: 'That castaway already has 2 owners.',
  'already-yours': 'You already have that castaway.',
  locked: 'Down to the wire — only unpicked castaways are available now.',
  complete: 'The draft is already complete.',
  'not-started': "The draft hasn't started yet.",
  empty: 'Nothing to undo.',
  // These three only ever come from the real record — the practice copy has no
  // rules to refuse a write, which is exactly why a rehearsal can go perfectly
  // and the real draft still fall over.
  rejected: "The database didn't accept that pick. Nothing was saved — try again.",
  'write-denied': "The database refused that pick (permission/validation). Nothing was saved — tell Matt.",
  'write-failed': "That pick couldn't be saved — check your connection and try again.",
  unknown: "That pick didn't go through. Nothing was saved — try again.",
};

// ---- Reactions ----
// Stored per message as emoji -> playerId -> true, so a count is just the
// number of keys and "did I react" is a direct lookup. Toggling writes only
// this one leaf, which keeps two people reacting at once from clashing.
export function toggleReaction(
  lgKey: string,
  messageId: string,
  emoji: string,
  playerId: string,
  on: boolean,
) {
  return update(ref(rtdb, `${root_()}/messages/${lgKey}/${messageId}/reactions/${emoji}`), {
    [playerId]: on ? true : null,
  });
}

export function reactionSummary(m: ChatMessage, playerId: string) {
  const out: { emoji: string; count: number; mine: boolean }[] = [];
  for (const [emoji, who] of Object.entries(m.reactions || {})) {
    const ids = Object.keys(who || {}).filter((id) => (who as Record<string, boolean>)[id]);
    if (ids.length) out.push({ emoji, count: ids.length, mine: ids.includes(playerId) });
  }
  return out;
}

/**
 * Who reacted, one row per person per emoji — the same thing the long-press
 * sheet shows. Someone who left two reactions appears twice, as in Messages.
 */
export function reactorsOf(m: ChatMessage): { id: string; emoji: string }[] {
  const out: { id: string; emoji: string }[] = [];
  for (const [emoji, who] of Object.entries(m.reactions || {})) {
    for (const [id, on] of Object.entries((who || {}) as Record<string, boolean>)) {
      if (on) out.push({ id, emoji });
    }
  }
  return out;
}

// ---- Preseason Sole Survivor pick ----
// One pick per player for the whole season, locked at the same moment as the
// week 1 episode prediction so nobody can wait to see the premiere.
export function winnerPicksFor(root: LeagueRoot, lgKey: string): Record<string, string> {
  return root.winnerPicks?.[lgKey] || {};
}

export function setWinnerPick(lgKey: string, playerId: string, contestantId: string) {
  return update(ref(rtdb, `${root_()}/winnerPicks/${lgKey}`), { [playerId]: contestantId });
}
