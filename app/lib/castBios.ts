import { ref, set } from 'firebase/database';
import { rtdb } from './firebase';
import { seasonPath } from './season';
import { LIMITS, clamp } from './limits';
import type { CastBio } from './state';

// Bios live per league, next to castPhotos: a commissioner writes them for
// their own league and nobody else sees them. Blank fields are dropped, and an
// all-blank bio removes the entry entirely.
export async function saveCastBio(leagueKey: string, contestantId: string, bio: CastBio) {
  const clean: CastBio = {};
  const hometown = clamp((bio.hometown ?? '').trim(), LIMITS.bioLine);
  const occupation = clamp((bio.occupation ?? '').trim(), LIMITS.bioLine);
  const about = clamp((bio.about ?? '').trim(), LIMITS.bioAbout);
  if (hometown) clean.hometown = hometown;
  if (occupation) clean.occupation = occupation;
  if (about) clean.about = about;
  await set(
    ref(rtdb, `${seasonPath()}/leagues/${leagueKey}/castBios/${contestantId}`),
    Object.keys(clean).length ? clean : null,
  );
}
