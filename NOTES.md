# perceptual mechanics — notes & punch list

This file is solely about the perceptualmechanics site — the live code, deployment, and content
sourcing that feeds into it. Reorganized 2026-07-16: everything about the two other writing
projects (The Secret World, A Manual of Perceptual Mechanics) moved into their own Scrivener
files, which are now the source of truth for that material going forward. See "project map"
below for where things live.

## 1.0.4 (2026-07-17, same day)

Bug fix from a screenshot Scott sent: on a short-enough browser window, the
"perceptual mechanics" title text rendered right across the leaf preview
tile. Root cause — `#landing` had `padding-top: 3.5rem` to clear the fixed
nav bar, but no matching `padding-bottom`, so on a window short enough that
the two-row preview grid didn't have slack to spare, the flex-centered
content could sit flush against, or under, the fixed `#site-title` (bottom-
center) and `#colophon-mark` (bottom-right). Whichever tile lands at dead
center of the wrapped grid's second row — leaf, at the width in the
screenshot, since the seven tiles wrap 4-then-3 — took the title text right
across it. Added `padding-bottom: 4.5rem` to `#landing`, mirroring the
existing top clearance, sized to clear both fixed elements' full footprint.

## 1.0.3 (2026-07-17, same day)

One refinement to the status-bar easter egg, Scott's own idea: instead of a
reliable hover effect, each of the fifteen `onmouseover` handlers now also
calls a new `pmGlimpse()` (in `main.js`, exposed on `window` since inline
`onmouseover=""` attributes run in global scope, not a module's) that rolls
a 1-in-100 chance and, on a hit, flickers the browser tab's own title to
that element's status word for about a second and a half before reverting
on its own — not tied to how long the mouse stays put, so it reads as
something that happened to you rather than a hover state you triggered.
Deliberately rare enough that most visitors will never see it once. The
`window.status` line stays exactly as it was in 1.0.2 (inert everywhere,
kept anyway as the correct period technique); this is layered on top of it,
not a replacement.

Version bumped to 1.0.3 in package.json.

## 1.0.2 (2026-07-17, same day)

One easter egg, entirely Scott's idea: a throwback to his own web origins,
Netscape 3's status bar, where hovering a link swapped the address bar's URL
out for a short, loaded bit of status text instead — never a description,
always more like a mood or a private joke. Wired onto every nav icon, every
landing-page preview tile, and the "perceptual mechanics" title link itself,
each carrying its own one- or two-word status text:

sphere → "zen archery" · butterfly → "complexity" · scroll → "savagery" ·
theater → "light entertainment" · egg → "lantern" · leaf → "stillness" ·
orrery → "will" · perceptual mechanics → "secrets"

Done the actual 1999 way: plain inline `onmouseover="window.status='...';
return true;"` / `onmouseout="window.status=''; return true;"` on each of
the fifteen elements in index.html, nothing else — no new module, no
fake status-bar UI standing in for it. (First pass overbuilt this: a whole
`statusBar.js` component with a fixed beveled-chrome strip pinned to the
bottom of the viewport, since real browsers stopped honoring script writes
to `window.status` around 2014. Scott's call, correctly: that's not what he
asked for. This is exactly the old snippet, doing exactly what it always
did — nothing visible in a modern browser, all of it still sitting there
correct and inert in the page source, which is its own kind of easter egg.
The retired component is in `_stale_build_dirs_safe_to_delete/`.)

Version bumped to 1.0.2 in package.json.

## 1.0.1 (2026-07-17, same day)

Three follow-ups from Scott right after the 1.0 tag:

- **Real cross-links added to the scroll and to the egg's poems.** Scott asked how hard it
  would be to extend the geodesic sphere's fragment-link trick (click a phrase inside one
  fragment, jump to another) to the rest of the site's writing. The honest answer: it already
  exists in two places (sphere's own facet-to-fragment links, and manuscript's near-identical
  LINKS array — click a phrase in one patch of hide, scroll-and-flash to another), extending it
  to a scene that doesn't have it yet is real work, and true cross-scene linking (a phrase in Leaf
  jumping into a poem in the Egg) would need new scene-transition plumbing that doesn't exist
  anywhere on the site today. Scott's call: skip the cross-scene work for now, just do more of the
  in-scene kind, in both places that could use it. The scroll (`manuscript.js`) got three new
  entries in its existing LINKS array — a re-read of the full source text turned up one exact
  phrase ("pilgrimage to Hell") that was already sitting there decoratively as rubric-ink color
  with no link, promoted to a real bidirectional link between Holography and Projection, plus one
  new find: Pygmalion (2000, the oldest-dated piece on the scroll) uses the actual word
  "projection" in a passage about mistaking a fabricated persona for a real person — nine years
  before Projection (the piece) was written about exactly that. The Egg's 14 poems (`poems.js`)
  never had this mechanism at all; built it fresh in `egg.js`, same panel-swap-plus-glimmer idea
  as sphere's but re-themed to the Egg's own green/white palette instead of sphere's blue, with a
  `POEM_LINKS` array (keyed by poem title + stanza index, since poems.js entries don't carry an
  id) doing the same job as manuscript's LINKS. A close read of all 14 poems turned up five real,
  non-forced echoes — "stones" (Lament ↔ Moon Song), "mirrors"/"Mirrors" (The Lovers ↔ Lament),
  "latticework" (Moon Song ↔ Raise a Glass — unsurprising, since those two turn out to be parts 9
  and 11 of the same unpublished source cycle, thirty-six.doc), and "Coalescing" plus
  "Reveal"/"revealed" (DNA reaching out to both Apocrypha and Haiku, two completely unrelated
  source documents that happen to land on the same words). Same rule as everywhere else on this
  site: no new text was written to manufacture a connection — every linked phrase was already
  sitting in the poem, verbatim, and every target/phrase pair was checked programmatically against
  the actual source arrays before going in, not just eyeballed.

