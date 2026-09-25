import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import BackButton from '../components/BackButton';
import { PinnedHeader } from '../components/ScreenHeader';
import { useLiveContestants, useEpisodeNotes } from '../lib/episodes';
import { airedEpisodeCount, episodeAirTime } from '../lib/countdown';
import { useRecapDrafts } from '../lib/recapDraft';

type Props = NativeStackScreenProps<RootStackParamList, 'EpisodeManager'>;

// How many weeks Testing mode reveals ahead of the premiere.
const TEST_EPISODES = 3;

// A list of episodes — tap one to edit it. Editing every week on one long
// scrolling page left the recap box permanently buried under the keyboard.
export default function EpisodeManagerScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { contestants } = useLiveContestants();
  const notes = useEpisodeNotes();
  const drafts = useRecapDrafts();
  const aired = airedEpisodeCount();

  // Nothing has aired before the premiere, so there'd be nothing to edit and
  // no way to rehearse a recap or a notification.
  const [testMode, setTestMode] = useState(false);
  const shown = testMode ? Math.max(aired, TEST_EPISODES) : aired;
  const episodes = Array.from({ length: Math.max(shown, 0) }, (_, i) => shown - i);

  return (
    // Back sits outside the ScrollView so it stays put: buried at the top of a
    // long page, it was unreachable without scrolling all the way up again.
    <View style={styles.container}>
      <View style={styles.backBar}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <PinnedHeader title="Episodes" subtitle="Publish who went home and the recap." topInset={false} />
      <ScrollView contentContainerStyle={styles.content}>

        <Panel style={styles.testCard}>
          <View style={styles.testRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.testTitle}>Testing mode</Text>
              <Text style={styles.testBody}>
                Unlocks the first {TEST_EPISODES} episodes before they air. Only changes what you see —
                anything you publish is real.
              </Text>
            </View>
            <Pressable
              onPress={() => setTestMode((v) => !v)}
              style={[styles.toggle, testMode && styles.toggleOn]}
              accessibilityRole="switch"
              accessibilityState={{ checked: testMode }}
            >
              <Text style={[styles.toggleText, testMode && styles.toggleTextOn]}>
                {testMode ? 'On' : 'Off'}
              </Text>
            </Pressable>
          </View>
        </Panel>

        {episodes.length === 0 && (
          <Panel>
            <Text style={styles.hint}>
              No episodes have aired yet. Turn on Testing mode above to rehearse.
            </Text>
          </Panel>
        )}

        {episodes.map((ep) => {
          const recap = (notes[String(ep)] ?? '').trim();
          const out = contestants.filter((c) => c.eliminatedWeek === ep);
          return (
            <Pressable key={ep} onPress={() => navigation.navigate('EpisodeEditor', { episode: ep })}>
              <Panel style={styles.epRow}>
                <View style={styles.epMain}>
                  <Text style={styles.epTitle}>Episode {ep}</Text>
                  <Text style={styles.epMeta} numberOfLines={1}>
                    {out.length ? `Out: ${out.map((c) => c.name).join(', ')}` : 'No eliminations recorded'}
                  </Text>
                  <Text style={[styles.epStatus, !!recap && styles.epStatusDone, !recap && !!drafts[String(ep)] && styles.epStatusDraft]}>
                    {recap ? 'Recap published' : drafts[String(ep)] ? "Claude's draft ready to review" : 'No recap yet'}
                  </Text>
                </View>
                <View style={styles.epSide}>
                  <Text style={styles.epDate}>{new Date(episodeAirTime(ep)).toLocaleDateString()}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
                </View>
              </Panel>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  // Opaque and above the header, so the header's drop shadow can't show
  // in the strip over the title — see the shadow note in ScreenHeader.
  backBar: { paddingHorizontal: 20, backgroundColor: colors.bg, zIndex: 11 },
  content: { padding: 20, paddingTop: 0, paddingBottom: 40, gap: 12 },
  hint: { color: colors.textDim, fontSize: 13 },
  testCard: { backgroundColor: colors.panel2, borderColor: colors.accent2 },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  testTitle: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  testBody: { color: colors.textDim, fontSize: 12, marginTop: 3, lineHeight: 16 },
  toggle: {
    minWidth: 58, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 16,
    borderWidth: 1, borderColor: colors.line, alignItems: 'center',
  },
  toggleOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleText: { color: colors.textDim, fontWeight: '800', fontSize: 13 },
  toggleTextOn: { color: colors.onAccent },
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  epMain: { flex: 1, gap: 3 },
  epSide: { alignItems: 'flex-end', gap: 4 },
  epTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  epMeta: { color: colors.textDim, fontSize: 12 },
  epStatus: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  epStatusDone: { color: colors.green },
  epStatusDraft: { color: colors.accent },
  epDate: { color: colors.textDim, fontSize: 11 },
});
