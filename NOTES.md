# perceptual mechanics — notes & punch list

This file is solely about the perceptualmechanics site — the live code, deployment, and content
sourcing that feeds into it. Reorganized 2026-07-16: everything about the two other writing
projects (The Secret World, A Manual of Perceptual Mechanics) moved into their own Scrivener
files, which are now the source of truth for that material going forward. See "project map"
below for where things live.

## 1.0.22 (2026-07-19)

Scott, the next morning: "I think I broke something in the code, could
you check?" He'd hand-edited main.js and index.html himself overnight —
simplifying every nav icon, site-title, and preview tile's onmouseover
down to a plain `pmGlimpse('key')` call (dropping the old parallel
`window.status='...'` writes entirely, not just leaving them inert), and
restructuring pmGlimpse's internal word list from a flat object into an
array of `{ key, text }` pairs. That second part broke it: the lookup at
the bottom, `document.title = truth[text]`, still assumed `truth` was
keyed by name, but an array indexed by a string like `'sphere'` just
comes back `undefined` — so the 1-in-100 tab-title flicker was showing
the literal word "undefined" instead of "zen archery," "complexity," and
so on. The whole point of the easter egg was silently defeated. Fixed by
turning the list back into a plain object, `PM_GLIMPSE_WORDS`, keyed
directly by the same strings every onmouseover="" already passes in, plus
a guard so an unrecognized key fails silently instead of ever showing
"undefined" again.

"Yeah, may as well do a full cleanup, it's 6:36am on a Sunday morning,
the perfect time for code cleanup." Swept for other staleness while in
there: the nav's own header comment still said "all four scenes" (it's
seven, and has been since well before this weekend); and both the
Theater's main.js registry entry and its index.html preview tile still
described the reel as "scenes from Truth and Beauty and Paul Revere,"
missing "You've Got a Friend in Satan" entirely even though that play's
scenes have been live in the actual reel since it was added — a stale
aria-label, not a stale comment, so worth catching. All three fixed.

Verified with a real build: 23 modules, clean.

## 1.0.21 (2026-07-17, same day)

Lens shelved again. Scott sent a screenshot of 1.0.20 live — the Tree of
Life and chakras were clearly rendering, the beam read as a real cone —
but the gem was crowding the frame edges (its tip nearly touching the
title text, the culet crowding the caption) and the princess-cut facet
steps weren't bulging out past the girdle enough to read as a cut rather
than a smooth kite with some shading variation. I flagged both honestly
and asked whether he wanted them fixed now or if it was just a check-in.
His answer: "you know, let's just shelve this for the moment and look at
it tomorrow with fresh eyes" — and then, after confirming there was
nothing to push (7 versions, 1.0.14 through 1.0.20, sitting locally, never
pushed to GitHub, since this sandbox has no push credentials): "ok, can
you just comment out the lens then?"

Same three spots as every previous shelving (1.0.15/1.0.19's un-shelving
in reverse): the import/registry entry/initPreviews map entry in main.js,
and the nav-icon button + preview-tile block in index.html. Also reverted
the mobile nav-icon touch target in styles/main.css back to the 44px
guideline default — Lens out means the icon count drops back to seven,
which fits fine without the 38px override. src/scenes/lens.js itself is
untouched; the gem-framing and facet-bulge issues from the screenshot are
still there, unaddressed, waiting for "tomorrow."

Verified with a real build: 23 modules (Lens excluded), clean.

## 1.0.20 (2026-07-17, same day)

Right after answering Scott's question about whether the refraction was
actually computed (it is — `MeshPhysicalMaterial.transmission` is a real
per-frame GPU technique, not a faked texture), he came back with a three-
part request: "Okay, so let's focus the spotlight into a tighter beam.
Make the gem multifaceted, like a princess-cut diamond. Behind the gem, I
feel like we should do something with the chakras and the tree of life...
i'd love to see the refracted light getting all the way through the
bottom facets of the gem if possible." All three, plus the thing they add
up to.

