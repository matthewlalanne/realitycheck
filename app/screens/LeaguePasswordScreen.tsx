import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import { useTopInset } from '../components/ScreenHeader';
import { signInToLeague } from '../lib/leagueAuth';

/**
 * The last step of getting in: league, then who you are, then the password.
 * Addressing the person by name makes it read as a continuation of the two
 * screens before it rather than a wall.
 */
export default function LeaguePasswordScreen({ name, onBack }: { name: string | null; onBack?: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const top = useTopInset();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || !value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await signInToLeague(value);
      // On success the auth listener swaps this screen out; nothing to do here.
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.wordmark}>REALITY CHECK</Text>
        {/* First install has no stored name yet — league and name are picked
            straight after this. Returning members get greeted properly. */}
        <Text style={styles.title}>{name ? `Ok, ${name}.` : 'Welcome.'}</Text>
        <Text style={styles.subtitle}>Please enter the league password.</Text>

        <Panel style={styles.card}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={(t) => { setValue(t); setError(null); }}
            placeholder="League password"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
            accessibilityLabel="League password"
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={[styles.button, (busy || !value.trim()) && styles.buttonDisabled]}
            onPress={submit}
            disabled={busy || !value.trim()}
          >
            {busy
              ? <ActivityIndicator color={colors.onAccent} />
              : <Text style={styles.buttonText}>Enter the league</Text>}
          </Pressable>
        </Panel>

        <Text style={styles.footnote}>
          The password keeps our league private. Without it, anyone on the internet could read
          the standings, the chat and everyone's photos — this makes sure only people we've
          invited can see any of it. You'll only be asked once on this phone.
        </Text>

        {!!onBack && (
          <Pressable style={styles.back} onPress={onBack}>
            <Text style={styles.backText}>← Not you?</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingBottom: 60, gap: 8 },
  wordmark: { color: colors.accent, fontSize: 30, fontWeight: '900', letterSpacing: 2, marginBottom: 18 },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 15, marginBottom: 12 },
  card: { gap: 12 },
  input: {
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.line, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, color: colors.text, fontSize: 16,
  },
  error: { color: colors.red, fontSize: 13, fontWeight: '600' },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  footnote: { color: colors.textDim, fontSize: 11.5, lineHeight: 16, marginTop: 14 },
  back: { alignSelf: 'flex-start', paddingVertical: 12 },
  backText: { color: colors.accent2, fontSize: 14, fontWeight: '600' },
});
