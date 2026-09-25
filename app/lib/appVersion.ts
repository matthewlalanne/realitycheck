import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { ref, serverTimestamp, update } from 'firebase/database';
import { rtdb } from './firebase';
import { CLIENT_VERSION } from './clientVersion';

// Reports which build/bundle this device is actually running, so "who's on an
// old version" is a lookup instead of an inference from push-token shapes.
//
// Deliberately outside `league`: every client subscribes to that whole record,
// and this has no business being rebroadcast to everyone.
const VERSIONS = 'appVersions';

export function useReportAppVersion(personId: string) {
  useEffect(() => {
    if (!personId) return;
    update(ref(rtdb, `${VERSIONS}/${personId}`), {
      // The binary from TestFlight. Updates only reach a matching runtime.
      runtimeVersion: Updates.runtimeVersion ?? null,
      // The app's own build counter — the one number that can actually be
      // compared between two phones. This is what the draft's pre-flight
      // check reads to say who is behind.
      client: CLIENT_VERSION,
      // Which OTA bundle is live, and whether it's still the one baked into
      // the binary (i.e. this device has never taken an update).
      updateId: Updates.updateId ?? null,
      embedded: Updates.isEmbeddedLaunch ?? null,
      channel: Updates.channel ?? null,
      platform: Platform.OS,
      at: serverTimestamp(),
    }).catch(() => {
      // Diagnostics only — never let this interfere with using the app.
    });
  }, [personId]);
}
