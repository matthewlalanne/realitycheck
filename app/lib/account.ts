import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { onValue, ref, update } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { auth, functions, rtdb } from './firebase';

// Real accounts: every person signs in (Google or email code) and gets their
// own Firebase uid. Leagues they're in are indexed at userLeagues/<uid>, which
// only the server writes — creating and joining go through Cloud Functions
// (functions/index.js) so nobody can add themselves to a league without its
// code.

export function useAuthUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(!auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);
  return { user, loading };
}

export function logOut() {
  return signOut(auth);
}

/** Matt enters each season's results once for every league: admins/<uid> = true. */
export function useIsAdmin(uid: string | null | undefined): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!uid) { setAdmin(false); return; }
    return onValue(ref(rtdb, `admins/${uid}`), (s) => setAdmin(s.val() === true), () => setAdmin(false));
  }, [uid]);
  return admin;
}

export type MyLeague = { seasonId: string; leagueKey: string; name: string; personId: string; joinedAt?: number };

export function useMyLeagues(uid: string | null | undefined): { leagues: MyLeague[]; loading: boolean } {
  const [leagues, setLeagues] = useState<MyLeague[] | null>(null);
  useEffect(() => {
    if (!uid) { setLeagues([]); return; }
    return onValue(
      ref(rtdb, `userLeagues/${uid}`),
      (s) => {
        const v = (s.val() || {}) as Record<string, Omit<MyLeague, 'leagueKey'>>;
        setLeagues(
          Object.entries(v)
            .map(([leagueKey, l]) => ({ ...l, leagueKey }))
            .sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0)),
        );
      },
      () => setLeagues([]),
    );
  }, [uid]);
  return { leagues: leagues ?? [], loading: leagues === null };
}

export type Profile = { name: string; photo?: string | null };

export function useProfile(uid: string | null | undefined): { profile: Profile | null; loading: boolean } {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  useEffect(() => {
    if (!uid) { setProfile(null); return; }
    return onValue(ref(rtdb, `users/${uid}`), (s) => setProfile((s.val() as Profile) ?? null), () => setProfile(null));
  }, [uid]);
  return { profile: profile ?? null, loading: profile === undefined };
}

export function saveProfile(uid: string, p: Profile) {
  return update(ref(rtdb, `users/${uid}`), { name: p.name.trim().slice(0, 40), photo: p.photo ?? null });
}

/** Just the name — saveProfile would also reset the stored photo. */
export function saveProfileName(uid: string, name: string) {
  return update(ref(rtdb, `users/${uid}`), { name: name.trim().slice(0, 40) });
}

// ---- Seasons a league can be built on ----------------------------------------

export type SeasonOption = { id: string; showId: string; showName: string; label: string; open: boolean; castCount: number };

/** The catalog Matt maintains at seasonCatalog/<seasonId>. */
export function useSeasonCatalog(): SeasonOption[] {
  const [list, setList] = useState<SeasonOption[]>([]);
  useEffect(() => onValue(ref(rtdb, 'seasonCatalog'), (s) => {
    const v = (s.val() || {}) as Record<string, Omit<SeasonOption, 'id'>>;
    setList(Object.entries(v).map(([id, o]) => ({ ...o, id })));
  }, () => setList([])), []);
  return list;
}

// ---- Create / join -----------------------------------------------------------

function friendly(err: unknown, fallback: string): Error {
  const e = err as { code?: string; message?: string };
  const code = e?.code ?? '';
  if (code.includes('not-found')) return new Error("That code doesn't match a league. Check it with your commissioner.");
  if (code.includes('invalid-argument') || code.includes('failed-precondition') || code.includes('already-exists')) {
    return new Error(e.message || fallback);
  }
  return new Error(fallback);
}

export type NewLeague = {
  seasonId: string;
  name: string;
  style: 'last-standing' | 'points';
  draftMode: 'live' | 'auto' | 'offline';
  draftAt?: string | null;
  picksPerPlayer: number;
  sharedPicks: boolean;
  playerName: string;
};

export async function createLeague(input: NewLeague): Promise<{ seasonId: string; leagueKey: string; code: string; personId: string }> {
  try {
    const res = await httpsCallable<NewLeague, { seasonId: string; leagueKey: string; code: string; personId: string }>(functions, 'createLeague')(input);
    return res.data;
  } catch (err) {
    throw friendly(err, "Couldn't create the league. Check your connection and try again.");
  }
}

export type JoinResult =
  | { status: 'joined'; seasonId: string; leagueKey: string; personId: string; name: string }
  | { status: 'choose'; seasonId: string; leagueKey: string; name: string; open: { id: string; name: string }[] };

/**
 * Joins by code. A league copied in with its roster already filled (Denver)
 * answers 'choose' with the players nobody has claimed yet; call again with
 * `claimId` to become one of them, or `claimId: 'new'` to join as yourself.
 */
export async function joinLeague(code: string, playerName: string, claimId?: string): Promise<JoinResult> {
  try {
    const res = await httpsCallable<{ code: string; playerName: string; claimId?: string }, JoinResult>(functions, 'joinLeague')({ code, playerName, claimId });
    return res.data;
  } catch (err) {
    throw friendly(err, "Couldn't join right now. Check your connection and try again.");
  }
}
