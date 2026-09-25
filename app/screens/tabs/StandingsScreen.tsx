import { useRef, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, RootStackParamList } from '../../navigation';
import { useTheme } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import Panel from '../../components/Panel';
import { PinnedHeader, CONTENT_TOP_GAP } from '../../components/ScreenHeader';
import { useAvatars } from '../../lib/avatars';
import TeamAvatar from '../../components/TeamAvatar';
import EpisodeSummary from '../../components/EpisodeSummary';
import CastAvatar from '../../components/CastAvatar';
import { useLeague } from '../../contexts/LeagueContext';
import { useEpisodeCountdown } from '../../lib/countdown';
import { isEliminated, shortName, ownersOf, rosterIds, soleSurvivorId } from '../../lib/state';
import { tribeOf } from '../../lib/tribes';
import { idolCount, seasonStatsFor, stageOf } from '../../lib/seasonStats';
import { IdolChip, OutBadge, OutWash, VotesChip } from '../../components/CastawayStatus';
import TribeLegend from '../../components/TribeLegend';
import { Ionicons } from '@expo/vector-icons';

// One gradient per theme, always dark-toned so the white countdown type
// reads the same in light and dark mode.
const COUNTDOWN_BG = {
  purple: require('../../assets/countdown/purple.jpg'),
  green: require('../../assets/countdown/green.jpg'),
  orange: require('../../assets/countdown/orange.jpg'),
  blue: require('../../assets/countdown/blue.jpg'),
  mono: require('../../assets/countdown/mono.jpg'),
} as const;

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Standings'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function StandingsScreen({ navigation }: Props) {
  const { colors, theme } = useTheme();
  const styles = makeStyles(colors);
  // Tapping the tab you're already on jumps back to the top, the way
  // every other iOS app behaves.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  // Which league is on screen is decided globally in LeagueContext, so the
  // switcher in the header moves every tab at once.
  const { root, league: lg, leagueKey, teamId, playerName } = useLeague();
  const countdown = useEpisodeCountdown(leagueKey);
  const avatars = useAvatars();
  const contestants = root.contestants || [];
  const byId = new Map(contestants.filter(Boolean).map((c) => [c.id, c]));

  const drafted = Object.keys(lg.picks || {}).length > 0;
  const winnerId = soleSurvivorId(root);
  const ranked = [...lg.players]
    .map((p) => {
      const roster = rosterIds(lg, p.id).map((cid) => byId.get(cid)).filter(Boolean) as typeof contestants;
      const alive = roster.filter((c) => !isEliminated(c)).length;
      const winner = !!winnerId && roster.some((c) => c.id === winnerId);
      return { ...p, roster, alive, winner };
    })
    .sort((a, b) => Number(b.winner) - Number(a.winner) || b.alive - a.alive || a.name.localeCompare(b.name));

  const ds = lg.draftState;
  const draftPending = !drafted && !!ds && !ds.complete;
  const draftLive = !!ds?.started && !ds.complete;
  // Practice only concerns leagues that still draft here, not seeded rosters.
  const practiceOn = !!root.draftPractice && (!drafted || draftLive);
  const remaining = contestants.filter((c) => c && !isEliminated(c)).length;

  return (
    <View style={styles.container}>
      <PinnedHeader title={`Hi, ${playerName}`} subtitle="Your standings and what's next, at a glance." />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>

      <View style={styles.countdownCard}>
        <ImageBackground source={COUNTDOWN_BG[theme]} style={styles.countdownBg} resizeMode="cover">
          {/* Fixed dark scrim + light type: the photo is the same in every
              theme, so the text can't follow the palette and stay readable. */}
          <Text style={styles.countdownLabel}>{countdown.label.toUpperCase()}</Text>
          <Text style={styles.countdownClock}>{countdown.clock}</Text>
          <Text style={styles.countdownMeta}>{remaining} of {contestants.length} castaways still in</Text>
        </ImageBackground>
      </View>

      <TribeLegend root={root} />

      {(practiceOn || draftPending || draftLive) && (
        <Pressable onPress={() => navigation.navigate('Draft')}>
          <Panel style={styles.draftCard}>
            <Text style={styles.draftTitle}>{practiceOn ? 'Practice draft is on' : draftLive ? 'Draft is live' : 'Draft coming up'}</Text>
            <Text style={styles.draftBody}>
              {practiceOn ? "Tap to join the practice — picks don't count." : draftLive ? 'Tap to join the draft board.' : 'Tap to see the draft order and format.'}
            </Text>
          </Panel>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Standings</Text>
      <Text style={styles.sectionHint}>Whoever holds the Sole Survivor wins the league.</Text>

      {ranked.map((p) => {
        // Compared against the team, not the person: a couple sharing a roster
        // entry should both see it marked as theirs.
        const isMe = p.id === teamId;
        const slots = Math.max(lg.picksPerPlayer || 0, p.roster.length);
        return (
          <Panel key={p.id} style={[styles.row, p.winner && styles.rowWinner]}>
            <View style={styles.rowHead}>
              <View style={styles.playerIdentity}>
                <TeamAvatar entry={p} avatars={avatars} leagueKey={leagueKey} size={30} />
                <Text style={styles.playerName}>{p.name}{isMe ? ' (you)' : ''}</Text>
              </View>
              {/* No "N still in" count — the cards below already show who's out. */}
              {(p.winner || !p.roster.length) && (
                <Text style={[styles.badge, p.winner && styles.badgeWinner, !p.roster.length && styles.badgeMuted]}>
                  {p.winner ? 'League Winner' : drafted ? 'No picks' : 'Draft TBD'}
                </Text>
              )}
            </View>
            <View style={styles.picks}>
              {Array.from({ length: slots }, (_, i) => {
                const c = p.roster[i];
                if (!c) {
                  return (
                    <View key={i} style={[styles.pick, styles.pickEmpty]}>
                      <View style={styles.pickPhotoEmpty}><Text style={styles.pickPhotoEmptyText}>?</Text></View>
                      <Text style={styles.pickNameEmpty}>Not drafted yet</Text>
                    </View>
                  );
                }
                const out = isEliminated(c);
                const shared = ownersOf(lg, c.id).length > 1;
                const tribe = tribeOf(root, c.id);
                const stage = stageOf(root, c);
                // A card answers two things beyond "still in?": are they
                // holding an idol, and are they a target. The rest is on their bio.
                const idols = out ? 0 : idolCount(c.items);
                const votes = seasonStatsFor(root, c.id).votes;
                // Tribe shows as the side border only (names are in the legend
                // under the countdown), and only before the merge.
                const where = out || stage === 'merged' ? null : tribe?.name;
                const sub = '';
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.pick, !!where && tribe && { borderLeftWidth: 4, borderLeftColor: tribe.color }, out && styles.pickOut]}
                    onPress={() => navigation.navigate('Bio', { id: c.id })}
                  >
                    {out && <OutWash />}
                    <CastAvatar id={c.id} style={styles.pickPhoto} />
                    <View style={styles.pickBody}>
                      <View style={styles.pickTop}>
                        <Text style={styles.pickName} numberOfLines={1}>{shortName(c.name)}</Text>
                        {shared && <Text style={styles.sharedTag}>SHARED</Text>}
                        {out && <OutBadge ep={c.eliminatedWeek as number} />}
                      </View>
                      {!!sub && (
                        <View style={styles.subRow}>
                          <Text style={styles.pickMeta} numberOfLines={1}>{sub}</Text>
                        </View>
                      )}
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
          </Panel>
        );
      })}

      <EpisodeSummary root={root} league={lg} leagueKey={leagueKey} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingTop: CONTENT_TOP_GAP, paddingBottom: 40, gap: 10 },
  countdownCard: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.line,
  },
  countdownBg: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, gap: 5 },
  countdownScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.photoScrim,
  },
  countdownLabel: {
    color: 'rgba(255,255,255,0.78)', fontSize: 11, letterSpacing: 2, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4,
  },
  countdownClock: {
    color: colors.accentOnDark, fontSize: 30, fontWeight: '800',
    fontVariant: ['tabular-nums'], letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6,
  },
  countdownMeta: {
    color: 'rgba(255,255,255,0.88)', fontSize: 12.5,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4,
  },
  draftCard: { backgroundColor: colors.panel2, borderColor: colors.accent },
  draftTitle: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  draftBody: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  sectionTitle: { color: colors.accent, fontSize: 18, fontWeight: '800', marginTop: 8 },
  sectionHint: { color: colors.textDim, fontSize: 12, marginTop: -6 },
  row: { gap: 10 },
  rowWinner: { borderColor: colors.accent, borderWidth: 2 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  playerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  playerName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  badge: { color: colors.green, fontSize: 11, fontWeight: '700', borderWidth: 1, borderColor: colors.green, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeWinner: { color: colors.accent, borderColor: colors.accent },
  badgeMuted: { color: colors.textDim, borderColor: colors.line },
  // One castaway per row: room for the name, tribe, stats and what they're holding.
  picks: { gap: 8 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  // Quiet small-caps marker: someone else in the league also drafted them.
  sharedTag: { color: colors.textDim, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pickBody: { flex: 1, gap: 4 },
  pickTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickPhotoOut: { opacity: 0.5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 1 },
  pillText: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  pickEmpty: { opacity: 0.6 },
  // Voted out reads as faded, with the status line in red — calmer than a thick red frame on every lost pick.
  pickOut: { borderColor: colors.red },
  pickPhoto: { width: 48, height: 48, borderRadius: 24 },
  pickPhotoEmpty: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  pickPhotoEmptyText: { color: colors.textDim, fontWeight: '800' },
  pickName: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  pickNameOut: { textDecorationLine: 'line-through', color: colors.textDim },
  pickNameEmpty: { color: colors.textDim, fontSize: 13, fontStyle: 'italic' },
  pickMeta: { color: colors.textDim, fontSize: 12.5 },
  statLine: { color: colors.text, fontSize: 12.5 },
  stage: { alignSelf: 'flex-start', color: colors.accent, fontSize: 9.5, fontWeight: '900', letterSpacing: 1, marginTop: 3 },
  stageJury: { color: colors.textDim },
  demoBanner: { backgroundColor: colors.accent, borderRadius: 10, padding: 10, marginBottom: 4 },
  demoText: { color: colors.onAccent, fontWeight: '800', fontSize: 12.5, textAlign: 'center' },
  heldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  heldChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1, borderColor: colors.accent,
  },
  heldText: { color: colors.accent, fontSize: 11.5, fontWeight: '800' },
  tribeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  tribeDot: { width: 7, height: 7, borderRadius: 4 },
  tribeName: { color: colors.textDim, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
});
