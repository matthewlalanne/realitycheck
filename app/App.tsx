import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { AppState, ImageBackground, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RootStackParamList } from './navigation';
import SplashScreen from './screens/SplashScreen';
import WhoAreYouScreen from './screens/WhoAreYouScreen';
import LeaguePasswordScreen from './screens/LeaguePasswordScreen';
import MainTabs from './screens/MainTabs';
import DraftScreen from './screens/DraftScreen';
import BioScreen from './screens/BioScreen';
import UpdateRequiredScreen from './screens/UpdateRequiredScreen';
import MyBoardScreen from './screens/MyBoardScreen';
import EpisodeManagerScreen from './screens/EpisodeManagerScreen';
import EpisodeEditorScreen from './screens/EpisodeEditorScreen';
import TribesScreen from './screens/TribesScreen';
import EpisodeRecapScreen from './screens/EpisodeRecapScreen';
import { useIdentity } from './lib/identity';
import { PREVIEW, previewRoot } from './lib/preview';
import { useSession } from './lib/session';
import OnboardingFlow from './screens/onboarding/OnboardingFlow';
import { leaguesForPerson, type LeagueRecord } from './lib/state';
import { useLastLeague } from './lib/lastLeague';
import { navigationRef, NotificationRouter } from './lib/notificationRouting';
import { teamIdFor, useLeagueRoot } from './lib/state';
import { useLeagueAuth } from './lib/leagueAuth';
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
const MIN_SPLASH_MS = 2600;
function useMinSplashDelay() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);
  return done;
}

function RootNavigator() {
  const { identity, loading: identityLoading, setIdentity, clearIdentity, editorUnlocked, unlockEditor } = useIdentity();
  const realAuth = useLeagueAuth();
  // Preview: sign-in is simulated and data comes from the bundled snapshot.
  const authState = PREVIEW ? 'signed-in' : realAuth;
  const { session, loading: sessionLoading, save: saveSession } = useSession();
  const { loading: lastLeagueLoading, lastLeagueFor, saveLastLeague } = useLastLeague();
  const playerId = identity?.playerId ?? '';
  const onLeagueChange = useCallback((key: string) => saveLastLeague(playerId, key), [saveLastLeague, playerId]);
  // Take any waiting update now rather than leaving it for the next launch.
  useAutoUpdate();
  // Diagnostics: which build/bundle this device is actually running.
  useReportAppVersion(identity?.playerId ?? '');
  // The floor the commissioner has set. Only readable once signed in, which
  // is also the only point at which being out of date can do any harm.
  const minClient = useMinClient();
  // Nothing in the record is readable until we're signed in, so the read only
  // starts once we are — otherwise it would just fail on permissions.
  const { root: liveRoot, loading: liveLoading } = useLeagueRoot(authState === 'signed-in' && !PREVIEW);
  // Preview: leagues you create on this device are added to the snapshot in
  // memory (you as the only player, draft not started), so they open into the
  // full app just like a real one would.
  const root = useMemo(() => {
    const base = PREVIEW ? previewRoot : liveRoot;
    if (!base || !PREVIEW || !session?.leagues.length) return base;
    const extra: Record<string, LeagueRecord> = {};
    session.leagues.forEach((l) => {
      extra[l.id] = {
        name: l.name,
        picksPerPlayer: 2,
        players: [{ id: 'matt', name: session.name }],
        draftState: { started: false, complete: false, currentPickIndex: 0, history: [] },
        inviteCode: l.code,
        castPhotos: l.castPhotos,
      } as LeagueRecord;
    });
    return { ...base, leagues: { ...base.leagues, ...extra } };
  }, [liveRoot, session]);
  const rootLoading = PREVIEW ? false : liveLoading;
  const minSplashDone = useMinSplashDelay();

  if (authState === 'checking' || identityLoading || lastLeagueLoading || sessionLoading || !minSplashDone) {
    return <SplashScreen />;
  }

  // Sign in, then create / join / open a league. Once someone opens a league
  // the existing league app below takes over.
  if (!session || !session.inLeague) {
    // Preview: the copied leagues, as seen by Matt (the snapshot's commissioner).
    const created = new Set(session?.leagues.map((l) => l.id));
    const existing = root
      ? leaguesForPerson(root, 'matt').filter((key) => !created.has(key)).map((key) => ({
          key,
          name: root.leagues[key]?.name ?? key,
          members: root.leagues[key]?.players?.length ?? 0,
          showId: 'survivor-51',
        }))
      : [];
    return (
      <OnboardingFlow
        session={session}
        save={saveSession}
        existing={existing}
        onEnterLeague={async (key) => {
          await setIdentity({ leagueKey: key, playerId: 'matt', playerName: 'Matt' });
          if (session) saveSession({ ...session, inLeague: true });
        }}
      />
    );
  }

  // The league password comes before any data.
  //
  // Someone returning is greeted by name — their identity is stored on the
  // device, so we know who they are without reading the roster, which is
  // itself behind this very sign-in. A first-time install has no name yet and
  // gets the password first, then picks league and name straight after.
  if (authState === 'signed-out') {
    return (
      <LeaguePasswordScreen
        name={identity?.playerName ?? null}
        onBack={identity ? clearIdentity : undefined}
      />
    );
  }

  if (rootLoading || !root) {
    return <SplashScreen />;
  }

  // Hard stop for a build the league has moved past. Deliberately after
  // sign-in (nothing here is readable before) and before anything else can
  // be used.
  if (minClient > CLIENT_VERSION) {
    return <UpdateRequiredScreen required={minClient} mine={CLIENT_VERSION} />;
  }

  // An identity that no longer matches the roster (renamed/removed player)
  // falls back to the picker rather than a broken half-state.
  //
  // Resolved through teamIdFor, NOT by matching roster-entry ids directly:
  // someone on a shared entry signs in as themselves (`scott`) while the entry
  // is the couple (`scott-anne`), and a direct comparison rejected them.
  const valid = !!identity && !!teamIdFor(root.leagues[identity.leagueKey], identity.playerId);
  if (!identity || !valid) {
    return <WhoAreYouScreen root={root} current={null} onChoose={setIdentity} />;
  }

  return (
    <LeagueProvider
      root={root}
      identity={identity}
      initialLeagueKey={lastLeagueFor(identity.playerId)}
      onLeagueChange={onLeagueChange}
      editorUnlocked={editorUnlocked}
      unlockEditor={unlockEditor}
      setIdentity={setIdentity}
      clearIdentity={async () => { await clearIdentity(); if (session) saveSession({ ...session, inLeague: false }); }}
      onExitLeague={() => { if (session) saveSession({ ...session, inLeague: false }); }}
      onLogOut={async () => { await clearIdentity(); saveSession(null); }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Draft" component={DraftScreen} />
        <Stack.Screen name="Bio" component={BioScreen} />
        <Stack.Screen name="MyBoard" component={MyBoardScreen} />
        <Stack.Screen name="EpisodeManager" component={EpisodeManagerScreen} />
        <Stack.Screen name="EpisodeEditor" component={EpisodeEditorScreen} />
        <Stack.Screen name="Tribes" component={TribesScreen} />
        <Stack.Screen name="EpisodeRecap" component={EpisodeRecapScreen} />
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
