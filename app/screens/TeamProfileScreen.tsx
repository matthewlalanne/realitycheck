import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import BackButton from '../components/BackButton';
import TeamAvatar from '../components/TeamAvatar';
import CastAvatar from '../components/CastAvatar';
import { useAvatars } from '../lib/avatars';
import { useLeague } from '../contexts/LeagueContext';
import { rankedStandings } from '../lib/standings';
import { isEliminated, predictionLeaderboard, shortName } from '../lib/state';
import { idolCount, seasonStatsFor } from '../lib/seasonStats';
import { IdolChip, OutBadge, VotesChip } from '../components/CastawayStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'TeamProfile'>;

// One page for "how's this person doing", reused everywhere a name/avatar
// shows up (Standings, chat, the Predictions leaderboard) so the answer
// never depends on which screen you tapped from.
export default function TeamProfileScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { root, league: lg, leagueKey, teamId, terms } = useLeague();
  const avatars = useAvatars();
  const { playerId } = route.params;

  const ranked = rankedStandings(root, lg, leagueKey);
  const p = ranked.find((r) => r.id === playerId);
  const isPointsLeague = lg.style === 'points';
  const preds = predictionLeaderboard(root, leagueKey).find((b) => b.id === playerId);
  const isMe = playerId === teamId;

  if (!p) return null;

  return (
    <View style={styles.container}>
      <View style={styles.backBar}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <TeamAvatar entry={p} avatars={avatars} leagueKey={leagueKey} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{p.name}{isMe ? ' (you)' : ''}</Text>
            <Text style={styles.rank}>
              Rank #{p.rank} of {ranked.length}
              {p.winner ? ` · League ${terms.winner === 'winner' ? 'Winner' : terms.winner}` : ''}
            </Text>
          </View>
        </View>

        <Panel style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{isPointsLeague ? p.points : p.alive}</Text>
            <Text style={styles.statLabel}>{isPointsLeague ? 'Points' : `Of ${p.roster.length} still in`}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{preds?.wins ?? 0}</Text>
            <Text style={styles.statLabel}>Correct calls</Text>
          </View>
          {isPointsLeague && !!lg.countPredictions && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>+{p.predictionPoints}</Text>
                <Text style={styles.statLabel}>Pts from calls</Text>
              </View>
            </>
          )}
        </Panel>

        <Text style={styles.sectionTitle}>Roster</Text>
        {!p.roster.length && <Text style={styles.hint}>No picks yet.</Text>}
        <View style={{ gap: 8 }}>
          {p.roster.map((c) => {
            const out = isEliminated(c);
            const idols = out ? 0 : idolCount(c.items);
            const votes = seasonStatsFor(root, c.id).votes;
            return (
              <Pressable key={c.id} style={[styles.pick, out && styles.pickOut]} onPress={() => navigation.navigate('Bio', { id: c.id })}>
                <CastAvatar id={c.id} style={styles.pickPhoto} />
                <View style={styles.pickBody}>
                  <View style={styles.pickTop}>
                    <Text style={styles.pickName} numberOfLines={1}>{shortName(c.name)}</Text>
                    {out && <OutBadge ep={c.eliminatedWeek as number} />}
                  </View>
                  {!out && (idols > 0 || votes > 0) && (
                    <View style={styles.heldRow}>
                      {idols > 0 && <IdolChip count={idols} />}
                      {votes > 0 && <VotesChip votes={votes} />}
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backBar: { paddingHorizontal: 20 },
  content: { padding: 20, paddingTop: 0, paddingBottom: 40, gap: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.text, fontSize: 20, fontWeight: '800' },
  rank: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  statRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel2 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.line },
  statValue: { color: colors.accent, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  sectionTitle: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  hint: { color: colors.textDim, fontSize: 13 },
  pick: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg2, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line,
  },
  pickOut: { borderColor: colors.red },
  pickPhoto: { width: 44, height: 44, borderRadius: 22 },
  pickBody: { flex: 1, gap: 4 },
  pickTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickName: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  heldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
