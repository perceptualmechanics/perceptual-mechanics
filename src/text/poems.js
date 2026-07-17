// ─── Poems ─────────────────────────────────────────────────────────────────
// Full, unedited verse (Scott's own writing), pulled from a search of
// archives/Writing archive/ (2026-07-17) specifically for poetry — a
// different register from everything else already wired into the site,
// which is mostly prose (the scroll's essays and short fiction) or found
// fragments (Golden Hare, the Orrery). Not yet placed in any scene — this
// file exists so the text is captured and ready, same reasoning as
// scrollTexts.js: get the source down first, decide the container later.
//
// Not every poem-shaped thing in the archive is here. A handful of files
// (Apocrypha.doc, "The way her hips sway is unique.doc", "here comes no sun
// today.docx", "(Underneath scams and heart attacks,.pdf") open with a few
// real lines of verse and then dissolve into the same trance/stream-of-
// consciousness prose that runs through a lot of the archive (the "Void" /
// "Slack" private mythology material, already noted in NOTES.md from
// earlier sessions) — those openers are kept separately, below, as
// `poemFragments`, since they're real but not self-contained poems.
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
//   "Raise a Glass" is part 11 with a few small word changes. Both
//   versions are kept: `lamentForTheFutureNeverRealized` as Scott's own
//   later, polished excerpt (his editorial choice, worth respecting as
//   its own thing), and `thirtySix` as the full, earlier, rougher cycle —
//   which includes eight parts (2, 5, 6, 7, 8, 10, 12, 13) that never
//   made it into Assembled Verse at all. If "Lament" and "Moon Song" and
//   "Raise a Glass" are the only parts of this that have been read before,
//   there's a whole second cycle's worth of material below that hasn't
//   been.
//
// "DNA" (from Nucleus.doc / Nucleus.rtf) is a third, separate source —
// short, finished, explicitly dated: "© 2007 Scott Jason Cohen" sits right
// under it in the source file.

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
    title: 'Obvious',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    stanzas: [
      `I'm afraid I won't be seeing all those strange and distant lands,
For I lay here, cold and dying, and my blood is on your hands.
There's an angel riding shotgun, but I'm nothing to declare;
All my lies and aggravations saunter by your thoughtful stare.
You are naked and observant, and a credit to your place,
But I can see eclipses forming on your perfect face.
And a song is softly playing and a fire has been lit
And you are naked but unwilling and I am champing at the bit.
The sun has done its damage, and it's chilled me to the bone.
Heaven's drawing nearer, but there's no one on the throne.
So my life is slowly ebbing, and I cannot help but smile;
Your remorseful tears console me even as they turn to bile.
And I've spent my final dollar gaining entrance to the hall,
But there's no one here, it's empty, everybody took the fall.
So just leave me here to fester, I won't bother you no more –
As you cry your way to Heaven, please be sure to close the door.`,
    ],
  },
  {
    title: 'Lament for the Future Never Realized',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    note: `Scott's own later excerpt of "thirty-six" (see \`thirtySix\` below) — parts 1, 3, and 4 of that cycle, retitled and lightly polished, part 2 dropped entirely.`,
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
    title: 'Last Words on the Sea Witch',
    source: `Scott Jason Cohen's Assembled Verse.doc`,
    stanzas: [
      `If form follows function,
I'll have to figure out where you fit in.
I had a charming little citadel,
Complete with Greek columns,
And it all sunk in the swamp.
And you did it all with one groping hand.`,
      `If I give you form, will you go away?`,
      `We played a game, you and I,
Called Trimming the Hedges,
Or Shaving the Prunes,
Or whatever.`,
      `I traded my high moral ground for a highchair.`,
      `I shall miss your breasts,
Though your face was a mess.
Your plum-colored nipples
Match the stars on your skin,
And your junkie body
That women have died for
Reminds me that you're still a child.`,
      `And I fell on my knees for this?`,
      `Under a Hot Moon,
We played out a comic drama
That I now refuse
To take personally
Or seriously.`,
      `So there we are, sadder, wiser, and open for business.
Love ain't grand, but it does have its moments.`,
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
    title: 'thirty-six',
    source: `thirty-six.doc / thirty-six.rtf`,
    note: `The full, unedited 13-part cycle. Parts 1, 3, and 4 became "Lament for the Future Never Realized" above; part 9 became "Moon Song"; part 11, lightly reworded, became "Raise a Glass." Parts 2, 5, 6, 7, 8, 10, 12, and 13 — most of it — never made it into Assembled Verse.`,
    stanzas: [
      `I: things unspoken`,
      `1`,
      `On a hill,
Sentry to a field:
Green-gray grass
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
Were our neighbors
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
      `2`,
      `February is the cruelest month, bleeding
Over like pixels saturated to the
Bursting point with information.  Unfounded
Ice has lined the streets, throwing
Travel back to a caveman proposition –
But I have no chains on my wheels.  Rather,
I glide about the dirty sidewalk smiling
As to my good fortune – a job, a lover,
Rekindling the smith's furnace, as I
Readjust to natural timeshares reeling
From a digital overload of unwanted news
Foist upon my back, weighed down with
Gossip which I find myself avoiding
With all the dexterity I can muster.
Life is good, regardless of the plans
I've put on hold, the dreams I'm neglecting,
The cross I bear that no one asked me
To take up.  But – what price freedom?`,
      `The shoppers scuttle to and fro, running
From Tower to Gap, searching for the
Right accouterment to fit that one
Last piece of the puzzle – the gaping
Maw that can never be appeased, not
That they'll stop trying.  Nor, for that
Matter, will I – although I'm almost starving,
Compact discs have lured me from my home
With siren songs of art and lifestyle, both
Equally heady to my millenial ears.  Whistling
An aimless tune, I float above the mall-borne
Din – or so I think – seeking store-bought soulfood
That looks great, even though it's brimming
With fat and rot and speed and slop and
All once-natural ingredients mined out for endless
Iterations along a one-note theme.  Never doubting
My direction, I head for a record store with
The standard fare but the right atmosphere.`,
      `And then I see it.`,
      `Grey blanket snaps and tears,
Sunlight breaks through, golden
Tones rejuvenating the pallid
Scene with forgotten color.`,
      `And when the cloud breaks,
A silver-shaped cigar
Hovers high in heaven –
Oblong shape reflecting`,
      `Upon me.  No one
Sees it before the sky
Closes again, leaving me
Its only invited guest.`,
      `3`,
      `Six thousand horses drag instant destruction to
Infinite howitzers waiting for cover so
No one will blame them when lightning rains down upon
Helpless civilians with unbroken faith in God.`,
      `Enemy staggers toward endless oasis, fill
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
      `And one baby hybrid with feet firmly planted in
Half-and-half universe will save us from evil, or
Help us uncover the Hell that we tunneled for.`,
      `4`,
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
Propells him with metallic arms
To the Great Hall of Gernsback's dream
Where urgent business beckons all`,
      `Who toil for years with chemicals,
Where vacuum tubes hum constantly,
Who slave and sweat and bleed and die
To bring the spark into the night.`,
      `And here they sit, the masterminds
Of this, our polished Paradise.
He nods to Jules, he takes his seat –
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
      `5`,
      `"And someday we will all be dead,
Our leaden ash perfumes the ground
And tra-la-la, we'll dance around
The earth with ballerina wind.`,
      `Until the axe, though, here we stand
Above the lake of fire and sky;
We'll shake our heads and wonder why
They all obsess about the end.`,
      `For – don't you know? – the masters come
In ships of SuperUltraSteel!
They won't destroy – oh no, they'll heal
The miseries of Planet Earth!`,
      `And then, when all the work is done,
They'll take us back to Zeta R!
You don't believe?!?  I know they will –
They told me during surgery!"`,
      `So said the fool, one grand "What if?",
Before he toppled off the cliff.`,
      `6`,
      `A flaming peacock once said there was NO ACCIDENT.
Call me skeptic, call me humanocentric,
But Free Will's much more palatable to me.
To think, all my actions thought out in advance –
Didn't Heisenberg disprove that notion?
I don't think God's tending every butterfly.`,
      `Still – I've had things happen that could only be
Kismet, Fate or Synchronicity.
And yes, I've been visited – not by spindly Greys,
But muses, angels, and Earth-bound Titans
Who have all called me friend, companion
And medium for the message they have.`,
      `After I saw...well, whatever it was I saw,
I looked around me – nope, a solo performance.
So what was it?  Oh, the possibilities.
You got an hour or two?  Because between
My friends, my books, and the World Wide Web,
I've got theories that'll make you cringe.`,
      `I'll ignore the obvious – 'twas not a plane.
I'm sure of that – it had no wings.  All right?
Furthermore, don't bore me with your worn-out
Weather balloons and swamp gas and the oh-so
Convenient "hallucination."  Don't try to explain
Away my miracle, you understand?`,
      `Right.  UFO?  What the hell is a UFO?
It certainly fits all three criteria.
But let's not make the oh-so-tempting leap
And say it was full of Little Green Men;
I'm trying to remain objective,
And think things through rationally.`,
      `Sigh.  Oh, fine.  Off to alt.conspiracy,
That breeding ground of paranoids.
A quick scan for New England sightings
Within the recent weeks turns up nothing.
But these other threads – oh, for Christ's –
Please get over JFK already!`,
      `And Princess Di, and Littleton, and movements
Linking every event in history!
Go scrub the pyramid with the eye
Squeaky clean with mescaline – thanks, Bill –
And go outside!  Don't you people live?
"Kathie Lee's the Antichrist!"  Oh, God.`,
      `O Internet, as quick as death, congrats.
You've robbed us of our gentle thought pace.
Now faster, faster, faster, new, MORE! Is the mantra
Your backbone vibrates with.  It's no use.
There's so much information, so little wisdom.
Click.  Jacket.  To the porch to smoke it out.`,
      `The storm clouds perform that neat trick where
They cover everything except the horizon,
Where the setting sun illuminates a pink membrane
Surrounding us – it's like cotton candy silk
That hovers, substituting for ozone
As our temporary security blanket.`,
      `Soon, night will descend upon me.  Double sigh.
I'll inhale, drag, stare at the stars for hours
Waiting for my UFO to start the second movement
Of this new plotline I fell into by accident –
Oh, wait, that's right – accident by design.
The heavens contemplate.  As do I.`,
      `II: cloudburst`,
      `7`,
      `So: resolved, I'm not getting anywhere.
Endless quests of longing and hoping
Bouncing back at me like a paddle ball.
Endless frustrations – surely it has to happen
Soon! – plague me for days on end.
Is it out of my hands?  It is left to fate?
Patience is a virtue in name only.`,
      `The box is on the fritz, and my data's
Corrupted – Jesus, how many viruses?
A forward momentum hurtling me towards –
What?  What grand adventure lies ahead?
Or is it all in my mind?  My teeth clench.
God, I ache for release, I'm dry-humping
The caverns of my mind looking for answers.`,
      `And all these promises I've made to myself,
Half-hearted dares to "improve" my lifestyle;
Still smoking, still lazy, still inactive.  Maybe
Destiny's waiting for me to make the first move,
Or maybe it's all for nothing – Christ, is this
All I have to look forward to?  My daily grind for
My daily bread – conveyor belt straight to Hell.`,
      `Maybe I'm out of my mind.  Libra sun and
Gemini moon oscillate between my ears,
Generating voltage for – what?  This?  Epic
Thoughts of mediocrity appeal to me right now,
Daily gnats of uncaring narcosis like a gateway
Drug, waiting for another addiction to arise
Within me.  Or maybe I'm just crazy.`,
      `Porch, smoke, sigh.  Did I see something?  Forget
Imagination, that vaunted catch-all for anything
We can't explain – maybe it's all in my head.
What I want is some proof – something clear out
Of the blue to put a gold star on my lapel
And say, "He's the one!  He got it!"  But wanting
Something just insures it'll never arrive.`,
      `The lady wears a veil tonight, crazy Luna
Casting downward on her wayward children.
Acne scars, construction sites, pollution of the
Pool – we don't swim in her toilet (oh, that's bad).
Damnit, it's cold – where's this vaunted Spring
I've heard so much about?  The trees are blooming,
Where's the sun?  Where's the phoenix igniting?`,
      `The moon says something.`,
      `I swear it happens.  The moon, Luna's face,
Her mouth moves.  I can't hear it, but her lips move,
Speaking – or blowing me a kiss?  What's going on?
What did you say?  Answer me! – But the lady
Vanishes behind a wall of cloud.  Wait!  Come back!
I didn't catch that!  Please – please answer me...
Don't you know I've waited my whole life for this?`,
      `Then right side awash in water, left side burns
With power.  The lady's there, caressing my right cheek,
While someone else radiates pure will in my left hand.
Patience, darling.  Soon, you'll know.  Soon, you'll see.
You are cleansed, washed clean of doubt, of fear,
And there's your brother, eager to begin the work,
Your phoenix wrapped in angel's garb.  She's gone,`,
      `But not forgotten.  Not tonight.  Visiting is easy,
Visiting is good – to scorch the tunnels etched in
My brain, then cool down and give the metal form.
Steam from my mouth – the ash is long – I didn't know
Life could be so confusing, so chaotic – and yet so
Wonderful.  And I remind myself, not for the last time,
There are no easy answers – only ones we remember.`,
      `8`,
      `We
Who shall ever be named
Heretic,
Warlock,
Sorcerer,
We who call the storms
Are marching up the moor.`,
      `They
Who were named as
Pagan,
Sinner,
Demon,
They left a monument
Radiating with power.`,
      `The circle, long since abandoned,
Purged by cross and steel,
Waits patiently under clouds
For new denizens to take up
Residence in its shadow.`,
      `Mercurius reached it first,
Racing up the hill shouting
With glee.  Josiah was second,
Harnessing the power within
Himself.  Angela and I`,
      `Followed respectfully.  And
Dear Phoenix, cloaked in white,
Was the last to arrive.
We took our stations,
Surveyed the monument.`,
      `I drew the pentagram,
Linking five in one in
Fallow earth.  The aspect
Wavers – for a moment,
The stones are towers,`,
      `Reflecting infinity
Within each other.  A shiny
Iron disc, a glowing
Red light – then nothing.
Surely fae were about.`,
      `Angela took her loving cup,
And water flew, drenching
Everything.  The clouds
Relented.  The power roiled
Beneath our feet.  Air`,
      `Drew his sword, a dervish
Dance, fluid motion slicing,
Cutting cobwebs – Mercurius
As subtle as the wind
Itself.  Josiah drove his staff`,
      `Into the ground, and the sun
Broke through, watching
Us and watching brother
Phoenix remove his mask
And all was flame and`,
      `Light and storm and quake.
They never found us.`,
      `9`,
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
      `10`,
      `All right, maybe I didn't see nothing.`,
      `Okay?  I didn't see it.  It never happened,
It was – I don't know, a daydream or an
Airplane or a zeppelin for all I fucking know.
NOTHING HAPPENED.  Fine.`,
      `It's a dull lament I mutter, because I gave up.
I have more pressing things to work on – web
Site, wolf game, spending my newly-won
Earnings, making references to Star Wars
(Even though, to be quite honest, I can't
Stand the thing, and if this is a modern myth,
Then for the love of God, let us never tell a
Story again) – so yeah.  I've taken the plunge
Into willful mediocrity, and I'm not really
Enjoying it, but hey, life requires sacrifice.`,
      `Maybe I wanted to see it.  Maybe I just wanted
Attention, maybe I just needed to feel special,
Maybe it's all a bunch of bull – who knows.
My studies are going nowhere and fast, my
Writing's laced with self-pitying hash, eyes
Turning inward but still bleary and bloodshot.
Destiny's losing its patience with me, and my
Will to power is willing itself to sleep.  So very
Sorry, but I'm not a scribe, and I have nothing
Being dictated to me through a teacup but leaves.`,
      `Tea room.  Visiting Aleta, my ex who helped
Me more than she can be aware of – ad
Vixen by day, and seer on Sundays.  Skilled in
Both Tarot and reading the dregs of a teapot,
I can't foresee that she's not there; she took
The day off.  The only greeting I get is from
The price list.  The usual psychic fare – palm
Readings, cards and leaves aplenty – gives way
To more esoteric experiences, such as "past
Life meditation" – I am Elfy and Jo-Jo.`,
      `It was that semester, January-April 1997,
When everything went strange, when Steve
Geller – writer extraordinaire, and professor
With a flair for show business – began hinting
At his hidden hobbies, when Aleta showed me
To see the present in the arcana, when a
Role-playing game showed me what role
I never auditioned for, when an angel enveloped
Me in wings of fire and claimed me as his child.
You want to find a cause?  Here's your root.`,
      `I'm scared.  Scared to accept it.  It's too much,
Too great a risk to myself to believe.  Two times
Too – I don't know.  Can I ignore it – willfully accept
The blindness I haven't earned yet?  But the positive,
All-accepting New Age blather I've encountered –
Quite frankly, if it's between Patchouli Nation and
utter nihilism, give me oblivion now.  Better to accept
The darkness than settle for washed-out happiness.
All I want to do is explode all over the world, and
Goddamnit, I'm sick of waiting for the match!`,
      `Will the key be found tonight?
Not yet.  Not here.
Not yet asleep, and still not awake.
However, seeing the sickness
Is the first step in curing the fever.
Soon, I'll be released,
Fit as a fiddler...`,
      `Always at night.  The fear always comes at night.
So unwelcome, the serpent coils around my tree...
So much for the wrath of God.  I'll wager my garments
Fit a refined form – I just wish the sculptor would
Finish, never realizing it's my hand which molds
The clay that the water flows into, no cracked vessel
This, but soon getting soft – not completely dry,
My walls are bending this way and that, oh Josiah,
Sweet eternity, forge!`,
      `What new madness, this?  What new vision descends?
I will make sense of it, oh yes, Lord, I will decipher
Your signals from SETI, I will realize the idea into form
With your force...
Is this the new science, then?  Noetics, quanta justified
In the textbooks of uncertainty?  (how far I've come since
The beginning!)  Slicing, piercing vision, seeing every atom,
Is God a zeppelin?  Am I on the table?  Was I a changeling
child, me with parents unknown?  What can you say that
She hasn't sung to me?`,
      `The message unravels.  The head reels, the mind boggles,
The heart quakes and the soul ignites.`,
      `Later, for a word to comprehend.`,
      `11`,
      `Burned beyond recognition,
	Spontaneously
	from the inside.  The remains
fit into a small crystal jar, carried
	by the headmaster as he
strode across his campus. It
was unlike any sample he
had previously obtained.`,
      `In the lab, the bone fragments
	released the serpent's coils, scales
	dripping like absinthe, golden-
honey nectar hallucinogen,
	swirling around a Jacob's
	ladder of glassware.  Two currents
spark to life, leaving the professor
	perplexed and innately curious.
	The latticework is undamaged.
No coat of paint needs to be reapplied.`,
      `Carpenters and chanteuses
	occupy the middle lodge.
	The sickly-sweet liquid
is brought before them, the glass
	resonates, the Brownian
	motion coincides with a
frequency echoed by angels.
Nothing bubbled over, thank Goodness.`,
      `Distilled, concentrated, a
	single drop dabbed into either
	eye, the project thrust back into
azure-blue and bumblebee,
	the answer howling, the oft-
	repeated sentiment come
true that this one is special, he
wants a nipple before he
opens his eyes.`,
      `12`,
      `confused
melange
forms move
warm fur`,
      `	the brushed steel calipers pierced the skin, removing a
	sample of dna`,
      `soft glow
thirsty
mother
feed me`,
      `	the sample, when extruded, spelled out a message like
	a constellation`,
      `hear things
people
don't know
their words`,
      `	the tricky part of the process was, naturally, the
	melding of the genes`,
      `where i
who i
what i
don't know`,
      `	the hybridized sample was returned to the subject's
	reproductive system`,
      `all i
know is
i'm not
safe here`,
      `	fertilization appears to be successful.  subject can be
	returned to point of origin`,
      `now oh
close eyes
the light
the light`,
      `	success.`,
      `III: caught up`,
      `13`,
      `Black cat, snake eyes, crossing guards
Telling me to pause, telling me to
Cool my jets, they have not been
Sighted as of late, but I still respond
To their inevitable echo,
Self-censoring residue of shame and
Pain and o the guilt I feel.`,
      `When last I thought about my dear
Encounter (how long ago it seems!),
I was suddenly seized with the unearthly
Vision of – wait, what was it?  Oh yes.
I read it now, but memory fails, here
At curséd numero thirteen.`,
      `Has it come to this?  Has the special
Goodness left already?  (Months?  Yesterday?)
New home, new frame of reference.
I'm restraining my attitude at work
So I can win that critical raise –
Selling out?  Too tired to care?  Who knows.
I'm busy without being busy at all.
The hectic pace of living a wired life
Leaves no time at all for living.`,
      `If I had known this would be the
Throbbing grey aftermath of seeing a
UFO, then Lord help me, I would
Have prayed for blinders.`,
      `Domestic bliss lends itself to easy
Nightmares strewn on the cinema screen.
A recurring bout of sinusitis plagues me.
I have all these game words to write that
Mean nothing in the long run but a resumé
Piece to impress jerkwater agents that I'm
Actually "a published author."  But what
Good is writing if no one understands?`,
      `Goddamnit, something HAPPENED!  Why
Won't people believe me?  More to the
Point, why can't I tell people?  Why can't
I share this fucking revelation that's been
Eating me alive since February?`,
      `Am I afraid of ridicule?  Hardly – I had to
Deal with the jibes and insults of my peers
Since I was 11.  What, then?  Fear of not
Being taken seriously?  Hell, if I really
Wanted to, I could have a captive audience
Hanging on my every word – but I don't
Want that audience.  And it's certainly not
The Men in Black – and I don't mean Will Smith –
Who are checking my tongue.  There has to be
A reason I'm not shouting from the rooftops –`,
      `Apathy.  The modern enemy.  That's the block.
I'm not afraid that people will be offended –
I'm just afraid they won't care.`,
      `Everyone is tired, did you notice that?  No one
Has enough energy anymore.  Even with our
Low-fat lifestyle and body obsessions that drive
Us into the gym, no one seems to have that
"Oomph" unless it's to sell Volkswagens.  There
Are too many distractions, there are too many
Predators that are catching our reflexive eye,
There's too much to keep track of, and it's
Wearing our minds down, exhausting our
Imaginations.  We have bulimic souls, and
Their linings are burning away under gluttony.`,
      `But if I starve to spite my face,
Then surely we'll have lost the race.`,
      `I may be tired, but Mother Nature certainly
Isn't – there's quite a storm brewing out there.
And every day disasters pile up – earthquake,
Hurricane, and volcano raging against the
Dying of the light.  The more we settle into our
Static narcosis, the more Nature waves her hands
And tries to get our attention.  More and more
She goes unheard, like wealthy yupsters ignoring
Their crazy mom.  She's angry, we no longer come
To her with arms outstretched in love, but
Taking what we want and wondering why
She just can't keep her fucking mouth shut.`,
      `What we need is a miracle.`,
    ],
  },
];

