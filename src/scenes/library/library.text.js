// One scene, one text file. The two catalogs below stay clearly separated
// (real bookshelf vs. invented CD collection) by their own header comments
// and a section divider.
//
// The real bookshelf, cataloged from a photo of Scott's own shelf, scanned
// for every distinct book, film, and divination deck on it. See the
// library scene (library.js, this folder) for how this becomes a 3D shelf
// you can look around and click into.
//
// row/col/pos preserve the real shelf's layout — a 4x2 Kallax-style cube
// shelf, row 1 on top — and pos is left-to-right order within that cubby,
// so the scene lays these out in the same order they actually sit in
// Scott's apartment.
//
// Every isbn13/publisher/publish_year/pages/translator/editor field below
// was looked up (Open Library, publisher pages, WorldCat-adjacent
// bookseller listings), not guessed — and where a specific edition
// couldn't be pinned down from the spine alone (a title with several
// active printings, or an ambiguous translation), that's recorded in a
// `note` field rather than silently picking one. release_year/
// runtime_min/country on the film entries were looked up the same way;
// ISBN doesn't apply to films, so those keep their Criterion spine
// numbers (in `creator`) as their identifier instead.
//
// The read panel surfaces writer/producer credits on every film, a short
// excerpt for as many books as possible, and a YouTube link to one
// pivotal, non-spoiling scene per film.
//   - `writer` / `producer` on every bluray entry, researched the same
//     way as the rest of the filmographic data.
//   - `youtube` (a link) + `scene` (what it shows) on every film — picked
//     for being a genuinely pivotal/iconic moment that doesn't give away
//     the ending, preferring official studio/Movieclips-style uploads
//     where one exists. For films with no individual non-spoiler scene
//     clip on YouTube (a handful of harder-to-clip arthouse titles), the
//     link points at the film's own trailer instead, which is non-spoiler
//     by definition — the standing rule for any film added to this shelf
//     in the future. Links can rot; that's an accepted tradeoff for
//     linking out to real footage instead of hosting/reproducing it here.
//   - `excerpt` on books/decks where a short, fair-use-scale quotation
//     exists to give (mostly opening lines, matched to the specific
//     translation on the shelf where translation matters). Deliberately
//     NOT added to art/photography/reference books (the Taschen volumes,
//     Japanese Woodblock Prints, Book of Symbols, Art of Atari, the French
//     Laundry cookbooks, Expanding Universe) or to the tarot/alchemy decks
//     — there's no natural "excerpt" for those. Also deliberately skipped
//     for The Lyrics (McCartney) — reproducing song lyrics, even briefly,
//     is a firmer copyright line than a novel's opening sentence.
export const libraryItems = [
  { id: 1, type: 'book', title: 'Beowulf', creator: 'trans. Seamus Heaney', row: 1, col: 1, pos: 0, isbn13: '9780393330106', publisher: 'W. W. Norton & Company', translator: 'Seamus Heaney', excerpt: 'So. The Spear-Danes in days gone by and the kings who ruled them had courage and greatness. We have heard of those princes’ heroic campaigns.', catalog: 'Norton standalone paperback edition; Norton Critical Edition variant is 9780393938371' },
  { id: 2, type: 'book', title: 'Shinto: The Kami Way', creator: 'Sokyo Ono', row: 1, col: 1, pos: 1, isbn13: '9780804819602', publisher: 'Tuttle Publishing', publish_year: 1994, catalog: 'multiple Tuttle printings exist; also 9780804805254 (1989)' },
  { id: 3, type: 'book', title: 'Água Viva', creator: 'Clarice Lispector', row: 1, col: 1, pos: 2, isbn13: '9780811219907', publisher: 'New Directions', publish_year: 2012, pages: 88, translator: 'Stefan Tobler',  },
  { id: 4, type: 'book', title: 'Tao Te Ching', creator: 'Lao Tzu', row: 1, col: 1, pos: 3, isbn13: '9780140441314', publisher: 'Penguin Classics', publish_year: 1963, pages: 191, translator: 'D. C. Lau', excerpt: 'The way that can be spoken of is not the constant way; the name that can be named is not the constant name.' },
  { id: 5, type: 'book', title: 'Faust', creator: 'Johann Wolfgang von Goethe', row: 1, col: 1, pos: 4, isbn13: '9780140449013', publisher: 'Penguin Classics', publish_year: 2005, translator: 'David Constantine', catalog: 'Faust Part 1; translation edition uncertain from spine alone, several Penguin translations exist (Wayne, Constantine) — flag for Scott' },
  { id: 6, type: 'book', title: 'Alchemy & Mysticism', creator: 'Alexander Roob (Taschen)', row: 1, col: 1, pos: 5, isbn13: '9783836549363', publisher: 'TASCHEN', publish_year: 2014, pages: 575, catalog: 'edition uncertain, Taschen has reissued this multiple times (1997/2003/2009/2014); flag for Scott.' },
  { id: 7, type: 'book', title: 'The Canterbury Tales', creator: 'Geoffrey Chaucer', row: 1, col: 2, pos: 0, isbn13: '9780140424386', publisher: 'Penguin Classics', publish_year: 2003, pages: 528, translator: 'Nevill Coghill', excerpt: 'When in April the sweet showers fall and pierce the drought of March to the root, and all the veins are bathed in liquor of such power as brings about the engendering of the flower…' },
  { id: 8, type: 'book', title: 'Paradise Lost', creator: 'John Milton', row: 1, col: 2, pos: 1, isbn13: '9780140424393', publisher: 'Penguin Classics', publish_year: 2003, pages: 512, editor: 'John Leonard', excerpt: 'Of man’s first disobedience, and the fruit of that forbidden tree, whose mortal taste brought death into the world, and all our woe, with loss of Eden, till one greater Man restore us, and regain the blissful seat, sing, Heav’nly Muse.' },
  { id: 9, type: 'book', title: 'Medea and Other Plays', creator: 'Euripides', row: 1, col: 2, pos: 2, isbn13: '9780140449297', publisher: 'Penguin Classics', publish_year: 2003, translator: 'John Davie / Richard Rutherford', catalog: 'older Vellacott translation is 9780140441291 (1963); edition uncertain, flag for Scott' },
  { id: 10, type: 'book', title: 'The Bacchae and Other Plays', creator: 'Euripides', row: 1, col: 2, pos: 3, isbn13: '9780140447262', publisher: 'Penguin Classics', publish_year: 2006, translator: 'John Davie', catalog: 'older Vellacott translation is 9780140440447; edition uncertain, flag for Scott' },
  { id: 11, type: 'book', title: 'A Portrait of the Artist as a Young Man', creator: 'James Joyce', row: 1, col: 2, pos: 4, isbn13: '9780142437346', publisher: 'Penguin Classics', publish_year: 2003, catalog: 'photo shows Penguin Classics Deluxe cover style; newer centennial deluxe edition is 9780143108245 — edition uncertain, flag for Scott.', excerpt: 'Once upon a time and a very good time it was there was a moocow coming down along the road and this moocow that was coming down along the road met a nicens little boy named baby tuckoo.' },
  { id: 12, type: 'book', title: 'The Republic', creator: 'Plato', row: 1, col: 2, pos: 5, isbn13: '9780140449143', publisher: 'Penguin Classics', publish_year: 2003, translator: 'Desmond Lee', excerpt: 'I went down to the Piraeus yesterday with Glaucon, son of Ariston, to pray to the goddess, and also because I wanted to see how they would conduct the festival.',  },
  { id: 13, type: 'book', title: 'The Symposium', creator: 'Plato', row: 1, col: 2, pos: 6, isbn13: '9780140449273', publisher: 'Penguin Classics', publish_year: 2003, pages: 144, translator: 'Christopher Gill', excerpt: 'Each of us when separated, having one side only, like a flat fish, is but the indenture of a man, and he is always looking for his other half…', excerpt_from: 'Aristophanes’ speech (trans. Benjamin Jowett, 1871, public domain) — the origin-of-love myth Hedwig and the Angry Inch stages directly as “The Origin of Love”',  },
  { id: 14, type: 'book', title: 'Phaedrus', creator: 'Plato', row: 1, col: 2, pos: 7, isbn13: '9780140449747', publisher: 'Penguin Classics', publish_year: 2005, translator: 'Christopher Rowe' },
  { id: 15, type: 'book', title: 'The Last Days of Socrates', creator: 'Plato', row: 1, col: 2, pos: 8, isbn13: '9780140449280', publisher: 'Penguin Classics', publish_year: 2003, translator: 'Harold Tarrant / Hugh Tredennick', catalog: 'contains Euthyphro, Apology, Crito, Phaedo; newer Christopher Rowe translation is 9780140455496 — edition uncertain' },
  { id: 16, type: 'book', title: 'The Epic of Gilgamesh', creator: '', row: 1, col: 2, pos: 9, isbn13: '9780140449198', publisher: 'Penguin Classics', publish_year: 2020, pages: 304, translator: 'Andrew George', excerpt: 'He who saw the Deep, the country’s foundation, who knew..., was wise in all matters! He saw what was secret, discovered what was hidden, he brought back a tale of before the Deluge.', catalog: 'revised edition; earlier printing was 9780140447217' },
  { id: 17, type: 'book', title: 'The Theban Plays', creator: 'Sophocles', row: 1, col: 2, pos: 10, isbn13: '9780140444254', publisher: 'Penguin Classics', publish_year: 1984, translator: 'Robert Fagles', excerpt: 'Oh my children, the new blood of ancient Thebes, why are you here?', excerpt_from: 'opening line of Oedipus the King, one of the three plays in this collection' },
  { id: 18, type: 'book', title: 'Lysistrata and Other Plays', creator: 'Aristophanes', row: 1, col: 2, pos: 11, isbn13: '9780140448146', publisher: 'Penguin Classics', publish_year: 2003, pages: 304, translator: 'Alan H. Sommerstein' },
  { id: 19, type: 'book', title: 'Leaves of Grass', creator: 'Walt Whitman', row: 1, col: 2, pos: 12, isbn13: '9780140421996', publisher: 'Penguin Classics', editor: 'Malcolm Cowley', excerpt: 'I celebrate myself, and sing myself, and what I assume you shall assume, for every atom belonging to me as good belongs to you. I loafe and invite my soul, I lean and loafe at my ease observing a spear of summer grass.' },
  { id: 20, type: 'book', title: 'Bhagavad Gita', creator: '', row: 1, col: 2, pos: 13, isbn13: '9780140441215', publisher: 'Penguin Classics', publish_year: 1962, translator: 'Juan Mascaró', catalog: 'newer 2003 edition w/ Simon Brodbeck intro is 9780140449181 — edition uncertain' },
  { id: 21, type: 'book', title: 'Buddhist Scriptures', creator: '', row: 1, col: 2, pos: 14, isbn13: '9780140447583', publisher: 'Penguin Classics', publish_year: 2004, editor: 'Donald S. Lopez Jr.' },
  { id: 22, type: 'book', title: 'Oresteia', creator: 'Aeschylus', row: 1, col: 2, pos: 15, isbn13: '9780140443332', publisher: 'Penguin Classics', publish_year: 1984, translator: 'Robert Fagles',  },
  { id: 23, type: 'book', title: 'Songs of Innocence and Experience', creator: 'William Blake', row: 1, col: 2, pos: 16, isbn13: '9780192810898', publisher: 'Oxford Paperbacks', editor: 'Geoffrey Keynes', excerpt: 'Piping down the valleys wild, piping songs of pleasant glee, on a cloud I saw a child, and he laughing said to me: “Pipe a song about a lamb!” So I piped with merry cheer.', catalog: 'several editions exist across publishers; could not confirm exact edition from spine alone, flag for Scott' },
  { id: 24, type: 'book', title: 'Meditations', creator: 'Marcus Aurelius', row: 1, col: 2, pos: 17, isbn13: '9780140449334', publisher: 'Penguin Classics', publish_year: 2006, translator: 'Martin Hammond', catalog: '2015 hardcover reissue is 9780141395869' },
  { id: 25, type: 'book', title: 'Chaos: Making a New Science', creator: 'James Gleick', row: 1, col: 2, pos: 18, isbn13: '9780143113454', publisher: 'Penguin Books', publish_year: 2008, pages: 384,  },
  { id: 26, type: 'book', title: 'The Homeric Hymns', creator: '', row: 1, col: 2, pos: 19, isbn13: '9780140437829', publisher: 'Penguin Classics', publish_year: 2003, translator: 'Jules Cashford' },
  { id: 27, type: 'bluray', title: 'The Princess Bride', creator: 'dir. Rob Reiner (Criterion)', row: 1, col: 2, pos: 20, release_year: 1987, runtime_min: 98, country: 'USA', writer: 'William Goldman', producer: 'Andrew Scheinman & Rob Reiner', scene: '“As You Wish”', youtube: 'https://www.youtube.com/watch?v=niul8Hy-3wk' },
  { id: 28, type: 'book', title: 'Three Colours Trilogy: Blue White Red (companion volume)', creator: 'Krzysztof Kieślowski', row: 1, col: 2, pos: 21, isbn13: '9780571178926', publisher: 'Faber and Faber', publish_year: 1998, pages: 291,  },
  { id: 29, type: 'bluray', title: 'Dekalog', creator: 'Krzysztof Kieślowski · Criterion 637', row: 1, col: 3, pos: 0, release_year: 1989, runtime_min: 572, country: 'Poland', writer: 'Krzysztof Kieślowski & Krzysztof Piesiewicz', producer: 'Ryszard Chutkowski', scene: 'the U.S. re-release trailer', youtube: 'https://www.youtube.com/watch?v=cYio8DB-4T8' },
  { id: 30, type: 'bluray', title: 'Do the Right Thing', creator: 'Spike Lee · Criterion 97', row: 1, col: 3, pos: 1, release_year: 1989, runtime_min: 120, country: 'USA', writer: 'Spike Lee', producer: 'Spike Lee', scene: '“Fight the Power”', youtube: 'https://www.youtube.com/watch?v=TQ4y7GPeFBY' },
  { id: 31, type: 'bluray', title: 'Seven Samurai', creator: 'Akira Kurosawa · Criterion 2', row: 1, col: 3, pos: 2, release_year: 1954, runtime_min: 207, country: 'Japan', writer: 'Akira Kurosawa, Shinobu Hashimoto, Hideo Oguni', producer: 'Sojiro Motoki', scene: 'the U.S. theatrical trailer', youtube: 'https://www.youtube.com/watch?v=wJ1TOratCTo' },
  { id: 32, type: 'bluray', title: 'Dazed and Confused', creator: 'Richard Linklater · Criterion 336', row: 1, col: 3, pos: 3, release_year: 1993, runtime_min: 102, country: 'USA', writer: 'Richard Linklater', producer: 'Richard Linklater, Sean Daniel, James Jacks', scene: '"alright, alright, alright"', youtube: 'https://www.youtube.com/watch?v=oVsSHkukhig' },
  { id: 33, type: 'bluray', title: 'The Tree of Life', creator: 'Terrence Malick · Criterion 942', row: 1, col: 3, pos: 4, release_year: 2011, runtime_min: 139, country: 'USA', writer: 'Terrence Malick', producer: 'Sarah Green, Bill Pohlad, Brad Pitt, Dede Gardner, Grant Hill', scene: 'the creation / universe sequence', youtube: 'https://www.youtube.com/watch?v=1WvuJwMFPz4' },
  { id: 34, type: 'bluray', title: 'A Hard Day\'s Night', creator: 'dir. Richard Lester · Criterion 1104', row: 1, col: 3, pos: 5, release_year: 1964, runtime_min: 87, country: 'UK', writer: 'Alun Owen', producer: 'Walter Shenson', scene: 'the “Can’t Buy Me Love” field sequence', youtube: 'https://www.youtube.com/watch?v=MnQ7-if2mas' },
  { id: 35, type: 'bluray', title: 'Citizen Kane', creator: 'Orson Welles', row: 1, col: 3, pos: 6, release_year: 1941, runtime_min: 119, country: 'USA', writer: 'Herman J. Mankiewicz & Orson Welles', producer: 'Orson Welles', scene: 'the opening, “Rosebud”', youtube: 'https://www.youtube.com/watch?v=fr93wwtiKQM' },
  { id: 36, type: 'bluray', title: 'The Silence of the Lambs', creator: 'Jonathan Demme · Criterion 13', row: 1, col: 3, pos: 7, release_year: 1991, runtime_min: 118, country: 'USA', writer: 'Ted Tally', producer: 'Kenneth Utt, Edward Saxon, Ron Bozman', scene: 'the “quid pro quo” dinner scene', youtube: 'https://www.youtube.com/watch?v=YlRLfbONYgM' },
  { id: 37, type: 'bluray', title: 'Dr. Strangelove', creator: 'Stanley Kubrick · Criterion 821', row: 1, col: 3, pos: 8, release_year: 1964, runtime_min: 94, country: 'UK/USA', writer: 'Peter George, Stanley Kubrick, Terry Southern', producer: 'Stanley Kubrick', scene: '“Gentlemen, you can’t fight in here! This is the War Room!”', youtube: 'https://www.youtube.com/watch?v=WI5B7jLWZUc' },
  { id: 38, type: 'bluray', title: 'Blow-Up', creator: 'Michelangelo Antonioni · Criterion 845', row: 1, col: 3, pos: 9, release_year: 1966, runtime_min: 111, country: 'UK/Italy', writer: 'Tonino Guerra & Michelangelo Antonioni (English dialogue: Edward Bond)', producer: 'Carlo Ponti', scene: 'blowing up the park photographs', youtube: 'https://www.youtube.com/watch?v=Q62gRiUrylw' },
  { id: 39, type: 'bluray', title: 'Repo Man', creator: 'Alex Cox · Criterion 534', row: 1, col: 3, pos: 10, release_year: 1984, runtime_min: 92, country: 'USA', writer: 'Alex Cox', producer: 'Jonathan Wacks & Peter McCarthy', scene: 'the “plate o’ shrimp” monologue', youtube: 'https://www.youtube.com/watch?v=VOLmUVXtwbM' },
  { id: 40, type: 'bluray', title: 'Hedwig and the Angry Inch', creator: 'John Cameron Mitchell · Criterion 593', row: 1, col: 3, pos: 11, release_year: 2001, runtime_min: 92, country: 'USA', writer: 'John Cameron Mitchell', producer: 'Christine Vachon, Katie Roumel, Pamela Koffler', scene: '“Origin of Love”', youtube: 'https://www.youtube.com/watch?v=lEn5E6YCoMA' },
  { id: 41, type: 'bluray', title: 'Throne of Blood', creator: 'Akira Kurosawa', row: 1, col: 3, pos: 12, release_year: 1957, runtime_min: 108, country: 'Japan', writer: 'Shinobu Hashimoto, Ryūzō Kikushima, Akira Kurosawa, Hideo Oguni', producer: 'Sōjirō Motoki & Akira Kurosawa', scene: 'the U.S. theatrical trailer', youtube: 'https://www.youtube.com/watch?v=TFY25PBs3ec' },
  { id: 42, type: 'bluray', title: 'Malcolm X', creator: 'Spike Lee · Criterion 740', row: 1, col: 3, pos: 13, release_year: 1992, runtime_min: 202, country: 'USA', writer: 'Arnold Perl & Spike Lee', producer: 'Marvin Worth & Spike Lee', scene: 'the “Defend Yourself” press conference', youtube: 'https://www.youtube.com/watch?v=1jatEIAjsjM' },
  { id: 43, type: 'bluray', title: 'Inside Llewyn Davis', creator: 'Joel & Ethan Coen · Criterion 794', row: 1, col: 3, pos: 14, release_year: 2013, runtime_min: 105, country: 'USA', writer: 'Joel Coen & Ethan Coen', producer: 'Scott Rudin, Joel Coen, Ethan Coen', scene: 'the “Please Mr. Kennedy” recording session', youtube: 'https://www.youtube.com/watch?v=6WCRAuIcjsc' },
  { id: 44, type: 'bluray', title: 'Dreams', creator: 'Akira Kurosawa · Criterion 842', row: 1, col: 3, pos: 15, full_title: 'Akira Kurosawa\'s Dreams', release_year: 1990, runtime_min: 119, country: 'Japan/USA', writer: 'Akira Kurosawa', producer: 'Hisao Kurosawa & Mike Y. Inoue', scene: '“Crows,” the Van Gogh episode', youtube: 'https://www.youtube.com/watch?v=We8NpHPXzwI' },
  { id: 45, type: 'bluray', title: 'The 39 Steps', creator: 'Alfred Hitchcock · Criterion 56', row: 1, col: 3, pos: 16, release_year: 1935, runtime_min: 86, country: 'UK', writer: 'Charles Bennett, Ian Hay, Alma Reville', producer: 'Michael Balcon', scene: 'the U.S. trailer', youtube: 'https://www.youtube.com/watch?v=hUIL0Z1c9bc' },
  { id: 46, type: 'bluray', title: 'La Jetée / Sans Soleil', creator: 'Chris Marker · Criterion 387', row: 1, col: 3, pos: 17, release_year: 1962, runtime_min: 28, country: 'France', writer: 'Chris Marker', producer: 'Anatole Dauman', scene: 'the U.S. trailer', youtube: 'https://www.youtube.com/watch?v=9GENscwqjzY' },
  { id: 47, type: 'bluray', title: 'Blood Simple', creator: 'Joel & Ethan Coen (Criterion)', row: 1, col: 4, pos: 0, release_year: 1984, runtime_min: 97, country: 'USA', writer: 'Joel Coen & Ethan Coen', producer: 'Ethan Coen', scene: 'the opening monologue', youtube: 'https://www.youtube.com/watch?v=7xifH6CGNzs' },
  { id: 48, type: 'bluray', title: 'All That Jazz', creator: 'Bob Fosse (Criterion)', row: 1, col: 4, pos: 1, release_year: 1979, runtime_min: 123, country: 'USA', writer: 'Robert Alan Aurthur & Bob Fosse', producer: 'Robert Alan Aurthur', scene: 'the opening “On Broadway” audition number', youtube: 'https://www.youtube.com/watch?v=L2e9acreKmQ' },
  { id: 49, type: 'bluray', title: 'No Country for Old Men', creator: 'Joel & Ethan Coen (Criterion)', row: 1, col: 4, pos: 2, release_year: 2007, runtime_min: 122, country: 'USA', writer: 'Joel Coen & Ethan Coen', producer: 'Scott Rudin, Ethan Coen, Joel Coen', scene: 'the coin toss', youtube: 'https://www.youtube.com/watch?v=opbi7d42s8E' },
  { id: 50, type: 'bluray', title: 'Double Indemnity', creator: 'Billy Wilder (Criterion)', row: 1, col: 4, pos: 3, release_year: 1944, runtime_min: 107, country: 'USA', writer: 'Billy Wilder & Raymond Chandler', producer: 'Buddy DeSylva & Joseph Sistrom', scene: 'the “how fast was I going, officer?” flirtation scene', youtube: 'https://www.youtube.com/watch?v=OH-J-Loy61w' },
  { id: 51, type: 'bluray', title: 'Tokyo Story', creator: 'Yasujiro Ozu (Criterion)', row: 1, col: 4, pos: 4, release_year: 1953, runtime_min: 136, country: 'Japan', writer: 'Kogo Noda & Yasujirō Ozu', producer: 'Takeshi Yamamoto', scene: 'the U.S. re-release trailer', youtube: 'https://www.youtube.com/watch?v=iNUzimUStwg' },
  { id: 52, type: 'bluray', title: '8½', creator: 'Federico Fellini (Criterion)', row: 1, col: 4, pos: 5, release_year: 1963, runtime_min: 138, country: 'Italy/France', writer: 'Ennio Flaiano, Tullio Pinelli, Federico Fellini, Brunello Rondi', producer: 'Angelo Rizzoli', scene: 'the opening dream sequence', youtube: 'https://www.youtube.com/watch?v=c6CgffwpXmY' },
  { id: 53, type: 'bluray', title: 'Solaris', creator: 'Andrei Tarkovsky (Criterion)', row: 1, col: 4, pos: 6, release_year: 1972, runtime_min: 167, country: 'USSR', writer: 'Friedrich Gorenstein & Andrei Tarkovsky', producer: 'Vyacheslav Tarasov', scene: 'the U.S. trailer', youtube: 'https://www.youtube.com/watch?v=U5-WFlJiFX0' },
  { id: 54, type: 'bluray', title: 'Ghost Dog: The Way of the Samurai', creator: 'Jim Jarmusch (Criterion)', row: 1, col: 4, pos: 7, release_year: 1999, runtime_min: 116, country: 'USA/France/Japan/Germany', writer: 'Jim Jarmusch', producer: 'Richard Guay & Jim Jarmusch', scene: 'swords on the roof / park scene', youtube: 'https://www.youtube.com/watch?v=xAlBlavGaB8' },
  { id: 55, type: 'bluray', title: 'F for Fake', creator: 'Orson Welles (Criterion)', row: 1, col: 4, pos: 8, release_year: 1973, runtime_min: 89, country: 'France/Iran/West Germany', writer: 'Orson Welles & Oja Kodar', producer: 'François Reichenbach, Dominique Antoine, Richard Drewett', scene: 'the Chartres Cathedral meditation', youtube: 'https://www.youtube.com/watch?v=erj8lO8aYog' },
  { id: 56, type: 'bluray', title: 'Miller\'s Crossing', creator: 'Joel & Ethan Coen (Criterion)', row: 1, col: 4, pos: 9, release_year: 1990, runtime_min: 115, country: 'USA', writer: 'Joel Coen & Ethan Coen', producer: 'Ethan Coen', scene: '“look into your heart” (Bernie in the forest)', youtube: 'https://www.youtube.com/watch?v=GJSSkr0JpAE' },
  { id: 57, type: 'bluray', title: 'The Right Stuff', creator: 'Philip Kaufman (Kino Lorber Studio Classics)', row: 1, col: 4, pos: 10, release_year: 1983, runtime_min: 192, country: 'USA', writer: 'Philip Kaufman', producer: 'Robert Chartoff & Irwin Winkler', scene: '“no bucks, no Buck Rogers”', youtube: 'https://www.youtube.com/watch?v=a7rGA0Zv8R4' },
  { id: 58, type: 'bluray', title: 'Barton Fink', creator: 'Joel & Ethan Coen', row: 1, col: 4, pos: 11, release_year: 1991, runtime_min: 116, country: 'USA', writer: 'Ethan Coen & Joel Coen', producer: 'Ethan Coen', scene: '“That Barton Fink Feeling” (the opening theater scene)', youtube: 'https://www.youtube.com/watch?v=VN54kkl_nTI' },
  { id: 59, type: 'bluray', title: 'The Maya Deren Collection', creator: '', row: 1, col: 4, pos: 12, writer: 'Maya Deren', producer: 'Maya Deren', scene: 'Meshes of the Afternoon (full 14-min short)', youtube: 'https://www.youtube.com/watch?v=bjtLgNpv5AQ' },
  { id: 60, type: 'bluray', title: 'North by Northwest', creator: 'Alfred Hitchcock (4K UHD)', row: 1, col: 4, pos: 13, release_year: 1959, runtime_min: 136, country: 'USA', writer: 'Ernest Lehman', producer: 'Alfred Hitchcock', scene: 'the crop duster attack', youtube: 'https://www.youtube.com/watch?v=TtbOConPflA' },
  { id: 61, type: 'bluray', title: 'Vertigo', creator: 'Alfred Hitchcock (4K UHD)', row: 1, col: 4, pos: 14, release_year: 1958, runtime_min: 128, country: 'USA', writer: 'Alec Coppel & Samuel Taylor', producer: 'Alfred Hitchcock', scene: 'the opening rooftop chase', youtube: 'https://www.youtube.com/watch?v=O888bu0QrMg' },
  { id: 62, type: 'bluray', title: 'GoodFellas', creator: 'Martin Scorsese (4K UHD)', row: 1, col: 4, pos: 15, release_year: 1990, runtime_min: 146, country: 'USA', writer: 'Nicholas Pileggi & Martin Scorsese', producer: 'Irwin Winkler', scene: '“funny how? funny like a clown?”', youtube: 'https://www.youtube.com/watch?v=tl-D128yaMA' },
  { id: 63, type: 'bluray', title: '2001: A Space Odyssey', creator: 'Stanley Kubrick, 50th Anniversary Edition (4K UHD)', row: 1, col: 4, pos: 16, release_year: 1968, runtime_min: 149, country: 'UK/USA', catalog: 'runtime varies by cut across sources (139-161 min); 149 is the commonly cited general-release figure.', writer: 'Stanley Kubrick & Arthur C. Clarke', producer: 'Stanley Kubrick', scene: 'HAL refuses: “I’m sorry, Dave, I’m afraid I can’t do that”', youtube: 'https://www.youtube.com/watch?v=Wy4EfdnMZ5g' },
  { id: 64, type: 'bluray', title: 'Fargo', creator: 'Joel & Ethan Coen, 2-disc set (4K UHD)', row: 1, col: 4, pos: 17, release_year: 1996, runtime_min: 98, country: 'USA/UK', writer: 'Joel Coen & Ethan Coen', producer: 'Ethan Coen', scene: 'Marge questions Jerry at the dealership', youtube: 'https://www.youtube.com/watch?v=TqNaJxRC9NM' },
  { id: 65, type: 'bluray', title: 'The Big Lebowski', creator: 'Joel & Ethan Coen (4K UHD)', row: 1, col: 4, pos: 18, release_year: 1998, runtime_min: 117, country: 'USA', writer: 'Joel Coen & Ethan Coen', producer: 'Ethan Coen', scene: '“that rug really tied the room together”', youtube: 'https://www.youtube.com/watch?v=uGK4x4tqPIY' },
  { id: 66, type: 'bluray', title: 'Close Encounters of the Third Kind', creator: 'Steven Spielberg (4K UHD)', row: 1, col: 4, pos: 19, release_year: 1977, runtime_min: 135, country: 'USA', writer: 'Steven Spielberg', producer: 'Julia Phillips & Michael Phillips', scene: 'Roy’s mashed-potatoes dinner scene', youtube: 'https://www.youtube.com/watch?v=cdkS0TgEG30' },
  { id: 67, type: 'bluray', title: 'Casablanca', creator: 'Michael Curtiz (4K UHD)', row: 1, col: 4, pos: 20, release_year: 1942, runtime_min: 102, country: 'USA', writer: 'Julius J. Epstein, Philip G. Epstein, Howard Koch', producer: 'Hal B. Wallis', scene: 'the “Play it, Sam” piano scene', youtube: 'https://www.youtube.com/watch?v=a_paHK6JdHA' },
  { id: 68, type: 'bluray', title: 'Reservoir Dogs', creator: 'Quentin Tarantino (4K UHD)', row: 1, col: 4, pos: 21, release_year: 1992, runtime_min: 99, country: 'USA', writer: 'Quentin Tarantino', producer: 'Lawrence Bender, Richard N. Gladstein, Monte Hellman, Harvey Keitel, Ronna B. Wallace', scene: '“Stuck in the Middle With You”', youtube: 'https://www.youtube.com/watch?v=PGqB6JIUzBo' },
  { id: 69, type: 'bluray', title: 'Pulp Fiction', creator: 'Quentin Tarantino (4K UHD)', row: 1, col: 4, pos: 22, release_year: 1994, runtime_min: 154, country: 'USA', writer: 'Quentin Tarantino (story w/ Roger Avary)', producer: 'Lawrence Bender', scene: '“Royale with Cheese”', youtube: 'https://www.youtube.com/watch?v=6Pkq_eBHXJ4' },
  { id: 70, type: 'bluray', title: 'Kill Bill Vol. 1', creator: 'Quentin Tarantino (4K UHD)', row: 1, col: 4, pos: 23, release_year: 2003, runtime_min: 111, country: 'USA', writer: 'Quentin Tarantino', producer: 'Lawrence Bender', scene: 'the Hattori Hanzo sword scene', youtube: 'https://www.youtube.com/watch?v=rIr6rEndy0A' },
  { id: 71, type: 'bluray', title: 'Kill Bill Vol. 2', creator: 'Quentin Tarantino (4K UHD)', row: 1, col: 4, pos: 24, release_year: 2004, runtime_min: 137, country: 'USA', writer: 'Quentin Tarantino', producer: 'Lawrence Bender', scene: 'meeting Master Pai Mei', youtube: 'https://www.youtube.com/watch?v=fCbf4DjlHuM' },
  { id: 72, type: 'book', title: 'Rosencrantz & Guildenstern Are Dead', creator: 'Tom Stoppard', row: 2, col: 1, pos: 0, isbn13: '9780802132758', publisher: 'Grove Press', publish_year: 1994, excerpt: '(A coin spins in the air, comes down.) GUIL: Heads. ROS: Heads.', catalog: '50th-anniversary edition is 9780802126214 — edition uncertain' },
  { id: 73, type: 'book', title: 'Gödel, Escher, Bach: An Eternal Golden Braid', creator: 'Douglas R. Hofstadter', row: 2, col: 1, pos: 1, isbn13: '9780465026562', publisher: 'Basic Books', publish_year: 1999, pages: 824,  },
  { id: 74, type: 'book', title: 'wabi sabi: Understanding the Zen Philosophy of Beauty', creator: 'Andrew Juniper (Tuttle)', row: 2, col: 1, pos: 2, isbn13: '9780804834827', publisher: 'Tuttle Publishing', publish_year: 2003, pages: 176, full_title: 'Wabi Sabi: The Japanese Art of Impermanence' },
  { id: 75, type: 'book', title: 'In Praise of Shadows', creator: 'Jun\'ichirō Tanizaki', row: 2, col: 1, pos: 3, isbn13: '9780918172020', publisher: 'Leete\'s Island Books', publish_year: 1977, pages: 56, translator: 'Thomas J. Harper / Edward G. Seidensticker',  },
  { id: 76, type: 'book', title: 'Kieślowski on Kieślowski', creator: 'ed. Danusia Stok', row: 2, col: 1, pos: 4, isbn13: '9780571173280', publisher: 'Faber and Faber', publish_year: 1993, pages: 268, editor: 'Danusia Stok' },
  { id: 77, type: 'book', title: 'Three Colours Trilogy: Blue, White, Red (screenplays)', creator: 'Krzysztof Kieślowski & Krzysztof Piesiewicz', row: 2, col: 1, pos: 5, catalog: '= id 28 (Three Colours Trilogy screenplay book), likely a duplicate sighting across cubbies rather than two separate copies — flag for Scott to confirm whether one of these two catalog entries should be removed' },
  { id: 78, type: 'book', title: 'Gravity\'s Rainbow', creator: 'Thomas Pynchon', row: 2, col: 1, pos: 6, isbn13: '9780143039945', publisher: 'Penguin Classics Deluxe', publish_year: 2006, catalog: 'cover by Frank Miller; earlier Penguin edition 9780140188592 — edition uncertain.', excerpt: 'A screaming comes across the sky. It has happened before, but there is nothing to compare it to now.' },
  { id: 79, type: 'book', title: 'Collected Fictions', creator: 'Jorge Luis Borges (Penguin Classics Deluxe)', row: 2, col: 1, pos: 7, isbn13: '9780140286809', publisher: 'Penguin Classics Deluxe', publish_year: 1999, translator: 'Andrew Hurley', excerpt: 'I owe the discovery of Uqbar to the conjunction of a mirror and an encyclopedia.', excerpt_from: 'opening of “Tlön, Uqbar, Orbis Tertius,” one story in this collection',  },
  { id: 80, type: 'book', title: 'The Iliad', creator: 'Homer, trans. Robert Fagles (Penguin Classics Deluxe)', row: 2, col: 1, pos: 8, isbn13: '9780140275360', publisher: 'Penguin Classics Deluxe', publish_year: 1998, translator: 'Robert Fagles', excerpt: 'Rage—Goddess, sing the rage of Peleus’ son Achilles, murderous, doomed, that cost the Achaeans countless losses.' },
  { id: 81, type: 'book', title: 'The Odyssey', creator: 'Homer, trans. Robert Fagles (Penguin Classics Deluxe)', row: 2, col: 1, pos: 9, isbn13: '9780140268867', publisher: 'Penguin Classics Deluxe', publish_year: 1997, pages: 541, translator: 'Robert Fagles', excerpt: 'Sing to me of the man, Muse, the man of twists and turns driven time and again off course, once he had plundered the hallowed heights of Troy.' },
  { id: 82, type: 'book', title: 'The Aeneid', creator: 'Virgil, trans. Robert Fagles (Penguin Classics Deluxe)', row: 2, col: 1, pos: 10, isbn13: '9780143105138', publisher: 'Penguin Classics Deluxe', publish_year: 2008, translator: 'Robert Fagles', excerpt: 'Wars and a man I sing—an exile driven on by Fate, he was the first to flee the coast of Troy, destined to reach Lavinian shores and Italian soil.' },
  { id: 83, type: 'book', title: 'Dune', creator: 'Frank Herbert', row: 2, col: 2, pos: 0, isbn13: '9780441172719', publisher: 'Ace Books', publish_year: 1990, excerpt: 'In the week before their departure to Arrakis, when all the final scurrying about had reached a nearly unbearable frenzy, an old crone came to visit the mother of the boy, Paul.', catalog: 'photo shows a stylized/modern cover, not the 1965 first-printing; exact reissue/edition uncertain, flag for Scott' },
  { id: 84, type: 'book', title: 'The Complete Stories', creator: 'Clarice Lispector', row: 2, col: 2, pos: 1, isbn13: '9780811219631', publisher: 'New Directions', publish_year: 2015, pages: 645, translator: 'Katrina Dodson', editor: 'Benjamin Moser' },
  { id: 85, type: 'book', title: 'Ulysses', creator: 'James Joyce', row: 2, col: 2, pos: 2, isbn13: '9780679722762', publisher: 'Vintage International', publish_year: 1990, pages: 783, excerpt: 'Stately, plump Buck Mulligan came from the stairhead, bearing a bowl of lather on which a mirror and a razor lay crossed.' },
  { id: 86, type: 'book', title: '1Q84', creator: 'Haruki Murakami', row: 2, col: 2, pos: 3, isbn13: '9780307476463', publisher: 'Vintage International', publish_year: 2013, pages: 1184, translator: 'Jay Rubin / Philip Gabriel', catalog: 'single-volume omnibus edition; a 3-volume boxed set also exists (9780345802934).', excerpt: 'Don’t let appearances fool you. There’s always only one reality.', excerpt_from: 'the taxi driver’s line to Aomame, early in Book One — not the literal opening sentence' },
  { id: 87, type: 'book', title: 'Near to the Wild Heart', creator: 'Clarice Lispector', row: 2, col: 2, pos: 4, isbn13: '9780811220026', publisher: 'New Directions', publish_year: 2012, translator: 'Alison Entrekin', excerpt: 'There were many good feelings. Climbing the hill, stopping at the top and, without looking, feeling the ground covered behind her, the farm in the distance.', catalog: 'earlier Giovanni Pontiero translation is 9780811211390/9780811211406 — edition uncertain' },
  { id: 88, type: 'book', title: 'The Crying of Lot 49', creator: 'Thomas Pynchon', row: 2, col: 2, pos: 5, isbn13: '9780060913076', publisher: 'Harper Perennial', publish_year: 2006, excerpt: 'One summer afternoon Mrs Oedipa Maas came home from a Tupperware party whose hostess had put perhaps too much kirsch in the fondue to find that she, Oedipa, had been named executor... of the estate of one Pierce Inverarity.', catalog: 'Harper Perennial Olive Editions reissue is 9780061849923 — edition uncertain' },
  { id: 89, type: 'book', title: 'Finnegans Wake', creator: 'James Joyce', row: 2, col: 2, pos: 6, isbn13: '9780141181264', publisher: 'Penguin Classics', publish_year: 1999, pages: 672, catalog: 'Penguin Modern Classics variant 9780141183114 also exists — edition uncertain.', excerpt: 'riverrun, past Eve and Adam’s, from swerve of shore to bend of bay, brings us by a commodius vicus of recirculation back to Howth Castle and Environs.' },
  { id: 90, type: 'book', title: 'The Metamorphoses', creator: 'Ovid (Everyman\'s Library)', row: 2, col: 2, pos: 7, isbn13: '9780140447897', publisher: 'Penguin Classics', publish_year: 2004, translator: 'David Raeburn', catalog: 'catalog lists creator as Everyman\'s Library, but this Raeburn translation is a Penguin Classics edition — could not confirm a matching Everyman\'s printing, flag for Scott' },
  { id: 91, type: 'book', title: 'The Divine Comedy', creator: 'Dante Alighieri (Everyman\'s Library)', row: 2, col: 2, pos: 8, isbn13: '9780679433132', publisher: 'Everyman\'s Library', publish_year: 1995, translator: 'Allen Mandelbaum', excerpt: 'When I had journeyed half of our life’s way, I found myself within a shadowed forest, for I had lost the path that does not stray.' },
  { id: 92, type: 'book', title: 'Japanese Woodblock Prints, 1680–1938', creator: 'Andreas Marks (Taschen 40 series)', row: 2, col: 3, pos: 0, isbn13: '9783836563369', publisher: 'TASCHEN', catalog: 'full title \'Japanese Woodblock Prints, 1680-1938\'; multiple print runs exist (40th anniv. ed. is 9783836587532) — edition uncertain' },
  { id: 93, type: 'book', title: 'The Book of Symbols: Reflections on Archetypal Images', creator: 'Archive for Research in Archetypal Symbolism (Taschen)', row: 2, col: 3, pos: 1, isbn13: '9783836514484', publisher: 'TASCHEN', publish_year: 2010, pages: 808, editor: 'Ami Ronnberg / Kathleen Martin, for ARAS' },
  { id: 94, type: 'book', title: 'The Beastie Boys Book', creator: 'Michael Diamond & Adam Horovitz (Spiegel & Grau)', row: 2, col: 3, pos: 2, isbn13: '9780812995541', publisher: 'Spiegel & Grau', excerpt: 'I loved MCA. He was a renegade. He seemed to live life at a million miles an hour, curious about everything, folding his experiences into his creative output.', catalog: 'UK Faber & Faber edition is 9780571308040 — edition uncertain' },
  { id: 95, type: 'book', title: 'The Library of Esoterica: Sacred Sites', creator: 'Taschen', row: 2, col: 3, pos: 3, isbn13: '9783836590600', publisher: 'TASCHEN', publish_year: 2024, pages: 520, editor: 'Jessica Hundley', series: 'The Library of Esoterica' },
  { id: 96, type: 'book', title: 'The Library of Esoterica: Astrology', creator: 'Taschen', row: 2, col: 3, pos: 4, isbn13: '9783836579889', publisher: 'TASCHEN', publish_year: 2020, editor: 'Andrea Richards / Jessica Hundley', series: 'The Library of Esoterica, vol. 2' },
  { id: 97, type: 'book', title: 'The Library of Esoterica: Plant Magick', creator: 'Taschen', row: 2, col: 3, pos: 5, isbn13: '9783836585644', publisher: 'TASCHEN', publish_year: 2022, pages: 520, editor: 'Jessica Hundley', series: 'The Library of Esoterica, vol. 4' },
  { id: 98, type: 'book', title: 'The Library of Esoterica: Tarot', creator: 'Taschen', row: 2, col: 3, pos: 6, isbn13: '9783836579872', publisher: 'TASCHEN', publish_year: 2020, pages: 520, editor: 'Jessica Hundley', series: 'The Library of Esoterica, vol. 1' },
  { id: 99, type: 'divination_box', title: 'The Wild Unknown Tarot', creator: 'Kim Krans', row: 2, col: 3, pos: 7, isbn13: '9780062466594', publisher: 'HarperElixir', publish_year: 2016, pages: 208,  },
  { id: 100, type: 'divination_box', title: 'The Wild Unknown Alchemy', creator: 'Kim Krans', row: 2, col: 3, pos: 8, isbn13: '9781797212579', publisher: 'Chronicle Books', publish_year: 2022,  },
  { id: 101, type: 'book', title: 'The Library of Esoterica: Witchcraft', creator: 'Taschen', row: 2, col: 4, pos: 0, isbn13: '9783836585606', publisher: 'TASCHEN', pages: 520, editor: 'Jessica Hundley / Pam Grossman', series: 'The Library of Esoterica, vol. 3' },
  { id: 102, type: 'book', title: 'William Shakespeare: Complete Works', creator: 'ed. Jonathan Bate & Eric Rasmussen, RSC 2nd ed. (Modern Library)', row: 2, col: 4, pos: 1, isbn13: '9780593230312', publisher: 'Modern Library', publish_year: 2022, editor: 'Jonathan Bate / Eric Rasmussen',  },
  { id: 103, type: 'book', title: 'The Lyrics: 1956 to the Present', creator: 'Paul McCartney, ed. Paul Muldoon (Liveright)', row: 2, col: 4, pos: 2, isbn13: '9781631492563', publisher: 'Liveright / W. W. Norton', publish_year: 2021, pages: 960, editor: 'Paul Muldoon', catalog: 'hardcover; paperback is 9781324094098 (624pp, 2023) — edition uncertain.' },
  { id: 104, type: 'book', title: 'Art of Atari', creator: 'Tim Lapetino (Dynamite)', row: 2, col: 4, pos: 3, isbn13: '9781524101039', publisher: 'Dynamite Entertainment', publish_year: 2016, pages: 352, creator_full: 'Tim Lapetino, with Robert V. Conte' },
  { id: 105, type: 'book', title: 'The French Laundry Cookbook', creator: 'Thomas Keller (Artisan)', row: 2, col: 4, pos: 4, isbn13: '9781579651268', publisher: 'Artisan', publish_year: 1999, pages: 336, creator_full: 'Thomas Keller, with Michael Ruhlman and Susie Heller' },
  { id: 106, type: 'book', title: 'The French Laundry, Per Se', creator: 'Thomas Keller (Artisan)', row: 2, col: 4, pos: 5, isbn13: '9781579658496', publisher: 'Artisan', publish_year: 2020, pages: 400, full_title: 'The French Laundry, Per Se' },
  { id: 107, type: 'book', title: 'Expanding Universe: Photographs from the Hubble Space Telescope', creator: 'Taschen', row: 2, col: 4, pos: 6, isbn13: '9783836549226', publisher: 'TASCHEN', pages: 260, creator_full: 'essay by Owen Edwards, interview with Zoltan Levay', catalog: '25th-anniversary edition; a 30th-anniversary edition with new images also exists — edition uncertain' },

  // These books were added from ISBNs Scott provided directly rather than
  // read off a shelf photo, so row/col/pos below are arbitrary (spread
  // across the existing book cubbies, never the film-only cubbies), not a
  // record of where these physically sit.
  { id: 108, type: 'book', title: 'The Changing Light at Sandover', creator: 'James Merrill', row: 2, col: 1, pos: 100, isbn13: '9780679410836', publisher: 'Knopf', publish_year: 1992, pages: 560, excerpt: 'AM I IN YR ROOM SO ARE ALL YR DEAD WHO HAVE NOT GONE INTO OTHER BODIES… NOW DO U UNDERSTAND WHAT HEAVEN IS IT IS THE SURROUND OF THE LIVING' },
  { id: 109, type: 'book', title: 'The Beatles Anthology', creator: 'The Beatles', row: 2, col: 4, pos: 100, isbn13: '9780811826846', publisher: 'Chronicle Books', publish_year: 2000, pages: 368,  },
  { id: 110, type: 'book', title: 'VALIS', creator: 'Philip K. Dick', row: 1, col: 1, pos: 100, isbn13: '9780547572413', publisher: 'Mariner Books', publish_year: 2011, pages: 271, excerpt: 'Horselover Fat’s nervous breakdown began the day he got the phone call from Gloria asking if he had any Nembutals.' },
  { id: 111, type: 'book', title: 'Pale Fire', creator: 'Vladimir Nabokov', row: 2, col: 2, pos: 100, isbn13: '9780679723424', publisher: 'Vintage International', publish_year: 1989, pages: 315, excerpt: 'I was the shadow of the waxwing slain / By the false azure in the windowpane;' },
  { id: 112, type: 'book', title: 'Angels in America: A Gay Fantasia on National Themes', creator: 'Tony Kushner', row: 1, col: 2, pos: 100, isbn13: '9781559367691', publisher: 'Theatre Communications Group', publish_year: 2013, excerpt: 'Hello and good morning. I am Rabbi Isidor Chemelwitz of the Bronx Home for Aged Hebrews.' },
  { id: 113, type: 'book', title: 'The Book of the SubGenius', creator: 'Rev. Ivan Stang / SubGenius Foundation', row: 2, col: 3, pos: 100, isbn13: '9780671638108', publisher: 'Simon & Schuster (Fireside)', publish_year: 1987, pages: 184,  },
  { id: 114, type: 'book', title: 'Revelation X: The "Bob" Apocryphon', creator: 'ed. Ivan Stang / SubGenius Foundation', row: 2, col: 3, pos: 101, isbn13: '9780671770068', publisher: 'Simon & Schuster (Fireside)', publish_year: 1994, pages: 182,  },
  { id: 115, type: 'book', title: 'Lolita', creator: 'Vladimir Nabokov', row: 2, col: 2, pos: 101, isbn13: '9780679723165', publisher: 'Vintage International', publish_year: 1989, pages: 317, excerpt: 'Lolita, light of my life, fire of my loins. My sin, my soul.' },
  { id: 116, type: 'book', title: 'Mage: The Ascension', creator: 'White Wolf Publishing', row: 2, col: 4, pos: 101, isbn13: '9781565044005', publisher: 'White Wolf Publishing', publish_year: 1997, pages: 296,  },
  { id: 117, type: 'book', title: 'Blood Treachery', creator: 'Scott Cohen & Steven DiPesa (White Wolf)', row: 2, col: 4, pos: 102, isbn13: '9781565044098', publisher: 'White Wolf Games Studio', publish_year: 2000, pages: 96,  },
  { id: 118, type: 'book', title: 'The Spirit Ways: A Guide to Shamans and Spirituality in Mage: The Ascension', creator: 'Eric P. Taylor, Rachel Barth, Scott Cohen & John Snead (White Wolf)', row: 2, col: 1, pos: 101, isbn13: '9781565044531', publisher: 'White Wolf Games Studio', publish_year: 1999, pages: 136,  },
  { id: 119, type: 'book', title: 'Prometheus Rising', creator: 'Robert Anton Wilson', row: 1, col: 1, pos: 101, isbn13: '9780692710609', publisher: 'Hilaritas Press', publish_year: 2016, pages: 321,  },
  { id: 120, type: 'book', title: 'Everything Is Under Control: Conspiracies, Cults, and Cover-Ups', creator: 'Robert Anton Wilson', row: 1, col: 2, pos: 101, isbn13: '9780061984310', publisher: 'HarperCollins', publish_year: 2009, pages: 456,  },

  // Same randomized-placement rule as the batch above — not from a shelf
  // photo, so row/col/pos are arbitrary.
  { id: 121, type: 'book', title: 'Daimonic Reality: A Field Guide to the Otherworld', creator: 'Patrick Harpur', row: 1, col: 2, pos: 102, isbn13: '9780937663097', publisher: 'Pine Winds Press', publish_year: 2003, pages: 329,  },
  { id: 122, type: 'book', title: 'Stories of Your Life and Others', creator: 'Ted Chiang', row: 1, col: 1, pos: 102, isbn13: '9781101972120', publisher: 'Vintage Books', publish_year: 2016, pages: 285,  },

  // Same rule as above: row/col/pos below are arbitrary, spread across
  // the existing book-only cubbies, not a record of physical placement.
  { id: 123, type: 'book', title: 'The Glass Bead Game', creator: 'Hermann Hesse', row: 1, col: 1, pos: 103, isbn13: '9780312278496', publisher: 'Picador USA', publish_year: 2002, pages: 558,  },
  { id: 124, type: 'book', title: 'Tord Boontje', creator: 'Martina Margetts (ed.)', row: 2, col: 4, pos: 103, isbn13: '9780847829293', publisher: 'Rizzoli', publish_year: 2007, pages: 240,  },
  { id: 125, type: 'book', title: 'Collected Poems', creator: 'James Merrill', row: 2, col: 1, pos: 102, isbn13: '9780375411397', publisher: 'Knopf', publish_year: 2001, pages: 885,  },
  { id: 126, type: 'book', title: 'Brave New World', creator: 'Aldous Huxley', row: 1, col: 2, pos: 103, isbn13: '9780060850524', publisher: 'Harper & Brothers', publish_year: 1932,  },
  { id: 127, type: 'book', title: 'Neuromancer', creator: 'William Gibson', row: 1, col: 1, pos: 104, isbn13: '9780441007462', publisher: 'Ace Books', publish_year: 2000, pages: 276,  },
  { id: 128, type: 'book', title: 'The Doors of Perception and Heaven and Hell', creator: 'Aldous Huxley', row: 1, col: 2, pos: 104, isbn13: '9780061729072', publisher: 'Harper Perennial', publish_year: 2009, pages: 208,  },
  { id: 129, type: 'book', title: 'Food of the Gods', creator: 'Terence McKenna', row: 1, col: 2, pos: 105, isbn13: '9780553371307', publisher: 'Bantam', publish_year: 1993, pages: 336,  },
  { id: 130, type: 'book', title: 'The Planetary Omnibus', creator: 'Warren Ellis (art by John Cassaday)', row: 2, col: 3, pos: 102, isbn13: '9781401242381', publisher: 'DC Comics (WildStorm)', publish_year: 2014, pages: 864,  },
  { id: 131, type: 'book', title: 'The Cosmic Serpent: DNA and the Origins of Knowledge', creator: 'Jeremy Narby', row: 2, col: 1, pos: 103, isbn13: '9780874779646', publisher: 'Tarcher', publish_year: 1999, pages: 272,  },
  { id: 132, type: 'book', title: 'Trickster Makes This World: Mischief, Myth, and Art', creator: 'Lewis Hyde', row: 2, col: 2, pos: 102, isbn13: '9780374532550', publisher: 'Farrar, Straus and Giroux', publish_year: 2010, pages: 417,  },
  { id: 133, type: 'book', title: 'The Kybalion: Hermetic Philosophy', creator: 'Three Initiates', row: 1, col: 2, pos: 106, isbn13: '9780143131687', publisher: 'TarcherPerigee', publish_year: 2018, pages: 176,  },
  { id: 134, type: 'book', title: 'Kitchen Confidential', creator: 'Anthony Bourdain', row: 2, col: 4, pos: 104, isbn13: '9780060899226', publisher: 'Harper Perennial', publish_year: 2007, pages: 352,  },
  { id: 135, type: 'book', title: 'The Invention of the Zero', creator: 'Richard Kenney', row: 2, col: 2, pos: 103, isbn13: '9780679749974', publisher: 'Knopf', publish_year: 1995, pages: 158,  },
  { id: 136, type: 'book', title: 'The 39 Steps', creator: 'adapted by Patrick Barlow, from John Buchan and Hitchcock', row: 2, col: 3, pos: 103, isbn13: '9780573697142', publisher: 'Samuel French', publish_year: 2009, pages: 105,  },
  { id: 137, type: 'book', title: 'The Squared Circle: Life, Death, and Professional Wrestling', creator: 'David Shoemaker', row: 2, col: 4, pos: 105, isbn13: '9781101609743', publisher: 'Avery', publish_year: 2013,  },
  { id: 138, type: 'book', title: 'The Hobbit and The Lord of the Rings', creator: 'J.R.R. Tolkien', row: 2, col: 1, pos: 104, isbn13: '9780544445789', publisher: 'Houghton Mifflin Harcourt', pages: 1504,  },
  { id: 139, type: 'book', title: 'Holy Blood, Holy Grail', creator: 'Michael Baigent, Richard Leigh, and Henry Lincoln', row: 1, col: 1, pos: 105, isbn13: '9780385338455', publisher: 'Delta Trade Paperbacks', publish_year: 2004, pages: 489,  },
  { id: 140, type: 'book', title: 'Wiseguy', creator: 'Nicholas Pileggi', row: 2, col: 2, pos: 104, isbn13: '9781982129903', publisher: 'Simon & Schuster', publish_year: 2019, pages: 304,  },
  { id: 141, type: 'book', title: 'Alexander McQueen: Savage Beauty', creator: 'Andrew Bolton', row: 2, col: 4, pos: 106, isbn13: '9781588394125', publisher: 'Metropolitan Museum of Art', publish_year: 2011, pages: 240,  },
  { id: 142, type: 'book', title: 'The Godfather', creator: 'Mario Puzo', row: 2, col: 3, pos: 104, isbn13: '9781101043110', publisher: 'Penguin',  },
  { id: 143, type: 'book', title: 'The Shining', creator: 'Stephen King', row: 1, col: 2, pos: 107, isbn13: '9780345806789', publisher: 'Anchor Books', publish_year: 2013, pages: 659,  },
  { id: 144, type: 'book', title: 'It’s Not About the Money', creator: 'Brent Kessel', row: 2, col: 1, pos: 105, isbn13: '9780061234064', publisher: 'HarperOne', publish_year: 2008, pages: 336,  },
  { id: 145, type: 'book', title: 'Decreation: Poetry, Essays, Opera', creator: 'Anne Carson', row: 2, col: 2, pos: 105, isbn13: '9781400078905', publisher: 'Vintage', publish_year: 2006, pages: 272,  },
  { id: 146, type: 'book', title: 'Snake ’n’ Bacon’s Cartoon Cabaret', creator: 'Michael Kupperman', row: 1, col: 1, pos: 106, isbn13: '9780380807901', publisher: 'HarperCollins', publish_year: 2000,  },
  { id: 147, type: 'book', title: 'Nobilis, Livre de Base', creator: 'Jenna Katerin Moran (French edition)', row: 2, col: 3, pos: 105, isbn13: '9782970031406', publisher: 'Black Book Éditions',  },

  // Same rule as the other ISBN-only batches above: these three came from
  // ISBNs Scott provided directly (2026-09-01), not a shelf photo, so
  // row/col/pos below are arbitrary — spread across existing book cubbies,
  // never the film-only ones. No `excerpt` on any of the three: unlike the
  // rest of this catalog (mostly public-domain classics or short passages
  // already confirmed against a specific print edition), these are all
  // still-in-copyright 20th-century children's books, and a search-sourced
  // quote wasn't confirmed precisely enough against this specific edition's
  // text to print with the same confidence the rest of the shelf's excerpts
  // carry — same standing not-guessed rule as everywhere else in this file,
  // applied to the excerpt field this time instead of the ISBN.
  { id: 148, type: 'book', title: 'Mrs. Piggle-Wiggle', creator: 'Betty MacDonald', row: 1, col: 1, pos: 107, isbn13: '9780064401487', publisher: 'HarperCollins', publish_year: 2007, pages: 144, catalog: 'first published 1947; this specific ISBN edition is illustrated by Alexandra Boiger (earlier printings were illustrated by Hilary Knight — illustrator intentionally not treated as settled beyond this edition\'s own credited artist).' },
  { id: 149, type: 'book', title: 'Pippi Longstocking', creator: 'Astrid Lindgren', row: 1, col: 2, pos: 108, isbn13: '9780142402498', publisher: 'Puffin Books (Puffin Modern Classics)', publish_year: 2005, pages: 160, translator: 'Florence Lamborn',  },
  { id: 150, type: 'book', title: 'Encyclopedia Brown, Boy Detective', creator: 'Donald J. Sobol', row: 2, col: 2, pos: 106, isbn13: '9780142408889', publisher: 'Puffin Books', publish_year: 2007, pages: 96,  },
];

