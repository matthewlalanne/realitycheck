import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from './Panel';
import { airedEpisodeCount } from '../lib/countdown';
import { termsFor } from '../lib/season';
import { isEliminated, type LeagueRecord, type LeagueRoot } from '../lib/state';
import { recapParts } from '../lib/recap';

// The season's episodes, newest first, each a link to its recap page. Recaps
// run long, so they live on their own pages rather than stacked in here.
export default function EpisodeSummary({ root, leagueKey }: { root: LeagueRoot; league: LeagueRecord; leagueKey: string }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const cast = root.contestants || [];
  const stillIn = cast.filter((c) => c && !isEliminated(c)).length;
  const weeks = Array.from({ length: Math.max(0, airedEpisodeCount(leagueKey)) }, (_, i) => i + 1).reverse();

  return (
    <Panel style={styles.panel}>
      <Text style={styles.heading}>Episodes</Text>
      <Text style={styles.hint}>{stillIn} of {cast.length} {termsFor(root.meta).units} still in the game.</Text>

      {!weeks.length && <Text style={styles.hint}>Nothing yet — the premiere hasn't aired.</Text>}

      {/* Rows sit in their own container so the panel's gap doesn't add
          extra space below each one and throw off the centering. */}
      <View style={styles.list}>
      {weeks.map((w) => {
        const { title } = recapParts(root, w);
        return (
          <Pressable
            key={w}
            style={styles.row}
            onPress={() => navigation.navigate('EpisodeRecap', { episode: w })}
            accessibilityRole="link"
          >
            <View style={{ flex: 1 }}>
              {/* Same order as the recap page's header: episode number, then its name. */}
              <Text style={styles.epNum}>Episode {w}</Text>
              {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </Pressable>
        );
      })}
      </View>
    </Panel>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  panel: { gap: 6 },
  heading: { color: colors.accent, fontSize: 17, fontWeight: '800' },
  hint: { color: colors.textDim, fontSize: 12.5, lineHeight: 17 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 14,
  },
  list: { marginTop: 6 },
  epNum: { color: colors.text, fontSize: 18, fontWeight: '800' },
  title: { color: colors.textDim, fontSize: 14, marginTop: 2 },
});
