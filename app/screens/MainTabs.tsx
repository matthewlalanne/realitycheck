import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from '../navigation';
import { useTheme } from '../contexts/ThemeContext';
import { useLeague } from '../contexts/LeagueContext';
import { messagesFor, predsFor, winnerPicksFor } from '../lib/state';
import { useSeen } from '../lib/seen';
import { latestRecapWeek, useRecapRead } from '../lib/recapReads';
import { episodeAirTime, predictionEpisodeNumber, predictionsClosed, seasonPickClosed } from '../lib/countdown';
import StandingsScreen from './tabs/StandingsScreen';
import CastScreen from './tabs/CastScreen';
import PredictionsScreen from './tabs/PredictionsScreen';
import GamesScreen from './tabs/GamesScreen';
import MessagesScreen from './tabs/MessagesScreen';
import SettingsScreen from './tabs/SettingsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Standings: 'home',
  Cast: 'people',
  Predictions: 'flag',
  Games: 'game-controller',
  Messages: 'chatbox-ellipses',
  Settings: 'settings',
};

export default function MainTabs() {
  const { colors, resolvedMode, theme } = useTheme();
  const { root, leagueKey, playerId } = useLeague();
  // Unread = posted by somebody else since this device last opened the chat.
  // seenAt is null while the stored value loads, which suppresses the badge
  // rather than flashing every message as unread on launch.
  const { seenAt } = useSeen('messages', leagueKey);
  const unreadCount = seenAt === null ? 0
    : messagesFor(root, leagueKey).filter((m) => m.createdAt > seenAt && m.authorId !== playerId).length;
  const hasUnread = unreadCount > 0;

  const latestRecap = latestRecapWeek(root);
  const { seenWeek } = useRecapRead(leagueKey, playerId, latestRecap);
  const recapUnread = seenWeek !== null && latestRecap > seenWeek;

  // Something to do on Predictions: this week's pick isn't in and it locks
  // within 12 hours (same window as the server's reminder push), or the
  // season pick is still open and empty. Evaluated on render rather than on a
  // timer — close enough, since any data change or tab switch re-renders.
  const predWeek = predictionEpisodeNumber(leagueKey);
  const weekPickDue = !predictionsClosed(predWeek, leagueKey)
    && Date.now() >= episodeAirTime(predWeek, leagueKey) - 12 * 60 * 60 * 1000
    && !predsFor(root, leagueKey, predWeek)[playerId];
  const seasonPickDue = !seasonPickClosed(leagueKey) && !winnerPicksFor(root, leagueKey)[playerId];
  const predictionsDue = weekPickDue || seasonPickDue;

  // The icon number while the app is open: unread chat plus an unread recap,
  // matching what functions/index.js badgeCountsFor sends with each push.
  // This only sees the league on screen, so a second league's unread drops
  // out until its next push — the server count adds it back.
  const iconBadge = seenAt === null || seenWeek === null ? null : unreadCount + (recapUnread ? 1 : 0);
  useEffect(() => {
    if (iconBadge !== null) Notifications.setBadgeCountAsync(iconBadge).catch(() => {});
  }, [iconBadge]);

  const dotStyle = {
    backgroundColor: colors.red,
    minWidth: 10, width: 10, height: 10, maxHeight: 10,
    borderRadius: 5, lineHeight: 10, fontSize: 1,
    alignSelf: 'center' as const, marginTop: 2, marginLeft: 2,
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        // Frosted rather than solid, so the glow at the foot of the background
        // runs under the tab bar instead of stopping at a hard edge.
        // Other themes have no background gradient, so they keep a solid bar.
        tabBarStyle: { backgroundColor: theme !== 'purple' ? colors.bg2 : resolvedMode === 'light' ? 'rgba(255,246,244,0.78)' : 'rgba(22,12,36,0.6)', borderTopColor: colors.line },
        // Six tabs across leaves "Predictions" very little room on narrower
        // Android screens or with larger system text, where it got cut off.
        // Labels shrink to fit on one line instead.
        tabBarLabel: ({ color, children }) => (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            allowFontScaling={false}
            style={{ color, fontSize: 10.5, textAlign: 'center' }}
          >
            {children}
          </Text>
        ),
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof MainTabParamList]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Standings" component={StandingsScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Cast" component={CastScreen} />
      <Tab.Screen name="Predictions" component={PredictionsScreen} options={{ tabBarBadge: predictionsDue ? '' : undefined, tabBarBadgeStyle: dotStyle }} />
      <Tab.Screen name="Games" component={GamesScreen} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          // An empty badge with a fixed size renders as a plain dot — there's
          // no count to read, just "something's happened in here".
          tabBarBadge: hasUnread ? '' : undefined,
          tabBarBadgeStyle: dotStyle,
        }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
