import { useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import { SHOWS, findSeason, fmtLocalSlot, localAirUtc, minutesAfterAir, REVEAL_MIN_HOURS } from '../../lib/shows';
import { contestants } from '../../data/realData';
import { previewRoot } from '../../lib/preview';
import { textOnTribe } from '../../lib/tribes';
import { newInviteCode, type CreatedLeague } from '../../lib/session';
import { Screen, Choice, Note, Label, makeStyles as uiStyles } from './ui';

// Create a league in seven short steps. Show comes first: everything after it
// (what the cast is called, what data we fill in) depends on it. Only the
// things a group actually decides are asked; the cast, tribes, schedule and
// results come from us.

const TOTAL = 7;

// Names that would be ambiguous for anyone in more than one league.
const GENERIC = [
  'survivor', 'survivor league', 'fantasy survivor', 'survivor fantasy', 'survivor fantasy league',
  'league', 'my league', 'the league', 'fantasy league', 'fantasy', 'friends', 'family', 'family league',
  'survivor 51', 'season 51', 'test',
];
const isGeneric = (n: string) => {
  const s = n.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
  return !!s && (GENERIC.includes(s) || /^(survivor|fantasy|league|\s)+$/.test(s));
};

// Default reveal: the next evening after air, 8 PM local. (Survivor airs Wed
// 8 PM ET, so Thursday 8 PM wherever you are, comfortably past 12 hours.)
function defaultReveal() {
  const f = findSeason('survivor-51');
  const air = f ? new Date(localAirUtc(f.season)) : new Date();
  return { weekday: (air.getDay() + 1) % 7, hour: 20, minute: 0 };
}

// Default draft time: tomorrow at 8 PM local.
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

type Draft = Omit<CreatedLeague, 'id' | 'code' | 'createdAt'>;

export default function CreateLeagueWizard({ onCancel, onCreated }: { onCancel: () => void; onCreated: (l: CreatedLeague) => void }) {
  const colors = useThemeColors();
  const ui = uiStyles(colors);
  const styles = makeStyles(colors);
  const [step, setStep] = useState(1);
  const [showOpen, setShowOpen] = useState(false);
  const [rightsOk, setRightsOk] = useState(false);
  const [d, setD] = useState<Draft>({
    showId: 'survivor-51', name: '', style: 'last-standing', reveal: defaultReveal(), draft: 'live',
    draftAt: defaultDraftAt().toISOString(), draftTz: Intl.DateTimeFormat().resolvedOptions().timeZone, puzzleImage: null, memoryUsesCast: true, castPhotos: {},
  });
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const found = findSeason(d.showId);
  const [showId, setShowId] = useState(found?.show.id ?? 'survivor');
  const [seasonOpen, setSeasonOpen] = useState(false);
  const show = found?.show ?? SHOWS[0];
  const season = found?.season;
  const back = () => (step === 1 ? onCancel() : setStep(step - 1));
  const next = () => setStep(step + 1);

  const pickImage = async (aspect?: [number, number]) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.7 });
    return !res.canceled && res.assets[0] ? res.assets[0].uri : null;
  };
  const tribeColor = (id: string) => {
    const tid = previewRoot?.contestants?.find((c) => c?.id === id)?.tribe;
    return (tid && previewRoot?.tribes?.[tid]?.color) || '#6B7B8C';
  };

  if (step === 1) {
    const avail = SHOWS.find((x) => x.id === showId)!;
    return (
      <Screen
        title="What show is your league for?"
        subtitle="We keep the cast, schedule and every episode's results up to date, so you never have to type them in."
        step={{ index: 1, total: TOTAL }}
        onBack={back}
        primary={{ label: 'Next', onPress: next, disabled: !season }}
      >
        <Label>Show</Label>
        <Pressable style={styles.select} onPress={() => { setShowOpen(!showOpen); setSeasonOpen(false); }} accessibilityRole="combobox">
          <Text style={[styles.selectTitle, { flex: 1 }]}>{avail.name}</Text>
          <Ionicons name={showOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textDim} />
        </Pressable>
        {showOpen && (
          <View style={styles.menu}>
            {SHOWS.map((s) => (
              <Pressable
                key={s.id}
                disabled={!s.available}
                onPress={() => { setShowId(s.id); if (s.seasons[0]) set({ showId: s.seasons[0].id }); setShowOpen(false); }}
                style={[styles.menuRow, !s.available && { opacity: 0.45 }]}
              >
                <Text style={styles.menuText}>{s.name}</Text>
                {s.available
                  ? (s.id === showId && <Ionicons name="checkmark" size={18} color={colors.accent} />)
                  : <Text style={styles.soon}>COMING SOON</Text>}
              </Pressable>
            ))}
          </View>
        )}

        <Label>Season</Label>
        <Pressable style={styles.select} onPress={() => { setSeasonOpen(!seasonOpen); setShowOpen(false); }} accessibilityRole="combobox">
          <View style={{ flex: 1 }}>
            <Text style={styles.selectTitle}>{season?.label ?? 'Choose a season'}</Text>
            {!!season?.detail && <Text style={styles.selectSub}>{season.detail}</Text>}
          </View>
          <Ionicons name={seasonOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textDim} />
        </Pressable>
        {seasonOpen && (
          <View style={styles.menu}>
            {avail.seasons.map((se) => (
              <Pressable key={se.id} onPress={() => { set({ showId: se.id }); setSeasonOpen(false); }} style={styles.menuRow}>
                <Text style={styles.menuText}>{se.label}</Text>
                {se.id === d.showId && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </Pressable>
            ))}
          </View>
        )}
      </Screen>
    );
  }

  if (step === 2) {
    return (
      <Screen title="How do you want to play?" subtitle="You can change this any time before the draft." step={{ index: 2, total: TOTAL }} onBack={back} primary={{ label: 'Next', onPress: next }}>
        <Choice
          selected={d.style === 'last-standing'}
          onPress={() => set({ style: 'last-standing' })}
          icon="trophy"
          title="Last one standing"
          badge="Simplest"
          body={`Everyone drafts ${show.castNoun}. Whoever holds the winner wins the league. Weekly picks and a season pick keep it interesting along the way.`}
        />
        <Choice
          selected={d.style === 'points'}
          onPress={() => set({ style: 'points' })}
          icon="stats-chart"
          title="Points"
          body={`Your ${show.castNoun} earn points every episode: immunity wins, idols, surviving the vote. Highest total at the finale wins.`}
        />
      </Screen>
    );
  }

  if (step === 3) {
    const generic = isGeneric(d.name);
    return (
      <Screen
        title="Name your league"
        subtitle="Make it yours. Some people play in more than one league, so a generic name gets confusing fast."
        step={{ index: 3, total: TOTAL }}
        onBack={back}
        primary={{ label: 'Next', onPress: next, disabled: !d.name.trim() || generic }}
      >
        <TextInput
          style={ui.input}
          value={d.name}
          onChangeText={(t) => set({ name: t })}
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
    const r = d.reveal;
    const after = season ? minutesAfterAir(season, r.weekday, r.hour, r.minute) : 0;
    const tooSoon = after < REVEAL_MIN_HOURS * 60;
    const airLocal = season ? new Date(localAirUtc(season)) : null;
    const airLine = airLocal ? fmtLocalSlot(airLocal.getDay(), airLocal.getHours(), airLocal.getMinutes()) : '';
    const earliest = airLocal ? new Date(airLocal.getTime() + REVEAL_MIN_HOURS * 3600e3) : null;
    const pickerValue = new Date(2026, 0, 1, r.hour, r.minute);
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <Screen
        title="When should results show up?"
        subtitle={`New episodes air ${airLine}. Pick when your league sees each episode's results, so nobody gets spoiled.`}
        step={{ index: 4, total: TOTAL }}
        onBack={back}
        primary={{ label: 'Next', onPress: next, disabled: tooSoon }}
      >
        <Label>Day</Label>
        <View style={styles.days}>
          {DAYS.map((label, wd) => {
            const on = r.weekday === wd;
            return (
              <Pressable key={label} onPress={() => set({ reveal: { ...r, weekday: wd } })} style={[styles.day, on && styles.chipOn]}>
                <Text style={[styles.dayText, on && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.whenRow}>
          <Label>Time</Label>
          <DateTimePicker
            value={pickerValue}
            mode="time"
            display="compact"
            minuteInterval={15}
            onChange={(_, v) => { if (v) set({ reveal: { ...r, hour: v.getHours(), minute: v.getMinutes() } }); }}
          />
        </View>
        {tooSoon ? (
          <Note tone="warn">
            Results have to wait at least {REVEAL_MIN_HOURS} hours after the episode airs, so everyone has a chance to watch.
            {earliest ? ` The earliest is ${fmtLocalSlot(earliest.getDay(), earliest.getHours(), earliest.getMinutes(), false)}.` : ''}
          </Note>
        ) : (
          <Note>
            Results show every {fmtLocalSlot(r.weekday, r.hour, r.minute)}. Picks still lock an hour before the episode airs.
            Each player sees this in their own time zone.
          </Note>
        )}
      </Screen>
    );
  }

  if (step === 5) {
    return (
      <Screen title="How will you draft?" step={{ index: 5, total: TOTAL }} onBack={back} primary={{ label: 'Next', onPress: next }}>
        <Choice selected={d.draft === 'live'} onPress={() => set({ draft: 'live' })} icon="people" title="Live draft" badge="Most fun" body="Pick a time and draft together in the app, snake order. Anyone who's away gets auto-picked from their own rankings." />
        {(d.draft === 'live' || d.draft === 'auto') && (
          <View style={styles.whenCard}>
            <View style={styles.whenRow}>
              <Text style={styles.whenLabel}>{d.draft === 'live' ? 'Draft starts' : 'Auto draft runs'}</Text>
              {d.draftAt && (
                <View style={styles.pickers}>
                  <DateTimePicker
                    value={new Date(d.draftAt)}
                    mode="date"
                    display="compact"
                    minimumDate={new Date()}
                    onChange={(_, v) => { if (v) { const cur = new Date(d.draftAt!); v.setHours(cur.getHours(), cur.getMinutes(), 0, 0); set({ draftAt: v.toISOString() }); } }}
                  />
                  <DateTimePicker
                    value={new Date(d.draftAt)}
                    mode="time"
                    display="compact"
                    minuteInterval={15}
                    onChange={(_, v) => { if (v) set({ draftAt: v.toISOString() }); }}
                  />
                </View>
              )}
            </View>
            {d.draftAt ? (
              <Text style={styles.whenHint}>
                {fmtDraftTime(d.draftAt)}. Everyone sees it in their own time zone, so a player in California sees the right local time.
              </Text>
            ) : (
              <Text style={styles.whenHint}>No time yet. You can set it from the league's Settings; everyone gets a reminder when you do.</Text>
            )}
            <Pressable onPress={() => set({ draftAt: d.draftAt ? null : defaultDraftAt().toISOString() })} hitSlop={6}>
              <Text style={styles.whenToggle}>{d.draftAt ? "We'll pick a time later" : 'Set a time now'}</Text>
            </Pressable>
          </View>
        )}
        <Choice selected={d.draft === 'auto'} onPress={() => set({ draft: 'auto' })} icon="flash" title="Auto draft" body="At the time you set, the app drafts for everyone from their rankings. Nobody has to be online." />
        <Choice selected={d.draft === 'offline'} onPress={() => set({ draft: 'offline' })} icon="document-text" title="We already drafted" body="Enter everyone's picks yourself, or paste them from your group chat." />
      </Screen>
    );
  }

  if (step === 6) {
    const castCount = Object.keys(d.castPhotos).length;
    return (
      <Screen
        title="Add photos (optional)"
        subtitle="Make the league look like yours. You can do this later from Settings."
        step={{ index: 6, total: TOTAL }}
        onBack={back}
        primary={{ label: 'Next', onPress: next }}
        secondary={{ label: 'Skip for now', onPress: next }}
      >
        <Label>Puzzle game picture</Label>
        <Pressable style={styles.uploadWide} onPress={async () => { const u = await pickImage([1, 1]); if (u) set({ puzzleImage: u }); }}>
          {d.puzzleImage ? <Image source={{ uri: d.puzzleImage }} style={styles.uploadWideImg} /> : (
            <>
              <Ionicons name="image" size={26} color={colors.textDim} />
              <Text style={styles.uploadText}>Upload a picture for the sliding puzzle</Text>
            </>
          )}
        </Pressable>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Use {show.castNoun.replace(/s$/, '')} photos in Memory Match</Text>
            <Text style={styles.switchSub}>The matching game uses the headshots you add below.</Text>
          </View>
          <Switch value={d.memoryUsesCast} onValueChange={(v) => set({ memoryUsesCast: v })} />
        </View>

        <Label>{show.castNoun} headshots · {castCount} of {contestants.length}</Label>
        <Note>
          Why do we ask you? Cast photos belong to the network, so we can't include them. You can add your own; they're only
          visible inside your league. Only upload pictures you have the right to use.
        </Note>
        <Pressable style={styles.checkRow} onPress={() => setRightsOk(!rightsOk)}>
          <Ionicons name={rightsOk ? 'checkbox' : 'square-outline'} size={22} color={rightsOk ? colors.accent : colors.textDim} />
          <Text style={styles.checkText}>I have the right to use the photos I upload.</Text>
        </Pressable>
        <View style={[styles.grid, !rightsOk && { opacity: 0.45 }]} pointerEvents={rightsOk ? 'auto' : 'none'}>
          {contestants.map((c) => {
            const uri = d.castPhotos[c.id];
            const first = c.name.match(/["“]([^"”]+)["”]/)?.[1] ?? c.name.split(' ')[0];
            const color = tribeColor(c.id);
            return (
              <Pressable
                key={c.id}
                style={styles.gridItem}
                onPress={async () => { const u = await pickImage([1, 1]); if (u) set({ castPhotos: { ...d.castPhotos, [c.id]: u } }); }}
              >
                {uri ? <Image source={{ uri }} style={styles.gridImg} /> : (
                  <View style={[styles.gridImg, { backgroundColor: color, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="add" size={22} color={textOnTribe(color)} />
                  </View>
                )}
                <Text style={styles.gridName} numberOfLines={1}>{first}</Text>
              </Pressable>
            );
          })}
        </View>
      </Screen>
    );
  }

  // Step 7: review
  const rows: [string, string][] = [
    ['Show', `${show.name} · ${season?.label ?? ''}`],
    ['Game', d.style === 'points' ? 'Points' : 'Last one standing'],
    ['Name', d.name.trim()],
    ['Results', fmtLocalSlot(d.reveal.weekday, d.reveal.hour, d.reveal.minute)],
    ['Draft', d.draft === 'offline' ? 'Already drafted' : `${d.draft === 'live' ? 'Live' : 'Auto'} · ${d.draftAt ? fmtDraftTime(d.draftAt) : 'time TBD'}`],
    ['Photos', `${Object.keys(d.castPhotos).length} headshots${d.puzzleImage ? ' · puzzle picture' : ''}`],
  ];
  return (
    <Screen
      title="Look good?"
      subtitle="Tap a row to change it. Next you'll get a link to invite your group."
      step={{ index: 7, total: TOTAL }}
      onBack={back}
      primary={{
        label: 'Create league',
        onPress: () => onCreated({ ...d, name: d.name.trim(), id: `l${Date.now().toString(36)}`, code: newInviteCode(), createdAt: Date.now() }),
      }}
    >
      <View style={styles.review}>
        {rows.map(([k, v], i) => (
          <Pressable key={k} style={[styles.reviewRow, i > 0 && styles.reviewDivider]} onPress={() => setStep(i === 5 ? 6 : i + 1)}>
            <Text style={styles.reviewKey}>{k}</Text>
            <Text style={styles.reviewVal} numberOfLines={1}>{v}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </Pressable>
        ))}
      </View>
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
