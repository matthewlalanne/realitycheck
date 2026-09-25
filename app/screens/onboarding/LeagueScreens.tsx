import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../contexts/ThemeContext';
import type { ColorScheme } from '../../theme';
import { joinLeague, type MyLeague } from '../../lib/account';
import { Screen, Note, Label, makeStyles as uiStyles } from './ui';

// The placeholder domain until the real name is settled (PUBLIC_LAUNCH.md §5).
const JOIN_BASE = 'playrealitycheck.web.app/join/';


// ---- Your leagues ----------------------------------------------------------

export function LeaguesHome({
  name, leagues, loading, onOpen, onCreate, onJoin, onSignOut,
}: {
  name: string;
  leagues: MyLeague[];
  loading: boolean;
  onOpen: (l: MyLeague) => void;
  onCreate: () => void;
  onJoin: () => void;
  onSignOut: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <Screen
      title={`Hi, ${name}`}
      subtitle={!leagues.length && !loading ? 'Start a league for your group, or join one with a code.' : 'Your leagues'}
      secondary={{ label: 'Sign out', onPress: onSignOut }}
    >
      {leagues.map((l) => (
        <Pressable key={l.leagueKey} style={styles.leagueCard} onPress={() => onOpen(l)}>
          <View style={styles.leagueIcon}><Ionicons name="flame" size={20} color={colors.onAccent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.leagueName}>{l.name}</Text>
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

export function JoinScreen({
  playerName, initialCode, onBack, onJoined,
}: {
  playerName: string;
  initialCode?: string;
  onBack: () => void;
  onJoined: (l: MyLeague) => void;
}) {
  const colors = useThemeColors();
  const ui = uiStyles(colors);
  const styles = makeStyles(colors);
  const [code, setCode] = useState((initialCode ?? '').toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choose, setChoose] = useState<{ name: string; open: { id: string; name: string }[] } | null>(null);

  const go = async (claimId?: string) => {
    setBusy(true); setError(null);
    try {
      const r = await joinLeague(code, playerName, claimId);
      if (r.status === 'choose') { setChoose({ name: r.name, open: r.open }); return; }
      onJoined({ seasonId: r.seasonId, leagueKey: r.leagueKey, name: r.name, personId: r.personId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (choose) {
    return (
      <Screen
        title={`Which one are you?`}
        subtitle={`${choose.name} already has players. Pick yourself to take over your picks and history.`}
        onBack={() => setChoose(null)}
        secondary={{ label: "I'm not on the list", onPress: () => go('new') }}
      >
        {choose.open.map((p) => (
          <Pressable key={p.id} style={styles.leagueCard} onPress={() => go(p.id)} disabled={busy}>
            <View style={styles.leagueIcon}><Text style={{ color: colors.onAccent, fontWeight: '800' }}>{p.name.slice(0, 1).toUpperCase()}</Text></View>
            <Text style={[styles.leagueName, { flex: 1 }]}>{p.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </Pressable>
        ))}
        {!!error && <Note tone="warn">{error}</Note>}
      </Screen>
    );
  }

  return (
    <Screen
      title="Join a league"
      subtitle="Enter the 6-letter code from your commissioner. Tapping their invite link does this for you."
      onBack={onBack}
      primary={{ label: busy ? 'Joining…' : 'Join', onPress: () => go(), disabled: code.length !== 6 || busy }}
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
      {!!error && <Note tone="warn">{error}</Note>}
    </Screen>
  );
}

// ---- Invite (right after creating) -------------------------------------------

export function InviteScreen({ league, onDone }: { league: { name: string; code: string }; onDone: () => void }) {
  const link = `https://${JOIN_BASE}${league.code}`;
  const share = () => Share.share({ message: `Join my fantasy league “${league.name}” on Reality Check: ${link} (code ${league.code})` });
  return (
    <Screen
      title={`${league.name} is ready`}
      subtitle="Send your group the link or the code. They join from inside the app."
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
