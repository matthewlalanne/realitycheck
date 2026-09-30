---
name: amazing-race-recap
description: Write the Amazing Race 39 episode recap and results draft for Reality Check and file it where the episode editor offers "Load draft". Use after an episode airs, when asked for the AR recap/draft, or from the weekly scheduled task.
---

# Amazing Race recap draft

Produces two things for one leg of The Amazing Race 39 and files them at
`recapDrafts/amazing-race-39/<ep>`:

1. **The recap** the league reads.
2. **The results** (eliminated team, leg winner, non-elimination) the editor
   pre-fills.

Nothing reaches the league until an admin (Matt or Courtney) opens
Settings > Show admin > Manage episodes, taps the episode, taps **Load draft**,
checks it and saves.

## Rules

| Rule | What it means |
|---|---|
| Never make anything up | A fact goes in only if two independent recaps agree, or CBS or Wikipedia states it. Anything unconfirmed is left `null` and listed in `needsMatt` with why. |
| Research first | Always search the web for this episode. Never write from memory. Keep the links used in `sources`. |
| Explain once | Explain a race term (Detour, Roadblock, U-Turn, Express Pass, Yield, Speed Bump, Pit Stop, non-elimination leg, Double Leg, etc.) the first time it comes up this season. Terms already explained are in `data/amazing-race-39-explained.json`; add new ones there after filing. |
| Format | Title line with 🔥. Then short sections with one emoji and an ALL CAPS header each. Build suspense before revealing who was eliminated. End with 👀 WHAT TO WATCH. |
| Voice | Casual, like texting friends, light humor. No "lol", no em dashes, not many emojis. |
| Length | About 2,500 to 3,000 characters. Never over 5,000 (the database refuses it). |
| No spoilers past this leg | Only what aired in this episode. Nothing from previews of later episodes except in WHAT TO WATCH, and only what CBS aired as the preview. |

Suggested sections (skip any that didn't happen): 🌍 WHERE THEY WENT,
🧩 THE DETOUR, 🏃 THE ROADBLOCK, ⚡ EXPRESS PASS / U-TURN, 🏁 THE PIT STOP,
👋 WHO'S OUT, 👀 WHAT TO WATCH.

## Steps

1. **Which episode.** The one asked for. When run on a schedule: every aired
   episode that has neither a draft (`recapDrafts/amazing-race-39/<ep>`) nor a
   published recap (`seasons/amazing-race-39/episodeNotes/<ep>`), oldest first.
   If recaps for an episode aren't online yet, skip it and say so. Air dates are
   in `data/amazing-race-39.json`. Episode numbers are broadcast episodes,
   not leg numbers; if an episode is a double leg, cover both and say so.
2. **Research.** Search for "Amazing Race 39 episode N recap" and the leg's
   Wikipedia results table. Aim for 3+ sources: CBS, Wikipedia, and
   recaps (e.g. TVLine, EW, Parade, Gold Derby, Reality Blurred).
3. **Map teams to ids.** Use only these ids (from `data/amazing-race-39.json`):

   | id | Team |
   |---|---|
   | krieger-lohman | Ali & Joanna |
   | tejcek | Ann-Marie & Riley |
   | tager | Anuar & Andrea |
   | langlois-tribo | Cody & Jaime |
   | wilson-mcguire | Conner & Garrett |
   | dunmore | Dafina & Saran |
   | wilks-hamby | Daisha & Dalton |
   | matter | Doug & Dylan |
   | taylor-vintimilla | Erin & Javi |
   | rebhun-naso | Jody & Jenn |
   | schultz | Katie & Charlotte |
   | patterson | Michelle & Matthew |
   | johnson | Zach & Nate |

   If the file and the sources disagree on a team, stop and put it in
   `needsMatt`.
4. **Write the recap** to a scratch file, title as the first line.
5. **Write the stats JSON** to a scratch file, exactly this shape:

   ```json
   {
     "show": "amazing-race",
     "episode": 1,
     "title": "Episode title as CBS lists it, or null",
     "eliminated": ["team-id"],
     "legWinner": "team-id",
     "nonElimination": false,
     "savedLast": null,
     "needsMatt": ["Anything left null, and why"],
     "sources": ["https://..."]
   }
   ```

   - `eliminated`: `[]` on a non-elimination leg; `null` if unconfirmed.
     Double leg: every team eliminated in the episode.
   - `legWinner`: first to check in. Double leg: the winner of the last leg,
     and name the other winner in `needsMatt`.
   - `nonElimination` / `savedLast`: `true` and the last team's id when the
     last team stayed in. Otherwise `false` and `null`.
   - A team that quit or withdrew for medical reasons goes in `eliminated`
     and in `needsMatt` ("mark X as quit/withdrew").
6. **File it:** `scripts/write-recap-draft.sh amazing-race-39 <ep> <recap.txt> <stats.json>`.
   Needs the Firebase CLI logged in to `tribe-league-app` (or `FIREBASE_TOKEN`
   set). If it can't write, say so and paste the recap and JSON instead.
7. **Update** `data/amazing-race-39-explained.json` with any terms explained
   this time, commit it and push it to `main` (the next run reads it from there).
8. **Report back** in a short table: episode, eliminated, leg winner,
   what needs Matt, and the link to the sources.
