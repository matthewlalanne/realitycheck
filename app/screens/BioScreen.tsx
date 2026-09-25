import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import BackButton from '../components/BackButton';
import NoteEditor from '../components/NoteEditor';
import { useLeague } from '../contexts/LeagueContext';
import { useLiveContestants } from '../lib/episodes';
import CastAvatar from '../components/CastAvatar';
import { pickAndStoreCastPhoto } from '../lib/avatars';
import { bios } from '../data/bios';
import { noteOf, rankOf, useMyBoard } from '../lib/board';
import { seasonStatsFor, statFor, statTiles } from '../lib/seasonStats';
import { OutWash } from '../components/CastawayStatus';
import { ownersOf } from '../lib/state';
import { holdingList } from '../lib/advantages';
import { tribeOf } from '../lib/tribes';
import { airedEpisodeCount } from '../lib/countdown';

type Props = NativeStackScreenProps<RootStackParamList, 'Bio'>;

export default function BioScreen({ route, navigation }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { contestants } = useLiveContestants();
  const contestant = contestants.find((c) => c.id === route.params.id);
  const bio = bios[route.params.id];
  // Reading the bio is exactly when you change your mind about someone, so the
  // note box and the move buttons are right here rather than a screen away.
  const { root, league, leagueKey, playerId, teamId, terms } = useLeague();
  const outEp = root.contestants?.find((c) => c?.id === route.params.id)?.eliminatedWeek ?? null;
  // Who drafted them in the league you're viewing (a couple shares one entry).
  const owners = ownersOf(league, route.params.id);
  const nameOf = (id: string) => league.players.find((p) => p.id === id)?.name ?? id;
  const ownerNames = owners.map(nameOf).join(' & ');
  const others = owners.filter((id) => id !== teamId).map(nameOf);
  const pickLabel = !owners.length
    ? 'UNDRAFTED'
    : owners.includes(teamId)
      ? (others.length ? `YOUR PICK · ALSO ${others.join(' & ')}` : 'YOUR PICK')
      : `${ownerNames}'S PICK`;
  const { board, move, setNote } = useMyBoard(leagueKey, playerId);
  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  if (!contestant) return null;

  const hasPhoto = !!league.castPhotos?.[contestant.id];
  const changePhoto = async () => {
    setUploadingPhoto(true);
    try { await pickAndStoreCastPhoto(leagueKey, contestant.id); } finally { setUploadingPhoto(false); }
  };

  const rank = rankOf(board, contestant.id);
  // Season so far: totals, then episode by episode (newest first).
  const tiles = statTiles(seasonStatsFor(root, contestant.id));
  const held = holdingList(root.contestants?.find((c) => c?.id === contestant.id)?.items);
  const tribe = tribeOf(root, contestant.id);
  const epLines = Array.from({ length: Math.max(0, airedEpisodeCount(leagueKey)) }, (_, i) => i + 1)
    .reverse()
    .map((ep) => {
      const st = statFor(root, ep, contestant.id);
      const bits = [
        st.immunity && 'Won immunity', st.reward && 'Won reward', st.journey && 'Went on a journey',
        st.idolFound && 'Found an idol', st.idolPlay === 'saved' && 'Played an idol, and it saved them',
        st.idolPlay === 'wasted' && "Played an idol they didn't need", st.votes ? `${st.votes} vote${st.votes > 1 ? 's' : ''} against` : null,
      ].filter(Boolean) as string[];
      return { ep, bits };
    })
    .filter((l) => l.bits.length);
  const note = noteOf(board, contestant.id);

  return (
    // Back sits outside the ScrollView so it stays put: buried at the top of a
    // long page, it was unreachable without scrolling all the way up again.
    <View style={styles.container}>
      <View style={styles.backBar}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Voted out: said loudly, first thing — the static cast list never
            carries eliminations, so this reads the live record. */}
        {outEp ? (
          <View style={styles.outBanner}>
            <Text style={styles.outBannerTitle}>{terms.out.toUpperCase()} · EPISODE {outEp}</Text>
            {!!ownerNames && <Text style={styles.outBannerSub}>{ownerNames}'s pick</Text>}
          </View>
        ) : null}
        {hasPhoto ? (
          <View style={[styles.heroFrame, !!outEp && styles.heroFrameOut]}>
            <CastAvatar id={contestant.id} style={styles.heroImage} />
            {!!outEp && <OutWash />}
            {/* Every league uploads its own cast photos — there are no network
                photos here (CBS's, not ours) — so this is the only way a
                photo ever shows up instead of initials. */}
            <Pressable style={styles.photoEditBtn} onPress={changePhoto} disabled={uploadingPhoto} hitSlop={6}>
              {uploadingPhoto ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="camera" size={14} color="#fff" />
                  <Text style={styles.photoEditText}>Change photo</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          // No uploaded photo: skip the big framed placeholder — a
          // full-width box of nothing but initials looked like a broken
          // image, not a picture. Just a small button to add one instead.
          <Pressable style={styles.addPhotoRow} onPress={changePhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? <ActivityIndicator color={colors.accent} size="small" /> : (
              <>
                <Ionicons name="camera-outline" size={16} color={colors.accent} />
                <Text style={styles.addPhotoText}>Add a photo</Text>
              </>
            )}
          </Pressable>
        )}
        {/* Eyebrow: whose castaway this is. Voted-out bios say it in the banner instead. */}
        <View style={styles.nameBlock}>
          {!outEp && <Text style={[styles.eyebrow, owners.includes(teamId) && styles.eyebrowMine]}>{pickLabel.toUpperCase()}</Text>}
          <Text style={[styles.name, { marginTop: 0 }]}>{contestant.name}</Text>
        </View>

        {(terms.hasStats || terms.hasIdols || epLines.length > 0) && (
          <Panel style={styles.seasonPanel}>
            <Text style={styles.seasonTitle}>SEASON SO FAR{tribe ? ` · ${tribe.name.toUpperCase()}` : ''}</Text>
            {terms.hasStats && (
              <View style={styles.tiles}>
                {tiles.map((t) => (
                  <View key={t.label} style={styles.tile}>
                    <Text style={styles.tileValue}>{t.value}</Text>
                    <Text style={styles.tileLabel}>{t.label}</Text>
                  </View>
                ))}
              </View>
            )}
            {terms.hasIdols && (
              <View style={styles.heldWrap}>
                <Text style={styles.seasonSub}>Holding</Text>
                {held.length === 0 && <Text style={styles.heldNone}>Nothing right now</Text>}
                <View style={styles.heldChips}>
                  {held.map((h) => (
                    <View key={h.id} style={styles.heldChip}>
                      <Ionicons name={/idol/i.test(h.kind) ? 'shield' : 'star'} size={11} color={colors.accent} />
                      <Text style={styles.heldText}>{h.kind}</Text>
                      <Text style={styles.heldMeta}>since ep {h.ep}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {epLines.map((l) => (
              <View key={l.ep} style={styles.seasonEp}>
                <Text style={styles.seasonEpNum}>EP {l.ep}</Text>
                <Text style={styles.seasonEpText}>{l.bits.join('\n')}</Text>
              </View>
            ))}
          </Panel>
        )}

        <Panel style={styles.boardPanel}>
          <View style={styles.boardRow}>
            <Text style={styles.boardRank}>
              {rank ? `My rank · #${rank}` : 'Not ranked yet'}
            </Text>
            <View style={styles.boardButtons}>
              <Pressable
                style={styles.boardBtn}
                hitSlop={6}
                onPress={() => move(contestants, contestant.id, 'top')}
                accessibilityLabel="Move to the top of my board"
              >
                <Ionicons name="arrow-up-circle-outline" size={22} color={colors.accent2} />
              </Pressable>
              <Pressable
                style={styles.boardBtn}
                hitSlop={6}
                onPress={() => move(contestants, contestant.id, 'up')}
                accessibilityLabel="Move up my board"
              >
                <Ionicons name="chevron-up" size={20} color={colors.text} />
              </Pressable>
              <Pressable
                style={styles.boardBtn}
                hitSlop={6}
                onPress={() => move(contestants, contestant.id, 'down')}
                accessibilityLabel="Move down my board"
              >
                <Ionicons name="chevron-down" size={20} color={colors.text} />
              </Pressable>
              <Pressable
                style={styles.boardBtn}
                hitSlop={6}
                onPress={() => move(contestants, contestant.id, 'bottom')}
                accessibilityLabel="Move to the bottom of my board"
              >
                <Ionicons name="arrow-down-circle-outline" size={22} color={colors.accent2} />
              </Pressable>
            </View>
          </View>
          <Pressable onPress={() => setEditing(true)} style={styles.noteBox}>
            <Text style={note ? styles.noteText : styles.notePlaceholder}>
              {note || 'Add a private note — it shows up on the draft board.'}
            </Text>
          </Pressable>
        </Panel>

        <Panel style={styles.metaPanel}>
          {contestant.detail && <MetaRow label="Team" value={contestant.detail} />}
          {!!contestant.age && <MetaRow label="Age" value={String(contestant.age)} />}
          <MetaRow label="Hometown" value={bio?.hometown ?? contestant.from ?? ''} />
          {bio && <MetaRow label="Current residence" value={bio.residence} />}
          {bio && <MetaRow label="Occupation" value={bio.occupation} />}
        </Panel>

        {/* Their own official video/page, not our writeup — CBS's YouTube
            player embedded as-is, and a link out to their bio rather than
            copying its text. */}
        {!!bio?.youtubeId && (
          <View style={styles.videoFrame}>
            <WebView
              source={{ uri: `https://www.youtube.com/embed/${bio.youtubeId}` }}
              allowsFullscreenVideo
              style={styles.video}
            />
          </View>
        )}
        {!!bio?.officialBioUrl && (
          <Pressable style={styles.officialLink} onPress={() => Linking.openURL(bio.officialBioUrl!)}>
            <Ionicons name="open-outline" size={16} color={colors.accent} />
            <Text style={styles.officialLinkText}>Read their official bio</Text>
          </Pressable>
        )}

      </ScrollView>

      <NoteEditor
        visible={editing}
        contestantId={contestant.id}
        name={contestant.name}
        initial={note}
        onSave={(text) => setNote(contestant.id, text).catch(() => {})}
        onClose={() => setEditing(false)}
      />
    </View>
  );
}


function MetaRow({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backBar: { paddingHorizontal: 20 },
  content: { padding: 20, paddingTop: 0, paddingBottom: 40, gap: 12 },
  back: { marginBottom: 4 },
  backText: { color: colors.accent2, fontSize: 14 },
  // borderRadius + resizeMode="contain" on the same <Image> is a known iOS
  // quirk that renders the image off-center (a gap on one side only, not
  // both) — rounding lives on this wrapping View instead, and the Image just
  // fills it plainly, which avoids the interaction entirely.
  heroFrame: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: 14,
    backgroundColor: colors.panel,
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
  photoEditBtn: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12,
    minWidth: 32, minHeight: 28, justifyContent: 'center',
  },
  photoEditText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  addPhotoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  addPhotoText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  nameBlock: { gap: 3, marginTop: 4 },
  eyebrow: { color: colors.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  eyebrowMine: { color: colors.accent },
  heroFrameOut: { borderWidth: 2, borderColor: colors.red },
  outBanner: { backgroundColor: colors.red, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
  // Text in the page background colour: white-ish on the light theme's deep red, dark on the dark theme's salmon red — readable either way.
  outBannerTitle: { color: colors.bg, fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  outBannerSub: { color: colors.bg, fontSize: 13, opacity: 0.9 },
  name: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 4 },
  outTag: { color: colors.red, fontSize: 13, fontWeight: '700' },
  boardPanel: { gap: 10, backgroundColor: colors.panel2 },
  boardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  boardRank: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  boardButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  boardBtn: { paddingVertical: 4, paddingHorizontal: 6 },
  noteBox: {
    backgroundColor: colors.bg2, borderRadius: 10, borderWidth: 1, borderColor: colors.line,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  noteText: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
  notePlaceholder: { color: colors.textDim, fontSize: 13 },
  metaPanel: { gap: 8 },
  videoFrame: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  video: { flex: 1, backgroundColor: '#000' },
  officialLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  officialLinkText: { color: colors.accent, fontSize: 13.5, fontWeight: '700' },
  seasonPanel: { gap: 8 },
  seasonTitle: { color: colors.accent2, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Three across, two rows: the same six on every bio.
  tile: { width: '31%', backgroundColor: colors.bg2, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  tileValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  tileLabel: { color: colors.textDim, fontSize: 11.5, fontWeight: '600' },
  heldWrap: { gap: 6 },
  heldNone: { color: colors.textDim, fontSize: 13 },
  seasonSub: { color: colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  heldChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heldChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  heldText: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  heldMeta: { color: colors.textDim, fontSize: 11.5 },
  seasonEp: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  seasonEpNum: { color: colors.textDim, fontSize: 12, fontWeight: '800', width: 38 },
  seasonEpText: { color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaLabel: { color: colors.textDim, fontSize: 12, textTransform: 'uppercase' },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  qaPanel: { gap: 6 },
  question: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  answer: { color: colors.text, fontSize: 14, lineHeight: 20 },
  shortLabel: {
    color: colors.accent2, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.3, textAlign: 'center', marginTop: 6,
  },
  shortFrame: {
    alignSelf: 'center',
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.line,
    backgroundColor: '#000',
  },
  shortWeb: { flex: 1, backgroundColor: '#000' },
  credit: { color: colors.textDim, fontSize: 11, textAlign: 'center', marginTop: 4 },
});
