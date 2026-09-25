import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Image, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import { findSeason, seasonLabel } from '../../lib/shows';
import type { CreatedLeague, Session } from '../../lib/session';
import { Screen, Note, Label, makeStyles as uiStyles } from './ui';

// The placeholder domain until the real name is settled (PUBLIC_LAUNCH.md §5).
const JOIN_BASE = 'playrealitycheck.web.app/join/';

export type ExistingLeague = { key: string; name: string; members: number; showId: string };

// ---- Your leagues ----------------------------------------------------------

export function LeaguesHome({
  session, existing, onOpenExisting, onOpenCreated, onCreate, onJoin, onSignOut,
}: {
  session: Session;
  existing: ExistingLeague[];
  onOpenExisting: (key: string) => void;
  onOpenCreated: (l: CreatedLeague) => void;
  onCreate: () => void;
  onJoin: () => void;
  onSignOut: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const showName = seasonLabel;
  const none = !existing.length && !session.leagues.length;
  return (
    <Screen
      title={`Hi, ${session.name}`}
      subtitle={none ? 'Start a league for your group, or join one with a code.' : 'Your leagues'}
      secondary={{ label: 'Sign out', onPress: onSignOut }}
    >
      {existing.map((l) => (
        <Pressable key={l.key} style={styles.leagueCard} onPress={() => onOpenExisting(l.key)}>
          <View style={styles.leagueIcon}><Ionicons name="flame" size={20} color={colors.onAccent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.leagueName}>{l.name}</Text>
            <Text style={styles.leagueMeta}>{showName(l.showId)} · {l.members} players</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </Pressable>
      ))}
      {session.leagues.map((l) => (
        <Pressable key={l.id} style={styles.leagueCard} onPress={() => onOpenCreated(l)}>
          <View style={[styles.leagueIcon, { backgroundColor: colors.accent2 }]}><Ionicons name="hourglass" size={18} color={colors.onAccent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.leagueName}>{l.name}</Text>
            <Text style={styles.leagueMeta}>{showName(l.showId)} · waiting for players</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </Pressable>
      ))}

      <View style={styles.actions}>
        <Pressable style={styles.bigAction} onPress={onCreate}>
          <Ionicons name="add-circle" size={26} color={colors.accent} />
          <Text style={styles.bigActionTitle}>Create a league</Text>
          <Text style={styles.bigActionSub}>You'll be the commissioner</Text>
        </Pressable>
        <Pressable style={styles.bigAction} onPress={onJoin}>
          <Ionicons name="enter" size={26} color={colors.accent} />
          <Text style={styles.bigActionTitle}>Join with a code</Text>
          <Text style={styles.bigActionSub}>Got a link or 6 letters?</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// ---- Join with a code --------------------------------------------------------

export function JoinScreen({ onBack }: { onBack: () => void }) {
  const colors = useThemeColors();
  const ui = uiStyles(colors);
  const [code, setCode] = useState('');
  const [tried, setTried] = useState(false);
  return (
    <Screen
      title="Join a league"
      subtitle="Enter the 6-letter code from your commissioner. Tapping their invite link does this for you."
      onBack={onBack}
      primary={{ label: 'Join', onPress: () => setTried(true), disabled: code.length !== 6 }}
    >
      <TextInput
        style={[ui.input, { fontSize: 26, letterSpacing: 8, textAlign: 'center', fontWeight: '800' }]}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        placeholder="K7Q2MX"
        placeholderTextColor={colors.textDim}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
      />
      {tried && <Note>Preview: joining by code needs the live server, which isn't switched on yet.</Note>}
    </Screen>
  );
}

// ---- Invite (right after creating) -------------------------------------------

export function InviteScreen({ league, onDone }: { league: CreatedLeague; onDone: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const link = `https://${JOIN_BASE}${league.code}`;
  const share = () => Share.share({ message: `Join my ${findSeason(league.showId)?.show.name ?? ''} fantasy league “${league.name}” on Reality Check: ${link}` });
  return (
    <Screen
      title={`${league.name} is ready`}
      subtitle="Send your group the link. Tapping it installs the app if they need it, then drops them straight into your league."
      primary={{ label: 'Share invite link', onPress: share }}
      secondary={{ label: 'Go to my league', onPress: onDone }}
    >
      <CopyableCode code={league.code} link={link} />
      <Note>You can find this code any time in your league's Settings.</Note>
    </Screen>
  );
}

// ---- Code + link, each with a copy button (long-press copies too) --------------

export function CopyableCode({ code, link }: { code: string; link: string }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const copy = async (what: 'code' | 'link') => {
    await Clipboard.setStringAsync(what === 'code' ? code : link);
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };
  return (
    <View style={styles.codeCard}>
      <Text style={styles.codeLabel}>LEAGUE CODE</Text>
      <Pressable style={styles.copyRow} onPress={() => copy('code')} onLongPress={() => copy('code')} accessibilityLabel="Copy league code">
        <Text style={styles.code}>{code.split('').join(' ')}</Text>
        <Ionicons name={copied === 'code' ? 'checkmark-circle' : 'copy-outline'} size={22} color={colors.accent} />
      </Pressable>
      <Pressable style={styles.copyRow} onPress={() => copy('link')} onLongPress={() => copy('link')} accessibilityLabel="Copy invite link">
        <Text style={styles.link} numberOfLines={1}>{link.replace('https://', '')}</Text>
        <Ionicons name={copied === 'link' ? 'checkmark-circle' : 'copy-outline'} size={17} color={colors.accent2} />
      </Pressable>
      {!!copied && <Text style={styles.copiedText}>{copied === 'code' ? 'Code' : 'Link'} copied</Text>}
    </View>
  );
}

// ---- Lobby (a new league before its draft) -----------------------------------

export function LobbyScreen({ league, me, photo, onBack }: { league: CreatedLeague; me: string; photo?: string | null; onBack: () => void }) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const show = findSeason(league.showId)?.show;
  const seasonName = findSeason(league.showId)?.season.label;
  const draftLine = league.draft === 'offline' ? 'Enter your picks' : `${league.draft === 'live' ? 'Live draft' : 'Auto draft'} · ${league.draftAt ? new Date(league.draftAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : 'time TBD'}`;
  const share = () => Share.share({ message: `Join “${league.name}” on Reality Check: https://${JOIN_BASE}${league.code}` });
  return (
    <Screen
      title={league.name}
      subtitle={`${show?.name ?? ''}${seasonName ? ` · ${seasonName}` : ''} · ${league.style === 'points' ? 'Points' : 'Last one standing'}`}
      onBack={onBack}
      primary={{ label: 'Invite players', onPress: share }}
    >
      <View style={styles.draftCard}>
        <Ionicons name="calendar" size={22} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.draftTitle}>{draftLine}</Text>
          <Text style={styles.draftSub}>Everyone ranks the cast on My board before the draft. That ranking is their auto-pick list.</Text>
        </View>
      </View>

      <Label>Players · 1 joined</Label>
      <View style={styles.memberRow}>
        {photo ? <Image source={{ uri: photo }} style={styles.memberAvatar} /> : (
          <View style={[styles.memberAvatar, { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: colors.onAccent, fontWeight: '800' }}>{me.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.memberName}>{me}</Text>
        <Text style={styles.commish}>COMMISSIONER</Text>
      </View>
      <View style={[styles.memberRow, { opacity: 0.55 }]}>
        <View style={[styles.memberAvatar, styles.memberEmpty]}><Ionicons name="person-add" size={16} color={colors.textDim} /></View>
        <Text style={styles.memberName}>Waiting for your group…</Text>
      </View>
      <Note>League code {league.code}. Share it, or tap Invite players.</Note>
    </Screen>
  );
}

const makeStyles = (colors: ColorScheme) => StyleSheet.create({
  leagueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line,
  },
  leagueIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  leagueName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  leagueMeta: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  bigAction: {
    flex: 1, padding: 14, borderRadius: 14, gap: 4, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: colors.accent, backgroundColor: colors.bg2,
  },
  bigActionTitle: { color: colors.text, fontSize: 15.5, fontWeight: '800', marginTop: 4 },
  bigActionSub: { color: colors.textDim, fontSize: 12.5 },
  codeCard: { alignItems: 'center', padding: 22, borderRadius: 18, backgroundColor: colors.panel2, borderWidth: 1.5, borderColor: colors.accent, gap: 6 },
  codeLabel: { color: colors.textDim, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.5 },
  code: { color: colors.text, fontSize: 38, fontWeight: '900', letterSpacing: 2 },
  link: { color: colors.accent2, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '100%' },
  copiedText: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  draftCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  draftTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  draftSub: { color: colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 3 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  memberAvatar: { width: 38, height: 38, borderRadius: 19 },
  memberEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  memberName: { color: colors.text, fontSize: 15.5, fontWeight: '700', flex: 1 },
  commish: { color: colors.accent, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
});
