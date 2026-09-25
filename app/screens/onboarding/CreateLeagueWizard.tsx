import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import { createLeague, useSeasonCatalog, type SeasonOption } from '../../lib/account';
import { Screen, Choice, Note, Label, makeStyles as uiStyles } from './ui';

// Create a league in five short steps. The show comes first because the cast,
// schedule and wording all follow from it. Only what a group actually decides
// is asked; the cast, schedule and every episode's results come from us.

const TOTAL = 5;

// Names that would be ambiguous for anyone in more than one league.
const GENERIC = [
  'survivor', 'survivor league', 'fantasy survivor', 'survivor fantasy', 'survivor fantasy league',
  'amazing race', 'the amazing race', 'league', 'my league', 'the league', 'fantasy league', 'fantasy',
  'friends', 'family', 'family league', 'survivor 51', 'season 51', 'test',
];
const isGeneric = (n: string) => {
  const s = n.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
  return !!s && (GENERIC.includes(s) || /^(survivor|fantasy|league|\s)+$/.test(s));
};

function defaultDraftAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(20, 0, 0, 0);
  return d;
}
/** "Thu, Sep 25 · 8:00 PM MDT" in the viewer's own time zone. */
export function fmtDraftTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return `${day} · ${time}`;
}

export type CreatedInfo = { seasonId: string; leagueKey: string; code: string; personId: string; name: string };

