// Castaway facts only: hometown, residence, occupation. The CBS cast Q&A text,
// "three words" answers and official YouTube shorts from the private Outlast
// app are deliberately left out: they belong to CBS.
export type Bio = {
  hometown: string;
  residence: string;
  occupation: string;
};

export const bios: Record<string, Bio> = {
  "aaliyah": {
    "hometown": "Gloucester City, NJ",
    "residence": "Providence, RI",
    "occupation": "Chef"
  },
  "alexis": {
    "hometown": "Atlanta, GA",
    "residence": "Atlanta, GA",
    "occupation": "Criminal defense attorney"
  },
  "thienan": {
    "hometown": "Fort Worth, TX",
    "residence": "Fort Worth, TX",
    "occupation": "Medical student"
  },
  "ana": {
    "hometown": "Richmond Hill, Ontario, Canada",
    "residence": "Toronto, Ontario, Canada",
    "occupation": "Voice actress"
  },
  "jelly": {
    "hometown": "Garland, TX and Midwest City, OK",
    "residence": "Bloomington, IN",
    "occupation": "Sociology professor"
  },
  "brady": {
    "hometown": "La Salle, IL",
    "residence": "Knoxville, TN",
    "occupation": "Pro wrestler"
  },
  "carter": {
    "hometown": "Rock Rapids, IA",
    "residence": "Sioux Falls, SD",
    "occupation": "Livestock farmer"
  },
  "cristian": {
    "hometown": "Salt Lake City, UT",
    "residence": "Salt Lake City, UT",
    "occupation": "Head of HR"
  },
  "danny": {
    "hometown": "Mount Forest, Ontario, Canada",
    "residence": "London, Ontario, Canada",
    "occupation": "Game designer"
  },
  "devin": {
    "hometown": "Lufkin, TX",
    "residence": "Los Angeles, CA",
    "occupation": "Actor"
  },
  "eric": {
    "hometown": "Lincoln, RI",
    "residence": "Windsor Locks, CT",
    "occupation": "Mental health counselor"
  },
  "jenna": {
    "hometown": "Perrysburg, OH",
    "residence": "Toledo, OH",
    "occupation": "Wedding photographer"
  },
  "kristin": {
    "hometown": "Ketchum, ID",
    "residence": "Santa Barbara, CA",
    "occupation": "Crisis management"
  },
  "lewis": {
    "hometown": "Dublin, Ireland",
    "residence": "Puerto Rico",
    "occupation": "Farmer"
  },
  "linnea": {
    "hometown": "Kearny, NJ",
    "residence": "Jersey City, NJ",
    "occupation": "Entrepreneur"
  },
  "maggie": {
    "hometown": "Middleway, WV",
    "residence": "Charlestown, WV",
    "occupation": "Farmer"
  },
  "mike": {
    "hometown": "New York City, NY",
    "residence": "New York City, NY",
    "occupation": "Baseball executive"
  },
  "ori": {
    "hometown": "Spring Valley, NY",
    "residence": "Spring Valley, NY",
    "occupation": "Personal trainer"
  },
  "patt": {
    "hometown": "Tampa, FL",
    "residence": "Washington, D.C.",
    "occupation": "Federal prosecutor"
  },
  "rob": {
    "hometown": "Johnston, RI",
    "residence": "Cumberland, RI",
    "occupation": "Airline gate agent"
  },
  "sharonda": {
    "hometown": "Pompano Beach, FL",
    "residence": "Richmond, KY",
    "occupation": "Resident, OBGYN"
  }
};
