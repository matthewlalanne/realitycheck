import { useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColors } from '../../contexts/ThemeContext';
import { wordmarkFont, type ColorScheme } from '../../theme';
import { PREVIEW } from '../../lib/preview';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, functions } from '../../lib/firebase';
import { signInWithGoogle } from '../../lib/googleAuth';
import { StatusBar } from 'expo-status-bar';
import { Screen, Note, Label, makeStyles as uiStyles } from './ui';

const sunset = require('../../assets/brand/splash.jpg');

// ---- Landing: sign in or sign up ------------------------------------------
//
// Purely a familiar first choice — there's no actual difference underneath.
// Both paths land on the same Google/email screen; an account is created
// automatically the first time anyone signs in either way.

export function LandingScreen({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  return (
    <ImageBackground source={sunset} style={styles.hero} resizeMode="cover">
      <StatusBar style="light" />
      <View style={styles.scrim} />
      <View style={[styles.heroInner, { paddingTop: insets.top + 60, paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
        <Text style={styles.wordmark}>REALITY CHECK</Text>
        <View style={styles.buttons}>
          <Pressable style={styles.google} onPress={onSignUp} accessibilityLabel="Sign up">
            <Text style={styles.googleText}>Sign Up</Text>
          </Pressable>
          <Pressable style={styles.email} onPress={onSignIn} accessibilityLabel="Sign in">
            <Text style={styles.emailText}>Sign In</Text>
          </Pressable>
          <Text style={styles.fine}>
            Fan-made. Not affiliated with any network or show.
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}

// ---- Google/email choice, reached after picking sign in or sign up -------

export function WelcomeScreen({
  mode, onBack, onGoogle, onEmail,
}: {
  mode: 'signin' | 'signup';
  onBack: () => void;
  onGoogle: (info: { name: string | null; photoUrl: string | null }) => void;
  onEmail: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    if (PREVIEW) {
      setBusy(true);
      setTimeout(() => { setBusy(false); onGoogle({ name: null, photoUrl: null }); }, 700);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) { setBusy(false); return; } // cancelled
      const call = httpsCallable<{ idToken: string }, { token: string; email: string; name: string | null; photoUrl: string | null }>(functions, 'googleSignIn');
      const res = await call({ idToken });
      await signInWithCustomToken(auth, res.data.token);
      onGoogle({ name: res.data.name, photoUrl: res.data.photoUrl });
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Google sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    // Transparent so this sits on the app's own themed background (a plain
    // colour, or the purple theme's gradient art) instead of the sunset
    // photo — no illustration on this step, just the app's usual backdrop.
    <View style={styles.plainScreen}>
      <View style={[styles.heroInner, { paddingTop: insets.top + 60, paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
        <Pressable style={styles.backBtnPlain} onPress={onBack} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.accent2} />
        </Pressable>
        <View style={styles.buttons}>
          <Text style={styles.authTitlePlain}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</Text>
          <Pressable
            style={styles.google}
            onPress={google}
            accessibilityLabel="Continue with Google"
          >
            {busy ? <ActivityIndicator color="#1f1f1f" /> : (
              <>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.emailPlain} onPress={onEmail}>
            <Ionicons name="mail" size={18} color={colors.text} />
            <Text style={styles.emailPlainText}>Continue with email</Text>
          </Pressable>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <Text style={styles.finePlain}>
            Fan-made. Not affiliated with any network or show.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---- Email + code ----------------------------------------------------------

export function EmailScreen({ onBack, onCodeSent }: { onBack: () => void; onCodeSent: (email: string) => void }) {
  const colors = useThemeColors();
  const ui = uiStyles(colors);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (PREVIEW) { onCodeSent(e); return; }
    setSending(true);
    setError(null);
    try {
      const call = httpsCallable<{ email: string }, { ok: true }>(functions, 'requestEmailCode');
      await call({ email: e });
      onCodeSent(e);
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Couldn't send the code. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      title="What's your email?"
      subtitle="We'll email you a 6-digit code. No password to remember."
      onBack={onBack}
      primary={{ label: sending ? 'Sending…' : 'Send my code', onPress: send, disabled: !valid || sending }}
    >
      {!!error && <Note tone="warn">{error}</Note>}
      <TextInput
        style={ui.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={colors.textDim}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        autoFocus
        returnKeyType="send"
        onSubmitEditing={() => valid && !sending && send()}
      />
    </Screen>
  );
}

export function CodeScreen({ email, onBack, onVerified }: { email: string; onBack: () => void; onVerified: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const input = useRef<TextInput>(null);

  const verify = async (c: string) => {
    if (c.length !== 6) return;
    if (PREVIEW) { setError(null); onVerified(); return; }
    setVerifying(true);
    setError(null);
    try {
      const call = httpsCallable<{ email: string; code: string }, { token: string }>(functions, 'verifyEmailCode');
      const res = await call({ email, code: c });
      await signInWithCustomToken(auth, res.data.token);
      onVerified();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "That code didn't work. Try again.");
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setResent(true);
    if (PREVIEW) return;
    try { await httpsCallable(functions, 'requestEmailCode')({ email }); } catch { /* the Note below stays generic */ }
  };

  return (
    <Screen
      title="Check your email"
      subtitle={`We sent a 6-digit code to ${email}. It expires in 10 minutes. Don't see it? Check your spam folder.`}
      onBack={onBack}
      primary={{ label: verifying ? 'Checking…' : 'Confirm', onPress: () => verify(code), disabled: code.length !== 6 || verifying }}
      secondary={{ label: resent ? 'Sent again' : "Didn't get it? Send again", onPress: resend }}
    >
      <Pressable style={styles.codeRow} onPress={() => input.current?.focus()}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[styles.codeBox, i === code.length && styles.codeBoxActive]}>
            <Text style={styles.codeDigit}>{code[i] ?? ''}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(t) => { const c = t.replace(/\D/g, '').slice(0, 6); setCode(c); if (c.length === 6) verify(c); }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        style={styles.hiddenInput}
      />
      {error && <Note tone="warn">{error}</Note>}
      {PREVIEW && <Note>Preview: any 6 digits will work.</Note>}
    </Screen>
  );
}

// ---- Profile ---------------------------------------------------------------

export function ProfileScreen({
  initialName, initialPhoto, onBack, onDone,
}: { initialName?: string; initialPhoto?: string; onBack: () => void; onDone: (name: string, photo: string | null) => void }) {
  const colors = useThemeColors();
  const ui = uiStyles(colors);
  const styles = makeStyles(colors);
  const [name, setName] = useState(initialName ?? '');
  const [photo, setPhoto] = useState<string | null>(initialPhoto ?? null);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  return (
    <Screen
      title="What should your league call you?"
      subtitle="This is the name people see on standings, picks and chat."
      onBack={onBack}
      primary={{ label: 'Continue', onPress: () => onDone(name.trim(), photo), disabled: !name.trim() }}
    >
      <Pressable style={styles.avatarPick} onPress={pick}>
        {photo ? <Image source={{ uri: photo }} style={styles.avatarImg} /> : (
          <View style={[styles.avatarImg, styles.avatarEmpty]}>
            <Ionicons name="camera" size={26} color={colors.textDim} />
          </View>
        )}
        <Text style={styles.avatarText}>{photo ? 'Change photo' : 'Add a photo (optional)'}</Text>
      </Pressable>
      <Label>Your name</Label>
      <TextInput
        style={ui.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Jordan Smith"
        placeholderTextColor={colors.textDim}
        autoCapitalize="words"
        maxLength={40}
        returnKeyType="done"
      />
    </Screen>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  hero: { flex: 1 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.photoScrim },
  heroInner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  backBtn: { alignSelf: 'flex-start', padding: 4 },
  authTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  wordmark: { color: colors.accentOnDark, fontFamily: wordmarkFont, fontSize: 44, letterSpacing: 3, marginRight: -3, textAlign: 'center' },
  kicker: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 4, marginRight: -4, opacity: 0.85, marginTop: -4 },
  tagline: { color: '#fff', fontSize: 17, lineHeight: 23, textAlign: 'center', opacity: 0.92, maxWidth: 300 },
  buttons: { gap: 12 },
  google: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15, minHeight: 54,
  },
  googleG: { fontSize: 20, fontWeight: '900', color: '#4285F4' },
  googleText: { color: '#1f1f1f', fontSize: 16, fontWeight: '700' },
  email: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)',
  },
  emailText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fine: { color: 'rgba(255,255,255,0.75)', fontSize: 12, textAlign: 'center', marginTop: 4 },
  errorText: { color: '#ffb4a8', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  // The Google/email step: no photo behind it, so text/borders read against
  // the app's own themed background instead of a fixed dark photo.
  plainScreen: { flex: 1, backgroundColor: 'transparent' },
  backBtnPlain: { alignSelf: 'flex-start', padding: 4 },
  authTitlePlain: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  emailPlain: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 15, borderWidth: 1.5, borderColor: colors.line,
  },
  emailPlainText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  finePlain: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 4 },
  codeRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  codeBox: {
    flex: 1, aspectRatio: 0.8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line,
    backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center',
  },
  codeBoxActive: { borderColor: colors.accent },
  codeDigit: { color: colors.text, fontSize: 26, fontWeight: '800' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  avatarPick: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarImg: { width: 76, height: 76, borderRadius: 38 },
  avatarEmpty: { backgroundColor: colors.bg2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accent2, fontSize: 15, fontWeight: '700' },
});
