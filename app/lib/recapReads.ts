import { useCallback, useEffect, useState } from 'react';
import { onValue, ref, runTransaction } from 'firebase/database';
import { rtdb } from './firebase';
import type { LeagueRoot } from './state';

// The newest episode recap each person has opened: recapReads/<lg>/<personId>
// = episode number. Server-side (unlike lib/seen.ts) because the home-screen
// badge is set by the push the Cloud Function sends, and it has to know
// whether you've read this week's results yet. Top level for the same reason
// as reads/ and typing/: every client subscribes to the whole league record.
const RECAP_READS = 'recapReads';

/** The newest episode the commissioner published with "notify" — what counts as a new recap. */
export function latestRecapWeek(root: LeagueRoot | null | undefined): number {
  return Object.values(root?.announcements ?? {}).reduce(
    (max, a) => (a && a.type === 'recap' && typeof a.week === 'number' && a.week > max ? a.week : max),
    0,
  );
}

/**
 * `seenWeek` is null until loaded. Someone with no marker yet (everyone, the
 * first time this ships) is filed as having read whatever's already out, so
 * nobody gets a badge for an episode from weeks ago.
 */
export function useRecapRead(leagueKey: string, personId: string, latest: number) {
  const [seenWeek, setSeenWeek] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const path = `${RECAP_READS}/${leagueKey}/${personId}`;

  useEffect(() => {
    setSeenWeek(null);
    setLoaded(false);
    if (!leagueKey || !personId) return;
    return onValue(ref(rtdb, path), (snap) => {
      const v = snap.val();
      setSeenWeek(typeof v === 'number' ? v : null);
      setLoaded(true);
    });
  }, [path, leagueKey, personId]);

  const markRead = useCallback((week: number) => {
    if (!leagueKey || !personId || !week) return;
    // Never backwards: opening an old episode doesn't un-read the newest one.
    runTransaction(ref(rtdb, path), (cur) => (typeof cur === 'number' && cur >= week ? undefined : week)).catch(() => {});
  }, [path, leagueKey, personId]);

  useEffect(() => {
    if (loaded && seenWeek === null && latest > 0) markRead(latest);
  }, [loaded, seenWeek, latest, markRead]);

  return { seenWeek: loaded ? seenWeek ?? latest : null, markRead };
}
