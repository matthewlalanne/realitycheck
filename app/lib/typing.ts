import { useCallback, useEffect, useRef, useState } from 'react';
import { onValue, ref, serverTimestamp, update } from 'firebase/database';
import { rtdb } from './firebase';

// Who's typing, kept in its own top-level node rather than inside `league`.
// Every client subscribes to the whole league record, so putting a value that
// changes on every keystroke in there would rebroadcast the league to everyone
// several times a second.
//
// Each entry is just a timestamp. Nothing has to clean up after a dropped
// connection or a force-quit: an entry older than STALE_MS is simply ignored,
// so a stale "typing…" disappears on its own.
const TYPING = 'typing';
const STALE_MS = 6000;
// One write per this interval while someone types, instead of per keystroke.
const BEAT_MS = 2500;

/** Person ids currently typing in this league, excluding yourself. */
export function useTypingOthers(leagueKey: string, myId: string): string[] {
  const [raw, setRaw] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!leagueKey) return;
    return onValue(ref(rtdb, `${TYPING}/${leagueKey}`), (snap) => {
      setRaw((snap.val() as Record<string, number>) || {});
    });
  }, [leagueKey]);

  // Entries expire on their own, so re-evaluate on a timer as well as on data.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  return Object.entries(raw)
    .filter(([id, at]) => id !== myId && typeof at === 'number' && now - at < STALE_MS)
    .map(([id]) => id);
}

/**
 * Call `beat()` on every keystroke and `stop()` when the message is sent or
 * the field is cleared. Writes are throttled to one per BEAT_MS.
 */
export function useTypingSignal(leagueKey: string, myId: string) {
  const lastBeat = useRef(0);

  const write = useCallback(
    (value: unknown) => {
      if (!leagueKey || !myId) return;
      update(ref(rtdb, `${TYPING}/${leagueKey}`), { [myId]: value }).catch(() => {});
    },
    [leagueKey, myId],
  );

  const beat = useCallback(() => {
    const now = Date.now();
    if (now - lastBeat.current < BEAT_MS) return;
    lastBeat.current = now;
    // serverTimestamp keeps this honest against a device with a wrong clock.
    write(serverTimestamp());
  }, [write]);

  const stop = useCallback(() => {
    lastBeat.current = 0;
    write(null);
  }, [write]);

  // Don't leave a "typing…" behind when the screen goes away.
  useEffect(() => () => { write(null); }, [write]);

  return { beat, stop };
}
