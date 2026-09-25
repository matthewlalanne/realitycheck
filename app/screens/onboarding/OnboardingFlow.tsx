import { useState } from 'react';
import type { User } from 'firebase/auth';
import { WelcomeScreen, EmailScreen, CodeScreen, ProfileScreen } from './AuthScreens';
import CreateLeagueWizard, { type CreatedInfo } from './CreateLeagueWizard';
import { LeaguesHome, JoinScreen, InviteScreen } from './LeagueScreens';
import { logOut, saveProfile, type MyLeague, type Profile } from '../../lib/account';

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
  | { s: 'join' }
  | { s: 'invite'; league: CreatedInfo };

export default function OnboardingFlow({
  user, profile, myLeagues, leaguesLoading, isAdmin, onOpenLeague,
}: {
  user: User | null;
  profile: Profile | null;
  myLeagues: MyLeague[];
  leaguesLoading: boolean;
  isAdmin: boolean;
  onOpenLeague: (l: MyLeague) => void;
}) {
  const [step, setStep] = useState<Step>({ s: 'welcome' });

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
