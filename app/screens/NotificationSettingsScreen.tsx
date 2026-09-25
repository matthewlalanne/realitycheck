import { StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Panel from '../components/Panel';
import BackButton from '../components/BackButton';
import { NOTIF_OPTIONS, useNotifPrefs } from '../lib/notificationPrefs';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

// Pulled out of Settings, which was getting crowded with five switches
// before you even reach appearance/commissioner tools.
export default function NotificationSettingsScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const { prefs, toggle } = useNotifPrefs();

  return (
    <View style={styles.container}>
      <View style={styles.backBar}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Notifications</Text>
        <Panel style={styles.panel}>
          {NOTIF_OPTIONS.map((o) => (
            <View key={o.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{o.label}</Text>
                <Text style={styles.hint}>{o.hint}</Text>
              </View>
              <Switch value={prefs[o.key]} onValueChange={() => toggle(o.key)} trackColor={{ true: colors.accent, false: colors.line }} />
            </View>
          ))}
        </Panel>
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backBar: { paddingHorizontal: 20 },
  content: { padding: 20, paddingTop: 8, gap: 14 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  panel: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
