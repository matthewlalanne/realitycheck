import { useRef } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, RootStackParamList } from '../../navigation';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import Panel from '../../components/Panel';
import { PinnedHeader, CONTENT_TOP_GAP } from '../../components/ScreenHeader';
import CastAvatar from '../../components/CastAvatar';
import { bios } from '../../data/bios';
import { useLiveContestants } from '../../lib/episodes';
import { useLeague } from '../../contexts/LeagueContext';
import { noteOf, rankOf, useBoard } from '../../lib/board';
import { tribeOf } from '../../lib/tribes';
import { idolCount, seasonStatsFor, stageOf } from '../../lib/seasonStats';
import { IdolChip, OutBadge, OutWash, VotesChip } from '../../components/CastawayStatus';
import TribeLegend from '../../components/TribeLegend';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Cast'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function CastScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  // Tapping the tab you're already on jumps back to the top, the way
  // every other iOS app behaves.
  const scrollRef = useRef<FlatList>(null);
  useScrollToTop(scrollRef);
  const { contestants } = useLiveContestants();
  // Your own ranking and notes, shown here as a chip so the cast list doubles
  // as a reminder of what you already thought of someone.
  const { root, leagueKey, playerId, terms } = useLeague();
  const board = useBoard(leagueKey, playerId);
  return (
    <View style={styles.container}>
      <PinnedHeader title="Cast" subtitle="Tap anyone for their details and history." />
      <FlatList
        ref={scrollRef}
        contentContainerStyle={styles.content}
        data={[...contestants].sort((a, b) => a.name.localeCompare(b.name))}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 10 }}>
          <TribeLegend root={root} />
          <Pressable onPress={() => navigation.navigate('MyBoard')}>
            <Panel style={styles.boardCta}>
              <Ionicons name="list-outline" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.boardTitle}>My board</Text>
                <Text style={styles.boardBody}>Rank the cast and keep private notes for draft night.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </Panel>
          </Pressable>
          </View>
        }
      renderItem={({ item: c }) => {
        const tribe = tribeOf(root, c.id);
        const rc = root.contestants?.find((r) => r?.id === c.id);
        const outEp = rc?.eliminatedWeek ?? c.eliminatedWeek ?? null;
        const out = !!outEp;
        const stage = stageOf(root, { eliminatedWeek: outEp });
        const idols = out ? 0 : idolCount(rc?.items);
        const votes = seasonStatsFor(root, c.id).votes;
        // Tribe only matters before the merge — it's who goes to Tribal.
        const where = out || stage === 'merged' ? null : tribe?.name;
        return (
        <Pressable onPress={() => navigation.navigate('Bio', { id: c.id })}>
          <Panel style={[styles.card, !!where && tribe && { borderLeftWidth: 4, borderLeftColor: tribe.color }, out && styles.cardOut]}>
            {out && <OutWash />}
            <CastAvatar id={c.id} style={styles.photo} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                {out && <OutBadge ep={outEp as number} />}
                {rankOf(board, c.id) ? <Text style={styles.rankChip}>#{rankOf(board, c.id)}</Text> : null}
                {noteOf(board, c.id) ? (
                  <Ionicons name="document-text-outline" size={13} color={colors.accent2} />
                ) : null}
              </View>
              <Text style={styles.meta}>
                {terms.unit === 'team'
                  ? [c.detail, c.from].filter(Boolean).join('  ·  ')
                  : [`Age ${c.age}`, c.from].join('  ·  ')}
              </Text>
              {/* Occupation as its own line, same as the website's cast cards. */}
              {bios[c.id]?.occupation ? (
                <Text style={styles.occupation} numberOfLines={1}>{bios[c.id].occupation}</Text>
              ) : null}
              {!out && (idols > 0 || votes > 0) && (
                <View style={styles.chips}>
                  {idols > 0 && <IdolChip count={idols} />}
                  {votes > 0 && <VotesChip votes={votes} />}
                </View>
              )}
            </View>
          </Panel>
        </Pressable>
        );
      }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingTop: CONTENT_TOP_GAP, paddingBottom: 40 },
  boardCta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.panel2 },
  boardTitle: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  boardBody: { color: colors.textDim, fontSize: 12.5, marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankChip: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  // Red border rather than dimming: at half opacity the row read as
  // disabled, so nobody realised they could still open the bio.
  cardOut: { borderColor: colors.red },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  photo: { width: 52, height: 52, borderRadius: 26 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  nameOut: { textDecorationLine: 'line-through' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  occupation: { color: colors.accent2, fontSize: 12, fontWeight: '600', marginTop: 2 },
  outTag: { color: colors.red, fontSize: 11, fontWeight: '700' },
  statLine: { color: colors.text, fontSize: 12, marginTop: 3 },
  tribeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  tribeDot: { width: 8, height: 8, borderRadius: 4 },
  tribeName: { color: colors.textDim, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
});
