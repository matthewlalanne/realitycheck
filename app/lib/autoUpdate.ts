import { useEffect } from 'react';
import * as Updates from 'expo-updates';

// Take any waiting update at launch and restart straight into it, so nobody
// has to know about "open it twice".
//
// This is the first of the three guards added after the 2026 Denver draft,
// where two phones on an older bundle picked out of turn. It is also the
// weakest on its own: it can only run on a phone that already has it. The
// commissioner's pre-flight check (lib/clients.ts) is the one that covers
// phones which are already behind.
//
// Only ever at startup, and only once: reloading under someone mid-pick
// would be worse than the staleness.
let ranThisLaunch = false;

export function useAutoUpdate() {
  useEffect(() => {
    if (ranThisLaunch || __DEV__) return;
    ranThisLaunch = true;
    (async () => {
      try {
        const res = await Updates.checkForUpdateAsync();
        if (!res.isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch {
        // Offline, or the update server is unreachable. Never block the app
        // on this — the point is to help, and the gate below catches anyone
        // who genuinely can't be allowed to carry on.
      }
    })();
  }, []);
}
