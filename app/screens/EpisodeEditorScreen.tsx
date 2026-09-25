import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import BackButton from '../components/BackButton';
import { PinnedHeader } from '../components/ScreenHeader';
import { useLiveContestants, useEpisodeNotes, publishEpisode } from '../lib/episodes';
import { episodeAirTime } from '../lib/countdown';
import { LIMITS } from '../lib/limits';
import { useLeague } from '../contexts/LeagueContext';
import {
  HOLDING_KINDS, holdingList, holdingsPatch, isIdol, newHoldingId, type Holdings,
} from '../lib/advantages';
import { Ionicons } from '@expo/vector-icons';
import { sanitizeStat } from '../lib/seasonStats';
import { textOnTribe, tribesOf } from '../lib/tribes';
import { shortName, type EpisodeStat } from '../lib/state';
import { clearRecapDraft, saveEditorDraft, useRecapDrafts, type RecapDraft } from '../lib/recapDraft';
import { usePreventRemove } from '@react-navigation/native';
import { parseRecap, recapParts } from '../lib/recap';

type Props = NativeStackScreenProps<RootStackParamList, 'EpisodeEditor'>;


// One episode at a time: who went home, the recap, then an explicit publish.
// Nothing is written until Save, so a half-finished thought never lands on
// everyone's phone.
export default function EpisodeEditorScreen({ route, navigation }: Props) {
  const { episode } = route.params;
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { contestants, loading } = useLiveContestants();
  const notes = useEpisodeNotes();
  const savedRecap = notes[String(episode)] ?? '';

  const { root, terms } = useLeague();
  const initialParts = recapParts(root, episode);
  const [recap, setRecap] = useState(initialParts.body);
  const [title, setTitle] = useState(initialParts.title ?? '');
  // Claude's draft for this episode, if the weekly task has written one.
  const draft: RecapDraft | undefined = useRecapDrafts()[String(episode)];
  const [draftNeeds, setDraftNeeds] = useState<string[] | null>(null);
  const [out, setOut] = useState<string[]>([]);
  // Voted out is the default reason; toggled to quit/medical per person below.
  const [quit, setQuit] = useState<string[]>([]);
  const [notify, setNotify] = useState(!savedRecap);
  // The published recap loads a moment after the screen opens; once it's
  // there this is an edit, and edits shouldn't re-ping the league by default.
  const hasPublished = !!savedRecap;
  useEffect(() => { if (hasPublished) setNotify(false); }, [hasPublished]);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  // A multi-line box's return key adds a new line, so the keyboard needs its
  // own way out: a Done button in the top bar while it's open.
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // Idols/advantages as of the end of this episode, per castaway. Edited here
  // and written with everything else on Save.
  const [items, setItems] = useState<Record<string, Holdings>>({});
  const [addingVotes, setAddingVotes] = useState(false);
  const [giveKind, setGiveKind] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, EpisodeStat>>({});
  const [mergeHere, setMergeHere] = useState(false);
  const [juryHere, setJuryHere] = useState(false);
  const tribes = tribesOf(root);

  // Work in progress is saved with "Save draft" (and offered on the way out),
  // so closing the editor never throws away edits. `baseline` is the last
  // saved/loaded state; anything different from it counts as unsaved.
  const snapshot = () => {
    const cleanStats: Record<string, EpisodeStat> = {};
    Object.entries(stats).forEach(([id, st]) => { const c = sanitizeStat(st ?? {}); if (c) cleanStats[id] = c; });
    return { title, recap, out: [...out].sort(), stats: cleanStats, items, mergeHere, needs: draftNeeds };
  };
  const snapKey = ready ? JSON.stringify(snapshot()) : '';
  const [baseline, setBaseline] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [restored, setRestored] = useState(false);
  // Only true when a previously saved draft was brought back on open.
  const [restoredFromEarlier, setRestoredFromEarlier] = useState(false);
  const dirty = ready && baseline !== null && snapKey !== baseline;

  async function saveDraft() {
    setSavingDraft(true);
    try {
      await saveEditorDraft(episode, snapshot());
      setRestored(true); // it's already on screen; don't "restore" our own save
      setBaseline(JSON.stringify(snapshot()));
      setSavedAt(Date.now());
      return true;
    } catch {
      Alert.alert('Couldn’t save the draft', 'Check your connection and try again.');
      return false;
    } finally {
      setSavingDraft(false);
    }
  }

  // Leaving with unsaved edits (back button or swipe) asks first.
  usePreventRemove(dirty && !saving, ({ data }) => {
    Alert.alert('Save your changes?', 'You have edits that aren’t saved yet.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      { text: 'Save draft', onPress: async () => { if (await saveDraft()) navigation.dispatch(data.action); } },
    ]);
  });

  // Seed from the record once the live cast arrives, then leave the form alone
  // so a sync tick doesn't wipe what's being typed.
  useEffect(() => {
    if (ready || loading || !contestants.length) return;
    setOut(contestants.filter((c) => c.eliminatedWeek === episode).map((c) => c.id));
    setQuit(contestants.filter((c) => c.eliminatedWeek === episode && c.exitReason === 'quit').map((c) => c.id));
    const seeded: Record<string, Holdings> = {};
    (root.contestants ?? []).forEach((c) => { if (c) seeded[c.id] = { ...(c.items ?? {}) }; });
    setItems(seeded);
    setStats({ ...(root.episodeStats?.[String(episode)] ?? {}) });
    setMergeHere(root.game?.mergeEp === episode);
    setJuryHere(root.game?.juryEp === episode);
    setReady(true);
  }, [ready, loading, contestants, episode]);

  // Once seeded, the loaded state is the baseline for "unsaved changes".
  useEffect(() => {
    if (ready && baseline === null) setBaseline(JSON.stringify(snapshot()));
  }, [ready, baseline]);

  // A saved draft of your own comes back automatically (unless you've already
  // started editing this time).
  useEffect(() => {
    const ed = draft?.editor;
    if (!ready || restored || !ed || dirty) return;
    setRestored(true);
    setRestoredFromEarlier(true);
    setRecap(ed.recap ?? '');
    setTitle(ed.title ?? '');
    setOut(ed.out ?? []);
    setStats((ed.stats ?? {}) as Record<string, EpisodeStat>);
    setItems((prev) => ({ ...prev, ...(ed.items ?? {}) }));
    setMergeHere(!!ed.mergeHere);
    setDraftNeeds(ed.needs ?? null);
    setSavedAt(ed.savedAt ?? null);
    setBaseline(null); // re-baselined on the next render from the restored state
  }, [ready, restored, draft?.editor, dirty]);

  const savedTitle = root.episodeTitles?.[String(episode)] ?? '';
  useEffect(() => {
    const p = recapParts(root, episode);
    setRecap(p.body);
    setTitle(p.title ?? '');
  }, [savedRecap, savedTitle]);

  const eligible = contestants
    .filter((c) => !c.eliminatedWeek || c.eliminatedWeek === episode)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const addHolding = (cid: string, kind: string) =>
    setItems((prev) => ({ ...prev, [cid]: { ...(prev[cid] ?? {}), [newHoldingId()]: { kind, ep: episode } } }));

  const patchStat = (cid: string, patch: Partial<EpisodeStat>) =>
    setStats((prev) => ({ ...prev, [cid]: { ...(prev[cid] ?? {}), ...patch } }));

  // Finding an idol means they're now holding one — add the tag with it, and
  // take back the one this episode added if it gets unticked.
  const toggleIdolFound = (cid: string, on: boolean) => {
    patchStat(cid, { idolFound: on });
    setItems((prev) => {
      const mine = { ...(prev[cid] ?? {}) };
      if (on) mine[newHoldingId()] = { kind: 'Idol', ep: episode };
      else {
        const added = Object.entries(mine).find(([, h]) => h.kind === 'Idol' && h.ep === episode);
        if (added) delete mine[added[0]];
      }
      return { ...prev, [cid]: mine };
    });
  };

  // One tap for "the whole tribe won": ticks everyone on it who's still in,
  // or clears them all if they're already ticked.
  const tribeMembers = (tid: string) => eligible.filter((c) => !out.includes(c.id) && root.contestants?.find((r) => r?.id === c.id)?.tribe === tid);
  const tribeAll = (tid: string, field: 'immunity' | 'reward') => {
    const m = tribeMembers(tid);
    return m.length > 0 && m.every((c) => stats[c.id]?.[field]);
  };
  const setTribe = (tid: string, field: 'immunity' | 'reward') => {
    const on = !tribeAll(tid, field);
    setStats((prev) => {
      const next = { ...prev };
      tribeMembers(tid).forEach((c) => { next[c.id] = { ...(next[c.id] ?? {}), [field]: on }; });
      return next;
    });
  };

  const alive = eligible.filter((c) => !out.includes(c.id));
  const idsWhere = (f: (st: EpisodeStat) => boolean) =>
    new Set(Object.entries(stats).filter(([, st]) => st && f(st)).map(([id]) => id));
  const toggleField = (cid: string, field: 'immunity' | 'reward' | 'journey') =>
    patchStat(cid, { [field]: !stats[cid]?.[field] });
  const voteRows = eligible
    .filter((c) => (stats[c.id]?.votes ?? 0) > 0)
    .sort((a, b) => (stats[b.id]?.votes ?? 0) - (stats[a.id]?.votes ?? 0));
  const tally = voteRows.map((c) => stats[c.id]?.votes).join('-');
  const holders = alive.filter((c) => holdingList(items[c.id]).length > 0);

  // Everyone still eligible as tappable first-name chips — quicker to scan
  // than twenty rows when only one or two people did the thing.
  function CastChips({ cast, selected, onToggle }: { cast: typeof eligible; selected: Set<string>; onToggle: (id: string) => void }) {
    return (
      <View style={styles.holdChips}>
        {cast.map((c) => {
          const on = selected.has(c.id);
          return (
            <Pressable key={c.id} style={[styles.castChip, on && styles.toggleOn]} onPress={() => onToggle(c.id)}>
              <Text style={[styles.castChipText, on && styles.toggleOnText]}>{shortName(c.name)}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  function Toggle({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
    return (
      <Pressable style={[styles.kindChip, on && styles.toggleOn]} onPress={onPress}>
        <Text style={[styles.kindChipText, on && styles.toggleOnText]}>{label}</Text>
      </Pressable>
    );
  }
  function QuickTribeRow({ label, field }: { label: string; field: 'immunity' | 'reward' }) {
    return (
      <View style={styles.quickRow}>
        <Text style={[styles.expandLabel, { width: 104 }]}>{label}</Text>
        <View style={styles.holdChips}>
          {tribes.map((t) => {
            const on = tribeAll(t.id, field);
            return (
              <Pressable key={t.id} onPress={() => setTribe(t.id, field)}
                style={[styles.kindChip, { borderColor: t.color }, on && { backgroundColor: t.color }]}>
                <Text style={[styles.kindChipText, { color: on ? textOnTribe(t.color) : colors.text }]}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // Everything besides eliminations and the recap, in the same single write.
  function extraPatch(): Record<string, unknown> {
    const patch: Record<string, unknown> = { ...holdingsPatch(root, items) };
    const saved = root.episodeStats?.[String(episode)] ?? {};
    const ids = new Set([...Object.keys(saved), ...Object.keys(stats)]);
    ids.forEach((cid) => {
      const next = sanitizeStat(stats[cid] ?? {});
      if (JSON.stringify(next) !== JSON.stringify(sanitizeStat(saved[cid] ?? {}))) {
        patch[`episodeStats/${episode}/${cid}`] = next;
      }
    });
    const g = root.game ?? {};
    if (mergeHere && g.mergeEp !== episode) patch['game/mergeEp'] = episode;
    if (!mergeHere && g.mergeEp === episode) patch['game/mergeEp'] = null;
    if (juryHere && g.juryEp !== episode) patch['game/juryEp'] = episode;
    if (!juryHere && g.juryEp === episode) patch['game/juryEp'] = null;
    return patch;
  }
  const removeHolding = (cid: string, hid: string) =>
    setItems((prev) => {
      const next = { ...(prev[cid] ?? {}) };
      delete next[hid];
      return { ...prev, [cid]: next };
    });

  const toggle = (id: string) =>
    setOut((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleQuit = (id: string) =>
    setQuit((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Fills every field from the draft. Anything the draft couldn't confirm is
  // null there and stays blank here; its reasons show in the Needs you panel.
  function loadDraft() {
    if (!draft?.stats) return;
    const d = draft.stats;
    // The draft's recap starts with its title line; split it into the title field.
    const parts = parseRecap(draft.recap);
    setTitle(d.title ?? parts.title ?? '');
    setRecap(parts.title ? parts.body : (draft.recap ?? ''));
    if (d.votedOut) setOut(d.votedOut.filter((id) => eligible.some((c) => c.id === id)));
    const next: Record<string, EpisodeStat> = {};
    const put = (id: string, st: EpisodeStat) => { next[id] = { ...(next[id] ?? {}), ...st }; };
    if (d.immunity?.tribe) (root.contestants ?? []).forEach((c) => { if (c && c.tribe === d.immunity!.tribe && !c.eliminatedWeek) put(c.id, { immunity: true }); });
    d.immunity?.individuals?.forEach((id) => put(id, { immunity: true }));
    if (d.reward?.tribe) (root.contestants ?? []).forEach((c) => { if (c && c.tribe === d.reward!.tribe && !c.eliminatedWeek) put(c.id, { reward: true }); });
    d.reward?.individuals?.forEach((id) => put(id, { reward: true }));
    Object.entries(d.votes ?? {}).forEach(([id, n]) => { if (typeof n === 'number' && n > 0) put(id, { votes: n }); });
    d.idolsFound?.forEach((id) => put(id, { idolFound: true }));
    d.idolsPlayed?.forEach((p) => { if (p.outcome) put(p.id, { idolPlay: p.outcome }); });
    d.journeys?.forEach((id) => put(id, { journey: true }));
    setStats(next);
    // What they're holding now: add the finds; the commissioner removes played ones.
    setItems((prev) => {
      const out2 = { ...prev };
      const add = (id: string, kind: string) => {
        const mine = { ...(out2[id] ?? {}) };
        if (!Object.values(mine).some((h) => h.kind === kind && h.ep === episode)) mine[newHoldingId()] = { kind, ep: episode };
        out2[id] = mine;
      };
      d.idolsFound?.forEach((id) => add(id, 'Idol'));
      d.advantagesFound?.forEach((a) => add(a.id, a.kind));
      return out2;
    });
    if (d.merge !== null && d.merge !== undefined) setMergeHere(!!d.merge);
    setDraftNeeds(d.needsMatt ?? []);
  }

  async function save() {
    setSaving(true);
    try {
      await publishEpisode({
        week: episode,
        recap,
        cast: contestants,
        eliminatedIds: out,
        quitIds: quit,
        notify,
        title,
        holdings: extraPatch(),
      });
      // Published: Claude's draft and any saved work in progress are done with.
      if (draft) await clearRecapDraft(episode).catch(() => {});
      setBaseline(snapKey);
      setTimeout(() => navigation.goBack(), 0);
    } catch {
      Alert.alert('Couldn’t save', 'Something went wrong writing the episode. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const outNames = eligible.filter((c) => out.includes(c.id)).map((c) => c.name);

  return (
    // iOS: the ScrollView moves itself clear of the keyboard
    // (automaticallyAdjustKeyboardInsets). Wrapping it in a padding
    // KeyboardAvoidingView as well adjusted twice, which is what made the page
    // jump and get stuck. Android still needs the wrapper.
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? undefined : 'height'}
      enabled={Platform.OS !== 'ios'}
    >
      {/* Outside the ScrollView so it stays reachable on a long recap. */}
      <View style={[styles.backBar, styles.backBarRow]}>
        <BackButton onPress={() => navigation.goBack()} />
        {keyboardUp && (
          <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10} style={styles.doneBtn}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        )}
      </View>
      <PinnedHeader
        title={`Episode ${episode}`}
        subtitle={new Date(episodeAirTime(episode)).toLocaleDateString()}
        topInset={false}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >

        {loading && <ActivityIndicator color={colors.accent} />}

        {restoredFromEarlier && savedAt && (
          <Text style={styles.restoredNote}>
            Picked up your saved draft from {new Date(savedAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
          </Text>
        )}

        {draft?.stats && !draft.editor && draftNeeds === null && (
          <Panel style={styles.draftCard}>
            <Text style={styles.draftTitle}>Claude's draft is ready</Text>
            <Text style={styles.hint}>
              A recap and stats for this episode, pulled from recaps online. Loading it fills in the fields below.
              Nothing reaches the league until you save.
              {draft.stats.needsMatt?.length ? ` ${draft.stats.needsMatt.length} thing${draft.stats.needsMatt.length > 1 ? 's' : ''} need${draft.stats.needsMatt.length > 1 ? '' : 's'} you.` : ''}
            </Text>
            <Pressable style={styles.draftButton} onPress={loadDraft}>
              <Text style={styles.draftButtonText}>Load draft</Text>
            </Pressable>
          </Panel>
        )}

        {draftNeeds && draftNeeds.length > 0 && (
          <Panel style={styles.needsCard}>
            <Text style={styles.needsTitle}>NEEDS YOU</Text>
            <Text style={styles.hint}>The draft left these blank because the sources didn't confirm them.</Text>
            {draftNeeds.map((n, i) => (
              <Text key={i} style={styles.needsItem}>• {n}</Text>
            ))}
          </Panel>
        )}

        <Panel style={styles.section}>
          <Text style={styles.sectionLabel}>EPISODE TITLE</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Permanent Uncertainty"
            placeholderTextColor={colors.textDim}
            maxLength={LIMITS.episodeTitle}
            returnKeyType="done"
          />
          <Text style={[styles.sectionLabel, { marginTop: 8 }]}>RECAP</Text>
          <TextInput
            style={styles.notes}
            value={recap}
            onChangeText={setRecap}
            placeholder="What happened this episode?"
            placeholderTextColor={colors.textDim}
            multiline
            // Grows with the text instead of scrolling inside itself, so a
            // swipe anywhere scrolls the page (and drags the keyboard away)
            // rather than getting trapped in the box.
            scrollEnabled={false}
            textAlignVertical="top"
            // Roughly 800 words — a long recap and then some. The database
            // refuses anything past it, and a refused recap would take the
            // eliminations in the same write down with it.
            maxLength={LIMITS.episodeRecap}
          />
          {recap.length > LIMITS.episodeRecap - 500 && (
            <Text style={styles.counter}>
              {LIMITS.episodeRecap - recap.length} characters left
            </Text>
          )}
        </Panel>

        <Panel style={styles.section}>
          <Text style={styles.sectionLabel}>{terms.out.toUpperCase()}</Text>
          <Text style={styles.hint}>Check every {terms.unit} who left this episode.</Text>
          {eligible.map((c) => {
            const checked = out.includes(c.id);
            const isQuit = quit.includes(c.id);
            return (
              <View key={c.id}>
                <Pressable style={styles.checkRow} onPress={() => toggle(c.id)}>
                  <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkLabel}>{c.name}</Text>
                </Pressable>
                {checked && (
                  <Pressable style={styles.quitRow} onPress={() => toggleQuit(c.id)}>
                    <View style={[styles.checkbox, styles.checkboxSmall, isQuit && styles.checkboxOn]}>
                      {isQuit && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.quitLabel}>Left by quitting or medical evacuation (not {terms.out})</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </Panel>

        {/* Every episode has a vote and an immunity result, so those come
            first; the things that only sometimes happen sit below. Votes,
            immunity, reward, idols, journeys and the merge are all Survivor
            concepts — shows without them (e.g. Amazing Race teams) skip this
            whole block. */}
        {terms.hasStats && (
        <Panel style={styles.section}>
          <Text style={styles.sectionLabel}>THE VOTE</Text>
          <Text style={styles.hint}>
            How many votes each person got at Tribal.{tally ? ` Final vote: ${tally}.` : ''}
          </Text>
          {voteRows.map((c) => (
            <View key={c.id} style={styles.stepRow}>
              <Text style={[styles.checkLabel, { flex: 1 }]} numberOfLines={1}>{c.name}</Text>
              <Pressable style={styles.stepBtn} onPress={() => patchStat(c.id, { votes: Math.max(0, (stats[c.id]?.votes ?? 0) - 1) })}>
                <Ionicons name="remove" size={16} color={colors.text} />
              </Pressable>
              <Text style={styles.stepValue}>{stats[c.id]?.votes ?? 0}</Text>
              <Pressable style={styles.stepBtn} onPress={() => patchStat(c.id, { votes: Math.min(30, (stats[c.id]?.votes ?? 0) + 1) })}>
                <Ionicons name="add" size={16} color={colors.text} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => setAddingVotes((v) => !v)} hitSlop={6}>
            <Text style={styles.link}>{addingVotes ? 'Done' : '+ Add someone who got votes'}</Text>
          </Pressable>
          {addingVotes && (
            <CastChips
              cast={eligible.filter((c) => !(stats[c.id]?.votes))}
              selected={new Set()}
              onToggle={(id) => patchStat(id, { votes: 1 })}
            />
          )}
        </Panel>
        )}

        {terms.hasStats && (
        <Panel style={styles.section}>
          <Text style={styles.sectionLabel}>IMMUNITY</Text>
          {tribes.length > 0 && <QuickTribeRow label="Tribe won" field="immunity" />}
          <Text style={styles.expandLabel}>Or individual winner (after the merge)</Text>
          <CastChips cast={alive} selected={idsWhere((st) => !!st.immunity)} onToggle={(id) => toggleField(id, 'immunity')} />
        </Panel>
        )}

        {terms.hasStats && (
        <Panel style={styles.section}>
          <Text style={styles.sectionLabel}>REWARD</Text>
          <Text style={styles.hint}>Leave empty if there wasn't one.</Text>
          {tribes.length > 0 && <QuickTribeRow label="Tribe won" field="reward" />}
          <Text style={styles.expandLabel}>Or individual winners</Text>
          <CastChips cast={alive} selected={idsWhere((st) => !!st.reward)} onToggle={(id) => toggleField(id, 'reward')} />
        </Panel>
        )}

        {(terms.hasIdols || terms.hasStats || terms.hasTribes) && (
        <Text style={styles.groupLabel}>ONLY IF IT HAPPENED</Text>
        )}

        {terms.hasIdols && (
        <Panel style={styles.section}>
          <Text style={styles.sectionLabel}>IDOLS</Text>
          <Text style={styles.expandLabel}>Found one</Text>
          <CastChips cast={alive} selected={idsWhere((st) => !!st.idolFound)} onToggle={(id) => toggleIdolFound(id, !stats[id]?.idolFound)} />
          <Text style={styles.expandLabel}>Played one</Text>
          <CastChips
            cast={eligible}
            selected={idsWhere((st) => !!st.idolPlay)}
            onToggle={(id) => patchStat(id, { idolPlay: stats[id]?.idolPlay ? undefined : 'saved' })}
          />
          {eligible.filter((c) => stats[c.id]?.idolPlay).map((c) => (
            <View key={c.id} style={styles.playRow}>
              <Text style={[styles.checkLabel, { flex: 1 }]} numberOfLines={1}>{shortName(c.name)}'s idol</Text>
              <Toggle on={stats[c.id]?.idolPlay === 'saved'} label="Saved them" onPress={() => patchStat(c.id, { idolPlay: 'saved' })} />
              <Toggle on={stats[c.id]?.idolPlay === 'wasted'} label="Didn't need it" onPress={() => patchStat(c.id, { idolPlay: 'wasted' })} />
            </View>
          ))}
        </Panel>
        )}

        {terms.hasIdols && (
        <Panel style={styles.section}>
          <Text style={styles.sectionLabel}>HOLDING NOW</Text>
          <Text style={styles.hint}>What people are sitting on after this episode. Tap one to remove it once it's played or lost.</Text>
          {holders.map((c) => (
            <View key={c.id} style={styles.playRow}>
              <Text style={[styles.checkLabel, { width: 90 }]} numberOfLines={1}>{shortName(c.name)}</Text>
              <View style={[styles.holdChips, { flex: 1 }]}>
                {holdingList(items[c.id]).map((h) => (
                  <Pressable key={h.id} style={styles.holdChip} onPress={() => removeHolding(c.id, h.id)}>
                    <Ionicons name={isIdol(h.kind) ? 'shield' : 'star'} size={12} color={colors.accent} />
                    <Text style={styles.holdChipText}>{h.kind}</Text>
                    <Text style={styles.holdChipMeta}>ep {h.ep}</Text>
                    <Ionicons name="close" size={13} color={colors.textDim} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <Text style={styles.expandLabel}>Give someone</Text>
          <View style={styles.holdChips}>
            {HOLDING_KINDS.map((k) => (
              <Toggle key={k} on={giveKind === k} label={k} onPress={() => setGiveKind(giveKind === k ? null : k)} />
            ))}
          </View>
          {giveKind && (
            <CastChips cast={alive} selected={new Set()} onToggle={(id) => { addHolding(id, giveKind); setGiveKind(null); }} />
          )}
        </Panel>
        )}

        {terms.hasStats && (
        <Panel style={styles.section}>
          <Text style={styles.sectionLabel}>JOURNEY</Text>
          <CastChips cast={alive} selected={idsWhere((st) => !!st.journey)} onToggle={(id) => toggleField(id, 'journey')} />
        </Panel>
        )}

        {terms.hasTribes && (
        <Panel style={styles.section}>
          <Text style={styles.sectionLabel}>MERGE</Text>
          <Text style={styles.hint}>Tick it on the merge episode. Tribe names drop off everyone's cards from then on.</Text>
          <Pressable style={styles.checkRow} onPress={() => setMergeHere((v) => !v)}>
            <View style={[styles.checkbox, mergeHere && styles.checkboxAccent]}>
              {mergeHere && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>The tribes merged this episode</Text>
          </Pressable>
        </Panel>
        )}

        <Pressable style={styles.notifyRow} onPress={() => setNotify((v) => !v)}>
          <View style={[styles.checkbox, notify && styles.checkboxOn]}>
            {notify && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkLabel}>Notify the league</Text>
            <Text style={styles.hint}>
              Sends “Episode {episode} recap is up” to everyone. No names, no spoilers.
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      <View style={styles.saveBar}>
        {!!outNames.length && (
          <Text style={styles.saveSummary} numberOfLines={1}>Out: {outNames.join(', ')}</Text>
        )}
        <View style={styles.draftRow}>
          <Text style={styles.draftStatus}>
            {dirty ? 'Unsaved changes' : savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : savedRecap ? 'Published' : 'Not published yet'}
          </Text>
          <Pressable style={[styles.saveDraftBtn, (!dirty || savingDraft) && styles.saveButtonOff]} disabled={!dirty || savingDraft} onPress={saveDraft}>
            <Text style={styles.saveDraftText}>{savingDraft ? 'Saving…' : 'Save draft'}</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.saveButton, saving && styles.saveButtonOff]} disabled={saving} onPress={save}>
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving…' : notify ? 'Save & notify league' : 'Save episode'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  // Opaque and above the header, so the header's drop shadow can't show
  // in the strip over the title — see the shadow note in ScreenHeader.
  backBar: { paddingHorizontal: 20, backgroundColor: colors.bg, zIndex: 11 },
  content: { padding: 20, paddingTop: 16, paddingBottom: 40, gap: 14 },
  section: { gap: 8 },
  sectionLabel: { color: colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7 },
  quitRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 33, paddingBottom: 7 },
  quitLabel: { color: colors.textDim, fontSize: 13, flexShrink: 1 },
  checkboxSmall: { width: 18, height: 18, borderRadius: 5 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.red, borderColor: colors.red },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  checkLabel: { color: colors.text, fontSize: 15, flexShrink: 1 },
  titleInput: {
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.line, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 16, fontWeight: '700',
  },
  // flex-end: BackButton carries the safe-area space above it, so centring put Done up by the clock.
  backBarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  doneBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 5 },
  doneText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  notes: {
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.line, borderRadius: 10,
    padding: 12, color: colors.text, fontSize: 14, lineHeight: 20, minHeight: 160,
  },
  draftCard: { gap: 8, borderColor: colors.accent, borderWidth: 1.5 },
  draftTitle: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  draftButton: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16, marginTop: 2 },
  draftButtonText: { color: colors.onAccent, fontWeight: '800', fontSize: 14 },
  needsCard: { gap: 6, borderColor: colors.red, borderWidth: 1.5 },
  needsTitle: { color: colors.red, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  needsItem: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
  goneLabel: { textDecorationLine: 'line-through', color: colors.textDim },
  rowSummary: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  expand: { gap: 8, paddingTop: 4, paddingBottom: 6 },
  expandLabel: { color: colors.textDim, fontSize: 11.5, fontWeight: '700' },
  toggleOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleOnText: { color: colors.onAccent },
  link: { color: colors.accent, fontSize: 13.5, fontWeight: '700', paddingVertical: 2 },
  groupLabel: { color: colors.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginTop: 10, textAlign: 'center' },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  castChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg2 },
  castChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: colors.text, fontSize: 15, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  checkboxAccent: { backgroundColor: colors.accent, borderColor: colors.accent },
  holdTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  holdChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  holdChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.bg2,
  },
  holdChipText: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  holdChipMeta: { color: colors.textDim, fontSize: 11 },
  kindChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  kindChipText: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },
  counter: { color: colors.textDim, fontSize: 11, textAlign: 'right', marginTop: 6 },
  notifyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    backgroundColor: colors.panel2, borderRadius: 12, padding: 13,
    borderWidth: 1, borderColor: colors.line,
  },
  saveBar: {
    padding: 14, gap: 8,
    borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg2,
  },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  draftStatus: { flex: 1, color: colors.textDim, fontSize: 12.5 },
  saveDraftBtn: { borderWidth: 1.5, borderColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  saveDraftText: { color: colors.accent, fontWeight: '800', fontSize: 13.5 },
  restoredNote: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  saveSummary: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  saveButtonOff: { opacity: 0.5 },
  saveButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
});
