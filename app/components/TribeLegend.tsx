import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import type { LeagueRoot } from '../lib/state';
import { tribesOf } from '../lib/tribes';

// One chip per tribe, in its buff color. The
// cards below only carry the color as a side border, so the names live here
// once instead of on every card. Hidden after the merge, when tribes stop
// mattering.
export default function TribeLegend({ root }: { root: LeagueRoot }) {
  const styles = makeStyles(useThemeColors());
  if (root.game?.mergeEp) return null;
  const tribes = tribesOf(root);
  if (!tribes.length) return null;
  return (
    <View style={styles.row}>
      {tribes.map((t) => (
        <View key={t.id} style={[styles.chip, { backgroundColor: t.color }]}>
          <Text style={styles.name}>{t.name}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (_colors: ColorScheme) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  // Chips share the full width equally, however many tribes there are.
  chip: { flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 8 },
  // Light text on every chip, with a soft shadow so it still reads on the
  // lighter buff colors (yellow) without switching to black on some chips.
  name: {
    color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});
