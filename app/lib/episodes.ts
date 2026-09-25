import { useEffect, useState } from 'react';
import { onValue, push, ref, update } from 'firebase/database';
import { rtdb } from './firebase';
import { LIMITS, clamp } from './limits';
import { contestants as staticContestants, type Contestant } from '../data/realData';

// The website's Realtime Database is the one shared source of truth for
// eliminations and recaps — whoever publishes an episode (Matt or Courtney,
// from either the site or here) updates the same record, so both leagues and
// both platforms stay in sync automatically.
const LEAGUE_PATH = 'league';

type RemoteContestant = { id: string; eliminatedWeek?: number | null };

// Live-merges eliminatedWeek from the website's RTDB onto the app's static
// cast list (photos/bios/age stay local — only elimination status is live).
// Falls back to the static "nobody's out yet" data until the first snapshot
// arrives, so screens never flash empty.
// `remoteIds` is the RTDB array's own id order — index-sensitive writes (see
// setElimination below) must use THIS order, not the merged/static one,
// since the two arrays aren't guaranteed to be sorted the same way.
export function useLiveContestants(): { contestants: Contestant[]; remoteIds: string[] | null; loading: boolean } {
  const [remote, setRemote] = useState<RemoteContestant[] | null>(null);

  useEffect(() => {
    return onValue(ref(rtdb, `${LEAGUE_PATH}/contestants`), (snap) => {
      setRemote(snap.exists() ? (snap.val() as RemoteContestant[]) : []);
    });
  }, []);

  if (!remote) return { contestants: staticContestants, remoteIds: null, loading: true };

  const byId = new Map(remote.filter(Boolean).map((c) => [c.id, c.eliminatedWeek ?? null]));
  const merged = staticContestants.map((c) =>
    byId.has(c.id) ? { ...c, eliminatedWeek: byId.get(c.id) ?? null } : c
  );
  return { contestants: merged, remoteIds: remote.filter(Boolean).map((c) => c.id), loading: false };
}

export function useEpisodeNotes(): Record<string, string> {
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    return onValue(ref(rtdb, `${LEAGUE_PATH}/episodeNotes`), (snap) => {
      setNotes(snap.exists() ? (snap.val() as Record<string, string>) : {});
    });
  }, []);
  return notes;
}

// Toggles one castaway's elimination for one episode. Writes only the exact
// array index that changed (found from the live contestants list this
// screen already has), never the whole `league` blob — so nothing else the
// website keeps there (draft state, chat) is ever at risk of being clobbered.
export async function setElimination(allContestantIds: string[], contestantId: string, week: number | null) {
  const idx = allContestantIds.indexOf(contestantId);
  if (idx === -1) throw new Error(`Unknown contestant id: ${contestantId}`);
  await update(ref(rtdb, LEAGUE_PATH), { [`contestants/${idx}/eliminatedWeek`]: week });
}

export async function saveEpisodeNote(week: number, text: string) {
  await update(ref(rtdb, LEAGUE_PATH), { [`episodeNotes/${week}`]: text });
}

// Removes the node outright rather than blanking it. The recap notification
// only fires when a week goes from empty to written, so a cleared week can be
// published again and will notify again — which is what makes it testable.
export async function clearEpisodeNote(week: number) {
  await update(ref(rtdb, LEAGUE_PATH), { [`episodeNotes/${week}`]: null });
}

/**
 * Publishes an episode in one shot: eliminations, the recap, and — when asked —
 * an explicit announcement the Cloud Function turns into a push.
 *
 * The announcement is its own record rather than a side effect of writing the
 * recap, so the commissioner decides when the league gets pinged. Editing a
 * typo later doesn't have to notify twenty people again.
 */
export async function publishEpisode(opts: {
  week: number;
  recap: string;
  /** Current cast, in record order — index is the database key. */
  cast: { id: string; eliminatedWeek?: number | null }[];
  eliminatedIds: string[];
  /** Castaway ids among eliminatedIds who left by quitting or medical evac, not a vote. */
  quitIds?: string[];
  notify: boolean;
  /** The episode's name; empty clears it. */
  title?: string;
  /** Prebuilt by holdingsPatch() — idols/advantages, written in the same update. */
  holdings?: Record<string, unknown>;
}) {
  const { week, recap, cast, eliminatedIds, notify, holdings, title, quitIds } = opts;

  // Clamped, not just capped in the editor: an over-length recap is refused by
  // the rules, and it would take the eliminations in this same write with it.
  const patch: Record<string, unknown> = {
    [`episodeNotes/${week}`]: recap.trim() ? clamp(recap, LIMITS.episodeRecap) : null,
  };

  cast.forEach((c, idx) => {
    const checked = eliminatedIds.includes(c.id);
    if (checked) {
      patch[`contestants/${idx}/eliminatedWeek`] = week;
      patch[`contestants/${idx}/exitReason`] = quitIds?.includes(c.id) ? 'quit' : null;
    } else if (c.eliminatedWeek === week) {
      // Only clear someone this episode had marked out. Blanking every
      // unchecked castaway would resurrect everyone voted out in earlier weeks.
      patch[`contestants/${idx}/eliminatedWeek`] = null;
      patch[`contestants/${idx}/exitReason`] = null;
    }
  });

  if (title !== undefined) {
    patch[`episodeTitles/${week}`] = title.trim() ? clamp(title.trim(), LIMITS.episodeTitle) : null;
  }
  Object.assign(patch, holdings ?? {});

  await update(ref(rtdb, LEAGUE_PATH), patch);

  if (notify) {
    await push(ref(rtdb, `${LEAGUE_PATH}/announcements`), { type: 'recap', week, at: Date.now() });
  }
}
