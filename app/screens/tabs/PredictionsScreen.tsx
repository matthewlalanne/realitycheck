import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import Panel from '../../components/Panel';
import SegmentedTabs from '../../components/SegmentedTabs';
import { useTopInset, PinnedHeader, CONTENT_TOP_GAP } from '../../components/ScreenHeader';
import CastAvatar from '../../components/CastAvatar';
import { useLeague } from '../../contexts/LeagueContext';
import { pickDeadline, predictionEpisodeNumber, predictionsClosed, seasonPickClosed } from '../../lib/countdown';
import {
  WEEKLY_BET, eliminatedInEpisode, fmtMoney, isEliminated, lastScoredEpisode, peopleOf,
  predictionLeaderboard, predsFor, setPrediction, setWinnerPick, weeklySettlement, winnerPicksFor,
} from '../../lib/state';

function lockLabel(week: number, leagueKey: string) {
  const lockAt = pickDeadline(week, leagueKey);
  const diff = lockAt - Date.now();
  if (diff <= 0) return 'Picks are locked for this episode';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `Picks lock in ${d}d ${h}h`;
  if (h > 0) return `Picks lock in ${h}h ${m}m`;
  return `Picks lock in ${m}m`;
}

export default function PredictionsScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  // Tapping the tab you're already on jumps back to the top, the way
  // every other iOS app behaves.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  // League choice lives in LeagueContext — the header switcher drives it.
  const { root, leagueKey: predKey, league: lg, playerId } = useLeague();
  const week = predictionEpisodeNumber(predKey);
  const closed = predictionsClosed(week, predKey);
  const preds = predsFor(root, predKey, week);
  const savedPick = preds[playerId] ?? null;
  const betting = predKey === 'porterville';
  const outThisEp = eliminatedInEpisode(root, week);
  const scored = closed && outThisEp.length > 0;

  const [selected, setSelected] = useState<string | null>(savedPick);
  const [saving, setSaving] = useState(false);
  const [showEveryone, setShowEveryone] = useState(true);
  const [pickingWinner, setPickingWinner] = useState(false);
  const [tab, setTab] = useState<'week' | 'season'>('week');
  // Past episodes start collapsed — they're for looking something up, not
  // for reading every time you open the tab.
  const [openPast, setOpenPast] = useState<Set<number>>(() => new Set());
  const togglePast = (ep: number) => setOpenPast((prev) => {
    const next = new Set(prev);
    if (next.has(ep)) next.delete(ep); else next.add(ep);
    return next;
  });
  const pastEps = Array.from({ length: week - 1 }, (_, i) => week - 1 - i); // newest first
  const topInset = useTopInset();
  useEffect(() => { setSelected(savedPick); }, [savedPick, week, predKey]);

  const contestants = root.contestants || [];
  const byId = useMemo(() => new Map(contestants.filter(Boolean).map((c) => [c.id, c])), [contestants]);
  const stillIn = contestants.filter((c) => c && !isEliminated(c));
  const submittedCount = Object.keys(preds).length;
  const dirty = selected !== savedPick;
  const winnerLocked = seasonPickClosed(predKey);
  const winnerPicks = winnerPicksFor(root, predKey);
  const myWinner = winnerPicks[playerId] ?? null;
  const board = predictionLeaderboard(root, predKey);
  const anyWins = board.some((b) => b.wins > 0);
  // Settle-up always shows the most recent episode that actually has a result,
  // so the breakdown stays on screen all week instead of vanishing the moment
  // the countdown rolls over to the next episode.
  const settleEp = betting ? lastScoredEpisode(root, week) : null;
  const settlement = settleEp ? weeklySettlement(root, predKey, settleEp) : null;
  const myDebts = settlement?.debts.filter((d) => d.fromId === playerId) ?? [];
  const owedToMe = settlement?.debts.filter((d) => d.toId === playerId) ?? [];

  async function save() {
    if (closed || !selected || !dirty) return;
    setSaving(true);
    try { await setPrediction(predKey, week, playerId, selected); } finally { setSaving(false); }
  }

  // Undoing a pick made by mistake. It's its own button rather than a state of
  // the save button, and it confirms first — in Porterville it also takes you
  // back out of that week's pot, which is worth being deliberate about.
  function clearPick() {
    if (closed || !savedPick) return;
    Alert.alert(
      'Clear your pick?',
      betting
        ? `This removes your Episode ${week} pick and takes you out of this week's $${WEEKLY_BET} pot. You can pick again any time before picks lock.`
        : `This removes your Episode ${week} pick. You can pick again any time before picks lock.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Clear pick',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await setPrediction(predKey, week, playerId, null);
              setSelected(null);
            } finally { setSaving(false); }
          },
        },
      ],
    );
  }

  const pickedName = (cid: string | null) => (cid ? byId.get(cid)?.name ?? cid : '');

  return (
    <View style={styles.container}>
      <PinnedHeader title="Predictions" subtitle="Make your weekly pick and season-long call." />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>

        {/* Two tabs so the season pick isn't buried at the bottom of a long page. */}
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'week', label: `Episode ${week}` },
            { key: 'season', label: 'Season pick', dot: !winnerLocked && !myWinner },
          ]}
        />

        {tab === 'week' && (<>

        {betting && (
          <Panel style={styles.betCard}>
            <Text style={styles.betTitle}>Playing for money is optional</Text>
            <Text style={styles.betBody}>
              Locking in a pick puts you in for <Text style={styles.betAmount}>${WEEKLY_BET} of real money</Text> this
              week. No pick, no money — sit out any week you like, and plenty of people only play some of them.
              Name the right torch to get snuffed and you split that week's pot; we settle up on Venmo.
            </Text>
          </Panel>
        )}

        <Panel style={[styles.statusCard, closed && styles.statusCardLocked]}>
          <Text style={styles.statusLock}>{lockLabel(week, predKey)}</Text>
          {scored ? (
            <Text style={styles.statusResult}>
              Voted out: {outThisEp.map((c) => c.name).join(', ')}
              {savedPick ? (outThisEp.some((c) => c.id === savedPick) ? ' — you called it!' : ' — not your pick this time.') : ''}
            </Text>
          ) : (
            <Text style={styles.statusPick}>
              {savedPick ? `Your pick: ${pickedName(savedPick)}` : closed ? 'You didn’t lock in a pick.' : 'You haven’t picked yet.'}
            </Text>
          )}
          {betting && (
            <Text style={styles.pot}>This week's pot: ${submittedCount * WEEKLY_BET} <Text style={styles.potSub}>({submittedCount} × ${WEEKLY_BET})</Text></Text>
          )}
        </Panel>

        {!closed && (
          <>
            <Text style={styles.sectionTitle}>Tap who you think goes home</Text>
            <View style={styles.grid}>
              {stillIn.map((c) => {
                const on = selected === c.id;
                return (
                  <Pressable key={c.id} style={styles.gridItem} onPress={() => setSelected(on ? null : c.id)}>
                    <View style={[styles.castCard, on && styles.castCardOn]}>
                      <CastAvatar id={c.id} style={styles.castPhoto} />
                      <Text style={[styles.castName, on && styles.castNameOn]} numberOfLines={1}>{c.name}</Text>
                      {on && <View style={styles.checkDot}><Text style={styles.checkDotText}>✓</Text></View>}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Pressable style={styles.sectionToggle} onPress={() => setShowEveryone((v) => !v)}>
          <Text style={styles.sectionTitle}>Episode {week} picks</Text>
          <Text style={styles.sectionToggleText}>{showEveryone ? 'Hide' : 'Show'}</Text>
        </Pressable>
        {showEveryone && (
          <Panel style={styles.listPanel}>
            {peopleOf(lg).map((p) => {
              const cid = preds[p.id];
              const me = p.id === playerId;
              const shown = closed || me;
              const label = !cid ? 'No pick' : shown ? pickedName(cid) : 'Locked in';
              const hit = scored && cid && outThisEp.some((c) => c.id === cid);
              return (
                <View key={p.id} style={styles.listRow}>
                  <Text style={[styles.listName, me && styles.listNameMe]}>{p.name}{me ? ' (you)' : ''}</Text>
                  <Text style={[styles.listValue, !cid && styles.listValueMuted, hit && styles.listValueHit]}>{label}{hit ? ' ✓' : ''}</Text>
                </View>
              );
            })}
          </Panel>
        )}

        {settlement && (
          <>
            <Text style={styles.sectionTitle}>Episode {settlement.ep} settle-up</Text>
            <Panel style={styles.settleCard}>
              <Text style={styles.settleTop}>
                {fmtMoney(settlement.potCents)} pot · {settlement.entrants.length} in
              </Text>

              {settlement.push ? (
                <Text style={styles.settleNote}>That one blindsided everybody. Everyone keeps their ${WEEKLY_BET} — no payouts this week.</Text>
              ) : !settlement.debts.length ? (
                <Text style={styles.settleNote}>Everyone who played read the vote right. No money changes hands.</Text>
              ) : (
                <>
                  <Text style={styles.settleNote}>
                    Read the vote right: {settlement.winners.map((w) => w.name).join(', ')}
                  </Text>

                  {(myDebts.length > 0 || owedToMe.length > 0) && (
                    <View style={styles.settleMine}>
                      {myDebts.map((d) => (
                        <Text key={`o${d.toId}`} style={styles.settleMineOwe}>
                          You owe {d.toName} <Text style={styles.settleMineAmt}>{fmtMoney(d.cents)}</Text>
                        </Text>
                      ))}
                      {owedToMe.map((d) => (
                        <Text key={`g${d.fromId}`} style={styles.settleMineGet}>
                          {d.fromName} owes you <Text style={styles.settleMineAmt}>{fmtMoney(d.cents)}</Text>
                        </Text>
                      ))}
                    </View>
                  )}

                  <Text style={styles.settleAllLabel}>Everyone</Text>
                  {settlement.debts.map((d) => (
                    <View key={`${d.fromId}-${d.toId}`} style={styles.listRow}>
                      <Text style={styles.listName}>
                        {d.fromName} <Text style={styles.settleArrow}>→</Text> {d.toName}
                      </Text>
                      <Text style={styles.settleAmt}>{fmtMoney(d.cents)}</Text>
                    </View>
                  ))}
                  <Text style={styles.settleFoot}>The tribe has spoken. Settle up on Venmo — the app just does the math.</Text>
                </>
              )}
            </Panel>
          </>
        )}

        {pastEps.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Past episodes</Text>
            {pastEps.map((ep) => {
              const epPreds = predsFor(root, predKey, ep);
              const out = eliminatedInEpisode(root, ep);
              const mine = epPreds[playerId] ?? null;
              const open = openPast.has(ep);
              return (
                <Panel key={ep} style={styles.listPanel}>
                  <Pressable style={styles.pastHeader} onPress={() => togglePast(ep)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pastTitle}>Episode {ep}</Text>
                      <Text style={styles.pastSub} numberOfLines={1}>
                        Your pick: {mine ? pickedName(mine) : 'none'}
                        {out.length ? ` · Out: ${out.map((c) => c.name).join(', ')}` : ''}
                      </Text>
                    </View>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textDim} />
                  </Pressable>
                  {open && peopleOf(lg).map((p) => {
                    const cid = epPreds[p.id];
                    const me = p.id === playerId;
                    const hit = !!cid && out.some((c) => c.id === cid);
                    return (
                      <View key={p.id} style={styles.listRow}>
                        <Text style={[styles.listName, me && styles.listNameMe]}>{p.name}{me ? ' (you)' : ''}</Text>
                        <Text style={[styles.listValue, !cid && styles.listValueMuted, hit && styles.listValueHit]}>
                          {cid ? pickedName(cid) : 'No pick'}{hit ? ' ✓' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </Panel>
              );
            })}
          </>
        )}

        <Text style={styles.sectionTitle}>Predictions leaderboard</Text>
        <Panel style={styles.listPanel}>
          {!anyWins && <Text style={styles.hint}>No episodes scored yet — the first one counts after the premiere.</Text>}
          {board.map((b, i) => (
            <View key={b.id} style={styles.listRow}>
              <Text style={[styles.listName, b.id === playerId && styles.listNameMe]}>{i + 1}. {b.name}</Text>
              <Text style={styles.listValue}>
                {b.wins} correct{betting && b.wins > 0 ? ` · ${fmtMoney(b.wins * WEEKLY_BET * 100)}+` : ''}
              </Text>
            </View>
          ))}
        </Panel>

        </>)}

        {tab === 'season' && (<>

        <Panel style={[styles.seasonCard, winnerLocked && styles.statusCardLocked]}>
          <Text style={styles.statusLock}>Sole Survivor · season pick</Text>
          {myWinner ? (
            <View style={styles.seasonRow}>
              {<CastAvatar id={myWinner} style={styles.seasonPhoto} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.seasonName}>{pickedName(myWinner)}</Text>
                <Text style={styles.seasonMeta}>
                  {winnerLocked ? 'Locked in for the season' : 'Tap to change before the premiere'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.seasonEmpty}>
              {winnerLocked ? 'You didn’t make a season pick.' : 'Who wins the whole thing? One pick, all season.'}
            </Text>
          )}
          {!winnerLocked && (
            <Pressable
              style={[styles.seasonButton, !myWinner && styles.seasonButtonPrimary]}
              onPress={() => setPickingWinner(true)}
            >
              <Text style={[styles.seasonButtonText, !myWinner && styles.seasonButtonPrimaryText]}>
                {myWinner ? 'Change pick' : 'Pick your winner'}
              </Text>
            </Pressable>
          )}
          {winnerLocked && (
            <View style={styles.listPanelInner}>
              {peopleOf(lg).map((p) => (
                <View key={p.id} style={styles.listRow}>
                  <Text style={[styles.listName, p.id === playerId && styles.listNameMe]}>
                    {p.name}{p.id === playerId ? ' (you)' : ''}
                  </Text>
                  <Text style={[styles.listValue, !winnerPicks[p.id] && styles.listValueMuted]}>
                    {winnerPicks[p.id] ? pickedName(winnerPicks[p.id]) : 'No pick'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Panel>
        </>)}

      </ScrollView>

      <Modal visible={pickingWinner} animationType="slide" onRequestClose={() => setPickingWinner(false)}>
        <View style={styles.modalWrap}>
          <ScrollView contentContainerStyle={[styles.modalContent, { paddingTop: topInset }]}>
            <Pressable
              onPress={() => setPickingWinner(false)}
              style={styles.modalBack}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={20} color={colors.accent2} />
              <Text style={styles.modalBackText}>Back</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Who wins the season?</Text>
            <Text style={styles.modalHint}>
              One pick for the whole season. Locks an hour before the premiere airs.
            </Text>
            <View style={styles.grid}>
              {[...contestants].filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
                const on = myWinner === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={styles.gridItem}
                    onPress={async () => { await setWinnerPick(predKey, playerId, c.id); setPickingWinner(false); }}
                  >
                    <View style={[styles.castCard, on && styles.castCardOn]}>
                      <CastAvatar id={c.id} style={styles.castPhoto} />
                      <Text style={[styles.castName, on && styles.castNameOn]} numberOfLines={1}>{c.name}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.saveBar}>
            <Pressable style={styles.saveButton} onPress={() => setPickingWinner(false)}>
              <Text style={styles.saveButtonText}>{myWinner ? 'Done' : 'Decide later'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {!closed && tab === 'week' && (
        <View style={styles.saveBar}>
          <View style={styles.saveRow}>
            <Pressable
              style={[styles.saveButton, styles.saveButtonGrow, (!selected || !dirty || saving) && styles.saveButtonDisabled]}
              disabled={!selected || !dirty || saving}
              onPress={save}
            >
              <Text style={styles.saveButtonText}>
                {saving
                  ? 'Saving…'
                  : !selected
                    ? 'Pick a castaway'
                    : dirty
                      ? `Lock in ${pickedName(selected)}`
                      : 'Locked in'}
              </Text>
            </Pressable>
            {!!savedPick && (
              <Pressable style={styles.clearButton} disabled={saving} onPress={clearPick}>
                <Text style={styles.clearButtonText}>Clear my pick</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingTop: CONTENT_TOP_GAP, paddingBottom: 110, gap: 10 },
  statusCard: { backgroundColor: colors.panel2, borderColor: colors.accent, gap: 4 },
  seasonCard: { backgroundColor: colors.panel2, borderColor: colors.accent, gap: 8 },
  seasonRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  seasonPhoto: { width: 46, height: 46, borderRadius: 23 },
  seasonName: { color: colors.accent, fontSize: 17, fontWeight: '800' },
  seasonButtonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  seasonButtonPrimaryText: { color: colors.onAccent },
  seasonMeta: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  seasonEmpty: { color: colors.textDim, fontSize: 13.5, lineHeight: 18 },
  seasonButton: {
    alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 18,
    borderWidth: 1, borderColor: colors.accent,
  },
  seasonButtonText: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  listPanelInner: { gap: 10, marginTop: 4 },
  modalWrap: { flex: 1, backgroundColor: colors.bg },
  modalContent: { padding: 20, paddingBottom: 110, gap: 10 },
  modalBack: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingRight: 14, marginBottom: 2 },
  modalBackText: { color: colors.accent2, fontSize: 16, fontWeight: '600' },
  modalTitle: { color: colors.text, fontSize: 23, fontWeight: '800' },
  modalHint: { color: colors.textDim, fontSize: 13, marginBottom: 6 },
  statusCardLocked: { borderColor: colors.line },
  pastHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  pastSub: { color: colors.textDim, fontSize: 12.5, marginTop: 2 },
  statusLock: { color: colors.accent2, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  statusPick: { color: colors.accent, fontSize: 17, fontWeight: '800' },
  statusResult: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pot: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },
  potSub: { color: colors.textDim, fontWeight: '400' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 2 },
  sectionHeaderText: { color: colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.line },
  sectionTitle: { color: colors.accent, fontSize: 15, fontWeight: '800', marginTop: 8 },
  sectionToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionToggleText: { color: colors.accent2, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '47.5%' },
  // flex + centre so tiles in a row match height and the photo/name block
  // sits centred, instead of riding the top when a neighbour wraps to two lines.
  castCard: { flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', gap: 6 },
  castCardOn: { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.panel2 },
  castPhoto: { width: 54, height: 54, borderRadius: 27 },
  // No minHeight: a reserved two-line box left short names floating above
  // centre and padded every row with dead space. One line, ellipsised.
  castName: { color: colors.text, fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  castNameOn: { color: colors.accent },
  checkDot: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  checkDotText: { color: colors.onAccent, fontWeight: '800', fontSize: 13 },
  betCard: { backgroundColor: colors.panel2, borderColor: colors.accent2, gap: 3 },
  betTitle: { color: colors.accent2, fontSize: 13, fontWeight: '800' },
  betBody: { color: colors.text, fontSize: 12.5, lineHeight: 17 },
  betAmount: { color: colors.accent, fontWeight: '800' },
  settleCard: { gap: 5 },
  settleTop: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  settleNote: { color: colors.text, fontSize: 12.5, lineHeight: 17 },
  settleMine: { gap: 2, marginTop: 4, marginBottom: 2 },
  settleMineOwe: { color: colors.text, fontSize: 13.5, fontWeight: '600' },
  settleMineGet: { color: colors.green, fontSize: 13.5, fontWeight: '600' },
  settleMineAmt: { fontWeight: '800' },
  settleAllLabel: { color: colors.textDim, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 6 },
  settleArrow: { color: colors.textDim },
  settleAmt: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  settleFoot: { color: colors.textDim, fontSize: 11.5, marginTop: 6, fontStyle: 'italic' },
  saveRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  clearButton: {
    justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: colors.line, backgroundColor: 'transparent',
  },
  clearButtonText: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  listPanel: { gap: 10 },
  // paddingTop matches listPanel's gap, so each divider sits centred between rows.
  listRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  listName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  listNameMe: { color: colors.accent },
  listValue: { color: colors.textDim, fontSize: 13 },
  listValueMuted: { fontStyle: 'italic', opacity: 0.7 },
  listValueHit: { color: colors.green, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: 12 },
  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 18, backgroundColor: colors.bg2, borderTopWidth: 1, borderTopColor: colors.line },
  saveButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  // Only the predictions bar shares its row with Clear, so the grow lives here.
  saveButtonGrow: { flex: 1 },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
});
