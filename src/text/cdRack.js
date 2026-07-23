// CD rack catalog — perceptualmechanics.com library scene.
//
// Unlike the bookshelf (src/text/library.js), this collection is NOT catalogued
// from a real physical shelf. Scott doesn't own any of these CDs anymore; this
// is an invented-but-plausible "collection I wish I still had" built up together,
// album by album, across a long conversation. Every entry below was explicitly
// requested, accepted, or left unobjected-to by Scott during that dictation —
// nothing here is filler invented unilaterally.
//
// Per the site's hard convention (see scenes/library.js header), there is no
// real cover art anywhere in this scene — CD spines are canvas-drawn schematic
// textures only, artist/album as plain text.
//
// Interaction model is intentionally lighter than the books: no click-to-panel,
// no excerpts/credits/cross-links. Just a hover (or tap) tooltip with artist,
// album, and search-deep-links to Apple Music and Spotify — generated at
// render time from the artist/album strings below, not stored here.

export const cdRackItems = [
  // --- The Beatles (A Hard Day's Night onward) ---
  { id: 1, artist: 'The Beatles', album: "A Hard Day's Night" },
  { id: 2, artist: 'The Beatles', album: 'Beatles for Sale' },
  { id: 3, artist: 'The Beatles', album: 'Help!' },
  { id: 4, artist: 'The Beatles', album: 'Rubber Soul' },
  { id: 5, artist: 'The Beatles', album: 'Revolver' },
  { id: 6, artist: 'The Beatles', album: "Sgt. Pepper's Lonely Hearts Club Band" },
  { id: 7, artist: 'The Beatles', album: 'Magical Mystery Tour' },
  { id: 8, artist: 'The Beatles', album: 'The Beatles (White Album)' },
  { id: 9, artist: 'The Beatles', album: 'Yellow Submarine' },
  { id: 10, artist: 'The Beatles', album: 'Abbey Road' },
  { id: 11, artist: 'The Beatles', album: 'Let It Be' },

  // --- Led Zeppelin (full catalog) ---
  { id: 12, artist: 'Led Zeppelin', album: 'Led Zeppelin' },
  { id: 13, artist: 'Led Zeppelin', album: 'Led Zeppelin II' },
  { id: 14, artist: 'Led Zeppelin', album: 'Led Zeppelin III' },
  { id: 15, artist: 'Led Zeppelin', album: 'Led Zeppelin IV' },
  { id: 16, artist: 'Led Zeppelin', album: 'Houses of the Holy' },
  { id: 17, artist: 'Led Zeppelin', album: 'Physical Graffiti' },
  { id: 18, artist: 'Led Zeppelin', album: 'Presence' },
  { id: 19, artist: 'Led Zeppelin', album: 'In Through the Out Door' },
  { id: 20, artist: 'Led Zeppelin', album: 'Coda' },

  // --- Classic rock additions ---
  { id: 21, artist: 'Pink Floyd', album: 'The Dark Side of the Moon' },
  { id: 22, artist: 'The Who', album: "Who's Next" },
  { id: 23, artist: 'Cream', album: 'Disraeli Gears' },

  // --- Wilco lane ---
  { id: 24, artist: 'Wilco', album: 'Being There' },
  { id: 25, artist: 'Wilco', album: 'Summerteeth' },
  { id: 26, artist: 'Wilco', album: 'Yankee Hotel Foxtrot' },
  { id: 27, artist: 'Wilco', album: 'A Ghost Is Born' },

  // --- R.E.M. lane ---
  { id: 28, artist: 'R.E.M.', album: 'Murmur' },
  { id: 29, artist: 'R.E.M.', album: 'Document' },
  { id: 30, artist: 'R.E.M.', album: 'Automatic for the People' },
  { id: 31, artist: 'R.E.M.', album: 'New Adventures in Hi-Fi' },

  // --- Pixies (everything) ---
  { id: 32, artist: 'Pixies', album: 'Come On Pilgrim' },
  { id: 33, artist: 'Pixies', album: 'Surfer Rosa' },
  { id: 34, artist: 'Pixies', album: 'Doolittle' },
  { id: 35, artist: 'Pixies', album: 'Bossanova' },
  { id: 36, artist: 'Pixies', album: 'Trompe le Monde' },

  // --- For Squirrels ---
  { id: 37, artist: 'For Squirrels', album: 'Example' },

  // --- Minimalism ---
  { id: 38, artist: 'Steve Reich', album: 'Music for 18 Musicians' },
  { id: 39, artist: 'John Adams', album: 'Harmonielehre' },
  { id: 40, artist: 'John Adams', album: 'Nixon in China' },
  { id: 41, artist: 'John Adams', album: 'Shaker Loops' },
  { id: 42, artist: 'John Adams', album: 'El Niño' },
  { id: 43, artist: 'John Adams', album: 'Violin Concerto' },
  { id: 44, artist: 'John Adams', album: 'Naive and Sentimental Music' },
  { id: 45, artist: 'John Adams', album: 'The Dharma at Big Sur' },

  // --- Electronic lane ---
  { id: 46, artist: 'Aphex Twin', album: 'Selected Ambient Works 85-92' },
  { id: 47, artist: 'Aphex Twin', album: 'Selected Ambient Works Volume II' },
  { id: 48, artist: 'Aphex Twin', album: 'Richard D. James Album' },
  { id: 49, artist: 'Aphex Twin', album: 'Drukqs' },
  { id: 50, artist: 'Underworld', album: 'dubnobasswithmyheadman' },
  { id: 51, artist: 'Underworld', album: 'Second Toughest in the Infants' },
  { id: 52, artist: 'Underworld', album: 'Beaucoup Fish' },
  { id: 53, artist: 'Underworld', album: 'Everything, Everything' },

  // --- Hip-hop ---
  { id: 54, artist: 'Madvillain', album: 'Madvillainy' },
  { id: 55, artist: 'Beastie Boys', album: 'Licensed to Ill' },
  { id: 56, artist: 'Beastie Boys', album: "Paul's Boutique" },
  { id: 57, artist: 'Beastie Boys', album: 'Check Your Head' },
  { id: 58, artist: 'Beastie Boys', album: 'Ill Communication' },

  // --- Grunge / alt ---
  { id: 59, artist: 'Nirvana', album: 'Bleach' },
  { id: 60, artist: 'Nirvana', album: 'Nevermind' },
  { id: 61, artist: 'Nirvana', album: 'In Utero' },
  { id: 62, artist: 'Nirvana', album: 'Incesticide' },
  { id: 63, artist: 'Nirvana', album: 'MTV Unplugged in New York' },
  { id: 64, artist: 'Soundgarden', album: 'Superunknown' },
  { id: 65, artist: 'Meat Puppets', album: 'Meat Puppets II' },
  { id: 66, artist: 'Smashing Pumpkins', album: 'Gish' },

  // --- Shoegaze / Manchester ---
  { id: 67, artist: 'My Bloody Valentine', album: 'Loveless' },
  { id: 68, artist: 'Ride', album: 'Nowhere' },
  { id: 69, artist: 'The Stone Roses', album: 'The Stone Roses' },

  // --- Jazz ---
  { id: 70, artist: 'Miles Davis', album: 'Kind of Blue' },
  { id: 71, artist: 'Miles Davis', album: 'In a Silent Way' },
  { id: 72, artist: 'John Coltrane', album: 'A Love Supreme' },
  { id: 73, artist: 'Charles Mingus', album: 'Mingus Ah Um' },
  { id: 74, artist: 'Herbie Hancock', album: 'Head Hunters' },
  { id: 75, artist: 'Mahavishnu Orchestra', album: 'The Inner Mounting Flame' },
  { id: 76, artist: 'Weather Report', album: 'Heavy Weather' },

  // --- Post-rock / trip-hop / other ---
  { id: 77, artist: 'Tortoise', album: 'TNT' },
  { id: 78, artist: 'Massive Attack', album: 'Mezzanine' },
  { id: 79, artist: 'Tricky', album: 'Maxinquaye' },
  { id: 80, artist: 'Pavement', album: 'Crooked Rain, Crooked Rain' },
  { id: 81, artist: 'Unwound', album: 'Leaves Turn Inside You' },
  { id: 82, artist: 'Prince', album: 'Parade' },
  { id: 83, artist: 'Prince', album: "Sign O' The Times" },
  { id: 84, artist: 'David Bowie', album: 'Blackstar' },
  { id: 85, artist: 'Mastodon', album: 'Crack the Skye' },
  { id: 86, artist: 'The Police', album: 'Synchronicity' },
  { id: 87, artist: 'The Police', album: 'Ghost in the Machine' },

  // --- Prog / Britpop / art-pop ---
  { id: 88, artist: 'King Crimson', album: 'Red' },
  { id: 89, artist: 'Genesis', album: 'Duke' },
  { id: 90, artist: 'XTC', album: 'Skylarking' },
  { id: 91, artist: 'XTC', album: 'Oranges and Lemons' },
  { id: 92, artist: 'XTC', album: 'Apple Venus Volume 1' },
  { id: 93, artist: 'Blur', album: 'Parklife' },
  { id: 94, artist: 'Blur', album: 'Blur' },
  { id: 95, artist: 'Blur', album: '13' },
  { id: 96, artist: 'Björk', album: 'Homogenic' },
  { id: 97, artist: 'Beck', album: 'Odelay' },
  { id: 98, artist: 'Beck', album: 'Midnite Vultures' },

  // --- Ambient / downtempo / krautrock (round added late) ---
  { id: 99, artist: 'Brian Eno', album: 'Music for Airports' },
  { id: 100, artist: 'Brian Eno', album: 'Another Green World' },
  { id: 101, artist: 'BT', album: 'If the Stars Are Eternal So Are You and I' },
  { id: 102, artist: 'Can', album: 'Future Days' },
  { id: 103, artist: 'The Cardigans', album: 'Gran Turismo' },
  { id: 104, artist: 'Caribou', album: 'Up in Flames' },
  { id: 105, artist: 'Catherine Wheel', album: 'Chrome' },
  { id: 106, artist: 'Catherine Wheel', album: 'Ferment' },
  { id: 107, artist: 'Cheb i Sabbah', album: 'Shri Durga' },
  { id: 108, artist: 'Cocteau Twins', album: 'Blue Bell Knoll' },
  { id: 109, artist: 'Deerhunter', album: 'Halcyon Digest' },
  { id: 110, artist: 'Interpol', album: 'Turn On the Bright Lights' },
  { id: 111, artist: 'DJ Shadow', album: 'Endtroducing.....' },
  { id: 112, artist: 'Kruder & Dorfmeister', album: 'The K&D Sessions' },

  // --- Last confirmed round ---
  { id: 113, artist: 'Lush', album: 'Gala' },
  { id: 114, artist: 'Built to Spill', album: 'Keep It Like a Secret' },
];
