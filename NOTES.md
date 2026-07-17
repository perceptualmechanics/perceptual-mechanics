# perceptual mechanics — notes & punch list

This file is solely about the perceptualmechanics site — the live code, deployment, and content
sourcing that feeds into it. Reorganized 2026-07-16: everything about the two other writing
projects (The Secret World, A Manual of Perceptual Mechanics) moved into their own Scrivener
files, which are now the source of truth for that material going forward. See "project map"
below for where things live.

## project map (as of 2026-07-16)

- **perceptualmechanics** (this repo) — the live site + code. What lands here: finished scenes,
  scroll patches, wired-in content. Deploys to perceptualmechanics.com via manual `dist/` upload
  (see "deployment" below) — anything that shouldn't be public has no business in this repo.
- **A Manual of Perceptual Mechanics.scriv** (`/Users/scottcohen/Documents/A Manual of Perceptual
  Mechanics.scriv`) — a separate Scrivener writing project. Now the source of truth for that
  project, including a Research/"Archive Research Notes" document holding the general
  personal-writing-archive research history (previously duplicated here in NOTES.md).
- **The Secret World.scriv** (`/Users/scottcohen/Documents/The Secret World.scriv`) — a separate
  Scrivener writing project (the game/mythology-verse — Boston Scion, the Yankee Pantheon). Now
  the source of truth for that project, including a Research/"Boston Scion — Campaign Notes &
  Archive Search" document holding the campaign read and lost-spreadsheet-search history
  (previously duplicated here in NOTES.md).

Raw research/staging notes from archive deep-dives (the deep-dive write-ups, gem excerpts, campaign
reports) live outside all three of these, in `../perceptualmechanics-source-material/` — a sibling
directory to this repo, not tracked in git. See "housekeeping" near the bottom for why and when that
moved.

## next up
- [ ] butterfly auto-rotate / camera sweep for YouTube Shorts (9:16 vertical)
- [ ] notebook review — new piece ideas

## elements/cycle roster (reference — resolved 2026-07-16)