**Tighter beam.** The spot's `angle` went from 0.15π (~27°) to 0.07π
(~12.6°), `penumbra` from 0.55 to 0.3, and the visible beam cone's radius
from 0.9×gemRadius down to 0.4× — a narrow, defined shaft instead of a
broad wash.

**Princess-cut gem.** `buildFacetedGem` is rebuilt from a single top-to-
bottom wedge per side (8 facets total) into a five-tier profile — crown
tip, crown ring, girdle, pavilion ring, culet — four columns going around,
six triangles per column, 24 facets total. Before writing it, I worked out
the outward-normal winding by hand for both triangle shapes that show up
(a single apex point above or below a four-point ring; two four-point
rings of different radii stacked, whichever direction they flare) and
confirmed both reduce to the same two winding rules regardless of which
band they're used in — then double-checked that by actually running the
real geometry through Three.js's `computeVertexNormals()` in a throwaway
Node script and confirming all 24 face normals point away from the
central axis, not just trusting the cross-product algebra by eye. Since
the triangle count per color is no longer a fixed two, the click/hover
code no longer assumes `faceIndex / 2` — `buildFacetedGem` now builds a
`triangleColumn` lookup array alongside the position buffer, and the
raycaster reads `gem.userData.triangleColumn[faceIndex]` directly.

**Chakras and the Tree of Life.** A new stationary backdrop plane, textured
by a canvas-drawn diagram: the ten sephirot of the Kabbalistic Tree of
Life (plus Da'at, the traditional "hidden" eleventh point, drawn fainter/
dotted per convention) joined by the standard 22 paths, with the seven
chakras drawn as a soft glow along the same central vertical axis the
Tree's own Middle Pillar (Kether–Da'at–Tiphareth–Yesod–Malkuth) already
runs down — Ein Soph and Malkuth/Shekinah were already this scene's
framework, so this leans on structure that was already there rather than
importing something unrelated. It's a sibling of the gem in `scene`, not
a child of the rotating `root` group, on purpose: a backdrop doesn't spin
with the sculpture in front of it, and a flat plane that did rotate would
vanish edge-on twice a revolution. Built generously tall (well above the
crown, well below the culet) and exempted from the scene's fog
(`material.fog = false`), specifically so the gem's transmission material
has real, vivid content to refract all the way through every facet —
including the pavilion ones at the bottom, which is exactly what Scott
asked to see and which the stone cradle's removal in 1.0.19 already
cleared the way for.

Verified: syntax check, a real build (24 modules, clean, ~2.5KB larger for
the new texture-drawing code), and the standalone Node/Three.js winding
check described above. Still can't render WebGL in this sandbox, so the
actual facet count, beam tightness, and backdrop legibility through the
glass are all worth Scott's own eyes.

## 1.0.19 (2026-07-17, same day)

Two more simplifications to Lens, requested right after Scott got to see
it live for the first time: "make the spotlight completely vertical. lose
the stone or whatever is holding the gem."

The spotlight fixture, `THREE.SpotLight`, and beam cone all moved from an
angled position (`(-1.05, 1.65, 0.85)` normalized) to directly overhead
(`(0, 1, 0)`) — the beam now falls straight down onto the gem instead of
arriving at a stage-light angle. The quaternion math that orients the
beam cone toward the gem didn't need to change at all; it was already
computed generically from the fixture's position each time, so pointing
that position straight up just works.

