import { useState } from 'react';
import type { CreatedLeague, Session } from '../../lib/session';
import { WelcomeScreen, EmailScreen, CodeScreen, ProfileScreen } from './AuthScreens';
import CreateLeagueWizard from './CreateLeagueWizard';
import { LeaguesHome, JoinScreen, InviteScreen, LobbyScreen, type ExistingLeague } from './LeagueScreens';

// Everything before you're inside a league: sign in, set up your profile,
// then create, join or open a league. A simple step machine rather than a
// navigator, so each screen can hand the next one exactly what it needs.
type Step =
  | { s: 'welcome' }
  | { s: 'email' }
  | { s: 'code'; email: string }
  | { s: 'profile'; method: 'google' | 'email'; email?: string; googleName?: string | null; googlePhoto?: string | null }
  | { s: 'home' }
  | { s: 'create' }
  | { s: 'join' }
  | { s: 'invite'; league: CreatedLeague }
  | { s: 'lobby'; league: CreatedLeague };

export default function OnboardingFlow({
  session, save, existing, onEnterLeague,
}: {
  session: Session | null;
  save: (s: Session | null) => void;
  existing: ExistingLeague[];
  onEnterLeague: (key: string) => void;
}) {
  const [step, setStep] = useState<Step>(session ? { s: 'home' } : { s: 'welcome' });

  switch (step.s) {
    case 'welcome':
      return <WelcomeScreen onGoogle={(info) => setStep({ s: 'profile', method: 'google', googleName: info.name, googlePhoto: info.photoUrl })} onEmail={() => setStep({ s: 'email' })} />;
    case 'email':
      return <EmailScreen onBack={() => setStep({ s: 'welcome' })} onCodeSent={(email) => setStep({ s: 'code', email })} />;
    case 'code':
      return <CodeScreen email={step.email} onBack={() => setStep({ s: 'email' })} onVerified={() => setStep({ s: 'profile', method: 'email', email: step.email })} />;
    case 'profile':
      return (
        <ProfileScreen
          initialName={step.googleName ?? undefined}
          initialPhoto={step.googlePhoto ?? undefined}
          onBack={() => setStep({ s: 'welcome' })}
          onDone={(name, photo) => {
            save({ method: step.method, email: step.email, name, photo, leagues: [], inLeague: false });
            setStep({ s: 'home' });
          }}
        />
      );
    case 'home':
      if (!session) return <WelcomeScreen onGoogle={(info) => setStep({ s: 'profile', method: 'google', googleName: info.name, googlePhoto: info.photoUrl })} onEmail={() => setStep({ s: 'email' })} />;
      return (
        <LeaguesHome
          session={session}
          existing={existing}
          onOpenExisting={onEnterLeague}
          onOpenCreated={(league) => onEnterLeague(league.id)}
          onCreate={() => setStep({ s: 'create' })}
          onJoin={() => setStep({ s: 'join' })}
          onSignOut={() => { save(null); setStep({ s: 'welcome' }); }}
        />
      );
    case 'create':
      return (
        <CreateLeagueWizard
          onCancel={() => setStep({ s: 'home' })}
          onCreated={(league) => {
            if (session) save({ ...session, leagues: [...session.leagues, league] });
            setStep({ s: 'invite', league });
          }}
        />
      );
    case 'join':
      return <JoinScreen onBack={() => setStep({ s: 'home' })} />;
    case 'invite':
      return <InviteScreen league={step.league} onDone={() => onEnterLeague(step.league.id)} />;
    case 'lobby':
      return <LobbyScreen league={step.league} me={session?.name ?? 'You'} photo={session?.photo} onBack={() => setStep({ s: 'home' })} />;
  }
}