// ─── Poem fragments ─────────────────────────────────────────────────────────
// Real verse, but not self-contained poems: each of these is the opening of
// a longer piece that drops into trance/stream-of-consciousness prose after
// a few lines. Worth keeping — the lines themselves are good — but kept
// separate from `poems` above so that array stays true "complete works only."
export const poemFragments = [
  {
    opening: `An almost hysterical purity obvious in steel blue eyes
Cascades down rough-hewn, scarred cheeks carved by wind and loss,
With a waterfall working down the crevasses,
Coalescing into buoyant green somewhere around the chin.`,
    source: `Apocrypha.doc`,
  },
  {
    opening: `Shades of recognition,
Echoes telling me that this scene
	has been played before.
Not deja vu, but a sense of an
	assumed role
That I've stepped into once again.
We might need a rewrite.`,
    source: `"The way her hips sway is unique.doc" — the piece is titled with its own first line; several more short verse passages ("Your eyes are questing...") are scattered through the prose that follows.`,
  },
  {
    opening: `here comes no sun today
here comes a sterling gay
here sometimes we are weird
here somethings get real queer`,
    source: `"here comes no sun today.docx" — also titled with its own first line.`,
  },
  {
    opening: `(Underneath scams and heart attacks,
What yearns for us? A pulse,
Two fingers across the neck
To confirm signs of life.)`,
    source: `"(Underneath scams and heart attacks,.pdf" — also titled with its own first line; the prose that follows references "The Machinist's Union," a separate piece elsewhere in the archive.`,
  },
];
