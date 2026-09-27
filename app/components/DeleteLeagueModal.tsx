import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import { deleteLeague } from '../lib/account';

// Typing the league's own name — not a generic "DELETE" — ties the
// confirmation to THIS league specifically, so it can't be muscle-memoried
// past on the wrong one if someone runs this from more than one league.
export default function DeleteLeagueModal({
  visible,
  seasonId,
  leagueKey,
  leagueName,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  seasonId: string;
  leagueKey: string;
  leagueName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const matches = typed.trim() === leagueName.trim();

  const close = () => {
    if (busy) return;
    setTyped('');
    onClose();
  };

  const confirm = async () => {
    if (!matches) return;
    setBusy(true);
    try {
      await deleteLeague(seasonId, leagueKey);
      setTyped('');
      onDeleted();
    } catch (err) {
      Alert.alert("Couldn't delete the league", err instanceof Error ? err.message : 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Delete {leagueName}?</Text>
          <Text style={styles.body}>
            This permanently deletes the league — every pick, chat message, and prediction. It
            disappears from everyone's account. There's no undo.
          </Text>
          <Text style={styles.label}>Type the league's name to confirm:</Text>
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            placeholder={leagueName}
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          <View style={styles.buttons}>
            <Pressable style={styles.cancel} onPress={close} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.delete, (!matches || busy) && styles.deleteDisabled]}
              onPress={confirm}
              disabled={!matches || busy}
            >
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.deleteText}>Delete league</Text>}
            </Pressable>
          </View>
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
    borderColor: colors.red,
    padding: 18,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  body: { color: colors.textDim, fontSize: 13.5, lineHeight: 19 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  input: {
    color: colors.text, fontSize: 15, backgroundColor: colors.bg2, borderRadius: 10,
    borderWidth: 1, borderColor: colors.line, paddingVertical: 10, paddingHorizontal: 12,
  },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancel: {
    flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.line,
  },
  cancelText: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  delete: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.red },
  deleteDisabled: { opacity: 0.4 },
  deleteText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
