import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Identity } from '../lib/identity';
import { EDITOR_IDS } from '../lib/identity';
import { useRegisterPushToken } from '../lib/push';
import { leaguesForPerson, personNameIn, teamIdFor, type LeagueRecord, type LeagueRoot } from '../lib/state';

type LeagueContextValue = {
  root: LeagueRoot;
  /** The league currently being viewed — this is what every screen should read. */
  leagueKey: string;
  league: LeagueRecord;
  /** Every league this player belongs to, in a stable order. */
  myLeagueKeys: string[];
  canSwitchLeagues: boolean;
  setLeagueKey: (key: string) => void;
  /** The signed-in person. Chat, predictions and profile are all keyed on this. */
  playerId: string;
  playerName: string;
  /** The roster entry they draft and place under — a couple shares one. */
  teamId: string;
  teamName: string;
  identity: Identity;
  /** Commissioner rights are per-league: Courtney runs Denver only. */
  isCommissioner: boolean;
  editorUnlocked: boolean;
  unlockEditor: (password: string) => Promise<boolean>;
  setIdentity: (id: Identity) => Promise<void>;
  clearIdentity: () => Promise<void>;
  /** Back to the list of all your leagues (create / join lives there). */
  onExitLeague?: () => void;
  /** Log out of the account entirely. */
  onLogOut?: () => void;
};

const LeagueContext = createContext<LeagueContextValue | null>(null);

// Everything under MainTabs reads the live league record + who you are from
// here. RootNavigator only mounts this once both are actually loaded, so
// consumers never see a half-ready state.
//
// Matt and AJ play in both leagues, so the league being *viewed* is separate
// from the identity you signed in with. Switching it here switches it
// everywhere at once — standings, picks, chat — rather than each screen
// keeping its own idea of which league you're looking at.
export function LeagueProvider({
  root,
  identity,
  initialLeagueKey,
  onLeagueChange,
  editorUnlocked,
  unlockEditor,
  setIdentity,
  clearIdentity,
  onExitLeague,
  onLogOut,
  children,
}: {
  root: LeagueRoot;
  identity: Identity;
  /** The league last viewed on this device, if any — restored on launch. */
  initialLeagueKey?: string | null;
  onLeagueChange?: (key: string) => void;
  editorUnlocked: boolean;
  unlockEditor: (password: string) => Promise<boolean>;
  setIdentity: (id: Identity) => Promise<void>;
  clearIdentity: () => Promise<void>;
  onExitLeague?: () => void;
  onLogOut?: () => void;
  children: React.ReactNode;
}) {
  const [viewKey, setViewKey] = useState(initialLeagueKey || identity.leagueKey);
  const setLeagueKey = useCallback((key: string) => {
    setViewKey(key);
    onLeagueChange?.(key);
  }, [onLeagueChange]);

  // Your leagues are simply the ones you're on a roster in — directly, or as a
  // member of a team entry. Everyone gets exactly the leagues they play in
  // rather than an all-or-nothing "dual league" flag.
  const myLeagueKeys = useMemo(() => {
    const keys = leaguesForPerson(root, identity.playerId);
    return keys.length ? keys : [identity.leagueKey];
  }, [root, identity.playerId, identity.leagueKey]);

  // Falling back rather than syncing in an effect keeps this correct on the
  // first render after switching player, with no flash of the wrong league.
  const leagueKey = myLeagueKeys.includes(viewKey) ? viewKey : identity.leagueKey;
  const league = root.leagues[leagueKey];
  // playerId is the person; teamId is the roster entry they draft and place
  // under here. For a solo player the two are the same string.
  const teamId = teamIdFor(league, identity.playerId) ?? identity.playerId;
  const playerName = personNameIn(league, identity.playerId) ?? identity.playerId;
  const teamName = league?.players.find((p) => p.id === teamId)?.name ?? playerName;

  useRegisterPushToken(leagueKey, identity.playerId, playerName);

  return (
    <LeagueContext.Provider
      value={{
        root,
        leagueKey,
        league,
        myLeagueKeys,
        canSwitchLeagues: myLeagueKeys.length > 1,
        setLeagueKey,
        playerId: identity.playerId,
        playerName,
        teamId,
        teamName,
        identity,
        isCommissioner: !!EDITOR_IDS[leagueKey]?.includes(identity.playerId),
        editorUnlocked,
        unlockEditor,
        setIdentity,
        clearIdentity,
        onExitLeague,
        onLogOut,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error('useLeague must be used within a LeagueProvider');
  return ctx;
}
