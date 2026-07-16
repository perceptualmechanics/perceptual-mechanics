# perceptual mechanics — notes & punch list

## nebula curator workflow
The curator tool runs **locally only** due to browser CORS restrictions on direct Anthropic API calls.

1. `npm run dev` in the project root
2. Open `http://localhost:5173/utils/nebula-curator.html`
3. Enter your Anthropic API key (from console.anthropic.com) — saves to localStorage
4. Paste URLs one at a time — Claude names each star and assigns a constellation
5. When you have enough stars, hit "rebuild constellations" for a full thematic remap
6. Hit "copy as JS" and paste the output into `src/scenes/nebula.js`
7. Commit and push — GitHub Actions deploys automatically

The live page at perceptualmechanics.com/utils/nebula-curator.html is password-protected
but non-functional for API calls. Use localhost instead.

## next up
- [ ] butterfly auto-rotate / camera sweep for YouTube Shorts (9:16 vertical)
- [ ] nebula: integrate curator tool output into nebula.js
- [ ] nebula: Webb/Hubble background image (bring a favorite)
- [ ] nebula: drawn constellation connections (hand-curated, not algorithmic)
- [ ] notebook review — new piece ideas

## pending decisions
- nebula star data — use curator tool to populate, then drop into nebula.js
- worldline/egg — Google Maps JS API + actual coordinates (Boston, LA, Boca, Michigan)
- elements scene — five-element live-stream piece (earth/water/air/fire/wood), embed via YouTube
  iframe API (`embed/VIDEO_ID` or `embed/live_stream?channel=CHANNEL_ID`, auto-switches to
  whatever's currently live). Needs an "offline" fallback state per stream — several of these
  are seasonal, not always-on. Roster as of 2026-07-16:

  | Element | Primary | Uptime | Backup(s) |
  |---|---|---|---|
  | Earth | [GlobalQuake](https://www.youtube.com/@GlobalQuake) — live seismic plot, auto-detects quakes worldwide | 24/7, always live | Force Thirteen Earthquakes, other seismic-monitor channels |
  | Water | [Smith River Cam](https://www.explore.org/livecams/zen-den/live-redwood-cam-1) (Explore.org, Jedediah Smith Redwoods SP) — wilderness river through old-growth redwoods, no development in frame | 24/7, always live | [Brooks Falls / Brooks River](https://explore.org/livecams/three-bears/brown-bear-salmon-cam-brooks-falls) (Katmai NP, AK) — bears fishing salmon, spectacular but solar-powered, goes dark in winter/low light |
  | Air | [YallBot](https://ryanhallyall.com/yallbot) — 24/7 AI weather broadcast, radar/storm analysis | 24/7, reliably live | Live Storm Chasers / Brandon Copic / Vince Waelti — only live during active severe weather, not steady |
  | Fire | [USGS Kilauea](https://www.usgs.gov/volcanoes/kilauea/multimedia/webcams) — Cam A/B/C, thermal cams cover no-glow nights | 24/7, always live | Stromboli Volcano Live Webcam — "near-continuous" eruptions 1000+ yrs, effectively always-on; Mount Etna multi-cam (INGV); afarTV 4K/8K volcano streams |
  | Wood | Chattahoochee National Forest live cam — 24/7, real-time, no music | 24/7, always live | Panama Fruit Feeder / canopy cams (Explore.org) — more wildlife-focused |

  Reliable always-on picks: GlobalQuake (earth), Smith River (water), USGS Kilauea or Stromboli (fire),
  YallBot (air), Chattahoochee (wood). All five now have an always-live primary — no seasonal gaps.

  Text-overlay source material (from archive/Writing archive, 2003-04 era, author: Scott Cohen):
  - Fire → `Fire.doc` (Oct 2003, Barnes & Noble in the Valley): word-association litany
    ("Fire. Burn. Sun. Light... The ash... Bunsen burner. Bonfire. Beach bonfire. Burning Man...")
    + a longer two-part dialogue scene ending with a real wildfire visible from a party. Good
    fit for an ember-particle text overlay (words rising/fading, blend-mode screen).
  - Water/Air/Earth/Wood → found inside `Cartography.doc` (a mini-anthology, same era), the piece
    "In The End It Falls Slowly Through The Aether": a single raindrop falling off a leaf, told
    through real physics (surface tension, friction, oxygen/nitrogen, root, sun) — genuinely
    touches water, air, earth, and wood in one continuous piece. Could work as connective/framing
    text across multiple streams rather than one dedicated element.
  - No direct water/air/wood equivalents to Fire.doc's standalone litany found yet.
  - Known gap: several files in `archives/Writing archive/` (Journaly.docx, More Rambling.docx,
    PROJECT IDEAS.doc, American Divine.docx, A Sensitive Dependence on Initial Conditions.docx,
    Oh, Just Stuff.doc, The fear.doc, The Veil -- Notes.doc/.txt) could not be read this session —
    that specific folder hit a stuck file-mount error (copies kept failing with "Resource deadlock
    avoided") that didn't clear even after retries and backoff. Worth another pass next session;
    `The Veil -- Notes.txt` (readable, ~72k chars) is a sprawling personal mythology doc that
    explicitly names "The Four, manifestations of the forces of nature and the elements" — likely
    worth a full read if the elements schema keeps developing.
  - `Millennium.doc` scored high on "earth" keywords but is White Wolf tabletop-RPG fan fiction
    (Mage/Werewolf crossover, Gaia/Wyrm/Wyld), not personal writing — not a fit.
  - `Baby Steps.doc` (same grab-bag-of-fragments format as Cartography) contains a fuller, more
    vivid version of the zeppelin/burning-fields image than the standalone Zeppelin doc: "The
    zeppelin soared high above... underneath the fields were a burning shroud, keeping the
    devastation from view until the wind caught the smoke and revealed the bombed-out silos...
    The heat was its own atmosphere." Real fire+air imagery, stronger candidate than the thin
    standalone "Zeppelin" fragment for a fire/air connective piece.
  - `The Dumb List.doc` is just a list of potential titles, unwritten, but suggestively on-theme:
    Tectonic Plates, Flood, Pine Needles, Fires Were Started, Pray for Rain — another set of
    "titled but never filled in" stubs, like Cartography's siblings. Nothing to pull text from.
  - Checked and ruled out as off-register (genre/outline, not lyric-personal): `The Veil -- Notes`
    (novel/show pitch, thin elemental content beyond "The Four" naming + a planned-but-unwritten
    "Vaidja's origin, the fires of San Diego" chapter — real 2003 SoCal wildfire echoing Fire.doc's
    own wildfire imagery, interesting as corroboration but no prose to use), `DRILLING HOLES IN MY
    HEAD` (fantasy screenplay treatment), `Destined Stuff` (tarot-style character address).
  - **Lock resolved (2026-07-16):** root cause was a stuck host-side lock on those specific
    inodes — `open()` succeeded but `read()` deterministically threw `EDEADLK` even with retries/
    backoff, with no process holding the file per `lsof`. Duplicating each file in Finder (new
    inode) cleared it; converted the copies with headless LibreOffice (`soffice --headless
    --convert-to txt`) since `.doc`/`.docx` binaries aren't directly parseable. All 8 previously-
    stuck files now read:
    - `Journaly.docx` — personal journal, 2017–2019. Scattered elemental *language* used
      metaphorically (fire/earth/air, explicit "classical elements" mention) but diary-form prose,
      not crafted lyric text — lower priority as overlay source than Fire.doc/Cartography.doc.
    - `More Rambling.docx` — mostly personal/diary content, but contains one strong isolated
      passage in a genuine fire register: "...accepted my true fire nature... Fire to my core...
      The path of fire is the most difficult path... the divine fury of correct action, violent
      joy, singing upwards and with fire in my eyes." A second fire-overlay candidate alongside
      Fire.doc — would need extracting just that passage from the surrounding personal material.
    - `The fear.doc` — short fear-themed venting fragment, same 2003 era as Fire.doc, but partly
      corrupted/garbled (a block of unreadable character noise mid-file) — not clean enough to use.
    - `PROJECT IDEAS.doc`, `American Divine.doc` — unrelated project pitches / character-archetype
      list, no elemental fit.
    - `A Sensitive Dependence on Initial Conditions.docx` — near-future sci-fi fragment, no
      elemental fit.
    - `Oh, Just Stuff.doc` — personal diary (2012), no elemental fit.
    - `The Veil -- Notes.doc` — same content already covered via the `.txt` version last session;
      nothing new.
    - **Net result:** no new standalone elemental litany on par with Fire.doc/Cartography.doc/Baby
      Steps.doc, but one new fire fragment worth keeping (More Rambling.docx). Still no direct
      water/air/wood standalone equivalents.

## full archive deep-dive (2026-07-16)

Did a complete pass on the entire `archives/Writing archive/` folder (228 files, ~1.84M words,
~2000–2025) — not just the elements-project text hunt. Full write-up saved to
`source-material/archive-deep-dive.md`; three more standalone gems staged in `source-material/`
alongside the fire excerpt (`gem-crocodile-photograph.md`, `gem-golden-hare-and-orrery.md`).

Highlights: the name "perceptual mechanics" isn't new — it traces back to a line in `km.txt`
(Kinetic Muse, 2005): *"There will be scientist-poets who will look back at our perceptual
mechanics and recognize the roots of their own reality."* Twenty-year paper trail on the site's
own name. Fire is confirmed as the single most obsessive image across the whole corpus (89 files,
1,147 mentions — more than water/earth/air combined). There's a consistent private mythology
running through decades of journal/trance writing (a muse figure, an antagonist called "the Void,"
a practice called "Slack," physics-as-"Ecstatics") that's the direct ancestor of the deployed
butterfly/chaos and sphere-fragment material. The largest single body of work is "The L.A. Project"
(three overlapping versions, 190K–210K words combined) — raw material behind the still-unrealized
"Holography" project idea from PROJECT IDEAS.doc, centered on an ex-partner ("Larra," 1,249
mentions across 37 files). Full screenplays (Truth and Beauty, Paul Revere, Blood Treachery,
Werewolves of 1812) were surveyed but not read draft-by-draft — each already a known, finished-ish
property rather than "forgotten."

Best new standalone finds beyond the fire passage: "The Crocodile Photograph" (complete dark-comedy
short story, cleanest fiction find in the archive), "The Golden Hare" (one-sentence myth fragment,
same register as the existing sphere hypertext fragments), "The Orrery of Los Feliz" (260-word
noir sci-fi vignette, strong fit for the nebula/orbital work already in progress).

## gems wired into the site (2026-07-16, same session)

All four "set aside" decisions from this pass are now actually implemented, not just staged:

- **The Crocodile Photograph** + **Fire.doc's two embedded stories** (dubbed `fireVigil` — the
  dying-man/Debbie dialogue about death and religion — and `fireCalamity` — the physics-rant/
  Edward-and-Maria party scene, wildfire visible in the middle distance) are now real patches on
  the scroll (`src/text/scrollTexts.js` + `src/scenes/manuscript.js`). Scroll is now ten pieces,
  not seven; Fire.doc's opening litany was deliberately left out of these two (still reserved for
  the elements/fire livestream project). Added a `tone-5` CSS tier for Crocodile Photograph since
  it's newer than everything previously on the scroll. `npx vite build` passes clean.
- **The Orrery of Los Feliz** is now a real object in `nebula.js` — a small clickable orrery (bronze
  center sphere, tilted orbit rings, three actually-orbiting bodies) sitting apart from the
  real-site constellations, opening the same info panel with the full found text. Note: `nebula.js`
  and `egg.js` are still commented out in `main.js` ("deactivated for now, being reworked") — this
  was true before this session too. Also worth flagging: `nebula.js` itself is way ahead of what
  NOTES.md's "next up" list below still describes as pending (Webb-style clouds and hand-drawn
  constellation lines are already built, just built around real-site history instead of the
  curator-tool/astronomy concept the "pending decisions" section below describes) — that section
  needs a real edit pass, not just this note, next time nebula comes up.
- **The Golden Hare** is a new top-level interstitial (`src/components/goldenHare.js`, wired into
  `main.js` via `initGoldenHare()`), not part of any single scene. Rare (roughly once every 1–3
  minutes), wanders across whatever's on screen — landing grid or an open experience, doesn't
  care which — as a plain inline-SVG silhouette, click reveals the one-sentence myth as a caption.
  Respects `prefers-reduced-motion` by not running at all rather than sitting inert.

## nebula.js reality check (flagged, not yet resolved)

The "next up" and "pending decisions" sections below pre-date a substantial nebula.js rework that
already happened — it no longer matches what those sections describe. Worth a proper cleanup pass:
confirm with Scott whether the curator-tool/astronomy-image concept is officially superseded by the
real-site-constellations concept before editing further, since right now both a stale plan and a
newer implementation exist side by side in this file.

## second deep dive: rest of archives/ + all Game/ folders (2026-07-16)

Broadened well past the Writing archive: the two Scrivener projects at the Documents root, `The New.scriv`,
and the big "Previously" folders (an old Windows profile backup that turns out to be the *source* of the
Writing archive, plus raw Spoonfed/Kinetic Muse site exports) — full write-up in
`source-material/second-deep-dive-archives.md`. Also did all of `Game/` (Scion, Exalted, WoD, D&D, Trinity
Continuum), custom/homebrew content only, official rulebooks excluded — full write-up in
`source-material/second-deep-dive-game-folders.md`.

Headline finds:
- **"A Manual of Perceptual Mechanics.scriv" and "The Secret World.scriv" are not empty** (an earlier survey
  had this wrong) — Manual holds 7 real documents including a 193K-word "The Hottest of Messes" (same raw
  material as "The L.A. Project") and a complete short story, "Interlude: Portable Hells."
- **Origin of "Solistrato" found**: `Purpose.doc`, a manifesto ending "Song of Fire and Light... Solistrato.
  The layer of life closest to the sun." That coined name then turns up independently as an old radio-
  station/site name, a Spoonfed subsection, *and* a D&D 5e character (`solistrato_57789333.pdf`) — one word,
  three media, twenty-plus years.
- **New strong gem candidate**: "Pygmalion," a complete essay about an online catfishing episode, direct
  thematic sibling to the scroll's existing Identity Theft/Projection pieces. Not yet wired in — flagging for
  a future pass.
- **"Butterfly Wings"** — an old-format screenplay fragment (blocked writer, a butterfly, a hurricane tracked
  by researchers) that may be the literal prose ancestor of the live Chaos Butterfly/Lorenz-attractor scene.
- **A full homebrew Scion campaign** ("Boston Scion," 2012–2014: 15 session recaps, ~50 characters, an
  invented "Yankee Pantheon" with new American gods — The King, The Zealot, Oppenheimer, Bull Market) —
  surveyed but not fully read, flagged as worth its own future pass given the scale.
- Recurring threads corroborated across new media: the fire self-identification (now also a Scion knack,
  "I Am a Fire"), the adoption theme (now also baked into two separate Scion character origins), and the
  Muses (a "Muse (Urania)" Scion birthright).
- **Update (2026-07-16):** Pygmalion is now wired into the scroll (`src/text/scrollTexts.js` +
  `src/scenes/manuscript.js`) — slotted chronologically into the c. 2000 cluster alongside Iron Gods/
  Flying/Thoughts Of Death Abounds (it's internally dated to May 2000, despite being the newest addition).
  Scroll is now eleven pieces. `npx vite build` passes clean. Everything else from this pass (Boston Scion,
  "Butterfly Wings," the D&D/Trinity Continuum custom characters, etc.) is still just staged in the two
  source-material files, not yet used.

## infrastructure done, needs real content
- `src/scenes/nebula.js` — placeholder star field
- `src/scenes/egg.js` — placeholder green sphere

## solid / deployed
- sphere with hypertext fragments + silk glimmer links
- chaos butterfly in phase space, 2026
- four-panel landing with persistent nav bar
- ESC to close scenes
- full a11y pass (skip link, ARIA roles, keyboard nav, reduced motion)
- nebula curator tool (separate artifact — paste URLs, Claude names stars + constellations)
- colophon: "created in collaboration with claude"

## deployment
- host: DreamHost
- build: `npm run build` → upload `dist/` contents to public root
- no server-side dependencies, static files only

## collaborators
- scott jason cohen — vision, writing, curation
- claude (anthropic) — code, literary analysis, implementation
