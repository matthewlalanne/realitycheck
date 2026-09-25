import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Which league you were last looking at, so a relaunch (or the restart after
// an update installs) lands you back there instead of your sign-in league.
// Stored with the player it belongs to: after switching player, someone
// else's last league shouldn't carry over.
const KEY = 'outlast:last-league';

type Stored = { playerId: string; leagueKey: string };

export function useLastLeague() {
  const [stored, setStored] = useState<Stored | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          try { setStored(JSON.parse(raw)); } catch { /* corrupt — ignore */ }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const saveLastLeague = useCallback((playerId: string, leagueKey: string) => {
    const next = { playerId, leagueKey };
    setStored(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const lastLeagueFor = useCallback(
    (playerId: string) => (stored?.playerId === playerId ? stored.leagueKey : null),
    [stored],
  );

  return { loading, lastLeagueFor, saveLastLeague };
}