The rough stone cradle is gone entirely: `buildRockCradle()`,
`makeStoneTexture()`, the `NATURE` data object (Malkuth/Shekinah, grounded
in thirty-six's section 13), `openNaturePanel()`, and every hover/click/
dispose reference to the cradle mesh. The gem now floats free in the
frame, nothing visibly holding it up. Section 13's text isn't deleted —
just no longer surfaced anywhere on the site; it's sitting in git history
(1.0.14 through 1.0.18) if it wants a home again later, maybe elsewhere.

Updated title/hint copy ("Four facets, one light" instead of "...one
light, one stone"; hint drops "or the stone to read") and the aria-labels
in both main.js and index.html to match. Verified with a real build: 24
modules, clean, main bundle a few KB smaller with the cradle code gone.

## 1.0.18 (2026-07-17, same day)

Lens is live. Scott, on the 1.0.17 report: "well now you have to uncomment
it so I can see it :D" — fair. Uncommented the import/registry entry/
initPreviews map entry in main.js and the nav-icon button + preview-tile
block in index.html — the same three spots that got commented out in
1.0.15 and stayed that way through the cycle→lens rename (1.0.16) and the
single-gem/Prologue-spotlight redo (1.0.17). `src/scenes/lens.js` itself
is untouched by this entry — nothing about the scene changed, only whether
anything on the site can reach it.

Also restored the mobile nav-icon touch target math from 1.0.15's
reversion: Lens returning brings the icon count back to eight, which
doesn't fit at the 44px guideline default (8 × 44px + 7 × 0.5rem gaps =
408px, over an iPhone SE's 375px) — dropped back to 38px at the 480px
breakpoint, same fix as 1.0.14, undone in 1.0.15, now needed again.

Verified with a real build this time, not a temporary wire-then-revert:
24 modules transformed, clean, both the nav icon and preview tile present
exactly once in the built HTML. Same caveat as every visual change this
session — no headless browser in this sandbox, so the actual gem shape,
facet colors, spotlight beam angle, and click targets still need Scott's
own eyes on a real dev server. This is the first time the redone version
(one gem, four sides, "Prologue" spotlight) will actually be visible to
check.

## 1.0.17 (2026-07-17, same day)

Lens redone — one gem, not four, and the light finally has a name. Scott,
right after the rename landed: "Yes. but redo it. the laser light comes
from 'Maestro, if you please'. It hits one cut gem, with four different
colored sides. make the gem translucent." Still shelved, same as 1.0.15/16
— none of this is wired into main.js or index.html yet — but the scene
itself changed structurally, not just cosmetically.

Two changes:

1. One gem instead of four. Built by hand as a bipyramid (`buildFacetedGem`)
   — the same kite/diamond silhouette this scene's own nav icon already
   draws — six vertices, eight triangular facets, non-indexed so each
   triangle gets a clean flat normal. The four vertical sides (a top wedge
   plus a matching bottom wedge each) carry the four colors as a
   `THREE.Mesh` material array over `geometry.groups`, one group per side,
   in `FACET_ORDER`. Click/hover detection reads `intersection.faceIndex`
   from the raycaster and floors it by 2 to recover which side got hit —
   two triangles per side, laid out in order, so `faceIndex / 2` maps
   straight back to a facet key. "Make the gem translucent," per Scott:
   `transmission` pushed to 0.9 with near-zero roughness and an
   attenuation color/distance tuned per facet, so the four colors read as
   colored glass with real depth, not colored plastic.

2. The light source found its name. What was a generic internal glow
   standing in for "Ein Soph" is now staged as a literal spotlight rig —
   a small fixture mesh, a real `THREE.SpotLight`, and (full scene only) a
   translucent additive cone faking a visible beam, all aimed at the gem
   from outside rather than glowing from within it. The fixture is
   clickable and opens a panel for "Prologue" — the shortest complete poem
   in Scott Jason Cohen's Assembled Verse.doc, four lines Scott pointed to
   directly: "Maestro, if you please: / A single spotlight, / Illuminating
   / Me from head to toe." It reads as a stage direction more than a
   description — cueing a light on before anything else in the poem
   happens — which is exactly the relationship the actual spotlight rig
   has to the gem. Ein Soph is still the concept the light stands for;
   Prologue is the concrete text and image grounding it, the same
   relationship every elemental facet already has between its archangel
   label and its own writing.

Also fixed in passing: the `.cyc-preview` CSS class from the original
cycle.js was missed during 1.0.16's rename (it doesn't contain the
substring "cycle," so the sed pass never touched it) — now `.lens-preview`,
matching everything else.

Couldn't verify this one live — no headless browser in this sandbox, and
this time the geometry itself is new (a hand-built, non-indexed, grouped
BufferGeometry with a material array), not just a rename, so it's worth
Scott's own eyes on the actual gem shape, the beam's angle, and the facet
click targets before anything gets un-shelved. Temporarily wired it into a
scratch copy of main.js to confirm the module bundles cleanly (24 modules,
no import/resolution errors) before reverting main.js back to its shelved
state — that only proves it parses and links, not that it looks right.

## 1.0.16 (2026-07-17, same day)

A full rename, cycle → lens. Scott, right after the 1.0.15 shelving report:
"danke. actually, do a full rename -- change cycle to lens." Not a content
change — the scene stays exactly as shelved in 1.0.15, still commented out
of main.js and index.html, still fully built and verified. Only the name
changes, everywhere it refers to the scene itself.

`src/scenes/cycle.js` → `src/scenes/lens.js`: every identifier tied to the
scene renamed (`createCycle` → `createLens`, `#cycle-title`/`-hint`/
`-caption`/`-panel`/`-panel-*` → `#lens-*`, `.cyc-preview` → `.lens-preview`,
the visible title text "The Cycle" → "The Lens"). Checked every one of the
51 case-insensitive hits in the file by hand before touching anything —
all 51 turned out to be identifiers or headings, none inside the actual
poem/prose content (FACETS paragraphs), so the whole file was safe to
rename in one pass. "Lens" also just fits the concept better than "Cycle"
ever did: a lens is exactly what focuses and refracts light through facets
toward a point — which is the whole visual idea (Ein Soph's light through
the four gem faces) — so this isn't just a rename for its own sake.

Updated the commented-out wiring to match: main.js's import/registry/
initPreviews entries, index.html's nav-icon and preview-tile blocks
(`data-scene="lens"`, `#preview-lens`, "The Lens"), the mobile nav-icon
math comment in styles/main.css, sceneKit.js's reduced-motion scene list,
and poems.js's header note about where thirty-six.doc's parts 8/13 live.

Deliberately left alone: every generic, unrelated use of the word "cycle"
already in the codebase — `CYCLE_SECONDS` in leaf.js (an animation-loop
duration), `MOTIF_CYCLE` in manuscript.js (a rotation of decorative motifs),
"bicycle" in theater.js, and every mention of thirty-six.doc as a "13-part
cycle" in poems.js and the scene file's own writing content. None of those
have anything to do with the scene that used to be called Cycle, so
none of them changed.

## 1.0.15 (2026-07-17, same day)

Cycle's shelved again, same day it came back. Scott, after seeing the 1.0.14
summary: "interesting, but let me mull this over a bit more. For now, comment
it out." Not a rejection of the gem/Ein Soph direction, just a pause — same
pattern as the original cycle shelving back before 1.0 (see the "Comment out
cycle scene" entry in the punch-list history).

Commented out, not deleted: the `import`/registry entry/`initPreviews()` map
entry in main.js, and the nav-icon button + preview-tile block in index.html,
each left in place inside a comment with a short "re-enable together" note
pointing at the other spots. `src/scenes/cycle.js` itself is untouched — the
rebuilt scene is still there, fully build-verified, just not wired to
anything reachable from the landing page. Also reverted the mobile
nav-icon touch target from 1.0.14's 38px back to the 44px guideline default
(styles/main.css) — that shrink only existed to fit cycle's 8th icon at the
480px breakpoint, and with cycle unwired the count is back to seven, which
already fit fine at 44px per the original 1.0.11 fix.

## 1.0.14 (2026-07-17, same day)

Cycle is back — fully rebuilt, not patched. The old version (five classical
elements, each a real YouTube livestream) is gone from git history entirely,
not just retired: the whole livestream concept is replaced.

Scott's prompt, mid-conversation, completely unprompted by anything before
it: "while I was on egg, I clicked, and triggered one of the orrery
posters!" led into "this is why we test, do you need to test for other
leaks" — and once that was cleared, Scott pivoted straight to "we *will*
be creating Geocities Mode at some point," then, genuinely out of nowhere:
"actually! I wanted to completely rework cycle. instead of youtube vids,
let's lay a foundation based on the angelic hierarchy laid out in the
Changing Light at Sandover." Four archangels, an element and a color each
(corrected once mid-message: Raphael to green, "Nature" to "all four," not
a fifth color of her own) — Michael/Light-Air/yellow, Gabriel/Fire-Death/
red, Raphael/Earth/green, Emmanuel/Water/blue, the Queen Mother holding all
four. A quick tangent about whether aluminum oxide has a yellow gem (it
does — yellow sapphire, corundum colored by iron instead of ruby's
chromium) turned into the actual design: four gemstone facets, and Nature
not as a fifth facet but as the gem's own setting.

Scott's full schema, once he'd worked it out: "The gem with four faces is
the crystal focusing the laser light of EIN SOPH. Nature is the cut of the
overall gem. MALKUTH/SHEKINAH. Each elemental facet is cut with other
polytheistic gods that would loosely fit in with that particular element.
and then you incorporate my writing." Ein Soph (Kabbalah: the infinite,
the divine before any attribute) is the light at the center of the scene.
Malkuth/Shekinah (the tenth sephirah — the physical world; also the
indwelling presence of the divine within it) isn't a fifth facet
competing with the other four's colors — she's the cut and setting that
holds them, built here as the rough, unpolished stone the four polished
gems are still embedded in.

Content, per his instruction that his own writing carries the actual
substance while other pantheons' gods are "loosely fit" context, not text:

- Gabriel (Fire/Death, ruby) — Fire.doc's word-association litany (2003),
  reserved for exactly this since the scroll was built. Other faces: Agni
  (Vedic), Surtr (Norse), Sekhmet (Egyptian).
- Michael (Light/Air, yellow sapphire) — Purpose.doc, complete (748
  words): a manifesto ending "Song of Fire and Light... Solistrato" — also
  the origin document for "Solistrato," a name recurring across Scott's
  work for two decades. Other faces: Ra (Egyptian), Amaterasu (Japanese),
  Vayu (Vedic).
- Raphael (Earth, emerald) and Emmanuel (Water, sapphire) — one real find
  while digging back through the archive for this: an unpublished 13-
  section, three-movement poem called "thirty-six," discovered to be the
  source of "Moon Song" (already live in the egg scene, verbatim, as its
  ninth section — Scott had genuinely forgotten this). Section 8 is a
  five-person ritual scene invoking each element in turn; split at its own
  natural pause rather than cut arbitrarily — Raphael gets the setup and
  earth invocation, Emmanuel gets water, air, and the fire/light climax
  that closes it, each with a cross-link to the other's half. Raphael's
  other faces: Demeter (Greek), Jörð (Norse), Tlaltecuhtli (Aztec).
  Emmanuel's: Poseidon (Greek), Susanoo (Japanese), Sobek (Egyptian).
- Malkuth/Shekinah (Nature) — the same poem's final section, closing on an
  explicit, angry Mother Nature: "there's quite a storm brewing out
  there... she's angry, we no longer come to her with arms outstretched in
  love." No other-pantheon list of her own — per Scott's framing, she's
  the vessel, not a peer facet.

The other-pantheon spread (Vedic, Norse, Egyptian, Greek, Japanese, Aztec)
deliberately echoes the palette already established in the unwired Boston
Scion campaign material, rather than inventing a new one — same house
style, just applied here instead of a tabletop pantheon.

Built as a real Three.js scene (the old version was DOM/iframe, since
video embeds don't belong rendered — this one does): four octahedron gems
in transmissive MeshPhysicalMaterial, arranged culet-in around a shared
bright core (Ein Soph — a small emissive sphere, a point light, and
layered additive glow sprites faking bloom, since this project has no
post-processing pipeline), all rising out of a displaced, matte-stone
partial-sphere cradle (Malkuth). Same panel/drag-orbit/dispose/reduced-
motion conventions as every other full scene, via sceneKit.js. Nav icon
redrawn as a quartered kite/diamond outline with a center dot for the
light — the old pentagon (five element dots) no longer fits a four-facet-
plus-setting structure. Re-added the status-bar easter egg word
('refraction') and re-enabled the mobile nav-icon-count math in main.css,
which needed retuning now that the icon count is back up to eight (see
below).

Version bumped to 1.0.14 in package.json.

## 1.0.13 (2026-07-17, same day)

Scott: "while I was on egg, I clicked, and triggered one of the orrery
posters!" A real, and fairly serious, bug — not just an orrery problem.

`main.js` reuses one `#experience-container` element for every scene;
switching scenes only clears its `innerHTML`, it never replaces the node
itself. Four scenes — sphere, butterfly, egg, orrery — bind their
mousemove/click/touchmove/touchstart interaction handlers straight onto
that shared container (butterfly binds several straight onto `window`,
which is even less scoped), and none of their `dispose()` methods ever
removed them. So every scene's listeners just kept running forever after
you left it — reading stale closures, raycasting against geometry that
had already been disposed — and any click or mousemove anywhere in the
experience, on any later scene, could still trigger something from a scene
you'd already closed. That's exactly Scott's bug: orrery's own click
handler was still attached from an earlier visit, its `hoveredPoster`
closure variable still held a poster from before, and clicking on egg
fired it.

Fixed all four: converted each scene's inline listener functions to named
variables and added the matching `removeEventListener` calls to
`dispose()`. Left `manuscript.js`, `theater.js`, `cycle.js`, and `leaf.js`
alone — their click handlers are bound to elements the scene itself
creates as children of the container (the scroll, the screen, the
controls), which get destroyed along with everything else when
`innerHTML` is cleared, so those were never actually leaking.

Version bumped to 1.0.13 in package.json.

## 1.0.12 (2026-07-17, same day)

One more from Scott's mobile screenshots: opening the orrery's read-more
panel doubled its own title — the panel's own "✦ THE ORRERY OF LOS FELIZ"
heading printing right through the scene's ambient title and hint text,
which were still fully visible underneath/on top of it.

Root cause wasn't really a z-index number to raise — it's how stacking
contexts actually nest. `#orrery-title` and `#orrery-hint` are fixed to
`document.body` at z-index:310, specifically so they clear
`#experience-overlay`'s own z-index:300 (each has a comment explaining
that, from when they were first built). `#orrery-panel` lives *inside*
that overlay, so no z-index it's given — it was 10 — can ever paint above
a document.body sibling at 310. That's not a bug in the number, it's what
stacking contexts do: everything inside #experience-overlay renders
together as one unit at its z-index, regardless of values assigned deeper
in the tree.

Rather than restructure where the panel lives in the DOM, faded the
ambient title/hint/caption out whenever the panel's open — they're
redundant once the panel has its own title and era line showing anyway.
Added a `hideAmbient()` helper and wired it into `openPanel()` and all
three places the panel closes (the close button, clicking outside it, and
Escape) — three separate close paths that would have been easy to miss
one of if this were done inline at each site instead.

Version bumped to 1.0.12 in package.json.

## 1.0.11 (2026-07-17, same day)

Scott's screenshot of orrery on a 402px-wide phone (Firefox's responsive
design mode, iPhone 17 profile) caught two real mobile bugs at once, both
in things that never had a narrow-phone case actually tested against them:

