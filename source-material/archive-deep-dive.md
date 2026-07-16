# The Writing Archive: A Deep Dive

Everything below comes from `archives/Writing archive/` — 228 files spanning roughly 2000 to
2025, about 1.84 million words once converted to plain text. This document is the record of that
read-through: what's actually in there, the shape of it, and the specific passages worth pulling
forward into perceptualmechanics or anything else.

## How this was done

The folder had two kinds of files that don't open normally: a stuck host-side lock (fixed last
session by duplicating individual files, this session by duplicating the whole folder), and legacy
Apple Pages files in three different internal formats (plain zip, exploded XML bundle, and modern
IWA/protobuf bundles). All three Pages formats turned out to be recoverable — the last one required
un-zipping the `Index.zip`, decompressing the internal snappy-framed chunks, and pulling printable
text runs out of the resulting protobuf bytes, which is a hack but it worked cleanly on every file
it was tried against. Screenplays in Final Draft (`.fdx`) format are XML and parsed directly.
Celtx files are zip archives containing HTML. Everything else was plain text, RTF, or PDF.

Net result: 214 of 228 files converted to readable text, the other 14 being true duplicates,
empty stubs, or files (like `Energy Work.pages`) with a `.docx`/`.pdf` sibling that already had the
real content.

At 1.84 million words, this could not be read in full at the sentence level — that's on the order
of twenty novels. The approach was: read every short piece (under roughly 3,000 words) in full,
since that's where a lot of the strongest, most self-contained material lives; sample the handful
of huge diary/blog-style files (some run 50,000 to 200,000 words) generously rather than
exhaustively; and characterize the big screenplay and novel drafts by their openings, structure,
and a keyword scan rather than reading every draft of every revision. Multiple drafts of the same
screenplay (Truth and Beauty has seven, Paul Revere has three, Werewolves of 1812 has two) were
treated as one work, using the latest draft as the reference text.

## The shape of it

This is two archives in one, sharing a single folder. One is a twenty-five-year private writing
practice — journal entries, stream-of-consciousness "trance writing," a self-invented mythology
built around muses, a recurring antagonist called "the Void," and a spiritual/creative framework
he calls "Slack" and "Ecstatics." The other is a stack of conventional projects: finished and
half-finished screenplays, a couple of novels-in-progress, poems, and short fiction. The two feed
each other constantly — the journal is where the actual images and lines get worked out, and they
surface later, sometimes decades later, in more polished form.

A keyword pass across the whole corpus backs up what the earlier elements-project research
suggested: fire is the single most obsessive image, appearing in 89 separate files (1,147
instances) — more than water, earth, and air combined. "Love," "God," and "writing/writer" are the
next most common, and one name, "Larra," appears 1,249 times across 37 files: an ex-partner from
the Los Angeles years who is clearly the emotional center of gravity for an enormous amount of the
work, especially "The L.A. Project" (see below).

One genuinely fun discovery: the name "perceptual mechanics" isn't new. It shows up in thirteen
different files going back to 2005's `km.txt` ("Kinetic Muse"), where the line reads: *"There will
be scientist-poets who will look back at our perceptual mechanics and recognize the roots of their
own reality."* The site's name has a twenty-year paper trail.

## The self-mythology

Across dozens of files — `orbitals.txt`, `skating.pages`, `conifers.pages`, `musings.pages`,
`blah.pages`, `Undergone.pages`, and the massive `A bard of butterflies...` document chief among
them — there's a consistent private cosmology at work. A muse figure (sometimes named Thalia,
sometimes Clio) who gets addressed directly. A recurring antagonist called "the Void." A spiritual
practice called "Slack" tied to a theory that physics and what he calls "Ecstatics" are the same
thing described two ways. Chaos, fractals, and butterflies as recurring images of transformation
(directly ancestral to the deployed butterfly.js scene). Long stretches of what reads like genuine
automatic writing — trance-state typing, sometimes in all caps, sometimes dissolving into
typos-as-texture — that then resolves into clear, controlled prose, often within the same
paragraph. This mode produces both the most raw and the most striking writing in the whole
archive; the fire passage already pulled from `More Rambling.docx` is a good, comparatively mild
example.

Some of this writing is very raw — grief, rage, a health scare, a difficult period around a
divorce, more recent material (`skin and scars.txt`, dated January and March 2025) dealing with
adoption-related pain and an unemployment stretch. It's presented here only insofar as it's part of
the record; none of it is reproduced beyond what's needed to describe the shape of the work.

## The big projects

**The L.A. Project** (three overlapping versions — `The L.A. Project - ALL.txt` at 193,000 words,
a "Compiled" Pages version at 186,000 words, plus `l.a. dummy.txt` at 211,000 words, which looks
like an even earlier assemblage of the same raw material) is the largest single body of work in
the archive by far, and it's the direct ancestor of the "Holography" project pitched in
`PROJECT IDEAS.doc`: "a fictional extrapolation of my time in L.A." It opens with an epigraph from
Kushner's *Angels in America* ("Not Physics but Ecstatics Makes the Engine Run") and one from
Douglas Adams, then plunges into raw, unedited scenes and journal fragments from the Los Angeles
years, centered obsessively on Larra. It reads like ore rather than a finished vein — the good
material (the crocodile-photograph-style short scenes, the "Excerpt from the LA Encha" dialogue
about a case of mistaken gender identity at a Malibu pool party) is mixed in with enormous
unedited stretches, including one page where "Larra" is simply typed on repeat for paragraphs.
This is clearly the reservoir Scott meant when he called Holography "the one I'm feeling the most
force behind."

