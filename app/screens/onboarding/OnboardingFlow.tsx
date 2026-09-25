import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { WelcomeScreen, EmailScreen, CodeScreen, ProfileScreen } from './AuthScreens';
import CreateLeagueWizard, { type CreatedInfo } from './CreateLeagueWizard';
import { LeaguesHome, JoinScreen, InviteScreen } from './LeagueScreens';
import { logOut, saveProfile, type MyLeague, type Profile } from '../../lib/account';
import { usePendingInviteCode } from '../../lib/deepLink';

// Everything before you're inside a league: sign in, set your name, then
// create, join or open a league. Which of these you see is decided by real
// account state (App.tsx passes it in), not stored on the device:
//   not signed in  -> welcome / email / code
//   no profile yet -> "what should your league call you?"
//   otherwise      -> your leagues, with create and join
type Step =
  | { s: 'welcome' }
  | { s: 'email' }
  | { s: 'code'; email: string }
  | { s: 'home' }
  | { s: 'create' }
  | { s: 'join'; code?: string }
  | { s: 'invite'; league: CreatedInfo };

export default function OnboardingFlow({
  user, profile, myLeagues, leaguesLoading, isAdmin, onOpenLeague, onLeagueCreated,
}: {
  user: User | null;
  profile: Profile | null;
  myLeagues: MyLeague[];
  leaguesLoading: boolean;
  isAdmin: boolean;
  onOpenLeague: (l: MyLeague) => void;
  // Fires once, right as a freshly-created league is about to open, so the
  // app can land it on the cast-photos setup step instead of Standings.
  onLeagueCreated?: (leagueKey: string) => void;
}) {
  const [step, setStep] = useState<Step>({ s: 'welcome' });

  // A tapped invite link (confessional://join/CODE, and https:// once the
  // native side is wired up) lands here however far through onboarding
  // someone is. Once they're signed in with a profile it drops them straight
  // into Join with the code filled in, rather than making them retype it.
  const { code: pendingCode, consume } = usePendingInviteCode();
  useEffect(() => {
    if (!pendingCode || !user || !profile) return;
    if (step.s !== 'home' && step.s !== 'welcome') return;
    setStep({ s: 'join', code: pendingCode });
    consume();
  }, [pendingCode, user, profile, step.s, consume]);

  if (!user) {
    if (step.s === 'email') return <EmailScreen onBack={() => setStep({ s: 'welcome' })} onCodeSent={(email) => setStep({ s: 'code', email })} />;
    if (step.s === 'code') return <CodeScreen email={step.email} onBack={() => setStep({ s: 'email' })} onVerified={() => {}} />;
    return <WelcomeScreen onGoogle={() => {}} onEmail={() => setStep({ s: 'email' })} />;
  }

  if (!profile) {
    return (
      <ProfileScreen
        initialName={user.displayName ?? undefined}
        initialPhoto={user.photoURL ?? undefined}
        onBack={() => { logOut(); }}
        onDone={(name, photo) => { saveProfile(user.uid, { name, photo: photo && photo.startsWith('https://') ? photo : null }); }}
      />
    );
  }

  switch (step.s) {
    case 'create':
      return (
        <CreateLeagueWizard
          playerName={profile.name}
          isAdmin={isAdmin}
          onCancel={() => setStep({ s: 'home' })}
          onCreated={(league) => setStep({ s: 'invite', league })}
        />
      );
    case 'join':
      return (
        <JoinScreen
          playerName={profile.name}
          initialCode={step.code}
          onBack={() => setStep({ s: 'home' })}
          onJoined={(l) => { setStep({ s: 'home' }); onOpenLeague(l); }}
        />
      );
    case 'invite':
      return (
        <InviteScreen
          league={step.league}
          onDone={() => {
            setStep({ s: 'home' });
            onLeagueCreated?.(step.league.leagueKey);
            onOpenLeague({ seasonId: step.league.seasonId, leagueKey: step.league.leagueKey, name: step.league.name, personId: step.league.personId });
          }}
        />
      );
    default:
      return (
        <LeaguesHome
          name={profile.name}
          leagues={myLeagues}
          loading={leaguesLoading}
          onOpen={onOpenLeague}
          onCreate={() => setStep({ s: 'create' })}
          onJoin={() => setStep({ s: 'join' })}
          onSignOut={() => { logOut(); setStep({ s: 'welcome' }); }}
        />
      );
  }
}