export default function CreateLeagueWizard({
  playerName, isAdmin, onCancel, onCreated,
}: {
  playerName: string;
  isAdmin: boolean;
  onCancel: () => void;
  onCreated: (l: CreatedInfo) => void;
}) {
  const colors = useThemeColors();
  const ui = uiStyles(colors);
  const styles = makeStyles(colors);
  const catalog = useSeasonCatalog().filter((o: SeasonOption & { adminOnly?: boolean }) => o.open && (!o.adminOnly || isAdmin));
  const [step, setStep] = useState(1);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [picks, setPicks] = useState(2);
  const [shared, setShared] = useState(true);
  const [draft, setDraft] = useState<'live' | 'auto' | 'offline'>('live');
  const [draftAt, setDraftAt] = useState<string | null>(defaultDraftAt().toISOString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const season = catalog.find((o) => o.id === pickedId) ?? null;
  const unit = season?.showId === 'amazing-race' || season?.showId === 'test-show' ? 'team' : 'castaway';
  const back = () => (step === 1 ? onCancel() : setStep(step - 1));
  const next = () => setStep(step + 1);

  if (step === 1) {
    return (
      <Screen
        title="What show is your league for?"
        subtitle="We keep the cast, schedule and every episode's results up to date, so you never have to type them in."
        step={{ index: 1, total: TOTAL }}
        onBack={back}
        primary={{ label: 'Next', onPress: next, disabled: !season }}
      >
        {catalog.length === 0 && <Note>Loading shows…</Note>}
        {catalog.map((o) => (
          <Choice
            key={o.id}
            selected={pickedId === o.id}
            onPress={() => {
              setPickedId(o.id);
              // Amazing Race has 13 teams: one pick each keeps a small league workable.
              setPicks(o.showId === 'survivor' ? 2 : 1);
            }}
            icon="tv"
            title={`${o.showName} · ${o.label}`}
            body={`${o.castCount} ${o.showId === 'survivor' ? 'castaways' : 'teams'}`}
          />
        ))}
        <Note>More shows are on the way.</Note>
      </Screen>
    );
  }

  if (step === 2) {
    return (
      <Screen title="How do you want to play?" subtitle="You can't change this after the draft." step={{ index: 2, total: TOTAL }} onBack={back} primary={{ label: 'Next', onPress: next }}>
        <Choice
          selected
          onPress={() => {}}
          icon="trophy"
          title="Last one standing"
          badge="Simplest"
          body={`Everyone drafts ${unit === 'team' ? 'teams' : 'castaways'}. Whoever holds the winner wins the league. Weekly picks and a season pick keep it interesting along the way.`}
        />
        <Note>Points leagues are coming soon.</Note>
        <Label>Picks each</Label>
        <View style={styles.stepperRow}>
          {[1, 2, 3].map((n) => (
            <Pressable key={n} onPress={() => setPicks(n)} style={[styles.day, picks === n && styles.chipOn]}>
              <Text style={[styles.dayText, picks === n && styles.chipTextOn]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Two players can pick the same {unit}</Text>
            <Text style={styles.switchSub}>Off means every {unit} belongs to one person.</Text>
          </View>
          <Switch value={shared} onValueChange={setShared} />
        </View>
      </Screen>
    );
  }

  if (step === 3) {
    const generic = isGeneric(name);
    return (
      <Screen
        title="Name your league"
        subtitle="Make it yours. Some people play in more than one league, so a generic name gets confusing fast."
        step={{ index: 3, total: TOTAL }}
        onBack={back}
        primary={{ label: 'Next', onPress: next, disabled: !name.trim() || generic }}
      >
        <TextInput
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Porterville Blindsiders"
          placeholderTextColor={colors.textDim}
          maxLength={40}
          autoCapitalize="words"
          autoFocus
        />
        {generic && <Note tone="warn">That one's too generic. Try your town, your group, or an inside joke.</Note>}
      </Screen>
    );
  }

  if (step === 4) {
    return (
      <Screen title="How will you draft?" step={{ index: 4, total: TOTAL }} onBack={back} primary={{ label: 'Next', onPress: next }}>
        <Choice selected={draft === 'live'} onPress={() => setDraft('live')} icon="people" title="Live draft" badge="Most fun" body="Pick a time and draft together in the app, snake order. Anyone who's away gets auto-picked from their own rankings." />
        {(draft === 'live' || draft === 'auto') && (
          <View style={styles.whenCard}>
            <View style={styles.whenRow}>
              <Text style={styles.whenLabel}>{draft === 'live' ? 'Draft starts' : 'Auto draft runs'}</Text>
              {draftAt && (
                <View style={styles.pickers}>
                  <DateTimePicker
                    value={new Date(draftAt)}
                    mode="date"
                    display="compact"
                    minimumDate={new Date()}
                    onChange={(_, v) => { if (v) { const cur = new Date(draftAt); v.setHours(cur.getHours(), cur.getMinutes(), 0, 0); setDraftAt(v.toISOString()); } }}
                  />
                  <DateTimePicker value={new Date(draftAt)} mode="time" display="compact" minuteInterval={15} onChange={(_, v) => { if (v) setDraftAt(v.toISOString()); }} />
                </View>
              )}
            </View>
            {draftAt ? (
              <Text style={styles.whenHint}>{fmtDraftTime(draftAt)}. Everyone sees it in their own time zone.</Text>
            ) : (
              <Text style={styles.whenHint}>No time yet. You can start the draft yourself from Settings whenever your group is ready.</Text>
            )}
            <Pressable onPress={() => setDraftAt(draftAt ? null : defaultDraftAt().toISOString())} hitSlop={6}>
              <Text style={styles.whenToggle}>{draftAt ? "We'll pick a time later" : 'Set a time now'}</Text>
            </Pressable>
          </View>
        )}
        <Choice selected={draft === 'auto'} onPress={() => setDraft('auto')} icon="flash" title="Auto draft" body="At the time you set, the app drafts for everyone from their rankings. Nobody has to be online." />
        <Choice selected={draft === 'offline'} onPress={() => setDraft('offline')} icon="document-text" title="We already drafted" body="Enter everyone's picks yourself." />
      </Screen>
    );
  }

  const rows: [string, string, number][] = [
    ['Show', season ? `${season.showName} · ${season.label}` : '', 1],
    ['Game', `Last one standing · ${picks} pick${picks === 1 ? '' : 's'} each`, 2],
    ['Name', name.trim(), 3],
    ['Draft', draft === 'offline' ? 'Already drafted' : `${draft === 'live' ? 'Live' : 'Auto'} · ${draftAt ? fmtDraftTime(draftAt) : 'time TBD'}`, 4],
  ];
  return (
    <Screen
      title="Look good?"
      subtitle="Tap a row to change it. Next you'll get a link to invite your group."
      step={{ index: 5, total: TOTAL }}
      onBack={back}
      primary={{
        label: busy ? 'Creating…' : 'Create league',
        disabled: busy || !season,
        onPress: async () => {
          if (!season) return;
          setBusy(true); setError(null);
          try {
            const r = await createLeague({
              seasonId: season.id, name: name.trim(), style: 'last-standing', draftMode: draft,
              draftAt: draft === 'offline' ? null : draftAt, picksPerPlayer: picks, sharedPicks: shared, playerName,
            });
            onCreated({ ...r, name: name.trim() });
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        },
      }}
    >
      <View style={styles.review}>
        {rows.map(([k, v, target], i) => (
          <Pressable key={k} style={[styles.reviewRow, i > 0 && styles.reviewDivider]} onPress={() => setStep(target)}>
            <Text style={styles.reviewKey}>{k}</Text>
            <Text style={styles.reviewVal} numberOfLines={1}>{v}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </Pressable>
        ))}
      </View>
      {!!error && <Note tone="warn">{error}</Note>}
    </Screen>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  select: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.panel2,
  },
  selectTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  selectSub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  menu: { borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel2, overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
  menuText: { color: colors.text, fontSize: 15.5, fontWeight: '600' },
  soon: { color: colors.textDim, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  stepperRow: { flexDirection: 'row', gap: 8 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.line },
  dayText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  whenCard: { gap: 8, padding: 14, borderRadius: 14, backgroundColor: colors.bg2, marginTop: -4 },
  whenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  whenLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  pickers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  whenHint: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  whenToggle: { color: colors.accent2, fontSize: 14, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4, marginLeft: 4 },
  chip: { borderWidth: 1.5, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  chipTextOn: { color: colors.onAccent },
  uploadWide: {
    height: 140, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line,
    backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden',
  },
  uploadWideImg: { width: '100%', height: '100%' },
  uploadText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  switchTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  switchSub: { color: colors.textDim, fontSize: 12.5, marginTop: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkText: { color: colors.text, fontSize: 14, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '22%', alignItems: 'center', gap: 4 },
  gridImg: { width: 62, height: 62, borderRadius: 31 },
  gridName: { color: colors.text, fontSize: 11.5, fontWeight: '600' },
  review: { borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  reviewDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  reviewKey: { color: colors.textDim, fontSize: 13, fontWeight: '700', width: 78 },
  reviewVal: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
});
