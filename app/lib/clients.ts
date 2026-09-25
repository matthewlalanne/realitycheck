import { useCallback, useEffect, useState } from 'react';
import { onValue, ref, update } from 'firebase/database';
import { rtdb } from './firebase';
import { CLIENT_VERSION } from './clientVersion';
import { peopleOf, type LeagueRecord } from './state';

// Who is running which build, and what the floor currently is.
//
// This exists because of the 2026 Denver draft: two people were on a bundle
// that predated the hand-set pick order, so their phones built the old snake
// order, believed it was their turn and picked out of turn. The turn check
// runs on the phone doing the picking, so an out-of-date phone is sincerely
// wrong and the database has no reason to refuse it.
//
// Both nodes sit outside `league` — every client subscribes to that whole
// record, and none of this belongs in it.
const VERSIONS = 'appVersions';
const MIN_CLIENT = 'appMinClient';

export type ClientReport = { client?: number; at?: number; updateId?: string };

export function useClientVersions(): Record<string, ClientReport> {
  const [map, setMap] = useState<Record<string, ClientReport>>({});
  useEffect(() => onValue(ref(rtdb, VERSIONS), (snap) => {
    setMap((snap.val() as Record<string, ClientReport>) || {});
  }), []);
  return map;
}

/** The version everyone is required to be on, or 0 while nothing is set. */
export function useMinClient(): number {
  const [min, setMin] = useState(0);
  useEffect(() => onValue(ref(rtdb, MIN_CLIENT), (snap) => {
    const v = snap.val();
    setMin(typeof v === 'number' ? v : 0);
  }), []);
  return min;
}

/** Raises the floor to this build. Written by a commissioner, from the app. */
export function requireThisVersion() {
  return update(ref(rtdb, '/'), { [MIN_CLIENT]: CLIENT_VERSION });
}

export type StalePerson = { id: string; name: string; on: number | null };

/**
 * Everyone in this league who is behind `want` (their own report is older, or
 * they have never reported at all — someone who has never opened the app
 * since this check shipped is exactly who we're looking for).
 *
 * Someone with no app at all shows up here too, which is correct: they can't
 * pick from a phone, so the commissioner needs to know to expect them on the
 * website.
 */
export function stalePeople(
  league: LeagueRecord | undefined,
  versions: Record<string, ClientReport>,
  want = CLIENT_VERSION,
): StalePerson[] {
  if (!league) return [];
  return peopleOf(league)
    .map((p) => ({ id: p.id, name: p.name, on: versions[p.id]?.client ?? null }))
    .filter((p) => p.on === null || p.on < want)
    .sort((a, b) => a.name.localeCompare(b.name));
}
