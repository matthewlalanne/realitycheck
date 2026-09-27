import { ImageBackground, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { wordmarkFont } from '../theme';

const background = require('../assets/brand/splash.jpg');

// Shown while the app works out who's signed in. It is the very same picture
// the welcome screen sits on (buttons fade in on top of it), so going from
// loading to sign-in doesn't shift. Same wordmark, same spot, so it doesn't
// pop in a beat later on the very next screen either.
export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ImageBackground source={background} style={styles.container} resizeMode="cover">
      <StatusBar style="light" />
      <Text style={[styles.wordmark, { marginTop: insets.top + 60 }]}>REALITY CHECK</Text>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ff4d5a' },
  wordmark: {
    color: '#fff', fontFamily: wordmarkFont, fontSize: 44, letterSpacing: 3,
    marginRight: -3, textAlign: 'center',
  },
});
