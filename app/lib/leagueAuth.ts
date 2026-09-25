import { useEffect, useState } from 'react';
import { signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';

// One shared passphrase gates the whole league. The passphrase itself never
// ships in this bundle — it's typed in, sent to the leagueSignIn function, and
// exchanged there for a Firebase token. That keeps it rotatable server-side,
// and means reading the app's JavaScript reveals nothing.
//
// This is a door key, not an identity: everyone who signs in shares one uid.
// Who you are in the league is still the name you pick.

export type LeagueAuthState = 'checking' | 'signed-out' | 'signed-in';

export function useLeagueAuth(): LeagueAuthState {
  const [state, setState] = useState<LeagueAuthState>('checking');
  useEffect(() => onAuthStateChanged(auth, (user) => setState(user ? 'signed-in' : 'signed-out')), []);
  return state;
}

/** Throws with a message fit to show the person who typed it. */
export async function signInToLeague(passphrase: string): Promise<void> {
  const call = httpsCallable<{ passphrase: string }, { token: string }>(functions, 'leagueSignIn');
  let token: string;
  try {
    const res = await call({ passphrase: passphrase.trim() });
    token = res.data.token;
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code.includes('permission-denied')) throw new Error("That password doesn't match. Check with whoever runs your league.");
    if (code.includes('invalid-argument')) throw new Error('Enter the league password.');
    throw new Error('Could not reach the league right now. Check your connection and try again.');
  }
  await signInWithCustomToken(auth, token);
}

export function signOutOfLeague() {
  return signOut(auth);
}
