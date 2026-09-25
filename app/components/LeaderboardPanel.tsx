import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from './Panel';
import type { ScoreEntry } from '../lib/leaderboard';

function fmtClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function LeaderboardPanel({ title, scores }: { title: string; scores: ScoreEntry[] }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <Panel style={{ gap: 8 }}>
      <Text style={styles.title}>{title}</Text>
      {scores.length === 0 ? (
        <Text style={styles.empty}>No times yet — be the first!</Text>
      ) : (
        scores.map((s, i) => (
          <View key={s.at} style={styles.row}>
            <Text style={styles.rank}>{i + 1}. {s.name}</Text>
            <Text style={styles.stat}>{fmtClock(s.ms)} &bull; {s.moves} moves</Text>
          </View>
        ))
      )}
    </Panel>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  title: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  empty: { color: colors.textDim, fontSize: 13 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 6,
  },
  stat: { color: colors.textDim, fontSize: 12 },
  rank: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
