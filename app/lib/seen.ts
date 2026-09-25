import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// "What have I already looked at" — stored per viewer, per league, on the
// device only. It drives the tab badges, so it deliberately never syncs:
// reading the chat on your phone shouldn't clear the badge on someone else's.
const storageKey = (what: string, lgKey: string) => `outlast-seen-${what}-${lgKey}`;

// The badge is rendered by MainTabs while it's cleared by MessagesScreen, so
// the two useSeen() calls have to be looking at the same value. Without this
// shared store each call kept its own useState and only re-read AsyncStorage
// on mount, so marking the chat read never reached the badge and it sat there
// until the app was relaunched.
const values = new Map<string, number>();
const listeners = new Map<string, Set<(v: number) => void>>();

function publish(key: string, at: number) {
  values.set(key, at);
  listeners.get(key)?.forEach((fn) => fn(at));
}

/**
 * `seenAt` is null until the stored value loads — callers should treat that as
 * "don't badge yet" rather than "nothing seen", so a badge never flashes on
 * during the first frame after launch.
 */
export function useSeen(what: string, lgKey: string) {
  const key = storageKey(what, lgKey);
  const [seenAt, setSeenAt] = useState<number | null>(values.get(key) ?? null);

  useEffect(() => {
    let alive = true;
    const set = listeners.get(key) ?? new Set();
    listeners.set(key, set);
    set.add(setSeenAt);

    const cached = values.get(key);
    if (cached !== undefined) setSeenAt(cached);
    else {
      AsyncStorage.getItem(key)
        .then((v) => { if (alive) publish(key, v ? Number(v) : 0); })
        .catch(() => { if (alive) publish(key, 0); });
    }

    return () => {
      alive = false;
      set.delete(setSeenAt);
      if (!set.size) listeners.delete(key);
    };
  }, [key]);

  const markSeen = useCallback(
    (at: number = Date.now()) => {
      // Never move the marker backwards: focusing an old screen shouldn't
      // un-read messages that a later call already covered.
      if ((values.get(key) ?? 0) >= at) return Promise.resolve();
      publish(key, at);
      return AsyncStorage.setItem(key, String(at)).catch(() => {});
    },
    [key],
  );

  return { seenAt, markSeen };
}
