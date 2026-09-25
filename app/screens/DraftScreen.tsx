import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import { PinnedHeader, CONTENT_TOP_GAP } from '../components/ScreenHeader';
import BackButton from '../components/BackButton';
import NoteEditor from '../components/NoteEditor';
import { useLeague } from '../contexts/LeagueContext';
import CastAvatar from '../components/CastAvatar';
import { boardOrder, noteOf, rankOf, useMyBoard } from '../lib/board';
import { CLIENT_VERSION } from '../lib/clientVersion';
import { requireThisVersion, stalePeople, useClientVersions, useMinClient } from '../lib/clients';
import {
  DRAFT_FAIL_MESSAGES,
  completeDraft,
  currentTurnPlayerId,
  draftOrderOf,
  draftSlack,
  isPickEligible,
  makeDraftPick,
  ownersOf,
  resetDraft,
  resetPracticeDraft,
  sendPicksToEnd,
  sequenceOf,
  setDraftOrder,
  setPickOrder,
  setPracticeForEveryone,
  startDraft,
  undoDraftPick,
  useDraftRoot,
} from '../lib/state';

type Props = NativeStackScreenProps<RootStackParamList, 'Draft'>;

// The same live Denver draft as the website — same record, same rules, same
// atomic transaction — so people can draft from the app and the site together.
// When the commissioner turns on practice for everyone, all of it runs against
// the shared practice copy instead.
export default function DraftScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { root: liveRoot, leagueKey, playerId, teamId, isCommissioner, editorUnlocked } = useLeague();
  const { practice, root } = useDraftRoot(liveRoot);
  const canRun = isCommissioner && editorUnlocked;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  // Your own board, brought onto the draft floor: your order, your notes.
  // Read-only here apart from the note box — reordering lives on My board.
  const { board, setNote } = useMyBoard(leagueKey, playerId);
  const [byRank, setByRank] = useState(false);
  // Who in this league is running an older app. Every phone reports its own
  // build on launch, so this works without the out-of-date phone doing
  // anything — which is the whole point, since an out-of-date phone is
  // exactly the one that can't be trusted to check.
  const clientVersions = useClientVersions();
  const minClient = useMinClient();
  const [editingNote, setEditingNote] = useState<{ id: string; name: string } | null>(null);

  const league = root?.leagues?.[leagueKey];
  const liveLeague = liveRoot.leagues[leagueKey];

  function togglePractice(on: boolean) {
    const liveDs = liveLeague?.draftState;
    const realInProgress = !!liveDs?.started && !liveDs.complete;
    Alert.alert(
      on ? 'Turn on practice for everyone?' : 'End practice for everyone?',
      on
        ? `Every Draft screen, on the app and the website, switches to a fresh practice draft until you turn it off. The real draft isn't touched.${realInProgress ? '\n\nThe real draft has already started — it stays hidden while practice is on.' : ''}`
        : 'Everyone goes back to the real draft.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: on ? 'Start practice' : 'End practice',
          onPress: async () => {
            setMessage('');
            setSaving(true);
            try { await setPracticeForEveryone(on, liveRoot); }
            catch { setMessage("Couldn't switch practice — check your connection."); }
            finally { setSaving(false); }
          },
        },
      ],
    );
  }

  // Commissioners get the league-wide switch; everyone else just sees a banner
  // while practice is on.
  const practiceBar = canRun ? (
    <Panel style={[styles.practiceCard, practice && styles.practiceCardOn]}>
      <View style={styles.practiceRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.practiceTitle}>{practice ? 'PRACTICE IS ON FOR EVERYONE' : 'Practice draft for everyone'}</Text>
          <Text style={styles.practiceBody}>
            {practice
              ? "Picks don't count. You can pick for whoever is on the clock. When you're done, turn this off, then start the real draft."
              : 'Switches every Draft screen, on the app and the website, to a practice draft.'}
          </Text>
        </View>
        <Switch
          value={practice}
          disabled={saving}
          onValueChange={togglePractice}
          trackColor={{ true: colors.accent2, false: colors.line }}
          accessibilityLabel="Practice draft for everyone"
        />
      </View>
      {practice && (
        <Pressable
          onPress={() =>
            Alert.alert('Reset the practice draft?', "Clears every practice pick and puts practice back to not started. The real draft isn't touched.", [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Reset',
                style: 'destructive',
                onPress: async () => {
                  setMessage('');
                  try { await resetPracticeDraft(liveRoot); }
                  catch { setMessage("Couldn't reset the practice draft."); }
                },
              },
            ])
          }
        >
          <Text style={styles.practiceReset}>Reset practice draft</Text>
        </Pressable>
      )}
    </Panel>
  ) : practice ? (
    <Panel style={[styles.practiceCard, styles.practiceCardOn]}>
      <Text style={styles.practiceTitle}>PRACTICE DRAFT</Text>
      <Text style={styles.practiceBody}>Picks here don't count. The commissioner turns practice off before the real draft.</Text>
    </Panel>
  ) : null;

  if (!root || !league) {
    return (
      <View style={styles.container}>
        <View style={styles.backBar}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <PinnedHeader title="Draft" topInset={false} />
        <ScrollView contentContainerStyle={styles.setupContent}>
          {practiceBar}
          <Text style={styles.hint}>{practice ? 'Loading the practice draft…' : 'Loading…'}</Text>
        </ScrollView>
      </View>
    );
  }

  const order = draftOrderOf(league);
  const ds = league.draftState || { started: false, currentPickIndex: 0, complete: false };
  const contestants = (root.contestants || []).filter(Boolean);
  const nameOf = (id: string) => league.players.find((p) => p.id === id)?.name ?? id;

  async function move(i: number, dir: -1 | 1) {
    const next = [...order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSaving(true);
    setMessage('');
    try { await setDraftOrder(leagueKey, next, practice); }
    catch { setMessage("Couldn't save the draft order — nothing changed."); }
    finally { setSaving(false); }
  }
  // Moving one slot swaps it with its neighbour, so the person you pull
  // forward trades places with whoever was there — no silent reshuffle of the
  // other 26.
  async function moveSlot(i: number, dir: -1 | 1) {
    const next = sequenceOf(league!);
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSaving(true);
    setMessage('');
    try { await setPickOrder(leagueKey, next, practice); }
    catch { setMessage("Couldn't save the pick order — nothing changed."); }
    finally { setSaving(false); }
  }
  // One tap per no-show: both their picks go to the back, everyone else
  // keeps their slot.
  async function sendToEnd(playerId: string) {
    setSaving(true);
    setMessage('');
    try { await setPickOrder(leagueKey, sendPicksToEnd(league!, playerId), practice); }
    catch { setMessage("Couldn't move those picks — nothing changed."); }
    finally { setSaving(false); }
  }
  async function clearSlots() {
    setSaving(true);
    setMessage('');
    try { await setPickOrder(leagueKey, null, practice); }
    catch { setMessage("Couldn't reset the pick order — nothing changed."); }
    finally { setSaving(false); }
  }

  function start() {
    const go = async () => {
      setSaving(true);
      setMessage('');
      try { await startDraft(leagueKey, order, practice); }
      catch { setMessage("Couldn't start the draft — the database refused the write. Nothing changed."); }
      finally { setSaving(false); }
    };
    if (practice) { go(); return; }
    // The 2026 Denver draft started with two people on an older build; their
    // phones worked out the old draft order and picked out of turn. Nobody
    // knew until it had already happened, so it gets said out loud here.
    if (behind.length) {
      Alert.alert(
        `${behind.length} ${behind.length === 1 ? 'person is' : 'people are'} on an old app`,
        `${behind.map((p) => p.name).join(', ')}.\n\nAn out-of-date app works out the draft order for itself and can pick out of turn. Ask them to fully close the app and open it again, then check this screen — or have them use the website instead.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start anyway', style: 'destructive', onPress: go },
        ],
      );
      return;
    }
    Alert.alert(
      `Start the real ${league!.name} draft?`,
      'Everyone will be able to pick, on the app and the website. To rehearse first, turn on Practice draft for everyone above.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start real draft', style: 'destructive', onPress: go },
      ],
    );
  }
  function confirmReset() {
    Alert.alert(
      practice ? 'Reset the practice draft?' : `Reset the real ${league!.name} draft?`,
      practice
        ? 'Clears every practice pick for everyone.'
        : "This clears every pick made so far, for everyone, and puts the draft back to not started. It can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset draft',
          style: 'destructive',
          onPress: async () => {
            setMessage('');
            try { await resetDraft(leagueKey, practice); }
            catch { setMessage("Couldn't reset the draft — nothing changed."); }
          },
        },
      ],
    );
  }

  // Porterville's picks were seeded straight into the record without the draft
  // ever running here, so `started` is false even though the draft is long
  // done. Without this, opening Draft on that league offers a Start button
  // that would reset a completed roster.
  const alreadyDrafted = Object.keys(league.picks || {}).length > 0;

  if (!ds.started && alreadyDrafted) {
    return (
      <View style={styles.container}>
        <View style={styles.backBar}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <PinnedHeader title="Draft" subtitle={league.name} topInset={false} />
        <ScrollView contentContainerStyle={styles.setupContent}>
          {practiceBar}
          <Panel style={styles.completeCard}>
            <Text style={styles.turnTitle}>Draft complete</Text>
            <Text style={styles.turnBody}>
              {league.name} has already drafted — every pick is in. Head to Home for the full rosters.
            </Text>
          </Panel>
        </ScrollView>
      </View>
    );
  }

  const behind = stalePeople(league, clientVersions);
  const setupSeq = sequenceOf(league);
  const customOrder = !!league.pickOrder && league.pickOrder.length === setupSeq.length;

  if (!ds.started) {
    return (
      // A plain View clipped the draft order once a league had enough players
      // to run past the screen, with no way to reach the Start button.
      <View style={styles.container}>
        <View style={styles.backBar}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <PinnedHeader title="Draft" subtitle={league.name} topInset={false} />
        <ScrollView contentContainerStyle={styles.setupContent}>
          {practiceBar}
          {canRun && (
            <Panel style={[styles.checkCard, behind.length ? styles.checkCardBad : styles.checkCardGood]}>
              <Text style={[styles.checkTitle, behind.length ? styles.checkTitleBad : styles.checkTitleGood]}>
                {behind.length
                  ? `${behind.length} ${behind.length === 1 ? 'person is' : 'people are'} on an old app`
                  : "Everyone's app is up to date"}
              </Text>
              {behind.length ? (
                <>
                  {behind.map((p) => (
                    <Text key={p.id} style={styles.checkName}>
                      • {p.name} — {p.on === null ? 'never opened the app' : `on version ${p.on}`}
                    </Text>
                  ))}
                  <Text style={styles.checkBody}>
                    An out-of-date app works out the draft order for itself, so it can put someone
                    on the clock who isn't. Ask them to fully close the app and open it again;
                    this list updates on its own. The website is always current.
                  </Text>
                </>
              ) : (
                <Text style={styles.checkBody}>
                  Every phone in {league.name} is on version {CLIENT_VERSION}. Safe to start.
                </Text>
              )}
              {minClient < CLIENT_VERSION && (
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      'Require this version?',
                      `Anyone on an older app will be stopped at a screen asking them to update, until they do. Nothing else about the league changes.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Require it',
                          onPress: () => { requireThisVersion().catch(() => setMessage("Couldn't set the required version.")); },
                        },
                      ],
                    )
                  }
                >
                  <Text style={styles.checkAction}>Require this version to use the app</Text>
                </Pressable>
              )}
              {minClient >= CLIENT_VERSION && (
                <Text style={styles.checkBody}>Older apps are already locked out.</Text>
              )}
            </Panel>
          )}
          <Panel style={styles.formatCard}>
            <Text style={styles.formatLabel}>THIS LEAGUE'S FORMAT</Text>
            <Text style={styles.formatName}>Shared Draft</Text>
            <Text style={styles.formatBody}>A castaway can be shared by up to 2 players — everyone gets {league.picksPerPlayer} picks.</Text>
          </Panel>
          <Panel style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>Draft order</Text>
            <Text style={styles.formatBody}>
              {canRun
                ? "The order for round one; round two runs back the other way. Someone not here yet? Send both their picks to the end with the last button."
                : 'The order for round one; round two runs back the other way.'}
            </Text>
            {order.map((id, i) => (
              <View key={id} style={styles.orderRow}>
                <Text style={[styles.orderName, id === teamId && { color: colors.accent }]}>{i + 1}. {nameOf(id)}</Text>
                {canRun && (
                  <View style={styles.orderButtons}>
                    <Pressable onPress={() => move(i, -1)} disabled={i === 0 || saving} style={styles.orderBtn}><Ionicons name="arrow-up" size={16} color={colors.text} /></Pressable>
                    <Pressable onPress={() => move(i, 1)} disabled={i === order.length - 1 || saving} style={styles.orderBtn}><Ionicons name="arrow-down" size={16} color={colors.text} /></Pressable>
                    <Pressable
                      onPress={() => sendToEnd(id)}
                      disabled={saving}
                      style={[styles.orderBtn, styles.orderBtnWide]}
                      accessibilityLabel={`Send ${nameOf(id)}'s picks to the end`}
                    >
                      <Ionicons name="play-forward" size={15} color={colors.accent2} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </Panel>

          {/* Full control of the running order, slot by slot. Untouched, it's
              simply the snake the league has always used. */}
          <Panel style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>The running order ({setupSeq.length} picks)</Text>
            <Text style={styles.formatBody}>
              {customOrder
                ? canRun
                  ? 'Set by hand — this is exactly how the draft will run. The arrows swap a pick with the one above or below.'
                  : 'Set by hand by the commissioner — this is exactly how the draft will run.'
                : `Built from the order above, snaking across ${league.picksPerPlayer} rounds.${canRun ? ' Move any pick to take it over by hand.' : ''}`}
            </Text>
            {setupSeq.map((id, i) => (
              <View key={`${id}-${i}`} style={styles.orderRow}>
                <Text style={[styles.orderName, id === teamId && { color: colors.accent }]}>
                  {i + 1}. {nameOf(id)}
                </Text>
                {canRun && (
                  <View style={styles.orderButtons}>
                    <Pressable onPress={() => moveSlot(i, -1)} disabled={i === 0 || saving} style={styles.orderBtn}><Ionicons name="arrow-up" size={16} color={colors.text} /></Pressable>
                    <Pressable onPress={() => moveSlot(i, 1)} disabled={i === setupSeq.length - 1 || saving} style={styles.orderBtn}><Ionicons name="arrow-down" size={16} color={colors.text} /></Pressable>
                  </View>
                )}
              </View>
            ))}
            {canRun && customOrder && (
              <Pressable onPress={clearSlots} disabled={saving}>
                <Text style={styles.practiceReset}>Back to snake order</Text>
              </Pressable>
            )}
            {canRun ? (
              <Pressable style={styles.startButton} onPress={start} disabled={saving}>
                <Text style={styles.startButtonText}>{saving ? 'Saving…' : practice ? 'Start practice draft' : 'Start real draft'}</Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>The commissioner will start the draft. You'll see it here live.</Text>
            )}
          </Panel>
        </ScrollView>
      </View>
    );
  }

  const seq = sequenceOf(league);
  const turnId = currentTurnPlayerId(league);
  const iAmOnClock = turnId === teamId;
  // Practice only: the commissioner can pick for whoever is on the clock, so a
  // full round can be rehearsed without everyone online.
  const pickForClock = practice && canRun && !!turnId && !iAmOnClock;
  const canPick = iAmOnClock || pickForClock;
  const locked = draftSlack(root, league) <= 0;

  // A disabled card swallowed the tap entirely — no message, nothing. That is
  // indistinguishable from the app being broken, which is exactly what it got
  // reported as. Every tap now says why it can't go through.
  const blockReason = (contestantId: string): string | null => {
    if (ds.complete) return 'The draft is already complete.';
    if (!turnId) return "The draft isn't running right now.";
    if (!canPick) return `It's ${nameOf(turnId)}'s turn, not yours.`;
    const owners = ownersOf(league!, contestantId);
    if (owners.includes(turnId)) return 'You already have that castaway.';
    if (owners.length >= 2) return `Taken — ${owners.map(nameOf).join(' & ')} already have them.`;
    if (owners.length > 0 && draftSlack(root!, league!) <= 0) return 'Down to the wire — only unpicked castaways are available now.';
    return null;
  };

  const tap = async (contestantId: string) => {
    const blocked = blockReason(contestantId);
    if (blocked) { setMessage(blocked); return; }
    if (!turnId) return;
    setMessage('');
    const res = await makeDraftPick(leagueKey, contestantId, turnId, practice);
    if (!res.ok) setMessage(DRAFT_FAIL_MESSAGES[res.reason] || "That pick didn't go through.");
  };
  const finish = () => {
    const made = contestants.reduce((n, c) => n + ownersOf(league!, c.id).length, 0);
    Alert.alert(
      practice ? 'Finish the practice draft?' : `Lock in the ${league!.name} draft?`,
      `${made} pick${made === 1 ? '' : 's'} are in. Nobody will be on the clock and no more picks can be made, here or on the website. Rosters stay exactly as they are.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock it in',
          onPress: async () => {
            setMessage('');
            const res = await completeDraft(leagueKey, practice);
            if (!res.ok) setMessage(DRAFT_FAIL_MESSAGES[res.reason] || "Couldn't lock in the draft — nothing changed.");
          },
        },
      ],
    );
  };
  const undo = async () => {
    const res = await undoDraftPick(leagueKey, practice);
    if (!res.ok) setMessage(DRAFT_FAIL_MESSAGES[res.reason] || "Couldn't undo.");
  };

  return (
    <View style={styles.container}>
      <View style={styles.backBar}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <PinnedHeader title="Draft" subtitle={league.name} topInset={false} />
      <FlatList
        contentContainerStyle={{ padding: 20, paddingTop: CONTENT_TOP_GAP, paddingBottom: 40, gap: 10 }}
        data={byRank ? boardOrder(board, contestants) : [...contestants].sort((a, b) => a.name.localeCompare(b.name))}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 10 }}>
            {practiceBar}
            <Panel style={ds.complete ? styles.completeCard : styles.turnCard}>
              {ds.complete ? (
                <>
                  <Text style={styles.turnTitle}>Draft complete</Text>
                  <Text style={styles.turnBody}>All picks are in — check Home for full rosters.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.turnTitle}>On the clock: {turnId ? nameOf(turnId) : '—'}</Text>
                  <Text style={styles.turnBody}>
                    Pick {(ds.currentPickIndex || 0) + 1} of {seq.length}{locked ? ' — unpicked castaways only now' : ''}
                  </Text>
                  {iAmOnClock && <Text style={styles.yourTurn}>It's your turn — tap a castaway below.</Text>}
                  {pickForClock && <Text style={styles.yourTurn}>Practice: tap a castaway to pick for {nameOf(turnId!)}.</Text>}
                  {turnId && seq[(ds.currentPickIndex || 0) + 1] && (
                    <Text style={styles.upNext}>Up next: {nameOf(seq[(ds.currentPickIndex || 0) + 1])}</Text>
                  )}
                </>
              )}
            </Panel>
            {!!message && <Text style={styles.errorText}>{message}</Text>}
            <View style={styles.sortRow}>
              <Pressable
                style={[styles.sortChip, !byRank && styles.sortChipOn]}
                onPress={() => setByRank(false)}
                accessibilityState={{ selected: !byRank }}
              >
                <Text style={[styles.sortText, !byRank && styles.sortTextOn]}>A–Z</Text>
              </Pressable>
              <Pressable
                style={[styles.sortChip, byRank && styles.sortChipOn]}
                onPress={() => setByRank(true)}
                accessibilityState={{ selected: byRank }}
              >
                <Text style={[styles.sortText, byRank && styles.sortTextOn]}>My rank</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable style={styles.boardLink} onPress={() => navigation.navigate('MyBoard')} hitSlop={6}>
                <Ionicons name="list-outline" size={15} color={colors.accent2} />
                <Text style={styles.boardLinkText}>My board</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item: c }) => {
          const owners = ownersOf(league, c.id);
          const eligible = !ds.complete && canPick && isPickEligible(root, league, c.id, turnId!);
          const myRank = rankOf(board, c.id);
          const myNote = noteOf(board, c.id);
          return (
            <Pressable onPress={() => tap(c.id)}>
              <Panel style={[styles.card, canPick && !eligible && styles.cardDisabled, eligible && styles.cardEligible]}>
                <CastAvatar id={c.id} style={styles.photo} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{c.name}</Text>
                    {myRank ? <Text style={styles.rankChip}>#{myRank}</Text> : null}
                  </View>
                  <Text style={styles.meta}>{owners.length ? owners.map(nameOf).join(' & ') : 'Unpicked'} ({owners.length}/2)</Text>
                  {/* The whole point of the notes: readable without a tap,
                      while you're deciding. */}
                  {myNote ? <Text style={styles.noteText} numberOfLines={3}>{myNote}</Text> : null}
                </View>
                {/* Its own Pressable, so this opens the note instead of
                    spending your pick on them. */}
                <Pressable
                  style={styles.noteBtn}
                  hitSlop={10}
                  onPress={() => setEditingNote({ id: c.id, name: c.name })}
                  accessibilityLabel={`${myNote ? 'Edit' : 'Add'} my note on ${c.name}`}
                >
                  <Ionicons
                    name={myNote ? 'document-text' : 'create-outline'}
                    size={18}
                    color={myNote ? colors.accent2 : colors.textDim}
                  />
                </Pressable>
              </Panel>
            </Pressable>
          );
        }}
        ListFooterComponent={
          canRun ? (
            <View style={{ gap: 8 }}>
              {!ds.complete && (
                <Pressable style={styles.finishButton} onPress={finish}>
                  <Text style={styles.finishButtonText}>Lock in the draft</Text>
                </Pressable>
              )}
              {/* Hidden once locked in: undo puts the draft back to
                  in-progress, which is not what anyone wants from a finished
                  board. Reset stays, behind its own confirmation. */}
              {!ds.complete && (
                <Pressable style={styles.undoButton} onPress={undo}>
                  <Text style={styles.undoButtonText}>Undo last pick</Text>
                </Pressable>
              )}
              <Pressable style={styles.resetButton} onPress={confirmReset}>
                <Text style={styles.resetButtonText}>{practice ? 'Reset practice draft' : 'Reset real draft'}</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      {editingNote && (
        <NoteEditor
          visible
          contestantId={editingNote.id}
          name={editingNote.name}
          initial={noteOf(board, editingNote.id)}
          onSave={(text) => setNote(editingNote.id, text).catch(() => {})}
          onClose={() => setEditingNote(null)}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  // Opaque and above the header, so the header's drop shadow can't show
  // in the strip over the title — see the shadow note in ScreenHeader.
  backBar: { paddingHorizontal: 20, backgroundColor: colors.bg, zIndex: 11 },
  setupContent: { padding: 20, paddingTop: CONTENT_TOP_GAP, paddingBottom: 48, gap: 14 },
  back: { marginBottom: 4 },
  backText: { color: colors.accent2, fontSize: 14 },
  practiceCard: { gap: 8 },
  practiceCardOn: { borderColor: colors.accent2, borderWidth: 2 },
  practiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  practiceTitle: { color: colors.accent2, fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
  practiceBody: { color: colors.textDim, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  practiceReset: { color: colors.accent2, fontSize: 13, fontWeight: '700' },
  checkCard: { gap: 6 },
  checkCardGood: { borderColor: colors.green, borderWidth: 2 },
  checkCardBad: { borderColor: colors.red, borderWidth: 2 },
  checkTitle: { fontSize: 15, fontWeight: '800' },
  checkTitleGood: { color: colors.green },
  checkTitleBad: { color: colors.red },
  checkName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  checkBody: { color: colors.textDim, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  checkAction: { color: colors.accent2, fontSize: 13, fontWeight: '700', marginTop: 4 },
  formatCard: { backgroundColor: colors.panel2 },
  formatLabel: { color: colors.accent2, fontSize: 11, letterSpacing: 1.2 },
  formatName: { color: colors.accent, fontSize: 20, fontWeight: '800', marginTop: 4 },
  formatBody: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  hint: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  sectionTitle: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  orderName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  orderButtons: { flexDirection: 'row', gap: 6 },
  orderBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  orderBtnWide: { borderColor: colors.accent2 },
  startButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  startButtonText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  turnCard: { backgroundColor: colors.panel2, borderColor: colors.accent },
  completeCard: { backgroundColor: colors.panel2, alignItems: 'center' },
  turnTitle: { color: colors.accent, fontSize: 17, fontWeight: '800' },
  turnBody: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  yourTurn: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 8 },
  upNext: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  errorText: { color: colors.red, fontSize: 12, textAlign: 'center' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  sortChip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel,
  },
  sortChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  sortText: { color: colors.textDim, fontSize: 12.5, fontWeight: '700' },
  sortTextOn: { color: colors.onAccent },
  boardLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  boardLinkText: { color: colors.accent2, fontSize: 12.5, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankChip: { color: colors.accent, fontSize: 12.5, fontWeight: '800' },
  noteText: { color: colors.textDim, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  noteBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardDisabled: { opacity: 0.45 },
  cardEligible: { borderColor: colors.accent, borderWidth: 2 },
  photo: { width: 48, height: 48, borderRadius: 24 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  finishButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  finishButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  undoButton: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  undoButtonText: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  resetButton: { borderWidth: 1, borderColor: colors.red, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  resetButtonText: { color: colors.red, fontSize: 13, fontWeight: '700' },
});
