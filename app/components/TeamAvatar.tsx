import { StyleSheet, View } from 'react-native';
import Avatar from './Avatar';
import { useThemeColors } from '../contexts/ThemeContext';
import type { ColorScheme } from '../theme';
import { avatarFor, type AvatarMap } from '../lib/avatars';
import type { Player } from '../lib/state';

// A roster entry's face. A couple sharing one entry gets both of their photos,
// overlapped — one photo for "Matt & AJ" only ever showed one of the two
// people. A solo entry is just the plain Avatar, unchanged.
//
// The pair is drawn back-to-front so the first member sits on top, and each
// gets a ring in the card colour so they stay visually separate against a
// photo of similar tone.
export default function TeamAvatar({
  entry,
  avatars,
  leagueKey,
  size = 30,
}: {
  entry: Player;
  avatars: AvatarMap;
  leagueKey: string;
  size?: number;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const members = entry.members?.length ? entry.members : null;

  if (!members) {
    return (
      <Avatar
        name={entry.name}
        color={colors.accent2}
        size={size}
        uri={avatarFor(avatars, entry.id, [], leagueKey)}
      />
    );
  }

  // Each face is slightly smaller than a solo one and they overlap by a third,
  // so the pair occupies barely more width than a single avatar.
  const face = Math.round(size * 0.82);
  const overlap = Math.round(face * 0.34);
  const width = face * members.length - overlap * (members.length - 1);

  return (
    <View style={[styles.stack, { width, height: face }]}>
      {members.map((m, i) => (
        <View
          key={m.id}
          style={[
            styles.slot,
            {
              left: i * (face - overlap),
              zIndex: members.length - i,
              borderRadius: (face + 4) / 2,
              padding: 1.5,
            },
          ]}
        >
          <Avatar
            name={m.name}
            color={i === 0 ? colors.accent2 : colors.accent}
            size={face}
            uri={avatarFor(avatars, m.id, [], leagueKey)}
          />
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  stack: { position: 'relative', flexShrink: 0 },
  // The ring is the card's own colour, which reads as a gap between the faces
  // without drawing a line of its own.
  slot: { position: 'absolute', top: 0, backgroundColor: colors.panel },
});
