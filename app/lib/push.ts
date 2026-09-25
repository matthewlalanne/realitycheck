import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { ref, update } from 'firebase/database';
import { rtdb } from './firebase';

// Notifications are deliberately contentless. The recap one never names a
// castaway, and the message one never quotes the message — iOS prints the
// body straight onto the lock screen, so it has to be spoiler-free at the
// source rather than relying on each person's preview setting.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Top level, not under `league`: read rules cascade, so anything in there is
// readable by every signed-in member — and device push tokens needn't be.
// Clients only ever write here; the Cloud Functions read it as admin.
const TOKENS_PATH = 'pushTokens';

/**
 * Registers this device for push and files the token under the player, so the
 * Cloud Function knows who to notify. Re-runs when the active league changes,
 * which is how Matt and AJ end up reachable for both of their leagues.
 */
export function useRegisterPushToken(leagueKey: string, playerId: string, playerName: string) {
  useEffect(() => {
    if (!leagueKey || !playerId) return;
    let cancelled = false;

    (async () => {
      // Simulators can't be issued a push token; bail rather than throw.
      if (!Device.isDevice) return;

      const existing = await Notifications.getPermissionsAsync();
      let granted = existing.granted;
      if (!granted && existing.canAskAgain) {
        const asked = await Notifications.requestPermissionsAsync();
        granted = asked.granted;
      }
      if (!granted || cancelled) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'League updates',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;
      if (!projectId) return;

      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      if (!token || cancelled) return;

      const patch: Record<string, unknown> = {
        [`${leagueKey}_${playerId}`]: {
          token,
          leagueKey,
          playerId,
          playerName,
          platform: Platform.OS,
          updatedAt: Date.now(),
        },
      };

      // Switching player used to leave this device filed under the previous
      // person, so their notifications landed on this phone. Clearing that up
      // meant reading the whole token list — which is the only reason it had
      // to be client-readable. The pruneStalePushTokens function now does it
      // server-side, so this only ever writes.

      if (cancelled) return;
      await update(ref(rtdb, TOKENS_PATH), patch);
    })().catch(() => {
      // Push is a nice-to-have; never let it take the app down on launch.
    });

    return () => { cancelled = true; };
  }, [leagueKey, playerId, playerName]);
}
