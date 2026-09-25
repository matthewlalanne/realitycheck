import { ImageBackground, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const background = require('../assets/brand/splash.jpg');

// Shown while the app works out who's signed in. It is the very same picture
// the welcome screen sits on (buttons fade in on top of it), so going from
// loading to sign-in doesn't shift or flash. No text of its own: the logo is
// part of the image.
export default function SplashScreen() {
  return (
    <ImageBackground source={background} style={styles.container} resizeMode="cover">
      <StatusBar style="light" />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#ff4d5a' } });
