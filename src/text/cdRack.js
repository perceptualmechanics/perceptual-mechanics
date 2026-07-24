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
// Interaction, 2026-07-24: CDs open the same #library-panel every book and
// film already uses (an earlier click-to-pin tooltip with Apple Music/
// Spotify search-links was tried first and then dropped — Scott: "let's
// redo the CD info. Lose the tooltip, open a panel, and put either a music
// video or a live performance that's available on YouTube. I don't think
// we need the Apple Music/Spotify links any more."). Each entry below
// carries `video` (a short description of what the clip shows — mirrors
// `scene` on the film entries in library.js) and `youtube` (a real,
// verified video URL: an official music video where one exists, otherwise
// a genuine live performance of a song from that specific album — never a
// generic "best of" or an unrelated song). No search-links are generated
// anymore. Every URL below was pulled from an actual web search result,
// never fabricated — for a handful of older/scene-less tracks (ambient
// pieces, some jazz, some Krautrock) no traditional "video" exists, so the
// closest genuine real thing (a live performance, an official audio upload,
// or a documented archival video) was used instead.

export const cdRackItems = [
  // --- The Beatles (A Hard Day's Night onward) ---
  { id: 1, artist: 'The Beatles', album: "A Hard Day's Night", video: 'the title track, official music video', youtube: 'https://www.youtube.com/watch?v=70QfHtKdh_0' },
  { id: 2, artist: 'The Beatles', album: 'Beatles for Sale', video: '"Eight Days a Week," official music video', youtube: 'https://www.youtube.com/watch?v=kle2xHhRHg4' },
  { id: 3, artist: 'The Beatles', album: 'Help!', video: '"Help!," official remastered video', youtube: 'https://www.youtube.com/watch?v=CaBaWvLbJXY' },
  { id: 4, artist: 'The Beatles', album: 'Rubber Soul', video: '"Nowhere Man," restored stereo film clip', youtube: 'https://www.youtube.com/watch?v=5z6Jgo_wH3A' },
  { id: 5, artist: 'The Beatles', album: 'Revolver', video: '"Eleanor Rigby," official music video', youtube: 'https://www.youtube.com/watch?v=qE4Zc5VogoI' },
  { id: 6, artist: 'The Beatles', album: "Sgt. Pepper's Lonely Hearts Club Band", video: '"A Day in the Life," official music video', youtube: 'https://www.youtube.com/watch?v=usNsCeOV4GM' },
  { id: 7, artist: 'The Beatles', album: 'Magical Mystery Tour', video: '"I Am the Walrus," official music video', youtube: 'https://www.youtube.com/watch?v=Og-yjQGzIS8' },
  { id: 8, artist: 'The Beatles', album: 'The Beatles (White Album)', video: '"Back in the U.S.S.R.," 2018 mix video', youtube: 'https://www.youtube.com/watch?v=nS5_EQgbuLc' },
  { id: 9, artist: 'The Beatles', album: 'Yellow Submarine', video: '"Yellow Submarine," official music video', youtube: 'https://www.youtube.com/watch?v=m2uTFF_3MaA' },
  { id: 10, artist: 'The Beatles', album: 'Abbey Road', video: '"Here Comes the Sun," official music video', youtube: 'https://www.youtube.com/watch?v=KQetemT1sWc' },
  { id: 11, artist: 'The Beatles', album: 'Let It Be', video: '"Let It Be," official music video', youtube: 'https://www.youtube.com/watch?v=5WywXZ_G0EI' },

  // --- Led Zeppelin (full catalog) ---
  { id: 12, artist: 'Led Zeppelin', album: 'Led Zeppelin', video: '"Communication Breakdown," live at the Royal Albert Hall, 1970', youtube: 'https://www.youtube.com/watch?v=KqF3J8DpEb4' },
  { id: 13, artist: 'Led Zeppelin', album: 'Led Zeppelin II', video: '"Whole Lotta Love," official music video', youtube: 'https://www.youtube.com/watch?v=HQmmM_qwG4k' },
  { id: 14, artist: 'Led Zeppelin', album: 'Led Zeppelin III', video: '"Immigrant Song," live 1972, official video', youtube: 'https://www.youtube.com/watch?v=RlNhD0oS5pk' },
  { id: 15, artist: 'Led Zeppelin', album: 'Led Zeppelin IV', video: '"Stairway to Heaven," live at Earl\'s Court, 1975', youtube: 'https://www.youtube.com/watch?v=Ly6ZhQVnVow' },
  { id: 16, artist: 'Led Zeppelin', album: 'Houses of the Holy', video: '"The Song Remains the Same," live at Madison Square Garden, 1973', youtube: 'https://www.youtube.com/watch?v=DtVKz0rv4cg' },
  { id: 17, artist: 'Led Zeppelin', album: 'Physical Graffiti', video: '"Kashmir," live at Knebworth, 1979', youtube: 'https://www.youtube.com/watch?v=hW_WLxseq0o' },
  { id: 18, artist: 'Led Zeppelin', album: 'Presence', video: '"Achilles Last Stand," remastered official audio', youtube: 'https://www.youtube.com/watch?v=1t4KLOm7pO0' },
  { id: 19, artist: 'Led Zeppelin', album: 'In Through the Out Door', video: '"In the Evening," 1990 remaster', youtube: 'https://www.youtube.com/watch?v=bJSJavz1AOM' },
  { id: 20, artist: 'Led Zeppelin', album: 'Coda', video: '"Bonzo\'s Montreux," remastered', youtube: 'https://www.youtube.com/watch?v=C-l6dCBbW9w' },

  // --- Classic rock additions ---
  { id: 21, artist: 'Pink Floyd', album: 'The Dark Side of the Moon', video: '"Money," official music video', youtube: 'https://www.youtube.com/watch?v=-0kcet4aPpQ' },
  { id: 22, artist: 'The Who', album: "Who's Next", video: '"Baba O\'Riley," 1971 official video', youtube: 'https://www.youtube.com/watch?v=_8_Pf144Qmg' },
  { id: 23, artist: 'Cream', album: 'Disraeli Gears', video: '"Sunshine of Your Love," official video (HD)', youtube: 'https://www.youtube.com/watch?v=HbqQL0J_Vr0' },

  // --- Wilco lane ---
  { id: 24, artist: 'Wilco', album: 'Being There', video: '"Outtasite (Outta Mind)," official video — the band skydiving mid-song', youtube: 'https://www.youtube.com/watch?v=VLfYMgp_97s' },
  { id: 25, artist: 'Wilco', album: 'Summerteeth', video: '"Can\'t Stand It"', youtube: 'https://www.youtube.com/watch?v=pPqQ2AWShqc' },
  { id: 26, artist: 'Wilco', album: 'Yankee Hotel Foxtrot', video: '"I Am Trying to Break Your Heart"', youtube: 'https://www.youtube.com/watch?v=zlxH9-TYseY' },
  { id: 27, artist: 'Wilco', album: 'A Ghost Is Born', video: '"Spiders (Kidsmoke)"', youtube: 'https://www.youtube.com/watch?v=Yk541WmcoSg' },

  // --- R.E.M. lane ---
  { id: 28, artist: 'R.E.M.', album: 'Murmur', video: '"Radio Free Europe," the band\'s original 1983 video', youtube: 'https://www.youtube.com/watch?v=Ac0oaXhz1u8' },
  { id: 29, artist: 'R.E.M.', album: 'Document', video: '"The One I Love," official music video', youtube: 'https://www.youtube.com/watch?v=j7oQEPfe-O8' },
  { id: 30, artist: 'R.E.M.', album: 'Automatic for the People', video: '"Everybody Hurts," official HD music video', youtube: 'https://www.youtube.com/watch?v=5rOiW_xY-kc' },
  { id: 31, artist: 'R.E.M.', album: 'New Adventures in Hi-Fi', video: '"E-Bow the Letter," official video, featuring Patti Smith', youtube: 'https://www.youtube.com/watch?v=5cnIQHJ169s' },

  // --- Pixies (everything) ---
  { id: 32, artist: 'Pixies', album: 'Come On Pilgrim', video: '"Caribou," live performance', youtube: 'https://www.youtube.com/watch?v=55-Z10Wpvjk' },
  { id: 33, artist: 'Pixies', album: 'Surfer Rosa', video: '"Gigantic," live at VPRO Studios, 1988', youtube: 'https://www.youtube.com/watch?v=pDoQuFPGdjQ' },
  { id: 34, artist: 'Pixies', album: 'Doolittle', video: '"Here Comes Your Man," official music video', youtube: 'https://www.youtube.com/watch?v=tPgf_btTFlc' },
  { id: 35, artist: 'Pixies', album: 'Bossanova', video: '"Velouria," official music video', youtube: 'https://www.youtube.com/watch?v=nc0Mv4Iyxvc' },
  { id: 36, artist: 'Pixies', album: 'Trompe le Monde', video: '"Alec Eiffel," official music video', youtube: 'https://www.youtube.com/watch?v=rsMLjaloyvI' },

  // --- For Squirrels ---
  { id: 37, artist: 'For Squirrels', album: 'Example', video: '"Mighty K.C.," official music video', youtube: 'https://www.youtube.com/watch?v=yBbl3RpgNN4' },

  // --- Minimalism ---
  { id: 38, artist: 'Steve Reich', album: 'Music for 18 Musicians', video: 'full performance by eighth blackbird', youtube: 'https://www.youtube.com/watch?v=ZXJWO2FQ16c' },
  { id: 39, artist: 'John Adams', album: 'Harmonielehre', video: '"Short Ride in a Fast Machine," official score video', youtube: 'https://www.youtube.com/watch?v=qwa42YhCT2E' },
  { id: 40, artist: 'John Adams', album: 'Nixon in China', video: '"News Has a Kind of Mystery," live at the Met, 2011', youtube: 'https://www.youtube.com/watch?v=F54z2VUhXDc' },
  { id: 41, artist: 'John Adams', album: 'Shaker Loops', video: 'live performance, ChamberFest Cleveland, 2019', youtube: 'https://www.youtube.com/watch?v=XtvrzmzxkEk' },
  { id: 42, artist: 'John Adams', album: 'El Niño', video: 'live performance, Paris 2000, Kent Nagano conducting', youtube: 'https://www.youtube.com/watch?v=3hFSuGwl7jU' },
  { id: 43, artist: 'John Adams', album: 'Violin Concerto', video: 'Gidon Kremer with the London Symphony Orchestra', youtube: 'https://www.youtube.com/watch?v=uZNbNURtgpc' },
  { id: 44, artist: 'John Adams', album: 'Naive and Sentimental Music', video: 'LA Philharmonic, Esa-Pekka Salonen conducting', youtube: 'https://www.youtube.com/watch?v=1WtV7XJckBU' },
  { id: 45, artist: 'John Adams', album: 'The Dharma at Big Sur', video: 'Tracy Silverman, electric violin, live 2014', youtube: 'https://www.youtube.com/watch?v=d0JE7YaZf5Y' },

  // --- Electronic lane ---
  { id: 46, artist: 'Aphex Twin', album: 'Selected Ambient Works 85-92', video: '"Xtal," opening track', youtube: 'https://www.youtube.com/watch?v=Xw5AiRVqfqk' },
  { id: 47, artist: 'Aphex Twin', album: 'Selected Ambient Works Volume II', video: '"Blue Calx"', youtube: 'https://www.youtube.com/watch?v=2BhaRfkADKk' },
  { id: 48, artist: 'Aphex Twin', album: 'Richard D. James Album', video: '"Girl/Boy Song"', youtube: 'https://www.youtube.com/watch?v=WX562jnoRo0' },
  { id: 49, artist: 'Aphex Twin', album: 'Drukqs', video: '"Avril 14th," the well-known Disklavier piano piece', youtube: 'https://www.youtube.com/watch?v=3Z9A099ZjtI' },
  { id: 50, artist: 'Underworld', album: 'dubnobasswithmyheadman', video: '"Dark & Long," opening track', youtube: 'https://www.youtube.com/watch?v=9H66_PYTFBA' },
  { id: 51, artist: 'Underworld', album: 'Second Toughest in the Infants', video: '"Pearl\'s Girl"', youtube: 'https://www.youtube.com/watch?v=Q5GjVvlmg3o' },
  { id: 52, artist: 'Underworld', album: 'Beaucoup Fish', video: '"King of Snake," official music video', youtube: 'https://www.youtube.com/watch?v=_43N5XxXths' },
  { id: 53, artist: 'Underworld', album: 'Everything, Everything', video: '"Two Months Off," music video', youtube: 'https://www.youtube.com/watch?v=bSUb-Rx-37A' },

  // --- Hip-hop ---
  { id: 54, artist: 'Madvillain', album: 'Madvillainy', video: '"All Caps," official animated video', youtube: 'https://www.youtube.com/watch?v=QYZJyHEdmq4' },
  { id: 55, artist: 'Beastie Boys', album: 'Licensed to Ill', video: '"(You Gotta) Fight for Your Right (To Party)," official video', youtube: 'https://www.youtube.com/watch?v=eBShN8qT4lk' },
  { id: 56, artist: 'Beastie Boys', album: "Paul's Boutique", video: '"Hey Ladies," music video', youtube: 'https://www.youtube.com/watch?v=AKiVlU2zKdY' },
  { id: 57, artist: 'Beastie Boys', album: 'Check Your Head', video: '"So What\'cha Want," music video', youtube: 'https://www.youtube.com/watch?v=LEslUnPBUpI' },
  { id: 58, artist: 'Beastie Boys', album: 'Ill Communication', video: '"Sabotage," official video, directed by Spike Jonze', youtube: 'https://www.youtube.com/watch?v=z5rRZdiu1UE' },

  // --- Grunge / alt ---
  { id: 59, artist: 'Nirvana', album: 'Bleach', video: '"About a Girl"', youtube: 'https://www.youtube.com/watch?v=AjrlWA2yWtU' },
  { id: 60, artist: 'Nirvana', album: 'Nevermind', video: '"Smells Like Teen Spirit," official music video', youtube: 'https://www.youtube.com/watch?v=hTWKbfoikeg' },
  { id: 61, artist: 'Nirvana', album: 'In Utero', video: '"Heart-Shaped Box," directed by Anton Corbijn', youtube: 'https://www.youtube.com/watch?v=8eGY-4OALgM' },
  { id: 62, artist: 'Nirvana', album: 'Incesticide', video: '"Sliver," official music video', youtube: 'https://www.youtube.com/watch?v=QECJ9pCyhns' },
  { id: 63, artist: 'Nirvana', album: 'MTV Unplugged in New York', video: '"Where Did You Sleep Last Night," live on MTV Unplugged, 1993', youtube: 'https://www.youtube.com/watch?v=hEMm7gxBYSc' },
  { id: 64, artist: 'Soundgarden', album: 'Superunknown', video: '"Black Hole Sun," official music video', youtube: 'https://www.youtube.com/watch?v=haeoUzvcl_M' },
  { id: 65, artist: 'Meat Puppets', album: 'Meat Puppets II', video: '"Plateau," live at WFUV', youtube: 'https://www.youtube.com/watch?v=_-xLsGOekk8' },
  { id: 66, artist: 'Smashing Pumpkins', album: 'Gish', video: '"I Am One," official music video', youtube: 'https://www.youtube.com/watch?v=Pi6RJmUNBbw' },

  // --- Shoegaze / Manchester ---
  { id: 67, artist: 'My Bloody Valentine', album: 'Loveless', video: '"Only Shallow," official music video', youtube: 'https://www.youtube.com/watch?v=FyYMzEplnfU' },
  { id: 68, artist: 'Ride', album: 'Nowhere', video: '"Vapour Trail," music video', youtube: 'https://www.youtube.com/watch?v=pVhNi5cU8mo' },
  { id: 69, artist: 'The Stone Roses', album: 'The Stone Roses', video: '"She Bangs the Drums," official video', youtube: 'https://www.youtube.com/watch?v=wD6Pq0bSMPo' },

  // --- Jazz ---
  { id: 70, artist: 'Miles Davis', album: 'Kind of Blue', video: '"So What," live in 1959 with John Coltrane', youtube: 'https://www.youtube.com/watch?v=6w4FI0Jq0lI' },
  { id: 71, artist: 'Miles Davis', album: 'In a Silent Way', video: 'live performance, Paris 1991', youtube: 'https://www.youtube.com/watch?v=H47xNRBZcDM' },
  { id: 72, artist: 'John Coltrane', album: 'A Love Supreme', video: 'the only complete live performance of the suite, Antibes, 1965', youtube: 'https://www.youtube.com/watch?v=RlrQZc3h13E' },
  { id: 73, artist: 'Charles Mingus', album: 'Mingus Ah Um', video: '"Better Git It in Your Soul"', youtube: 'https://www.youtube.com/watch?v=E7hoX7golZI' },
  { id: 74, artist: 'Herbie Hancock', album: 'Head Hunters', video: '"Chameleon," live on The Midnight Special, 1975', youtube: 'https://www.youtube.com/watch?v=j6u4mPYpLwY' },
  { id: 75, artist: 'Mahavishnu Orchestra', album: 'The Inner Mounting Flame', video: 'full album, opening with "Meeting of the Spirits"', youtube: 'https://www.youtube.com/watch?v=5ofh_S52Uks' },
  { id: 76, artist: 'Weather Report', album: 'Heavy Weather', video: '"Birdland"', youtube: 'https://www.youtube.com/watch?v=rI87xvv-OJE' },

  // --- Post-rock / trip-hop / other ---
  { id: 77, artist: 'Tortoise', album: 'TNT', video: 'the album performed live in full, 21st-anniversary set', youtube: 'https://www.youtube.com/watch?v=EwJf5fw57Yo' },
  { id: 78, artist: 'Massive Attack', album: 'Mezzanine', video: '"Teardrop," official music video', youtube: 'https://www.youtube.com/watch?v=u7K72X4eo_s' },
  { id: 79, artist: 'Tricky', album: 'Maxinquaye', video: '"Overcome," official music video', youtube: 'https://www.youtube.com/watch?v=ViHiOopNTlc' },
  { id: 80, artist: 'Pavement', album: 'Crooked Rain, Crooked Rain', video: '"Cut Your Hair," official music video', youtube: 'https://www.youtube.com/watch?v=QTTgpTeb0Z8' },
  { id: 81, artist: 'Unwound', album: 'Leaves Turn Inside You', video: '"Scarlette," official music video', youtube: 'https://www.youtube.com/watch?v=i26fk32ilTg' },
  { id: 82, artist: 'Prince', album: 'Parade', video: '"Kiss," official music video', youtube: 'https://www.youtube.com/watch?v=H9tEvfIsDyo' },
  { id: 83, artist: 'Prince', album: "Sign O' The Times", video: 'the title track, official music video', youtube: 'https://www.youtube.com/watch?v=8EdxM72EZ94' },
  { id: 84, artist: 'David Bowie', album: 'Blackstar', video: 'the title track, official music video', youtube: 'https://www.youtube.com/watch?v=kszLwBaC4Sw' },
  { id: 85, artist: 'Mastodon', album: 'Crack the Skye', video: '"Oblivion," official music video', youtube: 'https://www.youtube.com/watch?v=s6WGNd8QR-U' },
  { id: 86, artist: 'The Police', album: 'Synchronicity', video: '"Every Breath You Take," official music video', youtube: 'https://www.youtube.com/watch?v=OMOGaugKpzs' },
  { id: 87, artist: 'The Police', album: 'Ghost in the Machine', video: '"Spirits in the Material World," official music video', youtube: 'https://www.youtube.com/watch?v=BHOevX4DlGk' },

  // --- Prog / Britpop / art-pop ---
  { id: 88, artist: 'King Crimson', album: 'Red', video: '"Starless"', youtube: 'https://www.youtube.com/watch?v=OfR6_V91fG8' },
  { id: 89, artist: 'Genesis', album: 'Duke', video: '"Turn It On Again," official music video', youtube: 'https://www.youtube.com/watch?v=8OIkw9kJ0u4' },
  { id: 90, artist: 'XTC', album: 'Skylarking', video: '"Dear God," official music video', youtube: 'https://www.youtube.com/watch?v=p554R-Jq43A' },
  { id: 91, artist: 'XTC', album: 'Oranges and Lemons', video: '"The Mayor of Simpleton," official music video', youtube: 'https://www.youtube.com/watch?v=203_dp6MyY4' },
  { id: 92, artist: 'XTC', album: 'Apple Venus Volume 1', video: '"I\'d Like That"', youtube: 'https://www.youtube.com/watch?v=ordG_YjxgjI' },
  { id: 93, artist: 'Blur', album: 'Parklife', video: 'the title track, official music video', youtube: 'https://www.youtube.com/watch?v=YSuHrTfcikU' },
  { id: 94, artist: 'Blur', album: 'Blur', video: '"Song 2," official music video', youtube: 'https://www.youtube.com/watch?v=Wc18xt5wQnk' },
  { id: 95, artist: 'Blur', album: '13', video: '"Coffee & TV," official music video', youtube: 'https://www.youtube.com/watch?v=6oqXVx3sBOk' },
  { id: 96, artist: 'Björk', album: 'Homogenic', video: '"Jóga," official music video, directed by Michel Gondry', youtube: 'https://www.youtube.com/watch?v=2BSMcVRgloY' },
  { id: 97, artist: 'Beck', album: 'Odelay', video: '"Where It\'s At," official music video', youtube: 'https://www.youtube.com/watch?v=EPfmNxKLDG4' },
  { id: 98, artist: 'Beck', album: 'Midnite Vultures', video: '"Mixed Bizness," official music video', youtube: 'https://www.youtube.com/watch?v=OdqKQRhi6qU' },

  // --- Ambient / downtempo / krautrock (round added late) ---
  { id: 99, artist: 'Brian Eno', album: 'Music for Airports', video: '"1/1," opening movement', youtube: 'https://www.youtube.com/watch?v=LKZ3fGR2SDY' },
  { id: 100, artist: 'Brian Eno', album: 'Another Green World', video: '"St. Elmo\'s Fire," featuring Robert Fripp', youtube: 'https://www.youtube.com/watch?v=B807CcVxW9U' },
  { id: 101, artist: 'BT', album: 'If the Stars Are Eternal So Are You and I', video: '"13 Angels on My Broken Windowsill," official video', youtube: 'https://www.youtube.com/watch?v=Rrj74AZ0l5Q' },
  { id: 102, artist: 'Can', album: 'Future Days', video: '"Moonshake"', youtube: 'https://www.youtube.com/watch?v=JAdNjKAAj_o' },
  { id: 103, artist: 'The Cardigans', album: 'Gran Turismo', video: '"My Favourite Game," official music video', youtube: 'https://www.youtube.com/watch?v=3bc1z1Fpneg' },
  { id: 104, artist: 'Caribou', album: 'Up in Flames', video: '"Hendrix with Ko" (as Manitoba)', youtube: 'https://www.youtube.com/watch?v=TryR9xMJzfU' },
  { id: 105, artist: 'Catherine Wheel', album: 'Chrome', video: '"Crank," official music video', youtube: 'https://www.youtube.com/watch?v=nosA0sx4xpo' },
  { id: 106, artist: 'Catherine Wheel', album: 'Ferment', video: '"Black Metallic," official music video', youtube: 'https://www.youtube.com/watch?v=s27SCT2cYwA' },
  { id: 107, artist: 'Cheb i Sabbah', album: 'Shri Durga', video: 'the title track', youtube: 'https://www.youtube.com/watch?v=xatGV8ZnN8Q' },
  { id: 108, artist: 'Cocteau Twins', album: 'Blue Bell Knoll', video: '"Carolyn\'s Fingers," official music video', youtube: 'https://www.youtube.com/watch?v=NhGoZLudKyk' },
  { id: 109, artist: 'Deerhunter', album: 'Halcyon Digest', video: '"Helicopter," official music video', youtube: 'https://www.youtube.com/watch?v=G5RzpPrOd-4' },
  { id: 110, artist: 'Interpol', album: 'Turn On the Bright Lights', video: '"Obstacle 1," directed by Floria Sigismondi', youtube: 'https://www.youtube.com/watch?v=OC5zHACynR4' },
  { id: 111, artist: 'DJ Shadow', album: 'Endtroducing.....', video: '"Midnight in a Perfect World," official music video', youtube: 'https://www.youtube.com/watch?v=mSEj9eUq5YU' },
  { id: 112, artist: 'Kruder & Dorfmeister', album: 'The K&D Sessions', video: '"High Noon," official music video', youtube: 'https://www.youtube.com/watch?v=-hxZ0fcsGzw' },

  // --- Last confirmed round ---
  { id: 113, artist: 'Lush', album: 'Gala', video: '"Sweetness and Light," official music video', youtube: 'https://www.youtube.com/watch?v=u7cqkpy4QrQ' },
  { id: 114, artist: 'Built to Spill', album: 'Keep It Like a Secret', video: '"Carry the Zero," the band\'s best-known song', youtube: 'https://www.youtube.com/watch?v=MEeolUZeW9M' },
];
