import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

// Pulls a 6-character league invite code out of whatever URL opened the app:
// the custom scheme (confessional://join/CODE), a future universal link
// (https://playrealitycheck.web.app/join/CODE), or anything else ending in
// /join/CODE. Works today over the custom scheme with no native build change;
// the https form needs associated domains / app links wired up at build time
// (see design/app.json.build-settings.json) plus the site hosting the two
// verification files, so until then tapping the web link just opens the site.
const CODE_RE = /\/join\/([A-Za-z0-9]{6})(?:[/?#]|$)/;

export function codeFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(CODE_RE);
  return m ? m[1].toUpperCase() : null;
}

/**
 * The invite code the app was opened with, if any — from the launch URL or
 * one that arrives while it's already running. `consume()` clears it once
 * it's been used, so navigating away from Join doesn't keep bouncing back.
 */
export function usePendingInviteCode(): { code: string | null; consume: () => void } {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      const c = codeFromUrl(url);
      if (c) setCode(c);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      const c = codeFromUrl(url);
      if (c) setCode(c);
    });
    return () => sub.remove();
  }, []);

  return { code, consume: () => setCode(null) };
}