The elements/"cycle" scene this fed into is built and live (see "egg / leaf / orrery / cycle —
activated" below). Kept as its own section, not folded into history, since `cycle.js` references
this roster and research trail directly and may need it updated if a stream goes down for good.

- five-element live-stream piece (earth/water/air/fire/wood), embedded via the YouTube iframe API.
  Each stream carries a manual backup link rather than an automated "offline" detector — see the
  "egg / leaf / cycle" entry below for why. Roster as of 2026-07-16:

  | Element | Primary | Uptime | Backup(s) |
  |---|---|---|---|
  | Earth | [GlobalQuake](https://www.youtube.com/@GlobalQuake) — live seismic plot, auto-detects quakes worldwide | 24/7, always live | Force Thirteen Earthquakes, other seismic-monitor channels |
  | Water | [Smith River Cam](https://www.explore.org/livecams/zen-den/live-redwood-cam-1) (Explore.org, Jedediah Smith Redwoods SP) — wilderness river through old-growth redwoods, no development in frame | 24/7, always live | [Brooks Falls / Brooks River](https://explore.org/livecams/three-bears/brown-bear-salmon-cam-brooks-falls) (Katmai NP, AK) — bears fishing salmon, spectacular but solar-powered, goes dark in winter/low light |
  | Air | [YallBot](https://ryanhallyall.com/yallbot) — 24/7 AI weather broadcast, radar/storm analysis | 24/7, reliably live | Live Storm Chasers / Brandon Copic / Vince Waelti — only live during active severe weather, not steady |
  | Fire | [USGS Kilauea](https://www.usgs.gov/volcanoes/kilauea/multimedia/webcams) — Cam A/B/C, thermal cams cover no-glow nights | 24/7, always live | Stromboli Volcano Live Webcam — "near-continuous" eruptions 1000+ yrs, effectively always-on; Mount Etna multi-cam (INGV); afarTV 4K/8K volcano streams |
  | Wood | Chattahoochee National Forest live cam — 24/7, real-time, no music | 24/7, always live | Panama Fruit Feeder / canopy cams (Explore.org) — more wildlife-focused |

  Reliable always-on picks: GlobalQuake (earth), Smith River (water), USGS Kilauea or Stromboli (fire),
  YallBot (air), Chattahoochee (wood). All five now have an always-live primary — no seasonal gaps.

- text-overlay source material for the elements scene (from archive/Writing archive, 2003-04 era,
  author: Scott Cohen — full research trail behind these picks now lives in A Manual of Perceptual
  Mechanics.scriv, Research/"Archive Research Notes"):
  - Fire → `Fire.doc`: word-association litany ("Fire. Burn. Sun. Light... The ash... Bunsen
    burner. Bonfire. Beach bonfire. Burning Man...") plus a longer two-part dialogue scene ending
    with a real wildfire visible from a party. Reserved for the fire stream's text overlay.
  - Water/Air/Earth/Wood → `Cartography.doc`'s "In The End It Falls Slowly Through The Aether": a
    single raindrop falling off a leaf, told through real physics (surface tension, friction,
    oxygen/nitrogen, root, sun) — touches water, air, earth, and wood in one continuous piece.
    This is the source text for the "leaf" scene (see "egg / leaf / cycle" below).

## full archive deep-dive (2026-07-16)

Did a complete pass on the entire `archives/Writing archive/` folder (228 files, ~1.84M words,
~2000–2025) hunting for site-usable material. Full write-up + the general findings (perceptual
mechanics' name origin, the fire-obsession stat, the L.A. Project, etc.) now live in A Manual of
Perceptual Mechanics.scriv, Research/"Archive Research Notes" — that project is the source of
truth for the archive-research history going forward.

What actually landed on the site from that pass: "The Crocodile Photograph" (dark-comedy short
story), "The Golden Hare" (one-sentence myth fragment, now the wandering interstitial), "The
Orrery of Los Feliz" (noir sci-fi vignette; landed as a clickable object in nebula.js on 07-16,
later promoted to its own scene, `orrery.js`, on 07-17) — see "gems wired into the site" below.

## gems wired into the site (2026-07-16, same session)

- **The Crocodile Photograph** + **Fire.doc's two embedded stories** (dubbed `fireVigil` — the
  dying-man/Debbie dialogue about death and religion — and `fireCalamity` — the physics-rant/
  Edward-and-Maria party scene, wildfire visible in the middle distance) are now real patches on
  the scroll (`src/text/scrollTexts.js` + `src/scenes/manuscript.js`). Scroll is now ten pieces,
  not seven; Fire.doc's opening litany was deliberately left out of these two (still reserved for
  the elements/fire livestream project). Added a `tone-5` CSS tier for Crocodile Photograph since
  it's newer than everything previously on the scroll. `npx vite build` passes clean.
- **The Orrery of Los Feliz** was, as of this entry, a real object in `nebula.js` — a small
  clickable orrery (bronze center sphere, tilted orbit rings, three actually-orbiting bodies)
  sitting apart from the real-site constellations, opening the same info panel with the full found
  text. Superseded the next day — see "nebula retired, orrery promoted" below for what it became.
- **The Golden Hare** is a new top-level interstitial (`src/components/goldenHare.js`, wired into
  `main.js` via `initGoldenHare()`), not part of any single scene. Rare (roughly once every 1–3
  minutes), wanders across whatever's on screen — landing grid or an open experience, doesn't
  care which — as a plain inline-SVG silhouette, click reveals the one-sentence myth as a caption.
  Two variants (single scampering hare ~85%, a spinning Three Hares ring ~15%), redrawn from a
  real tattoo (Scott's own) and refined a second time against an Adobe Illustrator trace of the
  tattoo photo (see the file's header comment for detail on why that trace couldn't be used
  directly). Respects `prefers-reduced-motion` by not running at all rather than sitting inert.
- **Pygmalion** (a complete essay about an online catfishing episode) is wired into the scroll —
  slotted chronologically into the c. 2000 cluster. Scroll is now eleven pieces. Source essay's
  full context lives in A Manual of Perceptual Mechanics.scriv now, not here.

## egg / leaf / orrery / cycle — activated (2026-07-17)

Three pieces of new infrastructure (egg, leaf, cycle) were built 2026-07-16, `npx vite build`
verified, then deactivated the same day at Scott's request. `nebula.js` had been sitting
deactivated even longer ("being reworked"). All four were switched back on 2026-07-17: imports,
`SCENES` entries, nav icons, and preview tiles un-commented in `main.js` and `index.html`.
`nebula.js` was retired and replaced with `orrery.js` later the same day — see "nebula retired,
orrery promoted" below. Site now has eight scenes live: sphere, butterfly, manuscript, theater,
egg, leaf, orrery, cycle. `npx vite build` verified clean after re-activation.

- **`egg.js`** — fully rebuilt. Retired the old "worldline" concept (Google Maps satellite tiles +
  a personal geographic path) in favor of a self-contained WebGL scene: Earth (a canvas-drawn
  texture, no network image fetch, same approach as `orrery.js`'s halo textures), a dipole
  magnetic field traced as glowing arced lines, aurora curtains at both poles (gradient sprites,
  green fading to violet, swaying and flickering), and a scatter of small satellites on real
  tilted orbits (same pivot-rotation trick as the orrery in `orrery.js`). Drag to orbit, same
  manual-drag pattern as `orrery.js`.
- **`leaf.js`** — new scene, built around "In The End It Falls Slowly Through The Aether" in full
  (Cartography.doc — see "elements/cycle roster" above). A single quiet vignette, not an explorable
  space: an orthographic-camera Three.js scene, a leaf shape holding a droplet through a slow
  34-second loop — surface-tension hold, freefall (with a few "escaped molecule" motes peeling off
  mid-fall), impact/splash, reform — with the text arriving caption-by-caption in the same order
  it was written, timed to the phase of the fall it describes.
- **`cycle.js`** — new scene, the five-element live-stream piece from "elements/cycle roster"
  above, actually built: real YouTube iframe embeds (not WebGL — DOM/iframe is the honest choice
  for actual documentary footage, same reasoning as `theater.js`), one button per element, a manual
  backup link per stream since YouTube gives no reliable cross-origin "stream is down" signal from
  inside an iframe. Fire.doc's word-association litany (the piece explicitly reserved for this
  since it was first found — see "elements/cycle roster" above) plays over the fire stream only, one
  phrase fading in at a time. Confirmed live YouTube channel/video IDs for all five streams via
  direct lookup (GlobalQuake channel `UCZmcd4cQ2H_ELWAuUdOMgRQ`, YallBot/Ryan Hall Y'all channel
  `UCJHAT3Uvv-g3I8H3GhHWV7w`, Kilauea Cam A `iws3rh5vLAQ`, the Explore.org Smith River cam
  `WUqQdNAUC1c`, Chattahoochee National Forest cam `mFB6KZnjhy0`) rather than guessing — worth a
  periodic check since livestream video IDs do occasionally change when a stream restarts.

## nebula retired, orrery promoted (2026-07-17)

`nebula.js` bundled three separate things: hand-built constellations recreating Scott's old
personal sites (Spoonfed and its variants, the butterfly effect, Solistrato — real content, real
palettes pulled from the actual old CSS/HTML), the small clickable Orrery of Los Feliz object
sitting apart from those constellations, and `utils/nebula-curator.html`, a side tool for pasting
URLs ("mostly YouTube videos, but anything goes" per its own copy) and having Claude sort them
into star constellations via the Anthropic API — built but never actually used; every star in
`nebula.js` was hand-authored, none came from the curator tool.

At Scott's request, all three are gone except the orrery, which is promoted to its own scene:
- **`src/scenes/nebula.js`** and **`utils/nebula-curator.html`** — both retired (moved out of the
  repo entirely; this sandbox can rename files but not delete them, so they're not literally gone
  from disk, just untracked and out of the build — see "housekeeping" for the general pattern).
  The `nebula` entry in `vite.config.js`'s build inputs was removed along with the tool.
- **`src/scenes/orrery.js`** — new file, the found text (same full, unedited "Orrery of Los Feliz"
  short-short) rebuilt as its own complete scene rather than one small object in a larger one: a
  30-foot orrery matching the text's own description — nine planets on independent tilted orbits
  (four with their own moons), an asteroid belt (a scatter ring, not a solid line), two irregular
  tumbling "unidentified cosmic objects" further out, the center spike (steel and wood, painted
  royal purple) topped with a radio telescope dish that pulses as if still receiving a signal, a
  faint warehouse-rafter suggestion up high (the peak poking through the skylights), and a deep
  star field behind all of it. Drag to orbit, click the orrery to open the panel with the full
  found text — same interaction language as the old nebula stars. Renamed throughout: `main.js`
  (import, `SCENES` entry, `initPreviews` map), `index.html` (nav icon — redesigned as tilted orbit
  rings around a spiked hub, rather than the old six-star constellation glyph — and preview tile),
  `utils/shorts.html` (which also imported `createNebula` directly for its own scene list).
  Cross-references in `egg.js`'s header comments (which describe sharing the halo-texture and
  drag-to-orbit technique) updated to point at `orrery.js`.
- **Second pass, same day** — Scott's first look at the built scene called out two problems: the
  orbit rings (independently randomized tilts) read as a tangled scribble rather than a legible
  model, and the whole thing felt like a free-floating sci-fi object rather than something built
  by a person out of junk metal in a real warehouse. Rebuilt again: orbit tilts now share one base
  angle with only a few degrees of jitter (the found text's own line — "the orbits of the planets
  are precisely and mathematically laid out with an error tolerance approaching perfection" —
  justified making them close to coplanar, not tangled), and the whole sculpture is grounded in an
  actual warehouse — a concrete floor, a ceiling with a rectangular skylight hole the mast's peak
  actually pokes through, a soft light shaft falling through that hole, two corrugated-metal walls,
  and real `THREE.Light`s (hemisphere + a cool skylight directional + a warm point light) instead
  of unlit flat-color materials. The orrery itself is now built to read as welded scrap, Survival
  Research Labs-style, rather than a smooth glowing prop: a lattice mast (core shaft + riveted
  collar flanges + diagonal cross-braces) instead of a plain cylinder, canvas-generated weathered
  steel/rust textures (with a chipped-royal-purple-paint pass on the mast specifically, per "painted
  a most royal purple"), low-segment faceted rings with visible bolt studs, every ring and the
  outer "unidentified cosmic objects" braced back to the mast with welded struts so nothing reads
  as independently floating, bronze (not glowing) planets on short mounting arms, and the asteroid
  belt rebuilt as scattered angular debris chunks instead of glowing points. The click target is now
  a bolted control box with one lit amber indicator lamp, low on the mast, rather than a glowing
  purple sphere.
- **Scene order** — orrery moved to sit right after leaf, before cycle, at Scott's request. Full
  order is now: sphere, butterfly, manuscript, theater, egg, leaf, orrery, cycle.
- **Third pass, same day** — three more changes, all at Scott's request: the mechanism now hangs
  from the roof rather than standing on the floor (a crossed pair of steel roof trusses near the
  skylight, four chains fanning down from the trusses to a suspension collar partway up the mast,
  with a riser continuing on up through the truss height and the skylight hole to the dish — the
  mast's lower end, control box included, now hangs in open air with real clearance above the
  floor, nothing touching the ground); the nine bodies are the actual planets in the actual solar
  system rather than generic tinted spheres — real order, orbital spacing and body size both
  compressed with a square root of the real values so Mercury and Pluto can share a small scene,
  real notable moons (Earth's Moon, Mars's Phobos and Deimos, four Galilean moons on Jupiter,
  Titan, Triton, Charon), Saturn actually has rings, and the asteroid belt sits in its real spot
  between Mars and Jupiter instead of stuck out past everything (the "few other unidentified
  cosmic objects" from the text now read naturally as the odd stuff further out, past Pluto); and
  the back wall carries three taped-up early-90s show flyers — Nirvana, R.E.M., For Squirrels —
  canvas-generated xerox-flyer textures (band name as plain text only, no logos or artwork
  reproduced), dating the room itself rather than just the machine. Walls were also pulled in
  closer than the floor/ceiling extent (a separate `wallDist` from the floor/ceiling `span`) so the
  flyers actually read at a legible size instead of being lost on a distant wall.
- **Fourth pass, same day** — a round of notes after seeing it running: fixed all orbits (planets
  and the outer "unidentified" objects) to spin the same direction — they'd been alternating
  even/odd by index, which reads as a bug since real planets all orbit the same way; widened the
  zoom-in clamp (was capped at a distance of 8, now 1.4) so individual planets and moons can
  actually be approached up close, not just the cluster as a whole; and filled the warehouse out
  into a proper ramshackle garage rather than a bare room — a pegboard with tool silhouettes
  (wrench, hammer, saw) on the side wall, a stack of cardboard boxes in the back corner, an old
  tire leaning against the back wall, a workbench with a little clutter on top and a bare bulb
  hanging over it on a cord from the roof truss (the scene's existing warm point light now lives at
  that bulb instead of an arbitrary point in space). Added a fourth flyer, Beastie Boys, and
  respaced all four organically — different heights, rotations, and sizes, slightly overlapping,
  the way a real flyer wall accumulates over time rather than a neat row.
- **The Golden Hare, shelved (2026-07-17)** — at Scott's request ("not working for me"). The
  `initGoldenHare()` import and call in `main.js` are commented out, same treatment as egg/leaf/
  cycle's brief deactivation earlier this session — the file itself (`src/components/
  goldenHare.js`) is untouched and ready to switch back on if wanted later.
- **Fifth pass, same day** — the planet colors now match a real print Scott owns (a minimalist
  "The Solar System" poster, flat bold color per planet against dark slate green): Mercury pink,
  Venus purple, Earth cyan, Mars red-orange, Jupiter orange, Saturn gold, Uranus chartreuse,
  Neptune khaki, Pluto a muted pale cream (the print draws Pluto as an undifferentiated dot among
  the other Kuiper Belt objects, not a distinctly-colored planet, so it stayed muted here too).
  Not applied as the print's own clean flat vector fills, though — each planet gets its own
  canvas-generated spray-paint texture instead (`makeSprayPaintTexture`): a dark rust primer base,
  several layered "spray pass" dabs (hundreds of tiny semi-transparent dots per pass, denser toward
  each pass's own center so coverage thins unevenly toward the edges, the way an actual rattle can
  lays down color), a couple of gravity-drip streaks, and a scatter of dark grit on top. Same
  scrap-metal-someone-actually-painted logic as the mast's chipped royal purple.
- **Sixth pass, 2026-07-17** — the spray-paint texture wasn't actually reading: the rust-primer
  base dominated over the sparse, low-alpha color dabs, so on a small sphere it averaged out to a
  dark muddy blob instead of the print's colors (Scott: "is that supposed to be the sun down there?
  i don't think these are coming through" — the amber dot he'd spotted was the control box's
  indicator lamp, not a sun; there's no separate sun object in this design, just the painted mast).
  Fixed with a solid color base coat under the speckle/mottling passes, plus a subtle emissive tint
  per planet so they hold up under the scene's dim lighting. Then, at Scott's request: the orrery
  itself (not the warehouse around it) got substantially bigger — orbit-ring radii, planet sizes,
  and mast/hardware thickness all scaled up (`HW`/`SR`/`SS` constants in `buildOrrery`), with mast
  height and every vertical room anchor left untouched so the warehouse itself stayed the same
  size; ring radius growth is capped just inside the side walls (planet size and hardware got the
  fuller increase, unconstrained by the room). Camera pulled back to keep the bigger machine framed
  by default, zoom-out range widened to match. Also leaned the whole scene harder into an early-90s
  CD-ROM adventure game feel (Myst, Return to Zork, The 7th Guest) — added THREE.Fog matched to the
  clear color for that soft render-distance haze, a vignette + grain/scanline CSS overlay over the
  canvas, and restyled the read-more panel away from the sci-fi "Electrolize" font toward a serif
  journal-page look. Added a persistent title card (`The Orrery of Los Feliz`, plus a subtitle
  quoting the found text: "About thirty feet high, the peak poking out of the warehouse
  skylights"), same idea as butterfly's on-screen label. This piece is also going into The Secret
  World as a found object.

## You've Got a Friend in Satan — scenes wired into the theater (2026-07-16)

Scott's first play (a 1996 scanned script) got a full verbatim Word-doc transcription
(`You've Got a Friend in Satan.docx`, Documents root) and eight curated scenes added to
`src/scenes/theater.js` alongside Truth and Beauty and Paul Revere: the Art/Horace "hot enough for
ya" routine, Horace's "Diving in Hamburg" monologue, the Never Have I Ever/Spam runner, the sales
pitch through Todd's seduction, Art's arrival as backup, Katie's "I will not break" speech, the
notary-stamp twist, and the closing reveal that the whole assignment was a setup. New characters
(Horace, Art, Satan, Voice of Satan, Katie, Todd, Aaron, Traci, The Woman) added to the shared
`CHARACTERS` map. Verified with a headless DOM mock driving 2000 forced clicks through the full
shuffled timeline (every scene, every beat), plus a clean `vite build`.

## housekeeping (2026-07-16)

`source-material/` (all the deep-dive write-ups, gem excerpts, and the Boston Scion campaign report)
moved out of this repo entirely, to `../perceptualmechanics-source-material/` — a sibling directory,
not tracked in git. Reasoning: it's working notes about *other* Scott projects (Secret World, the
Manual) and personal archive material, not site content, and had no business being in a public repo
or anywhere near what gets deployed. Added `source-material/` to `.gitignore` as a safeguard against
it landing back in by accident. Committed locally (`Move source-material/ out of the repo`) but not
yet pushed — **this repo is public on GitHub**, and the four files that were already tracked
(`archive-deep-dive.md`, `fire-excerpt-more-rambling.md`, `gem-crocodile-photograph.md`,
`gem-golden-hare-and-orrery.md`) are already live in its history from an earlier commit. Pushing the
new commit stops them showing at the tip of `main` going forward, but doesn't erase them from
history — that needs an explicit history rewrite (force-push), which hasn't been done and shouldn't
happen without Scott deciding that's worth it.

## solid / deployed
- sphere with hypertext fragments + silk glimmer links
- chaos butterfly in phase space, 2026
- egg — Earth's magnetic field, aurorae, orbiting satellites, 2026 (activated 2026-07-17)
- leaf — "In The End It Falls Slowly Through The Aether," 2026 (activated 2026-07-17)
- orrery — the Orrery of Los Feliz, rebuilt as its own scene, 2026-07-17
- cycle — five live streams, one per classical element, 2026 (activated 2026-07-17)
- eight-panel landing with persistent nav bar
- ESC to close scenes
- full a11y pass (skip link, ARIA roles, keyboard nav, reduced motion)
- colophon: "created in collaboration with claude"

## deployment
- host: DreamHost
- build: `npm run build` → upload `dist/` contents to public root
- no server-side dependencies, static files only

## collaborators
- scott jason cohen — vision, writing, curation
- claude (anthropic) — code, literary analysis, implementation
