import { Image, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

// Shows the player's own photo when they've set one, and falls back to a
// coloured initials circle otherwise — the same fallback the website uses.
export default function Avatar({
  name,
  color,
  size = 44,
  uri,
}: {
  name: string;
  color: string;
  size?: number;
  uri?: string | null;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (uri) return <Image source={{ uri }} style={[styles.photo, round]} />;

  return (
    <View style={[styles.circle, round, { backgroundColor: color }]}>
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  photo: { backgroundColor: colors.bg2 },
  text: { color: colors.bg, fontWeight: '700' },
});
