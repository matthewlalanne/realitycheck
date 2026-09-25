// Real Survivor 51 cast + league data, pulled from the web site (league-data.js
// and the live Porterville picks) so the app has something real to look at
// instead of placeholder names. Private-device testing only — see the note in
// chat about swapping these for original art/bios before this ever goes public.

export type Contestant = {
  id: string;
  name: string;
  age: number;
  from: string;
  eliminatedWeek: number | null;
  exitReason?: 'voted' | 'quit';
};

// No bundled castaway photos: they're CBS's. See components/CastAvatar.tsx.


export const contestants: Contestant[] = [
  { id: 'rob', name: 'Rob Antonson', age: 40, from: 'Cumberland, RI', eliminatedWeek: null },
  { id: 'brady', name: 'Brady Booker', age: 27, from: 'Knoxville, TN', eliminatedWeek: null },
  { id: 'patt', name: 'Patt Cannaday', age: 33, from: 'Washington, D.C.', eliminatedWeek: null },
  { id: 'linnea', name: 'Linnea Capobianco', age: 25, from: 'Jersey City, NJ', eliminatedWeek: null },
  { id: 'cristian', name: 'Cristian Chavez', age: 26, from: 'Salt Lake City, UT', eliminatedWeek: null },
  { id: 'sharonda', name: 'Sharonda Cox', age: 34, from: 'Richmond, KY', eliminatedWeek: null },
  { id: 'jenna', name: 'Jenna Doore', age: 30, from: 'Toledo, OH', eliminatedWeek: null },
  { id: 'kristin', name: 'Kristin Flickinger', age: 49, from: 'Santa Barbara, CA', eliminatedWeek: null },
  { id: 'ori', name: 'Ori Jean-Charles', age: 27, from: 'Spring Valley, NY', eliminatedWeek: null },
  { id: 'lewis', name: 'Lewis Kelly', age: 28, from: 'Corozal, PR', eliminatedWeek: null },
  { id: 'danny', name: 'Danny Kilby', age: 30, from: 'London, ON', eliminatedWeek: null },
  { id: 'carter', name: 'Carter Krull', age: 24, from: 'Sioux Falls, SD', eliminatedWeek: null },
  { id: 'alexis', name: 'Alexis Levine', age: 34, from: 'Atlanta, GA', eliminatedWeek: null },
  { id: 'jelly', name: 'Angelica "Jelly" Loblack', age: 29, from: 'Bloomington, IN', eliminatedWeek: null },
  { id: 'eric', name: 'Eric Macksoud', age: 34, from: 'Windsor Locks, CT', eliminatedWeek: null },
  { id: 'maggie', name: 'Maggie Nestor', age: 40, from: 'Charles Town, WV', eliminatedWeek: null },
  { id: 'thienan', name: 'An "Thien An" Nguyen', age: 24, from: 'Fort Worth, TX', eliminatedWeek: null },
  { id: 'mike', name: 'Mike Pinsky', age: 32, from: 'New York City, NY', eliminatedWeek: null },
  { id: 'aaliyah', name: 'Aaliyah Puglia', age: 24, from: 'Providence, RI', eliminatedWeek: null },
  { id: 'ana', name: 'Ana Sani', age: 34, from: 'Toronto, ON', eliminatedWeek: null },
  { id: 'devin', name: 'Devin Way', age: 33, from: 'Los Angeles, CA', eliminatedWeek: null },
];

// League/player/picks data now lives in Firestore (see lib/leagues.ts and
// contexts/LeagueContext.tsx) — real accounts, real leagues, no more mock
// standings here. Only the show's own cast data (static either way) stays.