- **Nav bar icons clipped at both edges.** `#pm-nav` is a single-row flex
  container with no wrap and no scroll, so anything wider than the
  viewport just clips evenly off both sides (`justify-content: center`).
  Seven icons at their 44px touch-target width plus the existing
  `max-width:480px` gap of 1.5rem need 452px total — wider than every
  common phone from an iPhone SE (375px) up through a Pro Max (430px).
  Dropped the gap to 0.5rem at that breakpoint (356px total), comfortably
  under all of them, without touching the icons' own 44px touch target.
- **Orrery's hint text overlapping its own title.** `#orrery-hint` (top-
  right corner, one long string, no width constraint) and `#orrery-title`
  (centered, 90vw wide on mobile) never collided on desktop, where the
  title sits narrow and centered far from the hint's corner. On mobile
  both wrap — the title's subtitle line into two lines, the hint's long
  string into its own two or three — and neither one's layout accounts for
  the other, so they print on top of each other ("click a flyer to tune
  in" running straight across "the warehouse skylights." in the
  screenshot). Moved the hint below the title block on mobile instead of
  trying to squeeze both into the same top corner, and centered it
  full-width the same way the caption at the bottom already does.

Version bumped to 1.0.11 in package.json.

## 1.0.10 (2026-07-17, same day)

