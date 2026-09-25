import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from '../navigation';
import { useTheme } from '../contexts/ThemeContext';
import { useLeague } from '../contexts/LeagueContext';
import { messagesFor } from '../lib/state';
import { useSeen } from '../lib/seen';
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
  const hasUnread = seenAt !== null
    && messagesFor(root, leagueKey).some((m) => m.createdAt > seenAt && m.authorId !== playerId);

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
      <Tab.Screen name="Predictions" component={PredictionsScreen} />
      <Tab.Screen name="Games" component={GamesScreen} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          // An empty badge with a fixed size renders as a plain dot — there's
          // no count to read, just "something's happened in here".
          tabBarBadge: hasUnread ? '' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.red,
            minWidth: 10, width: 10, height: 10, maxHeight: 10,
            borderRadius: 5, lineHeight: 10, fontSize: 1,
            alignSelf: 'center', marginTop: 2, marginLeft: 2,
          },
        }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
