import { useEffect, useState } from 'react';
import { onValue, ref, remove, update } from 'firebase/database';
import { rtdb } from './firebase';

// Drafts written by the weekly recap task (the outlast-recap skill), one per
// episode. Nothing here shows in the app until the commissioner loads it into
// the episode editor and saves — so an unreviewed draft never reaches the league.
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
export type RecapDraft = { recap?: string; stats?: DraftStats; createdAt?: number; editor?: EditorSnapshot };

export function useRecapDrafts(): Record<string, RecapDraft> {
  const [drafts, setDrafts] = useState<Record<string, RecapDraft>>({});
  useEffect(() => onValue(ref(rtdb, 'recapDrafts'), (snap) => setDrafts(snap.val() ?? {})), []);
  return drafts;
}

// RTDB refuses `undefined` anywhere in a write, and drops empty objects —
// round-tripping through JSON strips the former.
export function saveEditorDraft(ep: number, snap: Omit<EditorSnapshot, 'savedAt'>) {
  const clean = JSON.parse(JSON.stringify({ ...snap, savedAt: Date.now() }));
  return update(ref(rtdb, `recapDrafts/${ep}`), { editor: clean });
}

export function clearRecapDraft(ep: number) {
  return remove(ref(rtdb, `recapDrafts/${ep}`));
}