- **Golden hare, fully retired.** Since the colophon's own mark is now a real hare (Abby
  Williams's artwork), the older wandering-hare easter egg (`components/goldenHare.js`, already
  shelved/commented-out since earlier the same day) was redundant — a site doesn't need two
  separate "spot the hare" mechanics. `goldenHare.js` is retired the same way `nebula.js` was:
  moved out of `src/components/` entirely into `_stale_build_dirs_safe_to_delete/` (this sandbox
  can rename files but not delete them, so it's untracked and out of the build, not literally gone
  from disk). All references cleaned up: the commented-out import/call in `main.js`, the stray
  comparison in `index.html`'s cycle-shelving comment, and the mention in `egg.js`'s satellite-
  offset comment. The hare's one-sentence found myth line ("A Golden Hare ran across the sky...")
  didn't get deleted along with the mechanic that used to carry it — it moved into the colophon's
  own credits section, right next to the Abby Williams artwork credit, since the mark itself is
  now the reason that line matters. Its old standalone "Elsewhere on the site" bibliography
  category is gone along with it.
- **Nav-icon tooltips made consistent.** Two outliers fixed: manuscript's `title` attribute was
  `"the scroll"` — lowercase, and not even the name used anywhere else for that scene (`SCENES`
  registry calls it "Selected Works — An Illuminated Manuscript", same as its own aria-label
  wording) — now matches that. Sphere's was just `"The Sphere"`, no subtitle, the only one of the
  seven with no descriptor while the other six all pair a name with one; gave it "Interconnected
  Text Fragments" (reusing the exact phrase already sitting in the colophon's own Sphere
  bibliography entry, not inventing new copy). Applied to both the nav icon and its matching
  landing-page preview tile, which mirror each other's `title` text on purpose (see the design-pass
  entry above for why the preview tiles got tooltips at all).

## 1.0 (2026-07-17)

Tagged `v1.0.0`, `package.json` bumped to match. End-to-end QA pass beforehand, everything verified
via `node --check`, a full clean `vite build`, and careful reading (this sandbox still has no
working browser tool this session — see the audit and cycle punch-list entries below for why —
so nothing here is a substitute for Scott's own click-through, just the strongest static/structural
check available):

- **Syntax**: all 17 source `.js` files pass `node --check`, zero errors.
- **Build**: clean production build, zero errors, the one warning is the long-standing >500kB
  `orrery` chunk-size notice (a bundling/performance note, not a bug — see the audit entry below).
  Confirmed the build output has no trace of retired code (`nebula`, `nebula-curator`) anywhere in
  the bundled JS.
- **Scene registry**: every live scene (sphere, butterfly, manuscript, theater, egg, leaf, orrery)
  has a matching `SCENES` entry, nav icon, preview tile, and preview-container mapping, all four in
  sync. Shelved scenes (`cycle`, the golden hare) confirmed fully commented out at every one of
  those points with zero live dangling references.
- **Internal links**: manuscript.js's cross-link targets, sphere.js's fragment-to-fragment links,
  and the colophon's bibliography were all checked against their actual source data programmatically
  — all resolve. The Egg bibliography entry's poem count (fourteen) matches `poems.js` exactly, name
  for name.
