import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import { LIMITS } from '../lib/limits';

export default function ScoreModal({
  visible,
  title,
  onSave,
  onSkip,
}: {
  visible: boolean;
  title: string;
  onSave: (name: string) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState('');
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Add your name to the leaderboard</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textDim}
            textContentType="name"
            autoComplete="name"
            autoFocus
            // Same cap the website's leaderboard input uses, so a name entered
            // on a phone and one entered on the site can't render differently.
            maxLength={LIMITS.leaderboardName}
          />
          <View style={styles.row}>
            <Pressable style={styles.skipButton} onPress={onSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
              disabled={!name.trim()}
              onPress={() => onSave(name.trim())}
            >
              <Text style={styles.saveText}>Save Score</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', backgroundColor: colors.panel2, borderRadius: 16, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.accent },
  title: { color: colors.accent, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  input: {
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  skipButton: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  skipText: { color: colors.textDim, fontWeight: '600' },
  saveButton: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.4 },
  saveText: { color: colors.onAccent, fontWeight: '700' },
});
