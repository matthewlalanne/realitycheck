import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Identity works exactly like the website: you pick your league and your
// name from the roster, and that's who you are on this device. No
// passwords — the same trust-your-friends model the site has always used.
const KEY = 'outlast:identity';
const EDITOR_KEY = 'outlast:editor-unlocked';

export type Identity = {
  leagueKey: string;
  playerId: string;
  /** Stored on the device only, so the password screen can say "Ok, Matt."
   *  before any data has been read. Optional: identities saved by older
   *  versions won't have it. */
  playerName?: string;
};

// Who is allowed to edit (episodes, draft setup). Mirrors the website.
export const EDITOR_IDS: Record<string, string[]> = {
  porterville: ['matt'],
  denver: ['courtney', 'matt'],
  coloradoSprings: ['matt'],
};
export const EDITOR_PASSWORD = 'Whale51!';

// "Switch player" exists so the league can be tested from other people's
// seats. Everyone else just gets Sign out — being able to hop into a
// teammate's profile isn't something a normal member should be offered.
const PLAYER_SWITCH_IDS = ['matt'];
export function canSwitchPlayer(id: Identity | null) {
  return !!id && PLAYER_SWITCH_IDS.includes(id.playerId);
}

export function isEditorIdentity(id: Identity | null) {
  return !!id && !!EDITOR_IDS[id.leagueKey] && EDITOR_IDS[id.leagueKey].includes(id.playerId);
}

export function useIdentity() {
  const [identity, setIdentityState] = useState<Identity | null>(null);
  const [editorUnlocked, setEditorUnlockedState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(EDITOR_KEY)]).then(([raw, ed]) => {
      if (raw) {
        try { setIdentityState(JSON.parse(raw)); } catch { /* corrupt — start fresh */ }
      }
      setEditorUnlockedState(ed === '1');
      setLoading(false);
    });
  }, []);

  const setIdentity = useCallback(async (id: Identity) => {
    setIdentityState(id);
    await AsyncStorage.setItem(KEY, JSON.stringify(id));
  }, []);

  const clearIdentity = useCallback(async () => {
    setIdentityState(null);
    setEditorUnlockedState(false);
    await AsyncStorage.multiRemove([KEY, EDITOR_KEY]);
  }, []);

  const unlockEditor = useCallback(async (password: string) => {
    if (password !== EDITOR_PASSWORD) return false;
    setEditorUnlockedState(true);
    await AsyncStorage.setItem(EDITOR_KEY, '1');
    return true;
  }, []);

  return { identity, loading, setIdentity, clearIdentity, editorUnlocked, unlockEditor };
}
