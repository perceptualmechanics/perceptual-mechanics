// ─── Poems ─────────────────────────────────────────────────────────────────
// Full, unedited verse (Scott's own writing), pulled from a search of
// archives/Writing archive/ (2026-07-17) specifically for poetry — a
// different register from everything else already wired into the site,
// which is mostly prose (the scroll's essays and short fiction) or found
// fragments (Golden Hare, the Orrery). Not yet placed in any scene — this
// file exists so the text is captured and ready, same reasoning as
// scrollTexts.js: get the source down first, decide the container later.
//
// A handful of files (Apocrypha.doc, "The way her hips sway is unique.doc",
// "here comes no sun today.docx", "(Underneath scams and heart attacks,.pdf")
// open with a few real lines of verse and then dissolve into the same
// trance/stream-of-consciousness prose that runs through a lot of the
// archive (the "Void" / "Slack" private mythology material, already noted
// in NOTES.md from earlier sessions). Those openers used to be kept in a
// separate `poemFragments` export, held apart on the theory that they
// weren't "complete" poems — Scott's call (2026-07-17): they're all poems,
// they're all equal, so they live in `poems` now too, each with a `note`
// explaining where its source text runs on into prose.
//
// Two sources, with one deliberate overlap:
//
// - "Scott Jason Cohen's Assembled Verse.doc" is a curated collection —
//   eleven titled, polished poems. Everything under `poems` up through
//   `haiku` comes from here, transcribed exactly as assembled.
// - "thirty-six.doc" (also present as thirty-six.rtf) is a much larger,
//   unedited 13-part cycle in three movements — "I: things unspoken,"
//   "II: cloudburst," "III: caught up" — that reads like a single
//   narrative: an unexplained encounter, the doubt and isolation
//   afterward, and an uneasy landing. It turns out to be the source
//   manuscript for three of the Assembled Verse poems: "Lament for the
//   Future Never Realized" pulls parts 1, 3, and 4 from here (dropping
//   part 2 and lightly retitling), "Moon Song" is part 9 verbatim, and
//   "Raise a Glass" is part 11 with a few small word changes. Only that
//   later, polished excerpt (`Lament for the Future Never Realized`
//   below) is transcribed in this file — the full earlier cycle,
//   including the eight parts (2, 5, 6, 7, 8, 10, 12, 13) that never made
//   it into Assembled Verse at all, hasn't been typed up here. Worth
//   doing later if that rougher material ever wants its own place.
//
// Update (2026-07-17, cycle.js rebuild): part of that "worth doing
// later" happened sooner than expected. Rebuilding the Cycle scene
// around an elemental/angelic structure sent a fresh search back
// through the archive, and it landed on thirty-six.doc again — this
// time for the untyped rough material. Part 8 (a five-figure ritual
// scene) splits at its own natural mid-poem pause to ground Raphael
// (earth half) and Emmanuel (water half); part 13's closing movement
// grounds Nature/Malkuth. So thirty-six.doc now has five of its
// thirteen parts live across the site — 1/3/4 as Lament above, 9 as
// Moon Song, 11 as Raise a Glass, and 8/13 in the Cycle scene — with
// six (2, 5, 6, 7, 10, 12) still unplaced.
//
// "DNA" (from Nucleus.doc / Nucleus.rtf) is a third, separate source —
// short, finished, explicitly dated: "© 2007 Scott Jason Cohen" sits right
// under it in the source file.
//
// The last four entries below ("Apocrypha," "The way her hips sway is
// unique," "here comes no sun today," "(Underneath scams and heart
// attacks,") are each their own fourth-and-on source — the verse opening of
// a longer prose piece, not part of Assembled Verse or thirty-six.doc.