**Truth and Beauty** (seven drafts, 1990s–2000s, culminating in `Truth and Beauty - Final Draft.fdx`)
is a finished feature screenplay — an ensemble dramedy about a group of friends in their 20s,
opening on two of them arguing about actresses (Ingrid Bergman vs. Rita Hayworth) in a bar. Sharp,
naturalistic dialogue, clearly the most conventionally "produced-feeling" of the screenplays.

**Paul Revere** (three drafts) is a Boston-set comedy framed around a Duck Tour guide character
and Revolutionary War reenactment culture — broader and more overtly comic than Truth and Beauty.

**Blood Treachery** (co-written with Stephen Michael DiPesa, two drafts) opens with an epigraph
from James Merrill's *The Changing Light at Sandover* and a dedication to Stephen Geller ("teacher,
mentor, artist, magician, shaman, and friend") — Geller is the same person referenced obliquely in
`PROJECT IDEAS.doc` as running "the worst screenwriting/best magical apprenticeship program ever,"
which explains a lot about where the mystical vocabulary running through Scott's other work
originated. This is an occult/fantasy screenplay, heavier and more genre-inflected than the others.

**Werewolves of 1812** (two Celtx drafts plus a PDF) is a period horror-comedy, self-explanatory
from the title.

**No Accident** (a 2,570-word fragment, marked "Novel, First Draft") and **Apocrypha** (27,700
words) are the two most substantial prose-fiction (non-screenplay) works besides Cartography;
neither was read in full, but both are tonally consistent with the rest — dense, referential,
moving between realism and the mystical vocabulary.

## Specific gems worth pulling forward

A few pieces stood out as complete, polished, and reusable on their own terms — genuinely
"forgotten" in the sense the term was meant:

**"The Crocodile Photograph"** (recovered from the hardest-to-parse Pages format) is a tight,
fully finished dark-comedy short story: a man steals a taxidermied crocodile photograph from
friends, escalates a petty resentment into a full domestic standoff, and gets decked by the
husband after one perfect closing insult. Complete arc, sharp voice, nothing missing. This is the
single cleanest short-fiction find in the whole archive.

**"The Golden Hare"** (`Golden Hare.pages`) is one sentence: *"A Golden Hare ran across the sky,
carrying the sun in its belly, where it would be safe. The hare ran up the ladder to the sky."*
Pure myth-fragment, complete as-is, and very much in the register of the existing sphere/nebula
hypertext fragments already deployed on the site.

**"The Orrery of Los Feliz"** (260 words) — a complete noir-flavored sci-fi vignette about
investigators tracking down a mysterious clockwork orrery (a moving model of the solar system,
complete with a working radio telescope) built by an unlikely community-college dropout in an LA
warehouse. Self-contained, atmospheric, unlike anything else in the archive in tone.

**"In The End It Falls Slowly Through The Aether"** (inside `Cartography.doc`, already known from
last session, now confirmed in full) — the raindrop piece touching water, air, earth, and root in
one continuous physical description. Still the strongest single water/air-register candidate for
the elements project.

**The fire passage in `More Rambling.docx`** (already extracted to
`source-material/fire-excerpt-more-rambling.md`) remains the best second fire-register voice
alongside `Fire.doc`'s litany.

**The "perceptual mechanics" line** in `km.txt` (2005) — not a reusable text fragment so much as a
genuinely nice piece of site history: the name predates the site by two decades.

**"Excerpt from the LA Encha"** — a very funny, true-feeling piece of dialogue (mistaken identity
at a Malibu pool party) that could stand alone as a short comic scene independent of the larger
L.A. Project.

## What didn't make the cut

The archive also contains, and this is worth naming plainly rather than padding out: résumés and
cover letters (several, spanning 2000–2009), event invitations and wedding-planning lists, a
handful of screenplay outlines that were never written past a title (`The Dumb List.doc`'s
title-only list, already logged), and several early-2000s pieces (`Millennium.doc`,
`DRILLING HOLES IN MY HEAD.doc`) that are competent genre writing (tabletop-RPG fan fiction,
fantasy screenplay treatment) but not personal/lyric material and not an obvious fit for anything
currently in flight.

## Suggested next steps

Two concrete threads worth picking up, if there's interest: pulling 3–5 more short standalone
pieces (Golden Hare, Orrery of Los Feliz, Crocodile Photograph chief among them) into the same
`source-material/` folder pattern started with the fire excerpt, so they're staged for reuse the
way the elements project needs; and, separately, if the L.A. Project / Holography idea ever gets
picked back up, this session's read-through is a reasonable map of where the strongest scenes are
buried inside those 200,000-plus raw words.