Swapped the feedback-link address in the colophon panel from Scott's
personal email to a dedicated perceptualmechanics@gmail.com. Only place
the old address appeared anywhere in the live source.

Version bumped to 1.0.10 in package.json.

## 1.0.9 (2026-07-17, same day)

Scott: on mobile, the preview tiles are left-aligned, not centered. Real
bug, in the max-width:480px rule for `#landing`. That rule's `align-items:
flex-start` was correct and intentional — `#landing`'s flex-direction stays
`row` at every breakpoint, so `align-items` is the *vertical* (cross-axis)
property, and the fix was about starting the scroll at the top instead of
vertically centering the seven-tile column that's always taller than a
phone viewport. But the same rule also set `justify-content: flex-start` —
for a row container, `justify-content` is the *horizontal* (main-axis)
property, unrelated to the vertical-scroll problem it was written to solve.
That's what pinned the whole tile column to the left edge instead of
centering it. Removed the `justify-content` override; `#landing` falls
back to its base `justify-content: center`, so the column now centers
horizontally while still starting scroll at the top vertically.

Version bumped to 1.0.9 in package.json.

## 1.0.8 (2026-07-17, same day)

Scott caught it exactly right: "it's an atom now, not a solar system." The
old orrery nav icon was three ellipses at 58°/122° rotations around a shared
center with an electron-style dot on one ring — the classic atom glyph
(Rutherford model), not an orrery. Redrawn as three concentric ellipses at
the *same* tilt (planets sharing one orbital plane, viewed at an angle,
same as the scene's own posed rings), a filled sun at center, three small
planet dots at different radii and angles, and a mast line up top matching
the actual scene's ceiling suspension. Only place this icon exists — the
landing-page preview tile for orrery renders the live WebGL scene itself,
not a static icon, so nothing else needed touching.

Version bumped to 1.0.8 in package.json.

## 1.0.7 (2026-07-17, same day)

Scott saw 1.0.6's room and sent back four words: "the room needs more
clutter." Fair — the first clutter pass only really furnished one corner
(pegboard, tire, boxes, workbench), and the rest of the warehouse floor was
just bare concrete. Added a second wave, all in the same `!preview` block
in `buildWarehouse()`, reusing the existing texture/material helpers rather
than pulling in anything new:

- A second crate stack, opposite corner from the first, different sizes so
  the two piles don't read as duplicates of each other.
- Two oil drums grouped near the back wall.
- A ladder leaning against the back wall, off to the side of everything
  else.
- Loose lumber stacked at a slight angle near the second crate pile.
- A coiled cable on the floor near the workbench — three loose torus
  segments rather than one clean ring, so it reads as slack coil.
- A stool at the workbench, pushed out slightly.
- Two fallen flyers on the floor (reusing the poster-texture generator with
  two new band names) that missed the wall.
- Two idle chains hanging from the roof truss, clear of the orrery's own
  suspension rigging — the kind of leftover cordage a working space just
  accumulates.

Version bumped to 1.0.7 in package.json.

## 1.0.6 (2026-07-17, same day)

Full reset of the orrery "aesthetic" request from 1.0.5. Scott's screenshot
of the compressed-video overlay got one word back — "Hmm." — and rather than
tune opacity on the five-layer macroblock/banding/posterized-noise stack, he
asked to start over: "What I really want is to make this a mini-MYST level
:D a micro-MYST... don't import the MYST aesthetic, it's still the early
'90s, but it should feel like the MYST developers were working on this for a
different game." A different metaphor entirely — not a video-signal overlay
sitting on top of the render, but the render itself reading like mid-90s
pre-rendered CG: labored camera moves and diegetic objects whose purpose
isn't explained.

Three changes, confirmed with Scott first:

- **Camera drag now has lag.** Drag used to write straight into
  `root.rotation.y`; now it accumulates into a separate target and the
  actual rotation eases toward it each frame (`* 0.07`), so the camera
  glides to a stop instead of tracking the pointer 1:1 — that "the game is
  still catching up to you" feel. Gated behind `prefersReducedMotion()`:
  reduced-motion visitors get the old direct assignment, no floaty catch-up.
  The drag itself stays instant and fully responsive either way — only the
  settle is eased.
- **Compressed-video overlay is gone.** Pulled the macroblock grid, the
  hard-stepped banding gradient, the posterized-noise layer, the chroma
  smear, and the uneven-judder drift animation — the whole 1.0.5 stack.
  What's left is one quiet static grain layer (the original fine feTurbulence
  noise, `opacity: 0.3`, no animation) — a trace, not a texture you notice.
  Warmed the scene to match: clear color and fog both moved from `0x030303`
  to `0x0a0704`, and the vignette's dark stop shifted to match — less "dead
  black CRT," more "warm dark room," which is closer to what a mystery
  warehouse should feel like lit.
