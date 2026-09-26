import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import { setDraftTime } from '../lib/state';
import { fmtDraftTime } from '../screens/onboarding/CreateLeagueWizard';

// Commissioner tool: the draft time is only ever set once, in the Create
// League wizard — there was no way to change it afterward. Same date/time
// picker, aimed at an existing league instead of a new one.
export default function DraftTimeEditor({
  visible,
  leagueKey,
  initial,
  onClose,
}: {
  visible: boolean;
  leagueKey: string;
  initial: string | null;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const [draftAt, setLocalDraftAt] = useState<string | null>(initial ?? new Date().toISOString());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await setDraftTime(leagueKey, draftAt);
      onClose();
    } catch {
      Alert.alert("Couldn't save the draft time", 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Draft time</Text>
          <Text style={styles.sub}>Everyone sees it in their own time zone.</Text>

          {draftAt && (
            <View style={styles.pickers}>
              <DateTimePicker
                value={new Date(draftAt)}
                mode="date"
                display="compact"
                onChange={(_, v) => { if (v) { const cur = new Date(draftAt); v.setHours(cur.getHours(), cur.getMinutes(), 0, 0); setLocalDraftAt(v.toISOString()); } }}
              />
              <DateTimePicker value={new Date(draftAt)} mode="time" display="compact" minuteInterval={15} onChange={(_, v) => { if (v) setLocalDraftAt(v.toISOString()); }} />
            </View>
          )}
          {draftAt ? (
            <Text style={styles.hint}>{fmtDraftTime(draftAt)}.</Text>
          ) : (
            <Text style={styles.hint}>No time set. Start the draft yourself from Settings whenever your group is ready.</Text>
          )}
          <Pressable onPress={() => setLocalDraftAt(draftAt ? null : new Date().toISOString())} hitSlop={6}>
            <Text style={styles.toggle}>{draftAt ? "Clear it — we'll pick a time later" : 'Set a time'}</Text>
          </Pressable>

          <View style={styles.buttons}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.save} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.onAccent} size="small" /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </View>
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
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: -8 },
  pickers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hint: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  toggle: { color: colors.accent2, fontSize: 14, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancel: {
    flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.line,
  },
  cancelText: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  save: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.accent },
  saveText: { color: colors.onAccent, fontSize: 14, fontWeight: '800' },
});
