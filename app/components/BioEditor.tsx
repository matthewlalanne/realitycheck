import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import CastAvatar from './CastAvatar';
import { LIMITS, clamp } from '../lib/limits';
import type { CastBio } from '../lib/state';

// Commissioner-only: writes the bio everyone in this league sees on a
// contestant's page. Same sheet as NoteEditor so the two feel alike.
export default function BioEditor({
  visible,
  contestantId,
  name,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  contestantId: string;
  name: string;
  initial: CastBio;
  onSave: (bio: CastBio) => void;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const [hometown, setHometown] = useState('');
  const [occupation, setOccupation] = useState('');
  const [about, setAbout] = useState('');

  useEffect(() => {
    if (!visible) return;
    setHometown(initial.hometown ?? '');
    setOccupation(initial.occupation ?? '');
    setAbout(initial.about ?? '');
  }, [visible, contestantId]);

  const done = () => {
    onSave({ hometown, occupation, about });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.headRow}>
            <CastAvatar id={contestantId} style={styles.photo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{name}</Text>
              <Text style={styles.sub}>Bio — everyone in this league sees it</Text>
            </View>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={{ gap: 10 }}>
            <Text style={styles.label}>Hometown</Text>
            <TextInput
              style={styles.line}
              value={hometown}
              onChangeText={(t) => setHometown(clamp(t, LIMITS.bioLine))}
              placeholder="Dallas, TX"
              placeholderTextColor={colors.textDim}
            />
            <Text style={styles.label}>Occupation</Text>
            <TextInput
              style={styles.line}
              value={occupation}
              onChangeText={(t) => setOccupation(clamp(t, LIMITS.bioLine))}
              placeholder="Teacher & firefighter"
              placeholderTextColor={colors.textDim}
            />
            <Text style={styles.label}>About</Text>
            <TextInput
              style={styles.input}
              value={about}
              onChangeText={(t) => setAbout(clamp(t, LIMITS.bioAbout))}
              placeholder="Who they are, why they're racing…"
              placeholderTextColor={colors.textDim}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.buttons}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.save} onPress={done}>
              <Text style={styles.saveText}>Save</Text>
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
    borderColor: colors.line,
    padding: 16,
    gap: 12,
    maxHeight: '90%',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 44, height: 44, borderRadius: 22 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  scroll: { flexGrow: 0 },
  label: { color: colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: -4 },
  line: {
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.bg2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 140,
    backgroundColor: colors.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  buttons: { flexDirection: 'row', gap: 10 },
  cancel: {
    flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.line,
  },
  cancelText: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  save: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.accent },
  saveText: { color: colors.onAccent, fontSize: 14, fontWeight: '800' },
});
