import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import { LIMITS, clamp } from '../lib/limits';
import { addLeaguePlayer, peopleOf, renamePersonIn, type LeagueRecord } from '../lib/state';

// Commissioner tool: add someone who isn't drafting from their own account
// (no phone, no interest in the app — whoever's running their draft picks
// for them), and fix a typo'd or outdated name on anyone already in the
// league. Renaming here is the same write as "Change your name" in
// Settings, just aimed at someone else's roster slot.
export default function PlayersEditor({
  visible,
  leagueKey,
  league,
  onClose,
}: {
  visible: boolean;
  leagueKey: string;
  league: LeagueRecord;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const people = peopleOf(league);

  const submitAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusyId('__new__');
    try {
      await addLeaguePlayer(leagueKey, name);
      setNewName('');
      setAdding(false);
    } catch {
      Alert.alert("Couldn't add them", 'Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  };

  const submitRename = async (id: string) => {
    const name = renameDraft.trim();
    if (!name) { setRenamingId(null); return; }
    setBusyId(id);
    try {
      await renamePersonIn(leagueKey, league, id, name);
      setRenamingId(null);
    } catch {
      Alert.alert("Couldn't save that name", 'Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Players</Text>
              <Text style={styles.sub}>Rename anyone, or add someone who isn't on the app.</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textDim} />
            </Pressable>
          </View>

          <FlatList
            data={people}
            keyExtractor={(p) => p.id}
            style={styles.list}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) =>
              renamingId === item.id ? (
                <View style={styles.row}>
                  <TextInput
                    style={styles.renameInput}
                    value={renameDraft}
                    onChangeText={(t) => setRenameDraft(clamp(t, LIMITS.personName))}
                    autoFocus
                    placeholder="Name"
                    placeholderTextColor={colors.textDim}
                  />
                  <Pressable onPress={() => submitRename(item.id)} disabled={busyId === item.id} hitSlop={8}>
                    {busyId === item.id ? <ActivityIndicator color={colors.accent} size="small" /> : <Ionicons name="checkmark" size={20} color={colors.accent} />}
                  </Pressable>
                  <Pressable onPress={() => setRenamingId(null)} hitSlop={8}>
                    <Ionicons name="close" size={20} color={colors.textDim} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.row}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Pressable onPress={() => { setRenamingId(item.id); setRenameDraft(item.name); }} hitSlop={8}>
                    <Ionicons name="create-outline" size={18} color={colors.accent2} />
                  </Pressable>
                </View>
              )
            }
          />

          {adding ? (
            <View style={styles.addRow}>
              <TextInput
                style={styles.renameInput}
                value={newName}
                onChangeText={(t) => setNewName(clamp(t, LIMITS.personName))}
                placeholder="Their name"
                placeholderTextColor={colors.textDim}
                autoFocus
              />
              <Pressable onPress={submitAdd} disabled={busyId === '__new__' || !newName.trim()} hitSlop={8}>
                {busyId === '__new__' ? <ActivityIndicator color={colors.accent} size="small" /> : <Ionicons name="checkmark" size={20} color={colors.accent} />}
              </Pressable>
              <Pressable onPress={() => { setAdding(false); setNewName(''); }} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textDim} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
              <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
              <Text style={styles.addButtonText}>Add a player</Text>
            </Pressable>
          )}
          <Text style={styles.hint}>
            Someone added here shows up in the draft order and standings right away. If they later
            want to play from their own phone, they'll need their own roster spot — ask them to join
            with the invite code as a new player instead.
          </Text>

          <Pressable style={styles.done} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: 20 },
  sheet: {
    backgroundColor: colors.panel2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 12,
    maxHeight: '85%',
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg2,
    borderRadius: 10, borderWidth: 1, borderColor: colors.line, paddingVertical: 8, paddingHorizontal: 12,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  renameInput: {
    flex: 1, color: colors.text, fontSize: 15, paddingVertical: 4,
  },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg2,
    borderRadius: 10, borderWidth: 1, borderColor: colors.accent, paddingVertical: 8, paddingHorizontal: 12,
  },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  addButtonText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
  done: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.accent, marginTop: 4 },
  doneText: { color: colors.onAccent, fontSize: 14, fontWeight: '800' },
});
