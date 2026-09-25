import { Image, StyleSheet, View, ViewProps } from 'react-native';
import { useTheme, useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';

// Dark-mode depth only. React Native has no CSS gradient and expo-linear-gradient
// would mean a new native build, so this is a 4x256 PNG alpha ramp stretched edge
// to edge and recoloured with `tintColor` — it ships inside an over-the-air
// update like any other asset and costs one Image per card.
const sheen = require('../assets/card-sheen.png');

// A rounded card panel — the base building block reused across every screen,
// matching the ".panel" look from the web league site.
export default function Panel({ style, children, ...rest }: ViewProps) {
  const colors = useThemeColors();
  const { resolvedMode } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={[styles.panel, style]} {...rest}>
      {/* Dark mode only. Light cards are flat white — any fade there, towards
          grey or towards a tint, just made them look dirty. */}
      {resolvedMode === 'dark' && (
        <Image
          source={sheen}
          style={[styles.sheen, { tintColor: colors.bg }]}
          resizeMode="stretch"
        />
      )}
      {children}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    // Keeps the ramp inside the rounded corners.
    overflow: 'hidden',
  },
  // Behind the content, ignoring the panel's own padding so the gradient runs
  // corner to corner. Laid out first, so anything in `children` draws on top.
  // Fades towards the page background, so a dark card gains a soft edge.
  sheen: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    width: undefined, height: undefined,
    // Never swallow a tap meant for a card that is itself pressable.
    pointerEvents: 'none',
  },
});