- **Three new mystery props**, all inert — nothing to click, nothing that
  does anything, just objects that look like they should: a wall gauge with
  a needle frozen at a random angle, an idle toggle lever on the workbench,
  a valve wheel on a stub of pipe. All added inside `buildWarehouse()`, all
  plain children of the scene's existing group so the current dispose
  traversal covers them for free.

Version bumped to 1.0.6 in package.json.

## 1.0.5 (2026-07-17, same day)

Three small requests from Scott, one per scene:

- **Egg: a subtle flux effect on the magnetic field lines.** Turned out one
  had half-existed already and just didn't work — the animate loop looped
  over `field.lines` writing a per-line phase offset into `field.mat.opacity`
  each iteration, but every line shared that one material instance, so each
  write just overwrote the last; only the final line's phase ever actually
  took effect, flattened across all nine lines. Fixed by giving each line
  its own material (same pattern the aurorae bands/shimmers already use),
  each running its own phase/speed/flare-strength, with a faint lift toward
  white at each line's own peak. Genuinely per-line now, closer to how a
  real magnetosphere's field lines fluctuate somewhat independently rather
  than breathing in lockstep.
- **Orrery: reworked the grain toward compressed video rather than film
  grain.** The old `#orrery-grain`/`#orrery-chroma` overlay leaned on
  feTurbulence noise and a scanline pattern — closer to a CD-ROM game's
  grain than to actual codec artifacts. Rebuilt as five stacked layers: an
  explicit macroblock grid (real straight seams — the one thing turbulence
  noise can never fake), a hard-stepped banding gradient standing in for
  8-bit color quantization, a feComponentTransfer `type="discrete"`-
  posterized noise layer for per-block luma variance (genuine quantization,
  not just coarser blur), and the original fine-noise floor underneath.
  The drift animation now snaps unevenly (near-duplicate keyframes holding
  variable durations) instead of a steady 2-step pulse — reads as a
  low-bitrate stream stuttering on uneven packet timing, not a breathing
  texture. Chroma smear kept, softened slightly.
- **Theater: mobile text readability.** Two real bugs, both the same
  shape: `.tab-slug` and `.tab-caption` (the italic per-beat description
  line) both had `@media (max-width: 480px)` overrides that shrank their
  font-size *below* their own desktop `clamp()` floor — backwards, since
  mobile is exactly where that hurts most. `.tab-caption` in particular is
  the thing most likely to actually get read start to finish, so it got the
  bigger bump. `.tab-inter-sub` (the interstitial's own italic sub-line, on
  a near-black background at opacity 0.6) had no mobile override at all;
  gave it one, with a firmer size floor and a bit more opacity.

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
