import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { AppState, ImageBackground, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RootStackParamList } from './navigation';
import SplashScreen from './screens/SplashScreen';
import MainTabs from './screens/MainTabs';
import DraftScreen from './screens/DraftScreen';
import BioScreen from './screens/BioScreen';
import UpdateRequiredScreen from './screens/UpdateRequiredScreen';
import MyBoardScreen from './screens/MyBoardScreen';
import EpisodeManagerScreen from './screens/EpisodeManagerScreen';
import EpisodeEditorScreen from './screens/EpisodeEditorScreen';
import TribesScreen from './screens/TribesScreen';
import EpisodeRecapScreen from './screens/EpisodeRecapScreen';
import TeamProfileScreen from './screens/TeamProfileScreen';
import CastPhotosScreen from './screens/CastPhotosScreen';
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';
import OnboardingFlow from './screens/onboarding/OnboardingFlow';
import { useLastLeague } from './lib/lastLeague';
import { useLeagueRoot } from './lib/state';
import { setActiveSeason } from './lib/season';
import { logOut, useAuthUser, useIsAdmin, useMyLeagues, useProfile, type MyLeague } from './lib/account';
import { navigationRef, NotificationRouter } from './lib/notificationRouting';
import { useReportAppVersion } from './lib/appVersion';
import { useAutoUpdate } from './lib/autoUpdate';
import { useMinClient } from './lib/clients';
import { CLIENT_VERSION } from './lib/clientVersion';
import { LeagueProvider } from './contexts/LeagueContext';
import DraftAnnouncement from './components/DraftAnnouncement';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Keeps the branded Splash up for at least this long even when everything
// loads instantly — a one-frame flash reads as a glitch, not a brand moment.
const MIN_SPLASH_MS = 0;
function useMinSplashDelay() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);
  return done;
}

function RootNavigator() {
  const { user, loading: authLoading } = useAuthUser();
  const uid = user?.uid ?? null;
  const { profile, loading: profileLoading } = useProfile(uid);
  const { leagues: myLeagues, loading: leaguesLoading } = useMyLeagues(uid);
  const isAdmin = useIsAdmin(uid);
  // The league currently open (null = the "your leagues" list). Held here so
  // the season's data is only read once someone actually opens one.
  const [open, setOpen] = useState<MyLeague | null>(null);
  // Set once, right when a league is freshly created, so its first open lands
  // on the cast-photos setup step instead of Standings. Any other open of any
  // league (including this same one, the second time) goes straight to
  // MainTabs as normal.
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);
  const { loading: lastLoading, lastLeagueFor, saveLastLeague } = useLastLeague();
  // Take any waiting update now rather than leaving it for the next launch.
  useAutoUpdate();
  useReportAppVersion(uid ?? '');
  const minClient = useMinClient();
  const minSplashDone = useMinSplashDelay();

  // Point every data helper at the open league's season BEFORE its data hooks
  // run (they read the active season when they subscribe).
  const seasonId = open?.seasonId ?? null;
  const { root, loading: rootLoading } = useLeagueRoot(!!seasonId, seasonId);
  const meta = root?.meta ?? null;
  if (seasonId) setActiveSeason(seasonId, meta);

  // Reopen the league you were last in, once the list has loaded.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (restored || !uid || leaguesLoading || lastLoading) return;
    setRestored(true);
    const last = lastLeagueFor(uid);
    const hit = myLeagues.find((l) => l.leagueKey === last);
    if (hit) setOpen(hit);
  }, [restored, uid, leaguesLoading, lastLoading, myLeagues, lastLeagueFor]);

  if (authLoading || (uid && (profileLoading || lastLoading)) || !minSplashDone) {
    return <SplashScreen />;
  }

  if (!open) {
    return (
      <OnboardingFlow
        user={user}
        profile={profile}
        myLeagues={myLeagues}
        leaguesLoading={leaguesLoading}
        isAdmin={isAdmin}
        onOpenLeague={(l) => { setOpen(l); if (uid) saveLastLeague(uid, l.leagueKey); }}
        onLeagueCreated={(leagueKey) => setJustCreatedKey(leagueKey)}
      />
    );
  }

  if (rootLoading || !root || !root.leagues?.[open.leagueKey]) {
    return <SplashScreen />;
  }

  // Hard stop for a build the app has moved past.
  if (minClient > CLIENT_VERSION) {
    return <UpdateRequiredScreen required={minClient} mine={CLIENT_VERSION} />;
  }

  const identity = { leagueKey: open.leagueKey, playerId: open.personId, playerName: profile?.name };

  return (
    <LeagueProvider
      key={open.leagueKey}
      root={root}
      identity={identity}
      isAdmin={isAdmin}
      onExitLeague={() => setOpen(null)}
      onLogOut={() => { setOpen(null); logOut(); }}
    >
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={open.leagueKey === justCreatedKey ? 'CastPhotos' : 'MainTabs'}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="CastPhotos" component={CastPhotosScreen} initialParams={{ setup: true }} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="Draft" component={DraftScreen} />
        <Stack.Screen name="Bio" component={BioScreen} />
        <Stack.Screen name="MyBoard" component={MyBoardScreen} />
        <Stack.Screen name="EpisodeManager" component={EpisodeManagerScreen} />
        <Stack.Screen name="EpisodeEditor" component={EpisodeEditorScreen} />
        <Stack.Screen name="Tribes" component={TribesScreen} />
        <Stack.Screen name="EpisodeRecap" component={EpisodeRecapScreen} />
        <Stack.Screen name="TeamProfile" component={TeamProfileScreen} />
      </Stack.Navigator>
      {/* Above the navigator so a pick announces on whatever screen you're on. */}
      <DraftAnnouncement />
      <NotificationRouter />
    </LeagueProvider>
  );
}

function ThemedApp() {
  const [fontsLoaded] = useFonts({ Anton_400Regular });
  const { colors, resolvedMode, theme } = useTheme();
  const barStyle = resolvedMode === 'light' ? 'dark' : 'light';

  // iOS can reset the status bar when the app returns from the background
  // (e.g. after the phone flips to dark mode at sunset), leaving white clock
  // text on a light theme. Re-apply the theme's style every time we come back.
  useEffect(() => {
    setStatusBarStyle(barStyle);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setStatusBarStyle(barStyle); });
    return () => sub.remove();
  }, [barStyle]);

  const navTheme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: 'transparent', card: colors.bg2, border: colors.line, text: colors.text, primary: colors.accent },
  };

  if (!fontsLoaded) {
    return <SplashScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {theme === 'purple' && (
        <ImageBackground
          source={resolvedMode === 'light' ? require('./assets/backgrounds/glow-light.jpg') : require('./assets/backgrounds/glow-dark.jpg')}
          resizeMode="cover"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        <RootNavigator />
        <StatusBar style={barStyle} />
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
