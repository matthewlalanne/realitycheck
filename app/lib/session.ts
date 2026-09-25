import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Who's signed in to Tribe League on this device, and the leagues they've
// created here. In preview this is all local; with real accounts it moves to
// Firebase Auth + the database.
const KEY = 'tl:session';

export type CreatedLeague = {
  id: string;
  code: string;
  showId: string;
  name: string;
  style: 'points' | 'last-standing';
  /** When results appear for this league: a weekly local day/time, at least 12h after air. */
  reveal: { weekday: number; hour: number; minute: number };
  draft: 'live' | 'auto' | 'offline';
  draftWhen?: string;
  /** Draft start as an exact moment (ISO, UTC) — every player sees it in their own time zone. */
  draftAt?: string | null;
  /** The commissioner's time zone when they set it, for "8 PM Mountain" style labels. */
  draftTz?: string;
  puzzleImage?: string | null;
  memoryUsesCast: boolean;
  castPhotos: Record<string, string>;
  createdAt: number;
};

export type Session = {
  method: 'google' | 'email';
  email?: string;
  name: string;
  photo?: string | null;
  leagues: CreatedLeague[];
  /** True once they've opened a league; the main app takes over from there. */
  inLeague: boolean;
};

export function useSession() {
  const [session, setState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) try { setState(JSON.parse(raw)); } catch { /* start fresh */ } })
      .finally(() => setLoading(false));
  }, []);
  const save = useCallback((next: Session | null) => {
    setState(next);
    if (next) AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    else AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);
  return { session, loading, save };
}

export function newInviteCode(): string {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L to misread
  return Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join('');
}