- **z-index / a11y**: every element a scene appends straight to `document.body` (title/hint/caption)
  sits at z-index 310 per the scale documented at the top of `styles/main.css` — no regressions.
  All four dialog-style panels (sphere, egg, orrery, colophon) close on Escape, each via its own
  `bindEscapeClose()` call with a matching `dispose()` in the owning scene's own teardown (colophon
  is a page-level singleton with no unmount, so it correctly never disposes its own listener). Every
  scene has both `prefers-reduced-motion` handling and aria labeling in place.
- **Housekeeping**: zero `console.log`/`debugger`/`TODO`/`FIXME`/stray `alert()` in `src/`, zero
  unused named imports (checked programmatically, not just by eye).

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
- **Seventh pass, 2026-07-17** — more feedback after seeing it running: recentered the orrery in
  the room and removed the auto-rotate entirely (it never let the scene settle into a composed,
  centered view - always caught mid-spin, which read as "not centered"; now it holds still until
  dragged), brightened the hemisphere/directional/point lights a step, and widened the fog's far
  distance well past the camera-to-orrery range (it had been cutting into the enlarged orrery and
  washing the preview tile almost to black). Also found and fixed the actual cause of "the title
  appears for a second then disappears": `#orrery-title`/`hint`/`caption` are appended to
  `document.body`, outside `#experience-overlay` (styles/main.css: fixed, z-index:300, fades to
  fully opaque over 0.6s) - at z-index:202 they were only visible during that fade-in, then
  covered once the overlay settled. This exact issue was already documented in main.js's own
  comments for butterfly's equivalent body-level label/hint (z-index:310 there, for the same
  reason) - orrery's just hadn't gotten the same treatment. Bumped all three to 310.

## Safari filter flicker + a punch list: egg, leaf, cycle (2026-07-17, same day)

Scott, mid-punch-list, also flagged the scroll/manuscript preview tile "oscillating between two
states" in Safari specifically. `.ms-preview-medallion` (src/scenes/manuscript.js) combines a CSS
box-shadow keyframe animation with a referenced SVG filter (`url(#ms-rough-strong)`) on the same
element - a known WebKit bug where the animated element periodically drops and re-resolves the
filter, reading as a flip between two states rather than a smooth loop. Fixed by forcing a stable
compositing layer (`translateZ(0)` + `will-change`) on the medallion and its child cracks.

Then a four-item punch list, left to work through solo:

- **Egg** (src/scenes/egg.js) — Scott questioned the aurorae: "should the aurorae column up like
  that?" They didn't, or rather, they shouldn't have: the old design stood sprite columns straight
  up off each pole, which reads as spikes, not what the aurora actually looks like from orbit (a
  ragged glowing band - the "auroral oval" - hugging the curve of the planet at high latitude).
  Rebuilt as a perturbed, jittered torus at each pole instead, with a few much-shorter shimmer
  sprites layered on as texture rather than the shape itself. Earth's surface texture was rebuilt
  at double resolution with ragged/noisy coastlines and terrain shading instead of clean ellipses,
  and got a separate, independently-rotating semi-transparent cloud shell (the single biggest lever
  for "photorealistic" over "textured ball") - the green emissive tint and atmosphere glow shell
  are untouched, so the "green egg" mood holds. Satellites now each carry one of Scott's poems
  (src/text/poems.js, cycling through all 12) and are clickable, same raycast-to-panel mechanism as
  the geodesic sphere's facet-to-fragment links in sphere.js; added a small per-satellite beacon
  and a generous invisible hit-sphere since the actual bodies are tiny. Also fixed egg-hint/
  egg-caption's z-index (202 -> 310) - same #experience-overlay collision bug as orrery's, latent
  here too since egg uses the same body-level-overlay pattern.
- **Leaf** (src/scenes/leaf.js) — two asks: have the text scroll down with the drop, and lean the
  whole thing hard into wabi-sabi. Replaced the old discrete fade-between-captions with one
  continuously-scrolling text column: all eight stages sit stacked in normal document flow inside a
  small masked viewport, and the scroll offset is driven directly by the same `frac` that drives
  the drop's own fall - holding each stage centered for its first 60%, then easing down to the
  next, so the text physically falls with the drop rather than cross-fading on its own clock.
  Wabi-sabi pass: the leaf silhouette is deliberately asymmetric now (uneven lobes, one small torn
  notch) with a canvas-mottled surface (uneven color patches, a browned weathering spot, a couple
  of insect-mark spots, fine grain) instead of one flat color fill; composition is off-center and
  very slightly tilted at rest; a subtle grain overlay sits over the whole render. Same z-index fix
  applied to leaf-caption/leaf-hint.
