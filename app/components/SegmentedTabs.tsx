import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';

type Tab<K extends string> = { key: K; label: string; dot?: boolean };

// Full-width segmented control used for in-page tabs (Predictions, Games).
// `dot` puts a small red marker on a tab that needs attention.
export default function SegmentedTabs<K extends string>({
  tabs, value, onChange,
}: { tabs: Tab<K>[]; value: K; onChange: (k: K) => void }) {
  const styles = makeStyles(useThemeColors());
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            style={[styles.tab, on && styles.tabOn]}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.text, on && styles.textOn]}>{t.label}</Text>
            {t.dot && <View style={styles.dot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.bg2, borderRadius: 12, padding: 4, gap: 4, borderWidth: 1, borderColor: colors.line },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9 },
  tabOn: { backgroundColor: colors.accent },
  text: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  textOn: { color: colors.onAccent },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red },
});
