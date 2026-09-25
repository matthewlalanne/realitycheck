import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';

// Shared building blocks for sign-in, league setup and the league lobby, so
// every step has the same frame: back, a progress line, a title, a body, and
// one primary action pinned to the bottom.

export function Screen({
  title, subtitle, step, onBack, children, primary, secondary,
}: {
  title: string;
  subtitle?: string;
  step?: { index: number; total: number };
  onBack?: () => void;
  children: ReactNode;
  primary?: { label: string; onPress: () => void; disabled?: boolean };
  secondary?: { label: string; onPress: () => void };
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 20) + 6 }]}>
        <View style={styles.topRow}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={10} style={styles.back}>
              <Ionicons name="chevron-back" size={22} color={colors.accent2} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : <View />}
          {step && <Text style={styles.stepText}>Step {step.index} of {step.total}</Text>}
        </View>
        {step && (
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${(step.index / step.total) * 100}%` }]} />
          </View>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={styles.children}>{children}</View>
      </ScrollView>
      {(primary || secondary) && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {primary && (
            <Pressable
              style={[styles.primary, primary.disabled && styles.primaryOff]}
              disabled={primary.disabled}
              onPress={primary.onPress}
            >
              <Text style={styles.primaryText}>{primary.label}</Text>
            </Pressable>
          )}
          {secondary && (
            <Pressable onPress={secondary.onPress} hitSlop={8} style={styles.secondary}>
              <Text style={styles.secondaryText}>{secondary.label}</Text>
            </Pressable>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/** A selectable card: title, a line of explanation, optional icon. */
export function Choice({
  selected, title, body, icon, onPress, disabled, badge,
}: {
  selected: boolean; title: string; body?: string; icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void; disabled?: boolean; badge?: string;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.choice, selected && styles.choiceOn, disabled && styles.choiceDisabled]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
    >
      {icon && <Ionicons name={icon} size={24} color={selected ? colors.accent : colors.textDim} />}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.choiceTop}>
          <Text style={[styles.choiceTitle, selected && { color: colors.accent }]}>{title}</Text>
          {!!badge && <Text style={styles.badge}>{badge}</Text>}
        </View>
        {!!body && <Text style={styles.choiceBody}>{body}</Text>}
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? colors.accent : colors.line}
      />
    </Pressable>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.note, tone === 'warn' && styles.noteWarn]}>
      <Ionicons name={tone === 'warn' ? 'alert-circle' : 'information-circle'} size={18} color={tone === 'warn' ? colors.red : colors.accent2} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const styles = makeStyles(useThemeColors());
  return <Text style={styles.label}>{children}</Text>;
}

export const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  top: { paddingHorizontal: 20, gap: 10, paddingBottom: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: colors.accent2, fontSize: 16, fontWeight: '600' },
  stepText: { color: colors.textDim, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5 },
  progress: { height: 4, borderRadius: 2, backgroundColor: colors.bg2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
  body: { padding: 20, paddingTop: 14, paddingBottom: 40, gap: 6 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', lineHeight: 33 },
  subtitle: { color: colors.textDim, fontSize: 15, lineHeight: 21 },
  children: { marginTop: 16, gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.bg },
  primary: {
    backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    // A soft glow in the button's own colour, like light catching a ridge.
    shadowColor: colors.accent, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  primaryOff: { opacity: 0.4 },
  primaryText: { color: colors.onAccent, fontSize: 16, fontWeight: '800' },
  secondary: { alignItems: 'center', paddingVertical: 4 },
  secondaryText: { color: colors.accent2, fontSize: 15, fontWeight: '700' },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.panel,
  },
  choiceOn: { borderColor: colors.accent, backgroundColor: colors.panel2 },
  choiceDisabled: { opacity: 0.5 },
  choiceTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  choiceTitle: { color: colors.text, fontSize: 16.5, fontWeight: '800' },
  choiceBody: { color: colors.textDim, fontSize: 13.5, lineHeight: 19 },
  badge: {
    color: colors.textDim, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase',
    borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden',
  },
  note: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.bg2, alignItems: 'flex-start' },
  noteWarn: { borderWidth: 1, borderColor: colors.red },
  noteText: { flex: 1, color: colors.text, fontSize: 13.5, lineHeight: 19 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 4 },
  input: {
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.line, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, color: colors.text, fontSize: 17,
  },
});
