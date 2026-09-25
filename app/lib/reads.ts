import { useCallback, useEffect, useState } from 'react';
import { onValue, ref, serverTimestamp, update } from 'firebase/database';
import { rtdb } from './firebase';

// Read receipts, following Messages: one marker per person per league, set
// when they open the conversation. Kept outside `league` for the same reason
// as typing — every client subscribes to that whole record.
//
// This is separate from lib/seen.ts, which drives the unread dot and stays on
// the device: whether YOUR badge is clear is nobody else's business, but
// whether you've seen a message is what a receipt is for.
const READS = 'reads';

export type ReadMap = Record<string, number>;

export function useReads(leagueKey: string): ReadMap {
  const [map, setMap] = useState<ReadMap>({});
  useEffect(() => {
    if (!leagueKey) return;
    return onValue(ref(rtdb, `${READS}/${leagueKey}`), (snap) => {
      setMap((snap.val() as ReadMap) || {});
    });
  }, [leagueKey]);
  return map;
}

/** Marks the conversation read for this person. Safe to call repeatedly. */
export function useMarkRead(leagueKey: string, myId: string) {
  return useCallback(() => {
    if (!leagueKey || !myId) return;
    // serverTimestamp so a device with a wrong clock can't claim to have read
    // a message before it was sent.
    update(ref(rtdb, `${READS}/${leagueKey}`), { [myId]: serverTimestamp() }).catch(() => {});
  }, [leagueKey, myId]);
}

/**
 * Who had opened the conversation at or after `sentAt`, excluding the sender.
 * A receipt only needs the message's own timestamp — there's no per-message
 * bookkeeping, just "your marker is newer than this message".
 */
export function readersOf(reads: ReadMap, sentAt: number, authorId: string): string[] {
  return Object.entries(reads)
    .filter(([id, at]) => id !== authorId && typeof at === 'number' && at >= sentAt)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
}
