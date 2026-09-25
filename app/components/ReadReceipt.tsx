import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Avatar from './Avatar';
import { avatarFor, type AvatarMap } from '../lib/avatars';

// Shown under your own most recent message only, the way Messages does it —
// a receipt on every message turns a 14-person chat into a wall of faces.
const MAX_FACES = 3;

export default function ReadReceipt({
  readers,
  avatars,
  leagueKey,
}: {
  readers: { id: string; name: string }[];
  avatars: AvatarMap;
  leagueKey: string;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  if (!readers.length) return null;

  const faces = readers.slice(0, MAX_FACES);
  const rest = readers.length - faces.length;

  return (
    <View style={styles.row} accessibilityLabel={`Read by ${readers.map((r) => r.name).join(', ')}`}>
      <Text style={styles.label}>Read by</Text>
      <View style={styles.stack}>
        {faces.map((r, i) => (
          <View key={r.id} style={[styles.slot, i > 0 && styles.slotOverlap]}>
            <Avatar
              name={r.name}
              color={colors.accent2}
              size={16}
              uri={avatarFor(avatars, r.id, [], leagueKey)}
            />
          </View>
        ))}
      </View>
      <Text style={styles.label}>
        {rest > 0
          ? `+${rest} other${rest === 1 ? '' : 's'}`
          // One or two readers are worth naming; three is already a crowd.
          : faces.length <= 2 ? faces.map((r) => r.name).join(' and ') : ''}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginTop: 3 },
  stack: { flexDirection: 'row', alignItems: 'center' },
  // A ring in the page colour so overlapping faces stay distinct.
  slot: { borderRadius: 10, padding: 1, backgroundColor: colors.bg },
  slotOverlap: { marginLeft: -6 },
  label: { color: colors.textDim, fontSize: 10.5 },
});
