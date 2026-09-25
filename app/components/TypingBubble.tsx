import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import Avatar from './Avatar';
import { avatarFor, type AvatarMap } from '../lib/avatars';

// The three-dot "someone's typing" bubble, with the same avatar treatment a
// real message from that person would get.
function Dot({ delay }: { delay: number }) {
  const colors = useThemeColors();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        // Pause so the three dots read as a cycle rather than a flicker.
        Animated.delay(640 - delay),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, v]);

  return (
    <Animated.View
      style={{
        width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.textDim,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
      }}
    />
  );
}

export default function TypingBubble({
  people,
  avatars,
  leagueKey,
}: {
  people: { id: string; name: string }[];
  avatars: AvatarMap;
  leagueKey: string;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  if (!people.length) return null;

  return (
    <View style={styles.row}>
      {/* Up to three faces, so a busy chat doesn't push the bubble off screen. */}
      {people.slice(0, 3).map((p) => (
        <Avatar
          key={p.id}
          name={p.name}
          color={colors.accent2}
          size={28}
          uri={avatarFor(avatars, p.id, [], leagueKey)}
        />
      ))}
      <View style={styles.bubble}>
        <Dot delay={0} />
        <Dot delay={160} />
        <Dot delay={320} />
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  bubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line,
    borderRadius: 16, borderBottomLeftRadius: 4,
  },
});
