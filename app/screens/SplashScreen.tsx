import { useEffect, useRef } from 'react';
import { Animated, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import { wordmarkFont } from '../theme';

const background = require('../assets/backgrounds/dusk.jpg');

// Branded loading screen shown by RootNavigator while it checks whether
// there's already a signed-in session (and, if so, which league they're in).
// No timer, no navigation of its own — it just renders for however long that
// check takes, then RootNavigator swaps it out on its own.
export default function SplashScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <ImageBackground source={background} style={styles.container} resizeMode="cover">
      <View style={styles.overlay} />
      <Animated.View style={[styles.stack, { opacity: fade }]}>
        <Text style={styles.title}>REALITY CHECK</Text>
        <Text style={styles.subtitle}>Fantasy TV</Text>
      </Animated.View>
    </ImageBackground>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The splash always sits on the same dark sunset photo, so its text stays
  // light in every theme — only the wordmark follows the chosen theme, using
  // that theme's dark-mode accent so it stays legible over the photo.
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.photoScrim,
  },
  stack: { alignItems: 'center', alignSelf: 'stretch' },
  // letterSpacing also lands *after* the final glyph, so a centred line sits
  // half a space left of true centre — and two lines with different spacing
  // drift apart from each other. The negative right margin takes that
  // trailing space back out of the layout box so both optically centre.
  title: {
    color: colors.accentOnDark,
    fontFamily: wordmarkFont,
    fontSize: 44,
    letterSpacing: 4,
    marginRight: -4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
  },
  subtitle: {
    color: '#f2ece0',
    fontSize: 13,
    letterSpacing: 3,
    marginRight: -3,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
});
