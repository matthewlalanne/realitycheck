import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import { useTopInset } from '../components/ScreenHeader';

// The hard stop. Shown when this build is older than the floor the
// commissioner has set, which they do before a draft.
//
// It blocks the whole app rather than just the Draft screen on purpose: an
// old build can be wrong about anything the newer one changed, and the draft
// is exactly where being sincerely wrong does the damage.
export default function UpdateRequiredScreen({ required, mine }: { required: number; mine: number }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const top = useTopInset();
  const [state, setState] = useState<'idle' | 'working' | 'error' | 'needs-install'>('idle');

  async function updateNow() {
    setState('working');
    try {
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) {
        // Nothing to download. Either this build is already current (and the
        // floor is simply above what over-the-air can reach), or it's an old
        // build whose runtime no longer matches anything being published —
        // which is exactly the position every 1.2.0 phone was in. Sending
        // them round this button again would be a dead end, so say plainly
        // that they need the app itself, not an update to it.
        setState('needs-install');
        return;
      }
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setState('error');
    }
  }

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <Panel style={styles.card}>
        <Ionicons name="arrow-down-circle" size={40} color={colors.accent} />
        <Text style={styles.title}>Update to keep playing</Text>
        <Text style={styles.body}>
          Your app is running an older version than the league. An out-of-date app can get the
          draft order wrong, which is how picks end up out of turn.
        </Text>
        <Pressable style={styles.button} onPress={updateNow} disabled={state === 'working'}>
          <Text style={styles.buttonText}>{state === 'working' ? 'Updating…' : 'Update now'}</Text>
        </Pressable>
        {state === 'error' && (
          <Text style={styles.error}>
            Couldn't reach the update server. Check your connection, then try again — or fully
            close the app and open it twice.
          </Text>
        )}
        {state === 'needs-install' && (
          <Text style={styles.error}>
            There's no update available for this version. You'll need to install the newest
            Reality Check itself — from TestFlight on iPhone, or the download link on the league site
            for Android. Ask whoever runs your league if you can't find it.
          </Text>
        )}
        <Text style={styles.meta}>This app is version {mine} · the league needs {required}</Text>
      </Panel>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 },
  card: { alignItems: 'center', gap: 12, backgroundColor: colors.panel2 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  button: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28, marginTop: 4 },
  buttonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  error: { color: colors.red, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  meta: { color: colors.textDim, fontSize: 11.5, marginTop: 2 },
});
