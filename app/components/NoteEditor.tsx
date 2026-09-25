import { useEffect, useState } from 'react';
import {
  Image,
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
import CastAvatar from '../components/CastAvatar';
import { LIMITS, clamp } from '../lib/limits';

// One note box, shared by the board, the bio page and the draft card, so a
// note written in any of the three looks and behaves the same.
//
// Saving happens on Done rather than on every keystroke: mid-draft the last
// thing anyone needs is a write going out per character.
export default function NoteEditor({
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
  initial: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const [text, setText] = useState(initial);

  // Reopening on someone else has to start from THEIR note, not whatever was
  // last typed.
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, contestantId]);

  const done = () => {
    onSave(text);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheet}>
          <View style={styles.headRow}>
            {true ? (
              <CastAvatar id={contestantId} style={styles.photo} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{name}</Text>
              <Text style={styles.sub}>Your note — only you see this</Text>
            </View>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={(t) => setText(clamp(t, LIMITS.boardNote))}
              placeholder="Anything you want to remember on draft night…"
              placeholderTextColor={colors.textDim}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.buttons}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.save} onPress={done}>
              <Text style={styles.saveText}>Done</Text>
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
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 44, height: 44, borderRadius: 22 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  inputWrap: { maxHeight: 220 },
  input: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 120,
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
