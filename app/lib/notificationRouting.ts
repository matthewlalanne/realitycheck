import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation';
import { useLeague } from '../contexts/LeagueContext';

// Lives on the NavigationContainer so routing can happen from outside any
// screen — the tap handler sits beside the navigator, not inside it.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Module-level so a remount (switching player, say) doesn't replay a tap that
// was already handled. It resets when the JS reloads — which is what we want
// when an update restarts the app right after it was opened from a
// notification: the tap gets routed again on the fresh bundle.
const handled = new Set<string>();

/**
 * Tapping a notification opens the screen it's about, in the league it came
 * from. The Cloud Functions put `type` and `leagueKey` in every payload.
 *
 * useLastNotificationResponse covers both a tap that launched the app cold
 * and one that brought it back from the background.
 */
export function useNotificationRouting() {
  const response = Notifications.useLastNotificationResponse();
  const { myLeagueKeys, setLeagueKey } = useLeague();

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.has(id)) return;
    handled.add(id);

    const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
    const leagueKey = typeof data.leagueKey === 'string' ? data.leagueKey : null;
    if (leagueKey && myLeagueKeys.includes(leagueKey)) setLeagueKey(leagueKey);

    // A saved recap draft opens straight into that episode's editor (only the
    // commissioner gets these). A published recap deliberately does NOT open its
    // recap page: someone who taps it by accident shouldn't land on the results.
    const pageEp = data.type === 'draft' ? Number(data.episode) : 0;
    if (pageEp) {
      let tries = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const open = () => {
        if (navigationRef.isReady()) {
          navigationRef.navigate('EpisodeEditor', { episode: pageEp });
        } else if (tries++ < 20) timer = setTimeout(open, 100);
      };
      open();
      return () => { if (timer) clearTimeout(timer); };
    }

    const tab = data.type === 'message' || data.type === 'reaction'
      ? 'Messages'
      : data.type === 'recap'
        ? 'Standings'
        : null;
    if (!tab) return;

    // On a cold start the navigator can mount a beat after this runs.
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('MainTabs', { screen: tab });
      } else if (tries++ < 20) {
        timer = setTimeout(go, 100);
      }
    };
    go();
    return () => { if (timer) clearTimeout(timer); };
  }, [response, myLeagueKeys, setLeagueKey]);
}

/** Renders nothing — just a place inside LeagueProvider to run the hook. */
export function NotificationRouter() {
  useNotificationRouting();
  return null;
}
