import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../contexts/ThemeContext';
import { useTopInset } from './ScreenHeader';
import type { ColorScheme } from '../theme';

// Sits below the notch and gives the tap a full-height target — the inline
// text link it replaced was both too high and too small to hit reliably.
export default function BackButton({ onPress, label = 'Back' }: { onPress: () => void; label?: string }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const top = useTopInset();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, { marginTop: top }]}
      hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="chevron-back" size={20} color={colors.accent2} style={styles.icon} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 14,
    marginBottom: 6,
  },
  // Pulls the glyph's own left bearing back so the arrow lines up with the
  // content below it rather than sitting a few pixels inboard.
  icon: { marginLeft: -4, marginRight: 1 },
  text: { color: colors.accent2, fontSize: 16, fontWeight: '600' },
});
