// Field size caps, mirrored from `Survivor League/database.rules.json`.
//
// These are NOT cosmetic. Every draft pick is a transaction that writes a
// whole subtree of the league record back to the database, and Realtime
// Database runs .validate against every node in what gets written — not just
// the parts that changed. So a single over-length string anywhere in that
// subtree makes the write fail, and the draft stops for everyone until the bad
// value is found and removed. That has happened: one chat message over 1000
// characters, and no pick would commit.
//
// Keeping a copy of the limits here lets the UI stop the value at the keyboard
// instead of letting the database refuse it later. If a number changes in the
// rules, change it here too — and in the website's app.js, which has its own
// copy for the same reason.
export const LIMITS = {
  messageText: 1000,   // league/messages/$lg/$id/text
  episodeRecap: 5000,  // league/episodeNotes/$week
  personName: 60,      // league/leagues/$lg/players/$i/name, and members
  leaderboardName: 20, // league/{puzzle,memory}Scores — matches the website's input
  boardNote: 2000,     // draftBoards/$lg/$personId/notes/$contestantId
  gifUrl: 500,         // league/messages/$lg/$id/gif/{url,preview}
  tribeName: 30,       // league/tribes/$id/name
  episodeTitle: 80,    // league/episodeTitles/$week
  bioLine: 100,        // seasons/$s/leagues/$lg/castBios/$id/{hometown,occupation}
  bioAbout: 2000,      // seasons/$s/leagues/$lg/castBios/$id/about
} as const;

// Trim to the cap without splitting a surrogate pair, which would leave a lone
// half of an emoji at the end. Firebase counts UTF-16 code units, the same
// units String.length counts, so the check and the cap agree.
export function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  // High surrogate with nothing after it: drop it.
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}
