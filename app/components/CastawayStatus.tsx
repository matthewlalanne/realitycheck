import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';

// The small set of status marks a castaway card carries. Deliberately few:
// a card answers "are they still in, are they safe, are they a target?" at a
// glance, and everything else lives on their bio.

/** "Out · Ep 3" — sits right next to the name. */
export function OutBadge({ ep }: { ep: number }) {
  const styles = makeStyles(useThemeColors());
  return (
    <View style={styles.out}>
      <Text style={styles.outText}>Out · Ep {ep}</Text>
    </View>
  );
}

/** Holding at least one idol. */
export function IdolChip({ count }: { count: number }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.idol}>
      <Ionicons name="shield" size={11} color={colors.onAccent} />
      <Text style={styles.idolText}>{count > 1 ? `${count} idols` : 'Idol'}</Text>
    </View>
  );
}

/** Season total of votes cast against them. */
export function VotesChip({ votes }: { votes: number }) {
  const styles = makeStyles(useThemeColors());
  return (
    <View style={styles.votes}>
      <Text style={styles.votesNum}>{votes}</Text>
      <Text style={styles.votesText}>{votes === 1 ? 'vote against' : 'votes against'}</Text>
    </View>
  );
}

/**
 * A red wash over a voted-out card: tinted enough to read as "out" in any
 * theme, light enough that the photo and details still show through.
 * The parent needs overflow: 'hidden' and its own borderRadius.
 */
export function OutWash() {
  const colors = useThemeColors();
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.red, opacity: 0.12 }]}
    />
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  out: { borderWidth: 1, borderColor: colors.red, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  outText: { color: colors.red, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  idol: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  idolText: { color: colors.onAccent, fontSize: 11.5, fontWeight: '800' },
  votes: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  votesNum: { color: colors.text, fontSize: 12, fontWeight: '800' },
  votesText: { color: colors.textDim, fontSize: 11.5, fontWeight: '600' },
});