// ─────────────────────────────────────────────────────────────────────────

// CD rack catalog — perceptualmechanics.com library scene.
//
// Unlike the bookshelf above, this collection is NOT catalogued
// from a real physical shelf. Scott doesn't own any of these CDs anymore; this
// is an invented-but-plausible "collection I wish I still had" built up together,
// album by album, across a long conversation. Every entry below was explicitly
// requested, accepted, or left unobjected-to by Scott during that dictation —
// nothing here is filler invented unilaterally.
//
// Per the site's hard convention (see library.js header, this folder), there is no
// real cover art anywhere in this scene — CD spines are canvas-drawn schematic
// textures only, artist/album as plain text.
//
// CDs open the same #library-panel every book and film already uses.
// Each entry below carries `video` (a short description of what the clip
// shows — mirrors `scene` on the film entries in library.js) and
// `youtube` (a real, verified video URL: an official music video where
// one exists, otherwise a genuine live performance of a song from that
// specific album — never a generic "best of" or an unrelated song). Every
// URL below was pulled from an actual web search result, never
// fabricated — for a handful of older/scene-less tracks (ambient pieces,
// some jazz, some Krautrock) no traditional "video" exists, so the
// closest genuine real thing (a live performance, an official audio
// upload, or a documented archival video) was used instead.

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
  { id: 115, artist: 'The Beach Boys', album: 'Pet Sounds', video: '"God Only Knows," the band\'s best song', youtube: 'https://www.youtube.com/watch?v=M0lj3WX_5ps' },
];
