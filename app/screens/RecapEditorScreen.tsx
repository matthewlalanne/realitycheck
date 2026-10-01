import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import BackButton from '../components/BackButton';
import { LIMITS } from '../lib/limits';
import { putRecap } from '../lib/recapHandoff';

type Props = NativeStackScreenProps<RootStackParamList, 'RecapEditor'>;

// The recap and nothing else, like a note in Notes: the text box is the whole
// page, so iOS handles scrolling, the caret, and selection natively with no
// outer page to fight the keyboard. Leaving any way (Done, back, swipe) hands
// the text back to the episode editor, which still owns saving.
export default function RecapEditorScreen({ route, navigation }: Props) {
  const { episode, text: initial, returnKey } = route.params;
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const [text, setText] = useState(initial);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.bar}>
        <BackButton label="Done" onPress={() => navigation.goBack()} />
        <Text style={styles.heading}>Episode {episode} recap</Text>
      </View>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={(t) => { setText(t); putRecap(returnKey, t); }}
        placeholder="What happened this episode?"
        placeholderTextColor={colors.textDim}
        multiline
        // Opens at the top with the keyboard down, like a note: tap where
        // you want to type. An empty recap goes straight to typing.
        autoFocus={!initial}
        textAlignVertical="top"
        // Roughly 800 words — a long recap and then some. The database
        // refuses anything past it, and a refused recap would take the
        // eliminations in the same write down with it.
        maxLength={LIMITS.episodeRecap}
      />
      {text.length > LIMITS.episodeRecap - 500 && (
        <Text style={styles.counter}>{LIMITS.episodeRecap - text.length} characters left</Text>
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bar: { paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 10 },
  heading: { color: colors.text, fontSize: 20, fontWeight: '800' },
  input: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 },
  counter: { color: colors.textDim, fontSize: 11, textAlign: 'right', paddingHorizontal: 20, paddingVertical: 6 },
});
