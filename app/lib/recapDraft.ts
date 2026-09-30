import { useEffect, useState } from 'react';
import { onValue, ref, remove, update } from 'firebase/database';
import { rtdb } from './firebase';
import { activeSeasonId } from './season';

// Drafts written by the weekly recap task (a per-show recap skill, e.g.
// .claude/skills/amazing-race-recap), one per episode, filed under the season
// at recapDrafts/<seasonId>/<ep> so two shows' episode 1 never collide.
// Nothing here shows in the app until an admin loads it into the episode
// editor and saves — so an unreviewed draft never reaches the league.
//
// `stats` is the skill's JSON as-is. Any field it couldn't confirm is null and
// explained in `needsMatt`; the editor surfaces those so blanks are obvious.
export type DraftStats = {
  episode: number;
  title?: string | null;
  votedOut: string[] | null;
  finalVote?: string | null;
  votes: Record<string, number | null> | null;
  immunity: { tribe: string | null; individuals: string[] } | null;
  reward: { tribe: string | null; individuals: string[] } | null;
  idolsFound: string[] | null;
  idolsPlayed: { id: string; outcome: 'saved' | 'wasted' | null }[] | null;
  journeys: string[] | null;
  advantagesFound: { id: string; kind: string }[] | null;
  merge: boolean | null;
  needsMatt?: string[];
  sources?: string[];
};

/**
 * The Amazing Race version: a leg has eliminated team(s), a winner, and
 * sometimes no elimination at all. Team ids are the season's contestant ids.
 */
export type RaceDraftStats = {
  show: 'amazing-race';
  episode: number;
  title?: string | null;
  eliminated: string[] | null;
  legWinner: string | null;
  /** Last team in on a non-elimination leg (so they stay in). */
  savedLast: string | null;
  nonElimination: boolean | null;
  needsMatt?: string[];
  sources?: string[];
};

export function isRaceDraft(s: DraftStats | RaceDraftStats | undefined): s is RaceDraftStats {
  return !!s && (s as RaceDraftStats).show === 'amazing-race';
}
/**
 * The commissioner's own work in progress on an episode, saved from the
 * editor with "Save draft" so closing the screen doesn't lose it. Restored
 * automatically the next time the episode is opened. Never shown to the league.
 */
export type EditorSnapshot = {
  title?: string;
  recap: string;
  out: string[];
  stats: Record<string, unknown>;
  items: Record<string, Record<string, { kind: string; ep: number }>>;
  mergeHere: boolean;
  needs: string[] | null;
  savedAt: number;
};
export type RecapDraft = { recap?: string; stats?: DraftStats | RaceDraftStats; createdAt?: number; editor?: EditorSnapshot };

export function useRecapDrafts(): Record<string, RecapDraft> {
  const [drafts, setDrafts] = useState<Record<string, RecapDraft>>({});
  useEffect(() => onValue(ref(rtdb, `recapDrafts/${activeSeasonId()}`), (snap) => setDrafts(snap.val() ?? {}), () => setDrafts({})), []);
  return drafts;
}

// RTDB refuses `undefined` anywhere in a write, and drops empty objects —
// round-tripping through JSON strips the former.
export function saveEditorDraft(ep: number, snap: Omit<EditorSnapshot, 'savedAt'>) {
  const clean = JSON.parse(JSON.stringify({ ...snap, savedAt: Date.now() }));
  return update(ref(rtdb, `recapDrafts/${activeSeasonId()}/${ep}`), { editor: clean });
}

export function clearRecapDraft(ep: number) {
  return remove(ref(rtdb, `recapDrafts/${activeSeasonId()}/${ep}`));
}
