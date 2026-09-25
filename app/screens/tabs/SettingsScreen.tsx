import { useRef, useState } from 'react';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, RootStackParamList } from '../../navigation';
import { useTheme, useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme, ThemeMode } from '../../theme';
import { THEME_OPTIONS } from '../../theme';
import Panel from '../../components/Panel';
import { PinnedHeader, CONTENT_TOP_GAP } from '../../components/ScreenHeader';
import { useLeague } from '../../contexts/LeagueContext';
import { signOutOfLeague } from '../../lib/leagueAuth';
import { clearMessages, draftDone, renamePersonIn } from '../../lib/state';
import { CopyableCode } from '../onboarding/LeagueScreens';
import Avatar from '../../components/Avatar';
import { avatarFor, pickAndStoreAvatar, setAvatar, useAvatars } from '../../lib/avatars';

const MODES: { key: ThemeMode; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function SettingsScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  // Tapping the tab you're already on jumps back to the top, the way
  // every other iOS app behaves.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { mode, resolvedMode, theme, setMode, setTheme } = useTheme();
  const { root, league, leagueKey, playerId, teamId, playerName, isCommissioner, isAdmin, terms, onLogOut } = useLeague();
  const avatars = useAvatars();
  // Your photo is yours, not the league's — set it once and it follows you
  // into every league you play in.
  const myAvatar = avatarFor(avatars, playerId, [], leagueKey) ?? null;
  const [photoBusy, setPhotoBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(playerName);
  const [nameSaving, setNameSaving] = useState(false);
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'downloading' | 'current' | 'error'>('idle');

  async function checkForUpdate() {
    setUpdateState('checking');
    try {
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) { setUpdateState('current'); return; }
      setUpdateState('downloading');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync(); // restarts straight into the new version
    } catch {
      setUpdateState('error');
    }
  }
  const commissionerNames = (league.commissionerIds || [])
    .map((id) => league.players.find((p) => p.id === id)?.name ?? id)
    .join(' & ');

  return (
    <View style={styles.container}>
      <PinnedHeader title="Settings" />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.profileRow}>
          <Avatar name={playerName} color={colors.accent} size={56} uri={myAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{playerName}</Text>
            <Text style={styles.profileMeta}>{league.name}</Text>
          </View>
        </View>
        <SettingsAction
          label={photoBusy ? 'Opening photos…' : myAvatar ? 'Change photo' : 'Add a photo'}
          onPress={async () => {
            setPhotoBusy(true);
            try {
              await pickAndStoreAvatar(playerId);
            } catch {
              Alert.alert("Couldn't save your photo", 'Check your connection and try again.');
            } finally {
              setPhotoBusy(false);
            }
          }}
        />
        {!!myAvatar && (
          <SettingsAction
            label="Remove photo"
            destructive
            onPress={() => setAvatar(playerId, null).catch(() =>
              Alert.alert("Couldn't remove your photo", 'Check your connection and try again.'))}
          />
        )}
        <SettingsAction
          label="Change name"
          onPress={() => { setNameDraft(playerName); setEditingName(true); }}
        />
        <Row label="Playing as" value={playerName} />
        <Row label="League" value={league.name} />
        <Row label="Role" value={isCommissioner ? 'Commissioner' : 'Player'} />
      </Panel>

      <Panel style={styles.section}>
        <SettingsAction first label="Notifications" onPress={() => navigation.navigate('NotificationSettings')} />
      </Panel>

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>

        <Text style={styles.fieldLabel}>Mode</Text>
        <View style={styles.modeRow}>
          {MODES.map((m) => {
            const on = mode === m.key;
            return (
              <Pressable
                key={m.key}
                style={[styles.modeChip, on && styles.modeChipActive]}
                onPress={() => setMode(m.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.modeChipText, on && styles.modeChipTextActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {mode === 'auto' && (
          <Text style={styles.fieldHint}>
            Following your phone — currently {resolvedMode}.
          </Text>
        )}

        <Text style={styles.fieldLabel}>Theme</Text>
        <View style={styles.themeGrid}>
          {THEME_OPTIONS.map((opt) => {
            const p = resolvedMode === 'dark' ? opt.dark : opt.light;
            const on = theme === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={styles.themeCell}
                onPress={() => setTheme(opt.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.preview, { backgroundColor: p.bg, borderColor: on ? colors.accent : colors.line, borderWidth: on ? 2 : 1 }]}>
                  <View style={[styles.previewHeader, { backgroundColor: p.accent }]} />
                  <View style={[styles.previewPanel, { backgroundColor: p.panel, borderColor: p.line }]}>
                    <View style={[styles.previewLine, { backgroundColor: p.text, width: '72%' }]} />
                    <View style={[styles.previewLine, { backgroundColor: p.textDim, width: '46%' }]} />
                  </View>
                </View>
                <View style={styles.themeLabelRow}>
                  <Text style={[styles.themeLabel, on && styles.themeLabelActive]} numberOfLines={1}>{opt.label}</Text>
                  {on && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Panel>

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>League</Text>
        <Row label="Players" value={String(league.players.length)} />
        <Row label="Picks per player" value={String(league.picksPerPlayer)} />
        <Row label="Commissioner" value={commissionerNames || '—'} />
        {!!league.inviteCode && (
          <View style={{ marginTop: 8 }}>
            <CopyableCode code={league.inviteCode} link={`https://playrealitycheck.web.app/join/${league.inviteCode}`} />
          </View>
        )}
        {/* Once the draft is settled only commissioners get to it, from their tools below. */}
        {!draftDone(league) && <SettingsAction label="View the draft" onPress={() => navigation.navigate('Draft')} />}
      </Panel>

      {isCommissioner && (
        <Panel style={[styles.section, styles.commissionerPanel]}>
          <Text style={styles.sectionTitle}>Commissioner Tools</Text>
          <SettingsAction
            label={draftDone(league) ? 'Manage the draft' : 'Set draft order & start draft'}
            onPress={() => navigation.navigate('Draft')}
          />
          <SettingsAction
            label="Add cast photos"
            onPress={() => navigation.navigate('CastPhotos', { setup: false })}
          />
          <SettingsAction
            label={`Delete all ${league.name} chat messages`}
            destructive
            onPress={() =>
              Alert.alert(
                `Delete every message in ${league.name}?`,
                "This clears the whole league's chat for everyone. It can't be undone.",
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete all', style: 'destructive', onPress: () => clearMessages(leagueKey) },
                ],
              )
            }
          />
        </Panel>
      )}

      {isAdmin && (
        <Panel style={[styles.section, styles.commissionerPanel]}>
          <Text style={styles.sectionTitle}>Show admin</Text>
          <Text style={styles.commissionerHint}>Results you enter here update every league on this season.</Text>
          <SettingsAction label="Manage episodes & eliminations" onPress={() => navigation.navigate('EpisodeManager')} />
          {terms.hasTribes && <SettingsAction label="Tribe names & colors" onPress={() => navigation.navigate('Tribes')} />}
        </Panel>
      )}

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <Row label="Version" value={Constants.expoConfig?.version ?? '—'} />
        <SettingsAction
          label={
            updateState === 'checking' ? 'Checking…'
            : updateState === 'downloading' ? 'Downloading…'
            : updateState === 'current' ? 'You’re up to date'
            : updateState === 'error' ? 'Couldn’t check — tap to retry'
            : 'Check for updates'
          }
          onPress={checkForUpdate}
        />
        <Text style={styles.fieldHint}>
          Updates normally arrive on their own the second time you reopen the app. This fetches one
          right now and restarts.
        </Text>
        <Text style={styles.fieldHint}>
          Reality Check is a fan-made fantasy league app. It is not affiliated with, endorsed by, or
          connected to CBS, Paramount, or SEG, or the show Survivor.
        </Text>
      </Panel>

      <Pressable
        style={styles.signOutButton}
        onPress={() =>
          Alert.alert('Log out?', 'You can sign back in any time with Google or your email.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Log out',
              style: 'destructive',
              onPress: () => { onLogOut?.(); },
            },
          ])
        }
      >
        <Text style={styles.signOutButtonText}>Log out</Text>
      </Pressable>


      </ScrollView>

      <Modal visible={editingName} transparent animationType="fade" onRequestClose={() => setEditingName(false)}>
        <View style={styles.nameBackdrop}>
          <View style={styles.nameSheet}>
            <Text style={styles.nameTitle}>Change your name</Text>
            <Text style={styles.nameSub}>This is how everyone in {league.name} sees you.</Text>
            <TextInput
              style={styles.nameInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
              placeholderTextColor={colors.textDim}
              autoFocus
              maxLength={60}
            />
            <View style={styles.nameButtons}>
              <Pressable style={styles.nameCancel} onPress={() => setEditingName(false)}>
                <Text style={styles.nameCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.nameSave, (!nameDraft.trim() || nameSaving) && { opacity: 0.5 }]}
                disabled={!nameDraft.trim() || nameSaving}
                onPress={async () => {
                  setNameSaving(true);
                  try {
                    await renamePersonIn(leagueKey, league, playerId, nameDraft);
                    setEditingName(false);
                  } catch {
                    Alert.alert("Couldn't save your name", 'Check your connection and try again.');
                  } finally {
                    setNameSaving(false);
                  }
                }}
              >
                <Text style={styles.nameSaveText}>{nameSaving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function SettingsAction({
  label,
  onPress,
  destructive,
  first,
}: { label: string; onPress: () => void; destructive?: boolean; first?: boolean }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <Pressable style={[styles.actionRow, first && styles.actionRowFirst]} onPress={onPress}>
      <Text style={[styles.actionLabel, destructive && styles.actionLabelDestructive]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={destructive ? colors.red : colors.textDim} />
    </Pressable>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingTop: CONTENT_TOP_GAP, paddingBottom: 40, gap: 16 },
  section: { gap: 10 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  profileName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  nameBackdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: 20 },
  nameSheet: { backgroundColor: colors.panel2, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  nameTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  nameSub: { color: colors.textDim, fontSize: 12.5, marginTop: -4 },
  nameInput: {
    color: colors.text, fontSize: 16, backgroundColor: colors.bg2, borderRadius: 10,
    borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10,
  },
  nameButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  nameCancel: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  nameCancelText: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  nameSave: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.accent },
  nameSaveText: { color: colors.onAccent, fontSize: 14, fontWeight: '800' },
  profileMeta: { color: colors.textDim, fontSize: 13, marginTop: 1 },
  sectionTitle: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  rowLabel: { color: colors.textDim, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  commissionerPanel: { backgroundColor: colors.panel2, borderColor: colors.accent },
  commissionerHint: { color: colors.textDim, fontSize: 11, marginTop: -4 },
  fieldLabel: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
  fieldHint: { color: colors.textDim, fontSize: 12, marginTop: -4 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeChipText: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  modeChipTextActive: { color: colors.onAccent },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeCell: { width: '48%', gap: 6 },
  preview: { height: 72, borderRadius: 10, padding: 7, gap: 6, overflow: 'hidden' },
  previewHeader: { height: 8, borderRadius: 4, width: '55%' },
  previewPanel: { flex: 1, borderRadius: 6, borderWidth: 1, padding: 7, gap: 5, justifyContent: 'center' },
  previewLine: { height: 5, borderRadius: 3 },
  themeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  themeLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  themeLabelActive: { color: colors.text, fontWeight: '700' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  actionLabel: { color: colors.text, fontSize: 14 },
  actionLabelDestructive: { color: colors.red, fontWeight: '600' },
  // Only divides a row from something above it — not when it's first in its panel.
  actionRowFirst: { borderTopWidth: 0, paddingTop: 0 },
  signOutButton: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  signOutButtonText: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: colors.panel2, borderRadius: 16, padding: 20, gap: 8, borderWidth: 1, borderColor: colors.accent },
  modalTitle: { color: colors.accent, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  modalLabel: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', marginTop: 6 },
  modalInput: { backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.text },
  modalError: { color: colors.red, fontSize: 12, marginTop: 4 },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { color: colors.textDim, fontWeight: '600' },
  modalSave: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalSaveDisabled: { opacity: 0.4 },
  modalSaveText: { color: colors.onAccent, fontWeight: '700' },
});