export const poems = [
  {
    title: 'Courtesans of the Old World',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    stanzas: [
      `O my lovelies, for a song in Paris.
On every corner I turn, see your
Nonchalance (well-practiced), your look
Centuries old and waiting for something
Richer than jewels, gold, the treasures of
The pharaohs –`,
      `There you are, hidden behind bulletproof glass,
Isolated and precious beyond words.  There you are,
Lighting my cigarette in a crowded bar.  There
You are, face buried in the crook of your
Girlfriend's neck on the ride between St. Paul
And the Louvre –`,
      `La belle dame sans merci?  Are you kind or
Thankful?  I'm unaware of rogue steps, shy
And timid along the Champs-Elysees, gently
Avoiding the whys and wherefores of international
Commerce, brief transactions in alleyways and
Cheap hotels –`,
      `Leave it be.  We'll burn it down and start again,
Like you've done countless times before, stringing
Along the boulevards and masses, in triumph and
Defeat; I will leave here untouched but certainly not
Unwanted.`,
    ],
  },
  {
    title: 'Springtime in the Garden',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    stanzas: [
      `Heat is a pool, and I'm up to my neck in it.
Wading through, it seems the insects don't mind.
They know how to walk on water.
Up from the winter of this our new millennium
(Did it really go on this long?), they're
Making up for lost time, and Lord knows
The flowers will be happy for it.  There's
A glow coming off these golden buds, microscopic,
Every cell throbbing with the task at hand,
Seedlings blanketing the brick, uselessly
Strewn everywhere – my dear, don't you know
Your wasted effort?  She doesn't care –
She's good that way.  The bees are thrilled,
Doing God's good work, poor things – such a rough life.
I'd happily die if someone threatened my hive.
Plunge my barb deep as I could go, release my
Toxin, and rip away, my last smiling joy
Carried on pheremones to my siblings.`,
    ],
  },
  {
    title: 'Prologue',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    stanzas: [
      `Maestro, if you please:
A single spotlight,
Illuminating
Me from head to toe.`,
    ],
  },
  {
    title: 'Raise a Glass',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    stanzas: [
      `Burnt beyond recognition,
	Spontaneously
	from the inside.  The remains
fit into a small glass jar, carried
	by the headmaster as he
	strode across campus.  It
was unlike any sample he
had previously obtained.`,
      `In the lab, the bone fragments
	had their code extracted,
	dripping like absinthe, golden-
honey nectar hallucinogen,
	swirling around a Jacob's
	ladder of glassware.  Two currents
sparked to life, leaving the professor
	perplexed and innately interested.
	The latticework is undamaged.
No coat of paint needs to be reapplied.`,
      `Carpenters and chanteuses
	occupy the middle lodge.
	The sickly-sweet liquid
was brought before them, the glass
	resonated, the Brownian
	motion harmonized with a
frequency echoed by angels.
Nothing bubbled over, thank Goodness.`,
      `Distilled, concentrated, a
	single drop dabbed into either
	eye, this project thrust back into
azure-blue and bumblebee,
	the answer howling, the oft-
	repeated sentiment come
true that this one is special, he
wants a nipple before he
opens his eyes.`,
    ],
  },
  {
    title: 'Lament for the Future Never Realized',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    note: `Scott's own later excerpt of "thirty-six.doc" (a longer, unedited 13-part source cycle, not itself included in this file) — parts 1, 3, and 4 of that cycle, retitled and lightly polished, part 2 dropped entirely.`,
    stanzas: [
      `I.`,
      `On a hill,
Sentry to a field:
Greey-gray grass
Holds twelve stones,
Monuments to ghosts
Never buried.`,
      `The shine, the steel:
The towers were here,
Jutting towards sky
While airships careened,
Dazzling masses.
And wind carried words
And inspired ideas
Of freedom for all,
Of a life unfettered
And helium-filled,
Where the clouds
Where our neighbors
And the sun
Was our friend.`,
      `But windows shatter,
Mirrors darken,
Sun to nightfall,
Rusted engines
Belching smoke
Upon the dreams
Of the future
That never was.`,
      `And the stones' carving
In tongues long lost
Demands the answer:
Where did it all go?`,
      `II.`,
      `Six thousand horses drag instant destruction to
Infinite howitzers waiting for cover so
No one will blame them when lightning rains down upon
Helpless civilians with unbroken faith in God.`,
      `Enemy staggers towards endless oasis, fill
Canteens with alcohol, marching through desert to
Circle the wagons of prairie companions whose
Heads are quite buried in pillows of genocide.`,
      `Kansas plain winter with snow killing sheep exposed;
Pheasants for hunting by small-minded farming folk
Starved to attrition, their banquets begotten to
Merciless white men with rings shining dully on`,
      `Clear winter night above Lincoln, Nebraska, where
Lovers kill cheating hearts, buried in graveyards with
Ravens as witnesses, all-seeing dead of night,
Lonely old tombstones, forgotten to everyone.`,
      `New baby born to an unmarried couple, their
Product of union has other relations who
Hover in winter night, waiting for omens to
Signal the finals when nothing will grow again.`,
      `III.`,
      `Nikola, with face aglow,
Hums tunelessly to Debussey.
Hydrogen holds him aloft
Above the neon coral reef.`,
      `The airship docks right next to Wells,
Whose absent-minded wave hello
Resounds with ancient science past
When Aristotle thought aloud.`,
      `The sky is filled with floating lights
Conveying masters of the art
To supper clubs of life and lamb,
And later, brandy and cigars.`,
      `Into the lift, where Gerald-3
Propels him with metallic arms
To the Great Hall of Gernsback's dream
Where urgent business beckons all`,
      `Who toil for years with chemicals,
Where vacuum tubes hum constantly,
Who slave and sweat and bleed and die
To bring the spark into the night.`,
      `And here they sit, the masterminds
Of this, our polished Paradise.
Nik nods to Jules, he takes his seat –
First course served.  A plate of greens.`,
      `The Doctor rises, clinks his glass
As alabaster Isaac's bust
Surveys the scene, nestled between
Ptolmey and Copernicus.`,
      `"Now, dear friends, forgive the tone
That soon will shroud our evening meal.
For soon, if forecasts are correct,
Our Grand Design will soon be lost."`,
      `Outrage overcomes the room,
As protests cast a noisy din.
"Gentlemen! – and Madame C –
We must retain our dignity!`,
      `Machines we made with motives pure
To liberate our fellow man.
But now our nations take our work
And try to build a slaughterhouse!`,
      `Yes, soon, my friends, one maddened Serb
Will send this world down into Dis!
And our machines will be usurped
To kill the hope within Man's breast!"`,
      `"What can we do?" the question raised.
"We'll fight them!"  "No, we're pacifists!"
"Jump to the future!" says old H.G.
"Alas!" says Verne.  "Into the sea!`,
      `Perhaps the Moon!  Or maybe Mars!"
It's going nowhere.  Chaos reigns.
The makers threaten everyone
Till Nikola proclaims, "Ahem!`,
      `Gentlemen, Madame Marie,
If this is true, then we are next!
The masses, full of casualties,
Will blame our visionary band!`,
      `For, as the advocates of peace,
We all will fall to Industry
As Henry's line cranks out disease
To buy himself his last release!`,
      `It pains me, but our course is clear.
To stop the war, we disappear
From public sight, and work at night
To counteract our enemies!`,
      `For they will win – they have the tricks,
The dollar bills, and Randolph Hearst.
Gentlemen, we must retreat
To live to fight another year."`,
      `The words sink in, the nods accrue...
To disappear from public view.`,
      `A puff, a sip is all it takes...
We must preserve the human race.`,
      `Through mustard gas and Holocaust,
The work, no matter what the cost,`,
      `Goes on, up to the present day,
Above midwestern U.S.A.`,
    ],
  },
  {
    title: 'Moon Song',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    stanzas: [
      `Hello, Phoebe, Lady of Veils –`,
      `	I'm on your level now.`,
      `		Flooring flowing we will try to enjoy
					our stay`,
      `	rarefied heights, into thin air
		amber-silver blood circle,
		   stones clamoring for
		      single touch from mother,`,
      `	such a disconnection, it can only be
		determined –`,
      `	who I am, without a masque,
		without a game to hide behind,`,
      `	we make our descent, feet
		dug in sand,`,
      `	walking to warm water,
		suspension fluid matrix,`,
      `	silver flagellant fish,
		green clear saltwater,`,
      `	laughing through waves
		washing me ashore.`,
      `This is the lost, the first, Om-Alpha,
	the egg giving way to the peacock of fire,
Beloved me, first born of facewear,
	Whose elegant touch refines the spun web
Into garments of moonsilk, a latticework ladder
	Ascending from boneyard to Arcadia.`,
      `	Take this, nail it on the door,
	  and pray they understand.`,
    ],
  },
  {
    title: 'After Auden',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    stanzas: [
      `A moon falls into seltzer
	While a tea envelops time.
Now there's no one there to help her
	When I sunder what is mine.`,
    ],
  },
  {
    title: 'The Lovers',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    stanzas: [
      `Their fingers, calloused and tired,
Still glowed with a magnetic
Pull nearly impossible to resist.
The hall of mirrors, the floor show,
The seeing eye did their best
To polarize them, but it seems
Physics has a heart all its own.`,
    ],
  },
  {
    title: 'Haiku',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    stanzas: [
      `It feels like her tongue
Parting the walls of desire
Against both our wills.`,
      `Her bare, sanguine arms
Writing, typing, smoothing down
Errant hair of babe,`,
      `Her jeweled forehead
Glowing, growing wet with thought,
Reflecting the light`,
      `Pouring down and through
Her eyes, nerves, cells, all the while
Still a mystery`,
      `Yet to be revealed
To me or millions, waiting
For the proper time`,
      `When pen hits paper,
Thought meets fiction, and the words
Flow forth perfectly.`,
    ],
  },
  {
    title: 'DNA',
    source: `Nucleus.doc / Nucleus.rtf`,
    note: `© 2007 Scott Jason Cohen — the only poem in this file with an explicit date and copyright line in the source.`,
    stanzas: [
      `As the congregation rises, the doors
Slide open; the rabbi raises up the
Twin scrolls, dictated by God, from the ark.
Uncovered, unrolled, the sacred letters
Reveal themselves, the primeval sequence
Coalescing into the stuff of life
(Word and phrase manifesting character).
The parashah read aloud, the message
Replicates in the hearts of the gathered;
The Sefer Torah is recoiled, restored.`,
    ],
  },
  {
    title: 'Apocrypha',
    source: `Apocrypha.doc`,
    note: `The verse that opens the piece — the rest of Apocrypha.doc dissolves into the same trance/stream-of-consciousness prose that runs through a lot of the archive.`,
    stanzas: [
      `An almost hysterical purity obvious in steel blue eyes
Cascades down rough-hewn, scarred cheeks carved by wind and loss,
With a waterfall working down the crevasses,
Coalescing into buoyant green somewhere around the chin.`,
    ],
  },
  {
    title: 'The way her hips sway is unique',
    source: `"The way her hips sway is unique.doc"`,
    note: `Titled with its own first line, same as the piece below. A few more short verse passages ("Your eyes are questing...") are scattered through the prose that follows.`,
    stanzas: [
      `Shades of recognition,
Echoes telling me that this scene
	has been played before.
Not deja vu, but a sense of an
	assumed role
That I've stepped into once again.
We might need a rewrite.`,
    ],
  },
  {
    title: 'here comes no sun today',
    source: `"here comes no sun today.docx"`,
    note: `Also titled with its own first line.`,
    stanzas: [
      `here comes no sun today
here comes a sterling gay
here sometimes we are weird
here somethings get real queer`,
    ],
  },
  {
    title: '(Underneath scams and heart attacks,',
    source: `"(Underneath scams and heart attacks,.pdf"`,
    note: `Also titled with its own first line; the prose that follows references "The Machinist's Union," a separate piece elsewhere in the archive.`,
    stanzas: [
      `(Underneath scams and heart attacks,
What yearns for us? A pulse,
Two fingers across the neck
To confirm signs of life.)`,
    ],
  },
];