- **Cycle** (src/scenes/cycle.js) — four of the five live streams were dead. Root cause on
  inspection: three of the five (water/fire/wood) were pinned to one specific YouTube video ID
  each, and a "24/7 live" broadcast still periodically ends and restarts under a brand new ID even
  though the channel itself doesn't change - a hardcoded ID is only ever temporarily correct, so
  this was always going to recur. Earth and Air were already using the self-updating pattern
  (`embed/live_stream?channel=<id>`, which always redirects to whatever that channel currently has
  live) and it's possible one or both broke anyway if the channel stopped streaming to YouTube
  specifically (GlobalQuake, for instance, also streams to Twitch). Converted every element that
  has a real 24/7-streaming channel to that self-updating pattern; where a pinned ID was the only
  option, kept the best-researched current one but swapped out backups that were literally raw
  YouTube search-results URLs (not real fallbacks) for concrete, durable, non-YouTube destinations
  (USGS's own real-time earthquake map, Windy's live radar, VolcanoDiscovery's Stromboli page,
  explore.org's full live-cams index). Also made the primary-source link a visible button instead
  of a footnote, since no embed of this kind can ever be fully failure-proof against the source's
  own churn. Honest caveat: this sandbox had no working browser tool this session (Claude in Chrome
  wasn't connected, and no headless browser could be gotten running either — missing system
  libraries, no root access, and the package mirrors needed to install them aren't reachable from
  here), so none of this was confirmed live in an actual browser; it's all web-search research.
  Worth a spot-check.

## Full codebase audit: quality, modularity, mobile, a11y (2026-07-17, same day)

Scott's ask, solo, while he stepped out: a full code review across the whole site, focused on code
quality, modularity/reusability, mobile, and accessibility. Sandbox note stands from the punch-list
above — no working browser tool this session (Chrome extension not connected, headless Chromium
can't launch — missing `libXdamage.so.1`, no root, package mirrors unreachable) — so everything
below is verified via `node --check` + `vite build` (syntax/bundling) and careful reading, not
visual/interactive testing. Flagged for Scott's own spot-check where it matters.

**New: `src/utils/sceneKit.js`.** Five small helpers factored out of drag-to-orbit, wheel-zoom,
guarded-resize, prefers-reduced-motion, and escape-to-close code that had drifted slightly out of
sync across orrery.js/egg.js/sphere.js/butterfly.js. Each returns a `dispose()` matching every
scene's existing teardown convention. Adopted so far in orrery.js, egg.js, and sphere.js.

**Real bugs this surfaced and fixed, not just refactoring:**
- **orrery.js and sphere.js had no touch support for drag-to-orbit at all** — mouse-only, despite
  sphere.js already having touch listeners (only used for tap-vs-drag detection on facet clicks,
  never wired to rotation). Rotating either scene silently didn't work on phones/tablets. Fixed via
  `bindOrbitDrag`, which unifies mouse and touch under one implementation.
- **orrery.js and egg.js had zero `prefers-reduced-motion` accommodation** for their continuous
  WebGL animation loops (orbital rotation, Earth/cloud spin, field-line precession, satellite
  orbits), unlike their CSS-driven sibling scenes (leaf, manuscript, cycle) which already respect
  it. Now gated behind `reduceMotion` in both files — drag-to-orbit itself stays available either
  way, since that's motion the visitor asks for, not motion imposed on them. Left ungated: small
  opacity/brightness pulsing (orrery's radio-telescope signal, egg's aurora shimmer and glow
  breathing) — that's not the continuous positional motion the media query is for.
- **None of the three read-more panels (orrery, egg, sphere) supported Escape to close** — only the
  close button or a click outside worked. All three now close on Escape via `bindEscapeClose`,
  matching standard modal-dialog expectation.
- **Mobile landing-page overflow**: `html, body { overflow: hidden }` (needed site-wide for the
  full-screen scene experience) combined with the 7-tile preview grid stacking into a column
  (~1500px) on narrow viewports, centered via `#landing`'s `justify-content: center` — there was no
  scrollbar and most tiles were simply unreachable below a certain viewport height. `#landing` now
  owns its own `overflow-y: auto` scroll context, and switches to `flex-start` alignment under
  480px so the natural "start at top, scroll down" gesture reaches every tile.
- **Nav icon touch targets** were ~38px effective (22px svg + 0.5rem padding), under the ~44px
  guideline. Added `min-width`/`min-height: 44px` to `.nav-icon` — pads the hit area without
  changing anything visually.
- **No z-index scale documented anywhere.** The `#experience-overlay` collision bug (any
  body-level element under z-index 300 is only visible during the overlay's 0.6s fade-in, then
  permanently covered — see the punch-list section above) had already independently bitten orrery,
  egg, and leaf, each fixed the same way once found. Added a comment block at the top of
  `styles/main.css` documenting the 9999/500/400/310/300 scale so the next scene added doesn't
  rediscover it the hard way.

**Assessed as already solid, no changes made:** theater.js (strong existing a11y — live region,
comprehensive aria-labels, its own reduced-motion handling), cycle.js (button-based UI, no
drag/orbit/resize logic to consolidate), butterfly.js (already has correct mouse+touch drag support
— not migrated onto sceneKit.js since it isn't broken, though its on-screen label/hint is still
split across main.js/main.css rather than being self-contained in butterfly.js like every other
scene's pattern; worth revisiting if butterfly.js gets touched again for something else).
`goldenHare.js` intentionally not reviewed (currently disabled feature).

**Not done, lower priority:** migrating butterfly.js onto sceneKit.js purely for consistency (works
correctly as-is); code-splitting the `orrery` bundle (Vite's build warns it's >500kB minified —
that's a real observation but a performance/tooling concern, not a quality/a11y bug, and out of
scope for this pass).

## Colophon, shelved cycle, cranked orrery atmosphere (2026-07-17, same day)

Follow-up punch list from Scott, after seeing the audit work:

- **Cycle** shelved for now (same treatment as goldenHare.js — commented out
  in main.js's registry/imports and index.html's nav icon + preview tile,
  code kept intact) while the elemental approach gets rethought further, per
  the 4/5-dead-streams issue from the punch-list before this.

- **New colophon**: `src/components/colophon.js`, a persistent mark fixed
  bottom-right of the landing page (appended inside `#landing`, not
  document.body — main.js already sets `#landing` to `display:none` while
  any scene is open, so it hides for free with no extra visibility logic).
  Clicking it opens a single dialog with three sections: credits (the site,
  and the mark itself), a bibliography (every literary source used across
  the scenes — the Orrery's found story, the Egg's thirteen poems and its
  Kenney epigraph, Leaf's Cartography.doc piece, the manuscript's essays,
  the Theater's three plays, the Sphere's fragments, the Golden Hare's found
  line — centralized in one place instead of scattered per-scene), and a
  feedback mailto link. This is also where egg.js's former per-poem
  "source" line (which doc each poem came from) and the inline citation on
  its "sing, orbiter" epigraph moved to — both pulled out of egg.js itself
  per Scott's request.
  - **Icon is a placeholder.** The real mark is a hand-inked hare by Abby
    Williams (https://abbywilliams.studio/) — moon, two Venus circles, sun,
    and a star, the same four symbols cut straight through the body as
    negative-space holes — which Scott provided as a PNG in chat. That image
    never reached this sandbox's filesystem (checked uploads/ and did a
    full recent-file sweep — nothing arrived), so `colophon.js` currently
    reuses `goldenHare.js`'s existing single-hare linework (now exported as
    `HARE_SVG`) as a stand-in. **Still needed**: Scott to save the PNG into
    the project (or anywhere in the connected folder) so it can be swapped
    in — the button's `innerHTML` is marked in the code where to do it. This
    would also be the first actual image asset on the site (a deliberate,
    one-off exception to the "canvas textures only" rule — crediting
    someone else's real artwork means using the real artwork).

- **Orrery atmosphere cranked up** ("that wonderful barely-compressed video
  vibe"): `#orrery-grain` opacity 0.5 → 0.85, harder scanlines, a second
  coarser turbulence layer standing in for MPEG-style macroblocking, and a
  `steps()` background-position drift so the noise snaps between two
  offsets each frame rather than sitting static — reads as frame-to-frame
  video noise. New `#orrery-chroma` layer adds a subtle red/cyan color
  fringe at the frame edges (radial-gradient masks + `mix-blend-mode:
  screen`) for cheap-lens/compression chromatic aberration. Both respect
  `prefers-reduced-motion`.

- **Orrery skylight poke-through made legible**: the riser height (mast
  segment from the suspension collar up through the roof to the dish/
  antenna/signal bulb) was clearing the ceiling by as little as 0.05-0.1
  units before — technically matching the text ("about 30 feet high, the
  peak poking out of the warehouse skylights") but not legibly so at that
  margin. Increased to clear by ~0.7-0.95 units instead, verified
  numerically with a small script since this sandbox can't render and look
  at it directly (no browser tool available all session — see the audit
  section above and the cycle punch-list before it for why). Worth Scott's
  own visual check, same caveat as everything else built blind this
  session.

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
