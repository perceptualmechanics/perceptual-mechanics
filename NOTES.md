# perceptual mechanics — notes & punch list

This file is solely about the perceptualmechanics site — the live code, deployment, and content
sourcing that feeds into it. Reorganized 2026-07-16: everything about the two other writing
projects (The Secret World, A Manual of Perceptual Mechanics) moved into their own Scrivener
files, which are now the source of truth for that material going forward. See "project map"
below for where things live.

## 1.1.8 (2026-07-23)

Scott: "just noticed a theater bug: on some of the interstitials,
the next button isn't working."

- **Root cause**: bardjs' `compileScript` tags an `intermission` event
  with the *upcoming* scene's `sceneIndex`, not the outgoing scene's
  — by design, so `Player` announces the new scene at the right
  moment. `TheaterRenderer.onSceneChange` was the only place that
  cleared the interstitial card's `.on` class, and it only fires when
  `sceneIndex` changes. That transition happens once, when landing ON
  the interstitial; the new scene's first real event shares that same
  `sceneIndex`, so `onSceneChange` never fires again on the way out.
  Clicking "next" was actually advancing the player the whole time —
  actors entering, lines playing — all of it invisible behind a card
  that never got dismissed, which is exactly why it looked like the
  button had stopped working rather than like a stuck screen. Only
  the outgoing renderer had this bug; bardjs' own Player/compile
  logic is fine (confirmed the bard.js demo's DomRenderer has no
  equivalent overlay to get stuck), so this is a theater.js-only fix,
  not a bardjs package change.
- **Fix**: `onEnter`/`onExit`/`onChorus`/`onLine` all now clear the
  interstitial themselves, rather than relying on a scene-boundary
  signal that may not exist between the card and whatever comes
  after it.

Verified: node --check, clean vite build. Traced the exact
timeline sequence by hand against compileScript's sceneIndex tagging
to confirm the fix covers every real event type that can follow an
intermission, not just the common case.

## 1.1.7 (2026-07-23)

Scott: "never mind, make it the letters PM like from the title" --
swapping out 1.1.6's hare-silhouette favicon.

- Regenerated favicon.ico/favicon-16x16.png/favicon-32x32.png/
  apple-touch-icon.png as a plain "PM" monogram, white on black,
  echoing #site-title's own look rather than the colophon mark.
  Poppins Bold (closest already-available geometric sans to
  Electrolize, same substitution reasoning as the social card).
  Checked at actual render size: crisp at 32px and 180px; softens at
  16px the way any two-letter glyph does at that resolution -- same
  real-world tradeoff most text-based favicons accept, so shipped as
  is rather than over-engineering a fix for the one legacy size.

Verified: clean vite build, all four files land at the site root.

## 1.1.6 (2026-07-23)

Scott: "ok but what about a favicon :D" -- the site never had one, so
browsers were silently 404ing on /favicon.ico this whole time.

- **Favicon set**, derived from the same hare-colophon.png mark used
  everywhere else: the intricate cut-through original (moon, star,
  Venus/Mercury symbols cut straight through the linework) doesn't
  read at 16-32px, so this is a simplified, solid gold silhouette on
  black instead -- alpha-thresholded, morphologically closed to fuse
  the fine cutouts into one bold leaping-hare shape, confirmed
  legible at both 16x16 and 32x32 by rendering and eyeballing each
  size directly. `public/favicon.ico` (16/32/48 multi-size),
  `favicon-16x16.png`, `favicon-32x32.png`, and
  `apple-touch-icon.png` (180x180), wired into index.html's `<head>`.

Verified: clean vite build, all four files land at the built site
root, link tags reference them correctly.

## 1.1.5 (2026-07-23)

Real deploy bug, found by checking the live site after Scott's "push
confirmed": perceptualmechanics.com was still serving an unrelated,
stale robots.txt (wp-admin/wp-includes disallows -- not ours) and
404s on sitemap.xml/the IndexNow key file, well after the 1.1.1-1.1.4
commits were pushed. Scott then pasted the actual failing Action log.

- **Root cause**: `.github/workflows/deploy.yml`'s "Set up SSH key"
  step ends with a bare `ssh-keyscan ... >> ~/.ssh/known_hosts`, no
  `|| true`, and the step runs under `bash -e` -- so any transient
  ssh-keyscan hiccup (DNS blip, momentary unreachability) kills the
  whole job before the rsync deploy step ever runs. Every downstream
  step (the SSH connection test, and the rsync deploy itself) already
  passes `-o StrictHostKeyChecking=no`, which means the known_hosts
  entry ssh-keyscan populates was never actually load-bearing --
  fixed by appending `|| true`, matching the guard the SSH-test step
  already had.

Verified: YAML re-parses cleanly. Actual deploy success can only be
confirmed by the next push triggering a green Action run and the live
robots.txt/sitemap.xml/social-card.png/IndexNow key matching what's
in this repo.

## 1.1.4 (2026-07-23)

Scott: "ooh yeah, do the structured data, and leave the title tag
alone." Also clarified the robots.txt/sitemap.xml/social-card work
from 1.1.1-1.1.3 hasn't been pushed yet -- what he'd pushed earlier
was unrelated.

- **JSON-LD structured data** added to index.html: a `WebSite` block
  (name, url, description, author/creator as a `Person`) plus a
  `keywords` array. `keywords` is schema.org's actual, still-live
  equivalent of the old `<meta name="keywords">` tag -- unlike that
  one (ignored by Google since 2009, unweighted by Bing), this
  property genuinely feeds crawler topic understanding. Terms were
  pulled straight from the site's seven live scenes (sphere,
  butterfly, manuscript, theater, egg, leaf, orrery) rather than
  reached for, so it's an accurate topic fingerprint, not keyword
  stuffing. Title tag left untouched per Scott's call -- the
  minimalist "perceptual mechanics" branding stays as-is.

Verified: clean vite build, JSON-LD block parses as valid JSON with
the expected keys.

## 1.1.3 (2026-07-23)

Scott: "oh shoot, then bingify me" (re: "LOL BING" from the 1.1.1
sitemap conversation).

- **IndexNow key file**: `public/56f9e77fc06a30c10479e74cf0229602.txt`
  (contents = the key itself), the verification file the IndexNow
  protocol expects at the site root. IndexNow is the one piece of
  this that doesn't require signing up for anything — Bing, Yandex,
  and a few others share a single push API: once the key file is
  live, pinging `api.indexnow.org` with a URL tells them to recrawl
  it immediately, no dashboard, no account. robots.txt/sitemap.xml
  (from 1.1.1) already work for Bing's regular crawler the same as
  Google's; this just adds the instant-notify path on top.
- Bing Webmaster Tools proper (their equivalent of Search Console —
  manual sitemap submission, "request indexing," ownership
  verification) still requires Scott to sign in and verify the
  domain himself; that account step can't be done from here.

Verified: clean vite build, key file lands at the built site root
with the exact key as its contents.

## 1.1.2 (2026-07-23)

Scott: "for the social card, use the hare."

- **`public/social-card.png`**, a 1200×630 `og:image`/`twitter:image`:
  the colophon's leaping hare mark (`public/hare-colophon.png`,
  cropped to its real content bounds), given the same "burnished
  gold" treatment `colophon.js` already applies to it on-site —
  sepia/saturate/brightness/contrast plus a soft gold glow — on the
  site's own pure-black background, with the site title set the way
  `#site-title` renders it (uppercase, wide letter-spacing, dim
  white), so the card reads as the same object as the rest of the
  site rather than a one-off banner. Wired into index.html's
  `og:image`/`twitter:image` meta (added in 1.1.1 without an image);
  upgraded `twitter:card` from `summary` to `summary_large_image`
  now that there's an image worth showing large.

Verified: clean vite build, confirmed social-card.png lands at the
site root in the built output and the new og:image/twitter:image tags
render with the right dimensions.

## 1.1.1 (2026-07-23)

Two small follow-ups. Scott: "actually, something I was wondering, how
do I make sure this site gets indexed properly?" — plus, separately:
"fine, can we comment out all the library-panel-note text? I'm not
sure I want it there yet."

- **Library panel note text disabled.** `populatePanel()`'s
  `noteEl.innerHTML = ...` line is commented out (not deleted) —
  one-line revert whenever it's wanted back. The underlying `note`
  field and the `LIBRARY_LINKS` cross-links that live inside it are
  untouched in the data; this is a display-layer toggle only. Side
  effect worth flagging: most of the cross-link constellation between
  catalog items lives inline inside `note` text, so hiding it also
  hides those visible hyperlinks for any link keyed to `field: 'note'`
  — the handful keyed to `scene`/`excerpt`/`excerpt_from` (the
  coin-toss/Hedwig pair) are unaffected.
- **Basic SEO scaffolding**, since none existed: `public/robots.txt`
  (allows everything except the `/utils/` and `/packages/` demo/
  utility pages, points at the sitemap) and `public/sitemap.xml` (one
  entry — this is a single-page app with no client-side routing, so
  there's only one real URL to list). Added a canonical link tag plus
  Open Graph and Twitter Card meta tags to index.html's `<head>`,
  reusing the existing description copy. No social-preview image yet
  (`og:image`) — nothing in the repo is sized/compressed for that
  purpose; worth a small follow-up if Scott wants one. Submitting the
  sitemap to Google Search Console and requesting indexing is a manual
  step on Scott's end (requires him to verify domain ownership there).

Verified: clean vite build, confirmed `robots.txt`/`sitemap.xml` land
at the built site root and `/utils/`, `/packages/` deploy paths match
what `robots.txt` disallows.

## 1.1.0 (2026-07-23)

Milestone. Scott: "I think one of the newer books got the wrong ISBN,
the one you have listed as 'Swip Stolk'. Correct for the real ISBN,
978 0 8478 2929 3. Then do a full site code quality check, semantics
and a11y, any design passes that need to be done, and let's call this
1.1" — closes out the whole 1.0.61–1.0.67 Library of Babel /
panel-bug / spine-pizzazz run plus a fresh sitewide audit.

- **Book identity fix (catalog item 124).** The ISBN search that
  originally cataloged this item came back with the wrong book
  entirely — not a wrong ISBN attached to the right book, but the
  wrong book, full stop. ISBN 9780847829293 is *Tord Boontje*
  (Rizzoli, 2007, ed. Martina Margetts), a monograph on the Dutch-born
  designer's lace-cut lighting and product work (the Garland shade
  chief among it) — not "Swip Stolk." Rewrote the entry's title,
  creator, publisher, year, page count, and note, and fixed the
  cross-reference to it inside item 141's note (Alexander McQueen:
  Savage Beauty) plus a `LIBRARY_LINKS` entry that had been keyed to
  the literal string "Swip Stolk" and would otherwise have silently
  failed link-integrity checking.
- **Full-site code quality / semantics / a11y audit**, run via a
  dedicated review pass across every scene, then worked through
  item by item:
  - **Real memory leak fixed** in butterfly.js: trail and glow-trail
    objects were disposing their `geo` but never their `mat` on
    scene teardown, and the phase-space grid's three line materials
    (major/minor/depth) weren't tracked or disposed at all. Both
    fixed; `dispose()` now cleans up every geometry, material, and
    listener it created.
  - **The panel-swap bug** (fixed for library.js in 1.0.66) turned
    out to be the exact same dead-logic pattern, verbatim, in
    sphere.js, egg.js, lens.js, and orrery.js — any scene whose
    click handler checked `panel.contains(e.target)` on a panel that
    already calls `stopPropagation()` on its own clicks. Fixed all
    four with the file-appropriate variant: sphere/egg/lens already
    track hover state live while the panel is open, so those just
    needed to gate on "did this click actually hit something new"
    before closing; orrery.js's architecture is different (a single
    static info panel plus separate audio-only poster hits), so its
    fix instead makes sure a poster click still plays its riff
    regardless of whether the info panel happens to be open.
  - **Focus never returned anywhere on panel close.** Every scene
    with a click-to-open detail panel (library, sphere, egg, lens,
    orrery) now makes its container programmatically focusable
    (`tabIndex = -1`) and sends focus back to it from all three close
    paths — the ✕ button, an empty-space click, and Escape — instead
    of leaving focus stranded on a now-hidden close button or
    nowhere at all.
  - **Semantic markup**: theater.js's end-card was a
    `div[role="button"][tabindex="0"]` with a hand-rolled Enter/Space
    keydown handler — replaced with a real `<button>`, which gets
    that behavior natively, and dropped the now-redundant keydown
    listener.
  - **Naming pass surfaced a real bug**: manuscript.js's keydown
    listener was anonymous, which meant `dispose()`'s
    `removeEventListener('keydown', ...)` call — if it had ever been
    written — could never have matched it anyway; turns out dispose
    wasn't even trying. Named the handler and added the missing
    `removeEventListener` alongside the existing click-listener
    cleanup.
  - **Deferred, noted rather than built**: keyboard-reachable 3D
    click targets (every scene's actual interactive objects — book
    spines, facets, satellites, the gem — are only reachable by
    mouse/touch hit-testing; a real fix means either building a
    parallel focus-order DOM proxy per scene or a from-scratch
    input-agnostic hit-test layer, both sizable). Also deferred:
    migrating butterfly.js onto sceneKit.js's shared
    orbit/zoom/resize/reduced-motion helpers (a nit flagged once
    before, still low-risk/low-value enough to skip). Both are real
    gaps, not overlooked ones — noted here rather than rushed into
    this round.

Verified: node --check on every touched file, a clean
`npx vite build` (only the pre-existing orrery >500kB chunk-size
warning), and a standalone link-integrity check confirming 147
catalog items, zero duplicate ids, zero broken `LIBRARY_LINKS`
phrase-matches, and item 124 now correctly showing Tord Boontje /
Martina Margetts (ed.) / 9780847829293.

## 1.0.67 (2026-07-23)

Scott: "ok looks good. last thing I'm seeing is that the books
themselves are very plain! What could we do to give them a bit more
pizzazz?"

- **Spine textures**, without touching the "no real cover art" rule:
  a per-item tint wash (so two books sharing one of the ~12 palette
  colors don't render as pixel-identical swatches — different dye
  lots, same cloth), a top-lit vertical gradient and soft left/right
  vignette (the spine reads as a rounded object catching light, not a
  flat card), 1-2 embossed horizontal binding-cord bands above/below
  the title, contrast-aware ink (the near-black-to-pale-tan palette
  meant one fixed cream text color read poorly against the lightest
  spines — now switches to dark ink above a luminance threshold), and
  alternating serif fonts. Divination boxes additionally get a few
  faint constellation lines between their existing scattered dots.
  Fine per-pixel grain was tried and dropped — at the size a spine
  actually renders on screen, it mostly vanishes into texture
  minification, the same "too subtle to register" mistake already
  made (and fixed) twice on the Babel backdrop; broad tonal moves read
  at any distance, fine grain doesn't.
- **Materials**: side/back faces now shaded darker than the front
  (previously identical flat color on every face, reading as one flat
  plane rather than a 3D object catching light unevenly); ~1 in 5
  items get a glossier trade-paperback finish (lower roughness, slight
  metalness) against the matte-cloth majority.

Verified: node --check, clean vite build, a standalone check
confirming the palette's luminance-vs-ink-color logic actually flips
for the one pale swatch that needs it and stays put for the rest.

## 1.0.66 (2026-07-23)

Two fixes in one round. Scott: "Cool! Now let's fill this out even
more. Moar hexes and strands. Let's make them a bit dynamic, maybe the
shimmer effect?" — plus, separately: "also, I'm noticing that when the
panel's open and I click on a new item, the old item still remains for
a few seconds before it gets replaced."

- **Panel bug, actually fixed at the root.** The click handler's
  `panel.classList.contains('open') && !panel.contains(e.target)`
  check was dead logic — the panel's own click listener already calls
  `stopPropagation()` on everything inside it, so any click that
  reached the container-level handler while the panel was open could
  only ever be a click on the canvas, never inside the panel. That
  branch always just closed the panel, even when the click landed
  squarely on a different spine — so clicking a new item while reading
  closed the panel first (old content visible through the close
  transition) and required a *second* click to actually open the new
  one, which read as "the old item still remains for a few seconds."
  Fixed: the click is now raycast directly against the shelf, and if
  it hit a spine, the panel's content swaps in place (same fade beat
  as the cross-link navigation already uses) instead of closing.
- **Library of Babel backdrop, denser and shimmering.** Node count
  raised from ~75 to ~214 (edges 450 → 1,284; strands 87 → 306) via a
  tighter grid step and a higher keep-probability. Each hexagon (and
  each strand) now pulses gently in brightness on its own phase/speed,
  same per-object convention as egg.js's field-line flux and aurora
  shimmer — adapted to work with `InstancedMesh`, which has no
  per-instance opacity, by animating each instance's own color
  intensity instead (identical visual result against the scene's
  pure-black background, at a fraction of the per-instance-material
  cost). Skipped entirely under `prefers-reduced-motion`, consistent
  with the rest of the site.

Verified: node --check, clean vite build, a standalone Node
simulation confirming the new node/strand counts (214/1,284/306).

## 1.0.65 (2026-07-23)

Scott, after loading 1.0.64: "getting there, but I'm not sure the
strands are showing?"

- **Fixed under-rendered strands.** The connecting rods were built at
  0.02 thickness / 0.16 opacity — a repeat of the exact "too thin to
  actually render" mistake the very first Babel backdrop attempt made
  with 1px LineLoop hexagons (v1.0.61). Bumped to 0.038 thickness /
  0.24 opacity, roughly matching the hex edges' own visible weight
  rather than sitting well below it.

Verified: node --check, clean vite build.

## 1.0.64 (2026-07-23)

Scott: "let's detach the hexagons so they don't form a honeycomb
pattern, just hexagons attached by strands, and let's make the Library
of Babel 3d around it... think of it like what you did with the
butterfly's phase space" — i.e. butterfly.js's volumetric spider-silk
grid, which fills a real 3D cube around the Lorenz attractor rather
than sitting behind it as a flat backdrop.

- **Rebuilt the backdrop a third time**, replacing the two flat
  honeycomb planes from 1.0.63 with a scattered field of independent
  hexagon "gallery" nodes filling a cube around the shelf on every
  side — no shared edges, each hexagon tumbled to its own random 3D
  orientation. Nodes are linked to their nearest 1-2 neighbors by thin
  strand-rods, so the field reads as a network of connected galleries
  rather than either a tiled surface or scattered confetti.
- A keep-out column matching the shelf's own width/height (through
  every depth, not just its physical thickness) keeps any node or
  strand from ever drawing across the shelf's own books, from any
  angle — not just head-on, which is what the flat-plane version
  couldn't guarantee once rotated.
- Built as two `InstancedMesh`es (edges, strands) since a real 3D
  field is hundreds of pieces; node/strand generation is deterministic
  (same hash convention as the rest of the scene) and computed once at
  build time.

Verified: node --check, clean vite build, a standalone Node simulation
of the node/strand generation math (75 nodes, 450 hex edges, 87
strands off a 216-candidate 3D grid) confirming non-trivial, non-empty
output before shipping.

## 1.0.63 (2026-07-23)

Scott, after seeing the 1.0.62 backdrop swing off to one side under a
drag: "oh no no no, so what I'm saying is that if you can arrange the
hexagons as a fainter lattice of hexagons, with this bookshelf being
the only one that's real."

- **Rebuilt the backdrop as an actual honeycomb lattice**, not a stack
  of concentric rings sharing one center on-axis behind the shelf (the
  "tunnel" read from 1.0.61/1.0.62, which is also why it swung
  dramatically to one side under even a small drag — a corridor with
  one shared center is very sensitive to viewing angle; a field tiling
  the whole background isn't). Two depth layers of true hexagonal
  tiling (`buildHexLatticeLayer()`, offset-coordinate honeycomb math),
  built as `InstancedMesh` since a real tiling is hundreds of edges.
  The shelf's own back panel naturally occludes whichever lattice cell
  sits directly behind it — which is the point: one real cell in an
  otherwise infinite field of faint ghost outlines.

Verified: node --check, clean vite build.

## 1.0.62 (2026-07-23)

Scott, after loading v1.0.61: "hmm, i don't think i'm seeing it?" — the
Library of Babel backdrop was there but effectively invisible.

- **Rebuilt the Babel backdrop's rendering technique.** The 1px
  `LineLoop` hexagons from 1.0.61 rendered as barely-there fragments —
  thin WebGL lines at low opacity against a pure-black background
  mostly vanish into anti-aliasing rather than reading as a shape.
  Replaced with hexagon rings built from thin box edges (the same
  technique `buildFrame()` already uses for the shelf's own dividers),
  unlit `MeshBasicMaterial`, and meaningfully higher opacity — so
  "faintly seen through the Veil" means dim, not actually invisible.
  Same fog/position/jitter logic as before, same guarantee that the
  foreground shelf itself never fogs.

Verified: node --check, clean vite build.

## 1.0.61 (2026-07-23)

Scott: "let's turn the bookcase vertical," then, treating the shelf as a
real-world extrusion of Borges' Library of Babel, "the Library of Babel
is faintly seen through the Veil, the bookshelf looks normal."

- **Shelf turned vertical**: the 4-wide/2-tall Kallax grid is now
  2-wide/4-tall — a pure 90-degree transpose (`COLS`/`ROWS` swapped,
  and which field feeds `cubbyLeft()` vs `cubbyTop()` in `buildItems()`
  swapped) done entirely in scene code. No item's stored `row`/`col`
  in `library.js` was touched — the real photo's left-to-right shelf
  order is preserved, just rotated 90 degrees on screen.
- **Camera reframed** for the taller shape: `baseDist` raised from
  8.5/7.2 to 14/12 (preview/main), wheel-zoom `maxDist` raised from
  11/11.5 to 17/17.
- **Library of Babel backdrop**: a new `buildBabelBackdrop()` adds a
  receding stack of 12 hexagonal gallery outlines (Borges' library is
  built of identical connected hexagons) positioned well behind the
  shelf's back panel, parented under the same `root` group so it turns
  with the shelf under drag. `scene.fog` (same clear-color-matched
  convention as `orrery.js`) is tuned so it only ever dims the
  backdrop — near/far set past the zoom range's `maxDist` so the shelf
  itself never fogs. Per-ring position/rotation jitter uses the
  scene's existing deterministic hash, so the recession reads as
  irregular architecture, not a mechanical tunnel. The foreground
  shelf's own materials, lighting, and click/panel behavior are
  unchanged.

Verified: node --check on library.js, clean `vite build` (only the
pre-existing orrery >500kB chunk warning).

## 1.0.60 (2026-07-23)

Scott clarified he's equating VALIS's territory with "the Surround" as
his own reading, not a claim about Dick's actual text — noted as such
in both essays rather than left as an unresolved flag. Then pasted 25
more ISBNs ("More books:") and asked for another pass.

- **25 more items added** (ids 123–147, catalog now 147 items): Hesse's
  *The Glass Bead Game*; a Swip Stolk design monograph; Merrill's
  *Collected Poems*; Huxley's *Brave New World* and *The Doors of
  Perception and Heaven and Hell*; Gibson's *Neuromancer* (whose
  "global consensus-hallucination" Matrix predates the Wachowskis by a
  decade — the word Scott's own 2003 cosmology explicitly declined to
  reuse); McKenna's *Food of the Gods*; Warren Ellis's *Planetary
  Omnibus*; Narby's *The Cosmic Serpent*; Lewis Hyde's *Trickster Makes
  This World*; *The Kybalion*; Bourdain's *Kitchen Confidential*;
  Kenney's *The Invention of the Zero*; a stage adaptation of *The 39
  Steps*; Shoemaker's *The Squared Circle*; a Tolkien boxed set;
  *Holy Blood, Holy Grail*; Pileggi's *Wiseguy*; an Alexander McQueen
  monograph; *The Godfather*; King's *The Shining*; a personal-finance
  book; Anne Carson's *Decreation*; a Kupperman comics collection; and
  *Nobilis* (French edition) — a tabletop RPG where players anchor
  cosmic Powers into human bodies, the clearest game-genre cousin yet
  to the Surround/Umbra/chimerical cluster.
- **19 new LIBRARY_LINKS** (66 → 85) threading the strongest new
  connections into existing clusters — the psychedelic-perception
  trio (Huxley/McKenna/Narby) into Harpur; Planetary into the
  chance/pattern/paranoia cluster; the Kybalion and Holy Blood, Holy
  Grail into the occult-reference cluster; Kitchen Confidential into
  the built-persona cluster; the Squared Circle's kayfabe into the
  belief-as-technology cluster; Decreation into the split-self
  cluster; two design monographs and two crime books paired with each
  other.
- **library_resonances.md**: four new sections (the membrane's
  genre-name lineage extended through Neuromancer/Nobilis/Trickster;
  the psychedelic-perception cluster; kayfabe joining SubGenius/
  Everything Is Under Control; Decreation as a third telling of the
  split self); closing sections and method note updated.
- **archive_against_library.md**: the VALIS/Surround flag rewritten
  to reflect Scott's own framing rather than left as unresolved;
  Neuromancer, Nobilis, and the psychedelic trio folded into "The
  Surround" section; a new paragraph on Hyde's Trickster naming the
  actual mythological job description for the whole liminality
  argument.

Verified: node --check, link-integrity script (147 items, 0 dup ids,
85/85 links valid), clean vite build, catalog mirror regenerated.

## 1.0.59 (2026-07-23)

Scott: search my writing for any mentions of "the Surround" (Sandover's
Ephraim calls his afterlife "THE SURROUND OF THE LIVING"), relate it to
Mage's Umbra and Changeling's chimerical reality, and take another pass
at both essays with it folded in.

Searched the raw archive (strings/zcat/unzip across .doc/.rtf/.txt/
.docx/.pages, not just the already-converted deep-dive material) and
found real, decades-old precedent: *Storyline.doc* (2003, a pitch for a
project called "The Veil") defines "the Surround" directly — "the
spirit world, an energy/information environment... kept apart from us
by the Veil" — and states the cosmology outright: "First, there is the
world. Governed by the laws of physics. Then there is the Veil. Then
there is the Surround." "A bard of butterflies" (undated, already a
known muse/myth source document) repeats it as incantation ("the
Surround the Surround the Surround"), self-titles its author "ETERNAL
WORD-SCULPTOR OF THE SURROUND," and places it on an explicit ladder
next to Plato's Forms. *km.txt* (2005) shows it in casual later use.
*Millennium.doc* confirms Scott's own Mage fiction uses "the Umbra"
directly; a 1998 *vhsmail.txt* LARP character sheet confirms his own
Changeling: The Dreaming character had a flaw built around
"chimerical" intrusions. Flagged rather than asserted: could not
confirm "the Surround" as an actual VALIS/Exegesis term via web
search, so that specific claim was left out of both documents and
raised directly with Scott instead.

- **library.js**: added a verified excerpt to id108 (Sandover) — "IT IS
  THE SURROUND OF THE LIVING" — and a note line connecting it to
  Scott's own 2003-onward use of the same term.
- **library_resonances.md**: Sandover section now quotes Ephraim's line
  directly and notes the three-way convergence (Sandover, Mage's Umbra,
  Changeling's chimerical) on the same threshold-concept.
- **archive_against_library.md**: new section, "The Surround, named
  before the shelf could name it," laying out the 2003-2005 archive
  evidence in full; "What the search was actually for" updated so
  Sandover/Harpur read as *confirming* a word Scott already had, not
  introducing him to the idea.

Verified: node --check, link-integrity script (122 items, 0 dup ids,
66/66 links valid), clean vite build, catalog mirror regenerated.

## 1.0.58 (2026-07-23)

A long freeform conversation with Scott, kicked off by "fold this all into
an adopted kid's search for identity," traveled through Sandover's ending,
Harpur's daimonic reality, quantum field theory vs. wave-particle duality,
D&D/White Wolf class mechanics, a Destiny 2 confession, and a Ted Chiang
story, and closed on: "my whole life has been that liminality." Scott:
"don't just add the books to the shelf and redo everything, incorporate
this conversation (and others, if you have any on record that could be
germane) into both your analyses." (Checked: no other on-record session
had germane content.)

- **2 more books added** (ids 121–122, catalog now 122 items), named one
  at a time mid-conversation rather than off a photo or an ISBN batch:
  Patrick Harpur's *Daimonic Reality* (the third-category argument — real
  without being physical — that gives Sandover's board and the SubGenius's
  "Bob" an actual philosophical name) and Ted Chiang's *Stories of Your
  Life and Others* (whose "Understand" restages Physics vs. Ecstatics as
  a plot about a superintelligence undone by an axis it never secured).
- **10 new LIBRARY_LINKS** (56 → 66) threading both books into the
  existing occult-material and physics-vs-feeling clusters.
- **library_resonances.md**: new section on Harpur resolving the
  real-vs-invented question underneath Sandover/SubGenius/Everything Is
  Under Control; Chiang added as a fifth voice in the Kubrick/Tarkovsky/
  Malick/Wilson thread; closing sections updated.
- **archive_against_library.md**: new closing section, "What the search
  was actually for," naming the adoption/identity-search root directly
  and reframing the muse/Larra, reused-names, fire, and Void material as
  one condition rather than separate items; folds in the RPG/Destiny
  class-declaration critique, Chiang, Sandover's "they choose," Harpur,
  and the observation that the conversation producing all this was
  itself a Platonic dialogue. Closes on Scott's own line rather than
  mine.

Verified: node --check, link-integrity script (122 items, 0 dup ids,
66/66 links valid), clean vite build, catalog mirror regenerated.

## 1.0.57 (2026-07-23)

Scott, on the "one name, several bodies" Blood Treachery claim in
1.0.56: "the 'screenplay' you see is the draft of Blood Treachery that
Steve and I co-wrote." Corrects a factual error — the archive's
screenplay-formatted item isn't a separate spec script that happens to
share a title and collaborator with the shipped sourcebook, it's an
earlier draft of the same book.

- **src/text/library.js**: reworded id108 (Sandover) and id117 (Blood
  Treachery) notes to drop the "unproduced spec screenplay" framing.
- **library_resonances.md**: removed the "stranger echo" paragraph
  built on the false premise, and dropped the now-inaccurate item from
  the closing "what the shelf keeps asking" list.
- **archive_against_library.md**: rewrote the Blood Treachery portion
  of "One name, several bodies" — added a correction note, dropped
  the false "spec script vs. published book" framing, kept the true
  parts (Solistrato, Ben, Andrew Hawking, the Kurosawa/Joyce
  comparison).
- Regenerated assets/bookshelf_catalog.json mirror.

Verified: node --check, link-integrity script (120 items, 0 duplicate
ids, 56/56 links valid), clean vite build.

## 1.0.56 (2026-07-23)

Scott pasted 13 ISBN-13s and said: "Incorporate these books into the
bookshelf and then redo both analyses and the internal links for
library."

- **13 new items added to the catalog** (ids 108–120, one photo's worth
  of shelf now 120 items total), sourced from ISBN alone via Open
  Library's single-ISBN endpoint (its batch endpoint kept failing —
  "URL exceeds maximum length" on 13 ISBNs at once, empty responses on
  smaller batches) plus one WebSearch fallback for an ISBN that came
  back empty even singly (turned out to be Kushner's *Angels in
  America* — also, not incidentally, the exact source of *The L.A.
  Project*'s own epigraph). Row/col/pos randomized across the
  book-only cubbies per Scott's "I don't care about exact placement."
  New titles: *The Changing Light at Sandover* (Merrill), *The Beatles
  Anthology*, *VALIS* (Dick), *Pale Fire* and *Lolita* (Nabokov),
  *Angels in America* (Kushner), *The Book of the SubGenius* and
  *Revelation X*, *Mage: the Ascension* core rulebook plus Scott's own
  two professional sourcebook credits (*Blood Treachery*, *The Spirit
  Ways*), and Robert Anton Wilson's *Prometheus Rising* and *Everything
  Is Under Control*.
- **library_resonances.md and archive_against_library.md both redone**
  to fold the new books into the existing analysis rather than just
  appending a list: VALIS joins the Symposium/Hedwig "other half"
  thread as a third, more literal telling; Nabokov's two novels get
  their own section arguing about who's really narrating; the two
  SubGenius books get a new section, and turn out to be the likely
  literal source of Scott's own "Slack" — flagged as a source, not just
  an echo; Prometheus Rising joins the 2001/Solaris/Tree of Life
  triangle as a fourth voice; *Blood Treachery* on the shelf, credited
  to Scott and Steven DiPesa, matches an unproduced spec screenplay in
  his own archive with the same title and the same collaborator — the
  clean, documented version of the "one name, several bodies" pattern
  the essay was already tracking, not just another example of it.
- **LIBRARY_LINKS grown from 31 to 56** — 25 new directional links
  across 12 threads wired into the new books' (curated) note text and
  back into the items they reference, using the same phrase-must-
  exist-verbatim rule as the first round.
- Fixed one authoring slip caught on review: the Sandover item's note
  originally referenced its own title inside its own text; corrected.

Verified: node --check on both changed files, a script confirming all
56 linked phrases exist verbatim in their source fields with no
duplicate ids and every target resolving, clean vite build (35
modules, same pre-existing orrery >500kB warning as every prior round).

## 1.0.55 (2026-07-23)

Scott: "you're good at this!" — after a deep-dive relational analysis of
the whole 107-item catalog (books, films, decks) turned up genuine
cross-title resonances (see library_resonances.md, delivered separately).
Then: "given this analysis, curate the excerpts to create hyperlinks
between them a la my other writings in the site."

- **Re-enabled the library scene** (shelved the day before in 1.0.54) —
  it doesn't make sense to ship clickable cross-links into a scene
  that's commented out of the nav.
- **Ported the site's fragment-link convention** (sphere.js's
  fragment-link, egg.js's poem-link, manuscript.js's LINKS) to the
  library: a `LIBRARY_LINKS` array in library.js keyed by item id +
  field name (note/scene/excerpt/excerpt_from), each entry a phrase
  already sitting in that field's text, wrapped at render time into a
  clickable jump to another item's panel. Same rule those three
  precedents already follow: only phrases actually in the text get
  wired up, and following a link fades the panel content out/in
  (sphere/egg's exact beat) without touching whatever spine the panel
  was originally opened from.
- **13 threads, 31 directional links**, curated into 19 items' note/
  excerpt fields in src/text/library.js: a coin toss linking No Country
  for Old Men and Rosencrantz & Guildenstern Are Dead; Hedwig and the
  Angry Inch's "Origin of Love" linked to a new excerpt on The
  Symposium (Aristophanes' actual speech, Jowett's 1871 public-domain
  translation); the Kubrick/Tarkovsky/Malick triangle (2001, Solaris,
  The Tree of Life); Kurosawa's honor code tested across Seven Samurai,
  Throne of Blood, Dreams, and Jarmusch's Ghost Dog; Joyce's arc
  (Portrait, Ulysses, Finnegans Wake) plus Gödel, Escher, Bach's
  "strange loop"; the wabi-sabi pair (In Praise of Shadows, Tokyo
  Story); Lispector's Água Viva and Murakami's 1Q84; and the Fagles/
  Mandelbaum epic relay (the Aeneid linking to the Iliad, the Odyssey,
  and Dante's Divine Comedy).
- Added a small `#library-panel-excerpt-from` caption under the
  excerpt — `excerpt_from` existed on a few items already (Theban
  Plays, Borges, 1Q84) but was never actually rendered in the panel
  until now.
- Left every other excerpt untouched, per the earlier note that
  Scott's curating those himself.

Verified: node --check on the data file and scene, a script confirming
all 31 linked phrases actually exist verbatim in their source fields
and every target id resolves, clean vite build (35 modules, same as
before the library scene was ever shelved).

## 1.0.54 (2026-07-22)

Scott: "all right, comment library out for the time being and we'll
pick it up tomorrow."

- **Shelved the library scene** — same pattern used for the lens scene
  (1.0.21): commented out its import, `SCENES` entry, and preview-map
  entry in `main.js`, and its nav icon + preview tile in `index.html`,
  with a comment at each spot explaining how to bring it back. The
  scene file, data, and everything shipped in 1.0.51–1.0.53 stay
  in the repo untouched — nothing deleted, just unlinked from the
  landing page and nav. Confirmed via the build output that the scene
  now tree-shakes out of the bundle entirely (main chunk dropped from
  ~307kB to ~255kB).

## 1.0.53 (2026-07-22)

Scott: "ok the movies go princess bride, three colours, the Dekalog, Do
the Right Thing, Seven Samurai, Dazed and Confused, The Tree of Life,
Hard Days Night, Citizen Kane, silence of the lambs, dr strangelove,and
I think you have the rest. also, we'll have to manually curate the
excerpts, but we'll see. i'm seeing a lot of 'video unavailable', so
i'd say look for movieclips first and foremost"

- **Corrected a spine misidentification.** Item 32 was catalogued as
  *Danger: Diabolik* (Mario Bava) — it's actually *Dazed and Confused*
  (Richard Linklater, Criterion 336). Replaced the full record (title,
  creator, year, runtime, country, writer, producer, scene, YouTube
  link) rather than just the title.
- **Re-sourced YouTube picks toward the Movieclips channel**, which is
  far more reliably embeddable than the reuploads/fan edits used in the
  first pass. Swapped in confirmed Movieclips (or, where Movieclips had
  no clip, an official studio-channel upload) for: Citizen Kane,
  Silence of the Lambs, Hedwig and the Angry Inch, Barton Fink,
  GoodFellas, and 2001: A Space Odyssey (whose scene caption also
  changed from "open the pod bay doors" to HAL's actual refusal line,
  matching the new clip). Do the Right Thing and Dr. Strangelove were
  already on confirmed Movieclips uploads and didn't need changing.
  Left the foreign/arthouse titles (Dekalog, Seven Samurai, Throne of
  Blood, Tokyo Story, 8½, Solaris, F for Fake, etc.) on their existing
  picks — Movieclips generally has no coverage of those, so there was
  nothing better to swap in; some "video unavailable" reports may
  persist there.
- **Left excerpts untouched** per Scott's note that he'll curate those
  himself going forward.

Verified: node --check on the data file and scene, a sanity script
(item/duplicate-id/missing-field checks), clean vite build.

## 1.0.52 (2026-07-22)

Scott, from a screenshot of the panel: "Ok, for the videos, embed the
video rather than linking it. Let's put the excerpt above the actual
info about the book, don't blockquote it, make excerpts longer. for
the art books, if there are any publicly available images we can use,
then perfect. also, when I click outside the panel, it moves to the
middle??"

- **Fixed the outside-click bug.** `.from-left` (the panel's
  left-anchored state) never set its own closed-state transform, so it
  inherited the base rule's `translateX(100%)` — which, applied to a
  panel now positioned at `left:0`, slides it to sit in the middle of
  the screen instead of off-screen. Added `transform: translateX(-100%)`
  to `.from-left` and a `.from-left.open` compound rule (higher
  specificity than either class alone) so the open state still wins
  correctly regardless of declaration order.
- **Videos now embed** (a `youtube-nocookie.com/embed/...` iframe, 16:9,
  above the details block) instead of just linking out. Playback is
  cleared on every close path (close button, outside click, Escape) so
  nothing keeps playing in the background.
- **Excerpt moved above the bibliographic details**, and un-blockquoted
  — plain italic text instead of the bordered box.
- **Cover images** added via Open Library's covers API, keyed off the
  ISBN already on file, with `onerror` hiding it gracefully if no cover
  exists there. This is the "real image" for the art/photo/reference
  books that don't have a natural textual excerpt (Taschen volumes,
  Book of Symbols, Art of Atari, etc.) — a deliberate, narrow exception
  to the site's "no real cover art" rule, scoped to identification-style
  thumbnails from a public covers database rather than reproducing any
  interior artwork.
- **Lengthened 11 of the 24 excerpts** from a single opening line to a
  fuller passage (a few sentences to a short paragraph), leaning more
  generous on public-domain originals (Paradise Lost, Portrait of the
  Artist, Leaves of Grass, Blake, Ulysses — all pre-1929 in the US) and
  staying modest on actively in-copyright translations/texts
  (Beowulf/Heaney, Gilgamesh/George, Tao Te Ching/Lau, Tlön/Hurley,
  Finnegans Wake). A handful were left as-is where no additional
  verified text was found, or where the existing line was already a
  reasonable length.

Verified: `node --check` on the data file and the scene, and a clean
`vite build`.

## 1.0.51 (2026-07-22)

Scott: "nice! ok, so let's stop the auto-rotate for the moment. I'll go
through and correct things in a bit, I want to get the technical info
ready. add writer and producer credits to all the films. NOW: for the
books, get an excerpt for as many as you can. for the films, get
YouTube links to one pivotal scene. That's the content we'll put in
the panel. Also, use the sphere convention where where you click
affects what side the panel opens from."

Five changes, all to the library scene:

- Auto-rotate stopped (library.js's `animate()` no longer advances
  `root.rotation.y` on its own) — the shelf now only turns under drag,
  as requested "for the moment."
- The read panel now opens from whichever side of the screen was
  actually clicked, ported directly from sphere.js's `.from-left` /
  `.no-transition` convention (a one-frame no-transition flip while the
  panel is still off-screen, so the anchor swap is invisible).
- Writer + producer credits researched and added for all 44 films.
- A short excerpt added for 24 of the 63 books/decks — mostly opening
  lines, matched to the specific translation on the shelf where the
  translation matters (Heaney's Beowulf, Fagles' Iliad/Odyssey/Aeneid,
  Mandelbaum's Dante, etc.). Deliberately skipped for the art/photo/
  reference volumes (the Taschen books, Book of Symbols, Art of Atari,
  the French Laundry cookbooks), the tarot/alchemy decks, and — on
  purpose — McCartney's *The Lyrics*, since quoting song lyrics is a
  firmer copyright line than a novel's opening sentence.
- A YouTube link + short description added for one pivotal/iconic
  scene per film (all 44), preferring official studio/Movieclips-style
  uploads where one existed.

The panel now surfaces all of this: writer/producer lines folded into
the existing details block, a blockquoted excerpt for books, and a
"watch: <scene> ↗" link for films.

Merged into `src/text/library.js` (canonical) and refreshed
`assets/bookshelf_catalog.json` (gitignored reference mirror).

Verified: `node --check` on the data file and the scene, a script
confirming all 44 films carry writer/producer/youtube and no duplicate
ids, and a clean `vite build` (same pre-existing orrery >500kB chunk
warning as always).

## 1.0.50 (2026-07-22)

Scott: "can you get ISBNs for these and then start assembling as much data
on each one as you can and update the JSON file? and that Beowulf, that's
the Seamus Heaney version. Also, some of these are wrong, but I can go
through them once you're done."

Fixed Beowulf's creator field to "trans. Seamus Heaney" (id 1). Then
looked up every one of the other 106 items individually — mostly via
Open Library/publisher/bookseller listings for the 63 books and
divination decks (ISBN-13, publisher, first-publish year, page count,
translator/editor where relevant), and via film-reference sources for
the 44 DVDs/Blu-rays (release year, runtime, country — ISBN doesn't
apply to films, so those keep their Criterion spine numbers as the
identifier instead). Where a title has more than one active edition and
the spine photo alone couldn't disambiguate which one Scott actually
owns (several of the Penguin Classics translations, a couple of the
Taschen reissues, the Dune cover edition), recorded a `note` field
saying so explicitly rather than guessing an ISBN and presenting it as
certain — Scott's already flagged that some entries need correcting, so
better to mark the genuinely ambiguous ones up front.

Merged all of this into `src/text/library.js` (the git-tracked source
the scene actually reads) and refreshed the `assets/bookshelf_catalog.json`
reference copy to match — assets/ is gitignored, so the JSON there is a
convenience mirror, not the canonical data. The library scene's read
panel (src/scenes/library.js) now shows this: a details block
(publisher/year, pages, ISBN, or release year/runtime/country as
applicable) plus the note line when one exists, under the existing
title/creator.

Verified: `node --check` on both data files and the scene, and a clean
`vite build` (same pre-existing orrery >500kB chunk warning as always).

## 1.0.49 (2026-07-22)

Scott: "for that picture of the bookshelf in the assets folder, can you
scan that and see if you can identify all the media there? :D" — then,
after a first pass and some corrections along the way ("The bloe
moon-stamped box is Kim Krans' Alchemy deck, which is right next to her
Wild Unknown tarot deck. No DMT, the Dpirit Molecule" — a misread pink
spine that turned out to be a stylized Frank Herbert "Dune," not "DMT: The
Spirit Molecule"; "well next to. It goes Dune, Complete Stories, Ulysses,
1q84" — a shelf-order correction): "oh darn, you're using the wrong
picture. my bad. Use IMG_1202 as the source for this project. add a new
scene to perceptualmechanics, library. Build out infrastructure as usual."

Two pieces of work here. First, re-cataloging: the earlier pass had been
built from IMG_1192.jpeg, a wide, geometrically distorted panorama —
Scott's real source photo was IMG_1202.jpeg, a clean, straight-on,
5712x4284 shot of the same shelf. Re-read every cubby directly from the
correct photo (high-resolution PIL crops per cubby, read at readable
scale) rather than trying to salvage the panorama-based guesses — this
surfaced a good number of titles that were simply illegible in the
distorted version (the full Criterion/Blu-ray spine-number runs, Gödel
Escher Bach, In Praise of Shadows, Borges's Collected Fictions, and more),
and confirmed Scott's shelf-order correction exactly (Dune, Complete
Stories, Ulysses, 1Q84, in that order). The corrected 107-item catalog now
lives in `src/text/library.js` — a real, tracked source file, not
`assets/`, since `assets/` is gitignored (Scott's own reference photos,
kept out of the public repo) and this needed to survive as part of the
actual site.

Second, the new scene: `src/scenes/library.js`. All 107 books, films, and
divination decks, laid out as a real 4x2 Kallax-style cube shelf matching
the photo's own layout (`row`/`col`/`pos` in the catalog preserve the
shelf's real left-to-right order in each cubby) — a floating 3D object
you drag to orbit and scroll to zoom, closer to the sphere/egg model than
the orrery's walk-around warehouse, since a shelf reads fine as something
held up to the light rather than a room to stand inside.

No real spine art or cover photography anywhere, same rule as every other
scene's procedural textures (the orrery's poster/audio system is the
clearest precedent — real titles, nothing lifted from an actual
copyrighted image): each spine is a canvas-drawn flat color field plus the
title/creator as text, from a small curated palette, not a photo or a
scraped cover. Item thickness isn't measured from the photo — each cubby's
available width gets distributed across however many items landed there
(6 on the low end, 25 on the high end) proportional to a per-title
deterministic hash-based weight, so the shelf looks reasonably organic
without needing per-spine pixel measurements, and two divination boxes
(Kim Krans' Wild Unknown Tarot and Alchemy) get a heavier weight class and
their own small dark starry palette so they read as distinct objects, the
way they do on the real shelf. Click a spine to open a read panel with its
real title, creator, and type (book/DVD/Blu-ray/divination deck) — same
role="dialog" panel pattern as every other scene, focus-managed, closeable
by button, outside click, or Escape.

Wired into the site the same way every other scene has been: nav icon +
preview tile in `index.html`, `SCENES`/`initPreviews()` entries in
`main.js`, `sceneKit.js` helpers (drag-to-orbit, wheel zoom, guarded
resize, reduced-motion, escape-to-close) rather than reimplementing any of
that. Verified: `node --check` on both new files, a standalone Node script
confirming the per-cubby width-distribution math sums exactly to each
cubby's available width for all 107 items with no overflow or negative
widths, and a clean `vite build` (same pre-existing orrery >500kB chunk
warning as always).

## 1.0.48 (2026-07-22)

Scott, after trying the first-person pass: "I think I could pass through
the planet rings, but I think I'm kind of okay with that... my only issue
with the rings having collision is that the room is kind of snug at the
moment, so if we did that, we'd have to space it out slightly more." →
"yeah, let's try the second option" (widen + add collision).

Widened the warehouse (full scene only — 6.5 → 8.5 half-width) and gave
the planet rings real collision. Each ring is a torus tilted about the X
axis, so most of it sits well overhead — only the low side of the bigger
outer rings ever dips down near eye height at all, at two points mirrored
across the center line. Solved the tilted-torus parametric equation for
exactly where each ring crosses eye height (θ where
`y(θ) = yOffset − R·sin(θ)·sin(tilt)` equals eye level) rather than
approximating the whole ring as a barrier, which would've blocked
passage under rings that are nowhere near the visitor at all — most of
each ring's circumference stays entirely overhead and should stay
walkable. Rings that never reach eye height at all (the smaller inner
ones) correctly get no collider.

The warehouse's clutter (crates, workbench, tire, drums, ladder, etc.) is
already positioned relative to the wall distance rather than fixed
coordinates, so it moved out with the walls automatically — no manual
re-placement needed.

Verified: extended the standalone math-check script with a brute-force
theta scan (200,000 steps around each test ring) that independently finds
where the mesh's own world-space Y crosses eye height, and confirmed it
lands on the same points the analytic solution produces — plus a case
confirming a ring that never reaches eye height correctly gets no
collider. `node --check` and a clean `vite build` (same pre-existing
orrery >500kB chunk warning as always).

## 1.0.47 (2026-07-22)

Scott: "have first-person camera movement in orrery, like someone's
wandering around with arrow keys" → "yes, with mouse-look and collision.
Like I said, I want this to feel like a Myst level." Full-scene orrery
only (the landing-page preview tile is unchanged — a thumbnail isn't
somewhere anyone's walking around). Replaces the old "drag rotates the
room around a parked camera" illusion with an actual first-person rig:

**Movement.** WASD or arrow keys walk, camera-relative, at a fixed eye
height (1.7 units above the floor — not coincidentally almost exactly the
control hub's own height, so walking up to it means looking it in the eye
rather than up or down at it). Acceleration/damping on the walk velocity
rather than instant start/stop, so it doesn't feel like sliding on ice or
snapping to a stop.

**Mouse-look.** Click once to engage pointer lock (standard desktop
"mouse-look," raw mouse movement, no button held down) — or just drag,
which works everywhere pointer lock doesn't (touch, or before you've
clicked to engage). Both input paths share one convention (drag/move
right turns the view right), deliberately NOT the same convention the
site's other drag-to-orbit scenes use (those rotate an object you're
looking at from outside; this is you, inside the room, turning your
head — different enough mechanics that matching would've been a
coincidence, not a real consistency win).

**Collision.** Circle-vs-circle push-out against the mast/control hub and
the room's floor clutter (crate stacks, the workbench, the tire, the oil
drums, the ladder), plus a hard clamp to the walls. The warehouse used to
have only two walls — back and one side — because the camera never
approached the open sides (a fixed, distant establishing shot). Added the
other two so the room is an actual enclosed box now; walking to the edges
doesn't spill out into the starfield beyond.

**Aiming.** Once you can turn your head independent of the literal mouse
cursor, "where the OS cursor is pointing" stops meaning anything — so
hover/click targeting for the control hub and the show flyers now always
raycasts from screen-center, every frame, and the OS cursor is hidden in
favor of a small crosshair dot that brightens when it's over something
clickable.

**Mobile.** No keyboard to hold WASD on, so coarse-pointer devices get a
small on-screen four-button walk pad (forward/back/strafe); drag-to-look
already covers looking around without needing pointer lock, which most
mobile browsers don't support anyway.

Verified: a standalone script re-deriving the forward/right vector math
(confirmed against three.js's own camera convention) and exercising the
collision resolver (mast push-out, wall clamp, overlapping colliders,
clear-space pass-through) — all passed. `node --check` on the touched
files, a clean `vite build` (only the pre-existing orrery >500kB chunk
warning), and a grep sweep for stale references. Caught and fixed one real
bug along the way: the collision resolver returns `{x, z}` but the first
draft of the call site read `next.y` — would have silently frozen the
camera's Z position the moment you touched a wall or the mast.

## 1.0.46 (2026-07-22)

Scott: "oh yeah, make sure all the markup is semantic as heck." Follow-on
to the 1.0.45 a11y audit — converts every ARIA-role-simulated element into
its real native equivalent, and adds `type="button"` sitewide so no
`<button>` is left defaulting to `type="submit"`.

**`#scene-previews`: div-soup → real list.** Was `<div role="list">` /
`<div role="listitem">` / `<div role="button" tabindex="0">` with a manual
keydown handler reimplementing Enter/Space activation. Now a real
`<ul id="scene-previews">` of `<li class="preview-wrapper">`, each wrapping
a real `<button type="button" class="preview-container">`. Native buttons
get Enter/Space activation for free, so the manual keydown handler in
main.js is gone — click listener only.

**`#site-title`: anchor-as-button → real button.** Was
`<a href="#" role="button">`, which never actually navigated anywhere and
needed `e.preventDefault()` plus its own keydown handler. Now
`<button type="button" id="site-title">`, same simplification in main.js.

**`type="button"` added everywhere:** all 7 `.nav-icon` buttons, the 7
`.preview-container` buttons, `#site-title`, the colophon close/mark
buttons, and every scene's panel-close button (sphere/orrery/egg/lens) —
none of these sit in a `<form>`, but leaving the default `type="submit"` on
a bare button is a bug waiting to happen the moment one ever does.

**CSS:** `#scene-previews` gets `list-style: none; margin: 0;`.
`.preview-container` and `#site-title` get button-chrome resets
(`background: none; border: none; font: inherit;`) so the native elements
look exactly as they did before. No tag-qualified selectors existed
anywhere in main.css, so nothing broke from the element-tag changes.

Verified: `node --check` on all six touched JS files, clean
`vite build` (only the pre-existing orrery >500kB chunk warning), and a
grep sweep confirming no stale `role="list"`, `role="listitem"`, or
`tabindex="0"` remain anywhere in index.html.

## 1.0.45 (2026-07-22)

Scott: "very nice! do a sitewide code clean and a11y audit and we'll be
done." Full pass across every scene, main.js, colophon.js, main.css, and
index.html. Repo-wide sweeps first (no console.log/debugger/TODO leftovers,
no unused imports, no duplicate DOM ids, every JS file still parses) came
back clean — the real findings were structural, not litter:

**Real bug: focus never actually returned to the preview tile that opened
a scene.** `returnToGallery()` tried `document.querySelector('.preview-
container:focus-within')` to find "the tile that was clicked" — but by
that point in the flow, focus had already moved into `expContainer` when
the scene launched, and clearing `expContainer.innerHTML` moments earlier
had just bumped focus to `<body>`. That selector could structurally never
match; the fallback silently did nothing every single time. Fixed by
tracking the actual trigger element (nav icon or preview tile) directly in
a `lastTrigger` variable and calling `.focus()` on it, rather than trying
to rediscover it after the fact.

**Real bug: leaf.js leaked a stale `orientationchange` listener on every
open/close.** `window.addEventListener('orientationchange', () =>
setTimeout(onResize, 100))` registered an inline arrow function, but
`dispose()` called `removeEventListener('orientationchange', onResize)` —
a different function reference than the one actually added, so the
listener (holding the whole scene's closure: camera, renderer, container)
was never actually removed. Same class of bug already fixed sitewide once
before (see the "cross-scene stale event listener leak" entry, much
earlier this session) — leaf.js evidently reintroduced its own instance
across this session's many rewrites. Fixed by moving leaf.js's resize
handling onto `bindGuardedResize` (sceneKit.js), same as egg/orrery/sphere
already use, which owns real references and cleans them up correctly.

**Real a11y gap: the colophon panel undersold what it actually is.** It
was `role="document"` with no `aria-modal` or `aria-labelledby` at all —
every in-scene read-more panel (sphere/orrery/egg/lens) uses
`role="dialog"` + `aria-labelledby`, deliberately `aria-modal="false"`
since they coexist with a still-interactive scene behind them. The
colophon is different: it's the one truly modal dialog on the site (full
backdrop, nothing else reachable). Brought it in line with the site's own
established pattern — `role="dialog"`, `aria-labelledby="colophon-title"`,
and `aria-modal="true"` (since, unlike the others, that's actually true
here) — and added a real focus trap (Tab/Shift+Tab now cycle within the
panel instead of escaping into the hidden page behind it), since nothing
else on the site needed one before this was the first genuine modal.

**Real a11y gap: zero headings anywhere on the page.** Screen-reader users
navigating by heading had nothing to land on. Added a visually-hidden
(`.sr-only`, new utility class) `<h1>` at the top of `#landing` — hidden
sighted-side since a visible one would duplicate `#site-title` and clash
with the intentionally chrome-free design, but present for assistive tech.

Everything else checked out already solid: every WebGL scene's autonomous
motion respects `prefers-reduced-motion` (either via sceneKit's
`prefersReducedMotion()` in the render loop, or a CSS media query for the
two DOM/CSS-driven scenes, manuscript and theater); no unused imports
anywhere; butterfly.js's resize listener uses a real named reference (no
leak, just not on the shared helper — left alone, not broken); the
preview-tile CSS properties from the whole Firefox saga (contain:paint,
clip-path, canvas border-radius, the ::after overlay) are all still doing
real work for the five scenes that don't use `mountClippedPreviewCanvas`
(sphere/butterfly/manuscript/theater/egg), so none of that got touched.

## 1.0.44 (2026-07-22)

Scott sent a screenshot and asked: "how do we feel about readability?"

Mostly good, but one real problem, visible in that exact screenshot: since
1.0.43 stretched the caption to the full window height, paragraphs now
scroll across every part of the backdrop, not just the bright sky/
buildings near the top. The bottom of that screenshot's visible box
crosses into the dark rail/foliage band, and the black text there — held
up until now by only a soft WHITE halo — reads as a dark smear against a
backdrop that's also dark. The white halo was calibrated for a box that
used to mostly sit over bright content; it does nothing for the opposite
case.

Added a second, dark halo underneath the existing light one
(`text-shadow`, four layers total now) — same "no boxed background"
approach Scott asked for back in 1.0.33, just covering contrast in both
directions instead of one. Can't confirm the actual visual result without
a browser, but the mechanism is sound: a light halo helps black text read
against dark backdrops, a dark halo helps it read against light ones, and
now both are present everywhere instead of only the first.

## 1.0.43 (2026-07-22)

Scott, after confirming the preview-tile fix worked: "last thing on leaf:
have the text extend the full height of the window."

Desktop `#leaf-caption` was capped at `height: min(74vh, 44rem)` under a
fixed `top: 4.5rem`. Switched to `top: 4.5rem; bottom: 4.5rem;` with no
explicit height — a positioned element with both top and bottom set
stretches to fill the space between them, so the box now runs the full
window height minus the same clearance this codebase already uses twice
elsewhere for the fixed nav/title/colophon-mark footprint, rather than an
arbitrary vh/rem cap. Scoped to the desktop rule only — left the mobile
media query (bottom-centered box, fixed 1.0.40 last version) alone, since
"full height" doesn't really apply to that much smaller, differently-
composed layout.

## 1.0.42 (2026-07-22)

Scott, after a hard refresh and a rebuilt dev server didn't fix 1.0.41:
"just rebuilt dev server and opened a fresh tab and it's still there." Then,
critically: "but keep in mind this is also happening on orrery."

That second sentence reframed the whole investigation. Every attempt from
1.0.36 through 1.0.41 assumed this was "Firefox can't clip a WebGL canvas,"
full stop — but Scott's own screenshots showed sphere/butterfly/egg's
preview tiles clipping just fine in that same browser the whole time. Only
the two heaviest, most complex WebGL scenes (leaf, now confirmed orrery
too) actually have the bug. That's a real signal: Firefox is promoting
specifically the demanding canvases to a GPU compositing layer that sits
outside the page's normal paint/z-order entirely — every technique tried
so far (contain:paint, clip-path, border-radius on the canvas, an opaque
::after overlay) tried to clip or cover that canvas from the outside, and
all of them were operating in the normal paint/z-order that this layer
apparently doesn't participate in.

The fix that can't be defeated by that: stop displaying the WebGL canvas
at all. Added `mountClippedPreviewCanvas()` to sceneKit.js — the scene
renders into its WebGL canvas exactly as before, but that canvas is never
appended to the DOM; instead a plain 2D `<canvas>` goes in its place, and
every animate() frame, `blit()` copies the WebGL canvas's finished pixels
onto it via `ctx.drawImage()`, clipped to a circle with `ctx.clip()`.
That's software rasterization, not GPU layer compositing, so there's no
accelerated layer left for Firefox to route around it with. Wired into
leaf.js and orrery.js's preview branches only (full-scene rendering is
untouched in both, and the other five scenes — which don't have the bug —
are untouched too, to keep the blast radius of any mistake small).

Genuinely can't verify this renders correctly without a browser — no
canvas/WebGL implementation in this sandbox — but the logic is small and
symmetric (append 2D canvas instead of WebGL canvas, copy+clip once a
frame, tear down on dispose), and confirmed via grep that both scenes wire
mount/blit/dispose identically.

## 1.0.41 (2026-07-22)

Scott: "excellent. but that Firefox preview image bug is still there."

Three straight attempts at CLIPPING the leaf preview tile's WebGL canvas
all failed in Firefox (Safari fine every time): `contain: paint` on the
container (1.0.36), `clip-path: circle(50%)` on the container (1.0.38),
`border-radius: 50%` directly on the canvas (1.0.39). Each tried a
different element and a different CSS clipping mechanism, and all three
failed identically — which is itself the tell: this was never an
ancestor-vs-child layering problem, Firefox's WebGL canvas just doesn't
participate in CSS box-clipping at all, on any element, through any
mechanism.

So: stopped trying to clip it. Added `.preview-container::after` — a
plain absolutely-positioned div with a `radial-gradient(circle
closest-side, transparent 100%, #000 100%)` background, painted on top of
the canvas. This covers the square canvas's corners with opaque black
(matching the page's own #000 background exactly, so it's invisible as a
"covering") rather than clipping the canvas's content — ordinary 2D
background compositing on a normal div, nothing WebGL-related for Firefox
to opt out of. Confirmed the gradient rule survives the production build
unchanged. Kept the three earlier properties too, still technically
correct for whichever engine actually does clip WebGL canvases properly.

## 1.0.40 (2026-07-22)

Scott sent a mobile screenshot (Firefox responsive design mode, iPhone-
sized viewport) with no other comment — but it caught a real bug: on
narrow/phone-width viewports, the leaf caption's mobile layout (bottom:
1.6rem) sits close enough to the fixed #site-title (bottom:1.2rem plus its
own ~2rem pill) that the two visibly collide — the caption's last line
("and those few floating adjust themselves...") was rendering right under
the "PERCEPTUAL MECHANICS" title pill in the screenshot. Same class of bug
main.css's #landing rule already solved once (documented there): a fixed,
always-present footprint (title + colophon-mark) needs real clearance, not
just a small nudge. Reused that same value — bottom: 4.5rem instead of
1.6rem — rather than guessing a new one, and trimmed height from 34vh to
30vh so the box doesn't creep too far up the screen to compensate.

Everything else in the screenshot looked like the 1.0.39 depth-of-field
system working as designed: mid-to-late in the fall, the buildings were
sharp (their own in-focus moment is at frac≈0.83, close to where the text
shown — "the drop explodes on the ground" — sits), and the rail/foreground
were visibly hazier, consistent with focus having swept away from them by
then.

## 1.0.39 (2026-07-22)

Scott, on 1.0.38: "that's a good look! fill in the background greenery more.
also, yeah, confirmed the bug's still there on Firefox, but Safari looks as
it should."

Two fixes:

1. **Firefox preview-tile clip, third attempt.** 1.0.36 tried `contain:
   paint`, 1.0.38 added `clip-path: circle(50%)` on top — both clip the
   `.preview-container` div, and Scott confirmed the leaf tile is still
   square in Firefox with both in place (Safari's fine either way). Every
   attempt so far clipped the wrong element: a WebGL canvas that's been
   promoted to its own GPU compositor layer can apparently ignore an
   ancestor's clip-path/overflow entirely in Firefox, no matter which CSS
   clipping mechanism the ancestor uses. Fixed by putting `border-radius:
   50%` directly on `.preview-container canvas` instead — clipping the
   canvas against its own shape rather than reasoning about a parent/child
   layer relationship. Kept all three ancestor-level properties too; each
   was still the "correct" fix for some engine, Firefox just needed one
   more.

2. **Denser greenery.** `drawPalmsLot` gets a soft tree-canopy hedge along
   the horizon (22 overlapping soft blobs, standing in for the near-
   continuous tree line backing Scott's real courtyard) plus more palms
   (5 → 11) and more round shrubs (2 → 6) along the pavement edge.
   `drawForegroundFoliage` gets bigger, more numerous base clusters (6 → 10)
   plus a second pass of ~26 smaller blobs breaking up the big clusters'
   edges so they read as leafy rather than a few flat green circles.
   Verified with a smoke test (`leaf-greenery-smoke.mjs`) that mocks just
   enough of CanvasRenderingContext2D to run both draw functions headless
   and confirm no NaN coordinates or wild out-of-bounds draws — can't see
   the actual pixels without a browser, but the draw calls themselves are
   sound.

## 1.0.38 (2026-07-22)

Scott, immediately after seeing 1.0.37 (two screenshots — the preview tile
still square, and the full scene with the real photo blurring): "first,
preview bug still isn't fixed. but second, oy, okay. Don't use the photo.
What I want you to do is use the photo as a visual reference for the depth
of field I want you to create. So create several planes, from the sky to
the parking carage to the trees and so forth, and do the blurring that way,
rather than with the actual photo."

Two fixes:

1. **Preview clip bug, take two.** 1.0.36's `contain: paint` fix held up in
   some browsers but Scott's screenshot was Firefox, and it clearly didn't
   hold there — the leaf tile was still square at rest. Added `clip-path:
   circle(50%)` to `.preview-container`, which is real per-pixel clipping
   the browser has to honor regardless of GPU layering, unlike `contain`/
   `overflow`. Kept `contain: paint` too, harmless either way.

2. **Real photo → procedural depth planes.** Pulled `public/leaf-balcony.jpg`
   entirely (deleted — no longer referenced anywhere) and rebuilt the whole
   backdrop as six hand-drawn canvas layers modeled on `assets/IMG_1198.jpeg`'s
   actual composition: sky (with its one big cumulus, dead center, like the
   real photo), a distant "parking carage" (Scott's own word for it) peeking
   up between two buildings, the twin white apartment blocks flanking the
   courtyard, a palm-lined parking lot, a foreground shrub in the lower
   corners, and the black balcony rail closest to camera. Real depth of
   field this time, not a shader: every layer but sky gets baked twice at
   build time (sharp + a canvas 2D `filter: blur()` pass over the finished
   drawing) and animate() cross-fades each pair's opacity by how close that
   layer's own fixed z is to a "focus depth" that sweeps linearly from the
   rail (z=-2) to the garage (z=-6.8) over the full scroll-driven fall —
   tied to `frac`, the same value already driving the drop, matching "as
   they scroll, different parts of the background will be in focus."

   Dropped the custom `ShaderMaterial`/GLSL from 1.0.37 completely — no
   shader anywhere in this version. That's a real reliability upgrade, not
   just a style change: canvas 2D's blur filter is a plain, broadly-
   supported API, and an opacity crossfade between two textures I can bake
   and inspect ahead of time is something I actually verified the math of
   (`leaf-dof-check.mjs` — confirms bounds, confirms each layer gets its own
   true-sharp moment in the right order, near to far). The one directorial
   call I made without asking: which direction the sweep runs (near-to-far
   over the fall, arriving sharp on the garage right at impact) — reversing
   it is a one-line swap of `FOCUS_NEAR`/`FOCUS_FAR` if that reads backwards
   once Scott sees it move.

## 1.0.37 (2026-07-22)

Scott, after confirming the real balcony photo matched ("Can you see this?" — yes,
via `assets/IMG_1198.jpeg`): "Ok so here's the kind of magic I want you to do. So
yes, IMG_1998 will be source of truth for this. but let's get wacky. instead of
horizontal parallax, let's do blur/focus along the z-axis. so as they scroll,
different parts of the background will be in focus while the drop's falling.
What do you think?"

Two changes, both to leaf.js's backdrop:

1. **Real photo, not procedural.** Resized `assets/IMG_1198.jpeg` (5712×4284,
   the exact balcony shot Scott confirmed) down to `public/leaf-balcony.jpg`
   (1800×1350, quality 82, ~625KB) and load it as the backdrop texture. Ripped
   out the whole three-layer procedural canvas system (`drawSky`/`drawFar`/
   `drawNear`/`makeLayerTexture`/`addLayer`) — it's gone, replaced by a single
   plane. A `coverCropUV()` helper crops the 4:3 photo to whatever aspect the
   window is, same idea as CSS `background-size: cover`.

2. **Rack focus instead of horizontal parallax.** Rather than the old
   scroll-driven side-to-side layer shift, the backdrop now runs a custom
   `THREE.ShaderMaterial` (single vertex/fragment pair, `FOCUS_VERTEX_SHADER`/
   `FOCUS_FRAGMENT_SHADER`) that blurs each pixel based on its vertical
   distance from a "focus band." That band's position (`uFocusY`) is updated
   every frame directly from the falling drop's own real-time y-position — so
   as the drop falls, focus literally travels down the photo with it, sharp
   near the drop and blurred everywhere else. Went with a hand-rolled 8-tap
   ring blur rather than reaching for `THREE.EffectComposer`/`BokehPass` (real
   depth-of-field post-processing): this codebase has no post-processing
   pipeline anywhere else, and one shader is something I can actually verify
   blind, whereas a multi-pass pipeline mostly isn't. Preview-mode tiles skip
   the shader entirely (plain `MeshBasicMaterial`, no blur cost) since they're
   static 320px thumbnails.

   Note on verification: this is the least-verifiable thing I've shipped this
   session. I checked the JS wiring (uniforms, texture loading, `ShaderMaterial`
   construction) and re-implemented the blur-distance math standalone in Node
   to confirm it's monotonic and bounded correctly — both passed. But GLSL
   source isn't compiled or type-checked by Vite/Node here, so actual shader
   syntax correctness and what it looks like rendering in a real WebGL context
   are unconfirmed until Scott loads the page.

## 1.0.36 (2026-07-22)

Scott: "there's a CSS bug on preview page: the standalone images are square,
but on hover, there's a circle mask being applied to them for a split
second." Real bug, unrelated to leaf specifically — every landing-page
preview tile (`.preview-container` in main.css) is affected. Root cause:
each tile's WebGL canvas gets its own GPU compositing layer, but the
container itself only became one on `:hover` (via the `transform: scale`
there). Without a layer of its own at rest, the browser doesn't reliably
honor the `border-radius`/`overflow:hidden` clip against a composited
child — square at rest, briefly circular only when the hover transform
forces a repaint. Fixed with `contain: paint`, which tells the browser
directly that nothing may paint outside the box, independent of layer
promotion — holds the clip at rest, not just mid-hover.

Also: Scott created `assets/` in this repo and dropped all thirteen
apartment reference photos into it as real files — the inline-paste
limitation flagged since 1.0.32 is now moot for this material specifically,
since these are real files on disk. Confirmed IMG_1198.jpeg is the exact
balcony reference (matches the confirmed view from 1.0.34 — rail,
buildings, palms, sky) among the batch. Not yet wired into leaf.js — asked
Scott whether he wants the real photo swapped in now that it's actually
usable, since "improved-procedural" was chosen specifically because the
photo wasn't reachable at the time, not as a settled preference.

## 1.0.35 (2026-07-22)

Scott confirmed 1.0.34's balcony fix against a real photo of his actual
view — matched. Also sent that one photo alone rather than in a batch,
guessing the earlier "reference file" attempts got dropped from sending
several at once — checked uploads/ again after this message anyway;
still nothing landed on disk, so that theory doesn't hold either. The
constraint stands regardless of batch size: inline-pasted chat images
render for both of us to look at, but only real file attachments leave
something on disk I can read.

Separately: "change the font to Coda." Swapped both #leaf-caption p and
#leaf-hint from Zen Maru Gothic to Coda in leaf.js, added Coda:wght@400;800
to index.html's font link, and dropped Zen Maru Gothic from that link
entirely since nothing else on the site was using it. Worth flagging: Coda
is a heavy display face by design (Google's own description calls it an
"impact heavy display font"), built for headlines, not 8 full paragraphs
of body text the way Zen Maru Gothic was being used here — used Coda's
Regular (400) weight rather than Heavy (800) to keep it as readable as a
fairly blocky face gets. Scott's call once he sees it actually scroll.

## 1.0.34 (2026-07-22)

Scott loaded 1.0.33 and sent a screenshot: bare sky, no rail, no skyline,
no palms — just the leaf and text floating over a flat pale gradient.
"Can you see this?" (I can't, still no browser here — but I could see
exactly what was missing from the screenshot itself.)

Root cause: horizonY/railTop/railBottom/the palm x-fractions are all
absolute fractions of the canvas (e.g. horizonY = ch*0.62), which only
land where intended if the plane-to-camera size ratio matches what they
were tuned against — the original single-plane backdrop's 2.4x, which
puts about 83% of the canvas inside the visible frame, centered. 1.0.33
oversized the plane geometry itself (1.8x/1.3x extra) so the new
parallax shift would never reveal a bare edge — but that oversizing
shrank the visible fraction down toward 46-64%, pushing the rail
(drawn at 78-98% down the canvas) and almost all of the skyline/palm
content outside the visible window entirely. Exactly the flat, empty
result in the screenshot.

Fixed by reverting the plane geometry to the exact original 2.4x (no
margin) — same visible fraction as every prior version Scott has already
seen work — and instead deriving the parallax offsets themselves from
however much real edge that plane size leaves at the current aspect
ratio (a new PARALLAX_MARGIN constant, ~20% of camera half-width), capped
well under 100% of it. Verified with two standalone scripts before
shipping this time: one confirming the visible fraction is back to
exactly 0.833 at nine aspect ratios, one confirming every parallax
offset stays safely inside the real margin at each of them — the same
class of math mistake 1.0.33 already made once, checked more carefully
this time specifically because of it.

## 1.0.33 (2026-07-22)

Scott sent apartment reference photos again and clarified the earlier "vector
graphics are awful" complaint was specifically about leaf's skyline/palms —
half-joking that AI was supposed to be "destroying graphic design" by now.
Genuinely blocked on using his actual photo (inline-pasted chat images still
don't land on disk here — confirmed again, nothing new in uploads/), so when
asked to pick a direction he went with "improved-procedural," then pushed the
whole scene further: "create a 3d space with different planes and parallax
... change the layout so that the leaf fills the right 1/3 of the window,
and the text fills the other 2/3, lose caption background, change caption
text color to black and enlarge to fill its space ... let's get a bit wild."
Confirmed one open design question first — what should drive the parallax —
and he picked tying it to scroll (the same signal already driving the drop's
fall) over mouse/tilt, since it behaves identically on mobile and desktop.

Backdrop rebuilt as three separate canvas-texture planes instead of one flat
image: sky+clouds+glow (drawSky), skyline+palms (drawFar), rail+plant
(drawNear), at z = -6/-4/-1.5 respectively. Each frame, all three get nudged
sideways by the scroll-driven `frac` at different rates — sky barely moves
(0.15), skyline/palms more (0.55), the rail/plant nearest layer the most
(1.05) — the classic parallax depth cue, driven by reading progress instead
of a cursor. Preview tiles keep the single sky-only plane from 1.0.32
untouched (no parallax there — not scrolling, no reason to move it).

Layout: the leaf now sits in a column sized to the right third of the
window, computed from the camera's live aspect ratio (recomputed on
resize) rather than a fixed position — verified across nine aspect ratios
from a portrait phone (0.4) to an ultrawide desktop (2.4) with a standalone
script before touching the real code, since an early version of the column-
fit math shrank the fall distance toward zero on very wide windows (a bigger
leaf at a fixed vertical position pushes its tip down toward the ground) —
caught that with the same script, then capped the fit scale at 1.7 and kept
the leaf's vertical anchor fixed to fix it. Caption moved to the left two-
thirds: background/border gone entirely, text now black (only viable because
of 1.0.31's daytime backdrop — would've vanished against the old dark dusk
version), and font-size roughly doubled. A soft white text-shadow halo
replaces the old dark drop-shadow, for the rare paragraph that sits over the
skyline layer, without reintroducing a boxed background. Below 800px width,
same fallback as before 1.0.30: centered bottom box, since there isn't room
for a right-third leaf column and a left-two-thirds text column both on a
phone screen.

Also separately oversized the backdrop planes' margin (1.5x → 1.8x width)
after the same verification script caught the new parallax motion revealing
a bare texture edge at very narrow aspect ratios that the old static single
plane never needed to worry about.

None of this is browser-confirmed — same standing limitation all session,
no headless browser in this sandbox. Verified via node --check, the two
standalone math scripts above, and a clean vite build. Scott's turn to load
it and see how the "wild" version actually feels.

## 1.0.32 (2026-07-22)

Two things Scott caught right after 1.0.31 shipped: "the PERCEPTUAL MECHANICS
title was totally getting lost against the palette on leaf. And on the
preview image, the leaf is square now, not round."

Title contrast: `#site-title` relied on a blurred `text-shadow` alone to
stay legible "over light scenes too" — fine everywhere else, since every
other scene sits on a mostly dark backdrop, but leaf's new daytime sky is
pale cream right near the horizon, exactly where the title sits (bottom:
1.2rem). A blurred shadow doesn't buy much contrast against a light,
fairly uniform background. Added a solid low-opacity dark scrim (pill-
shaped background + padding) behind the text instead of leaning on the
shadow alone — brightness-agnostic, so it'll hold up against any future
light scene too, not just this one.

Square-looking leaf preview: the balcony backdrop's rail, skyline, and
palms are all hard, straight-edged, full-width detail — fine at full
scene size, but shrunk into a 320px circular preview tile, those
rectilinear lines were apparently competing hard enough with the leaf's
own round silhouette that the leaf read as square rather than round.
Preview tiles exist to foreground one subject, not the full environment,
so `makeBalconyTexture()` now skips the skyline/palm/rail/plant detail
entirely when `preview` is true, keeping just the soft sky gradient and
glow behind the leaf. Couldn't see either fix live (no browser in this
sandbox, same limitation as every visual change this session) — both are
reasoned from the code and CSS, not confirmed by eye. Scott's turn to
check.

Also: Scott sent porch-view reference photos and asked, half-joking,
whether the skyline/palms could just be his actual photo instead of
procedurally-drawn canvas art. Genuinely blocked on that for now — images
pasted inline in chat don't land anywhere on disk I can read; only real
file attachments do. Asked Scott to attach (not paste) the photo so I can
actually use it.

## parking lot — not yet actioned

- **Real bookshelf as content source?** (flagged 2026-07-22) Scott sent a photo of his actual
  bookshelf (poetry/classics — Beowulf, Chaucer, Milton, Whitman, the Bhagavad Gita, Sophocles,
  Blake, Marcus Aurelius, Plato, Borges, Gödel Escher Bach, the Iliad/Odyssey/Aeneid, Ulysses,
  Murakami, Finnegans Wake; an occult/esoterica shelf — Tarot, Astrology, Witchcraft, Sacred Sites,
  Japanese Woodblock Prints; plus Beastie Boys' book, the RSC Shakespeare Complete Works, Paul
  McCartney's Lyrics, Art of Atari, The French Laundry Cookbook, Expanding Universe) alongside the
  apartment reference photos, saying he "might want to do something with that." No request yet —
  just noted here so it isn't lost. Candidate hook: `manuscript.js` (the scroll) already pulls from
  Scott's own writing archive; his actual physical library could be a second, parallel source for
  that scene, or its own thing entirely.

## 1.0.31 (2026-07-22)

Scott loaded 1.0.30 locally, confirmed it rendered clean, then sent
reference photos of his actual apartment "so you get a sense of my
style" — the whole reason the balcony backdrop existed in the first
place was to match that apartment's Japandi vibe, so this was worth
taking seriously rather than treating as a nice-to-have. Two real deltas
between what I'd built and the photos: his place reads bright daylight
(gray-beige walls, warm wood floor, daytime light), not the dusk mood I'd
guessed at, and his actual railing is plain black metal, not wood
balusters. Asked which to fix; Scott: "Match it — daytime, black rail."

Reworked makeBalconyTexture() in leaf.js: sky gradient swapped from a
dusk plum-to-gold gradient to a hazy daytime pale-blue-to-cream one,
stars replaced with a few soft translucent clouds, the condo-silhouette
skyline lightened from a near-black dusk tone to a lighter neutral gray
(daylight haze reads lighter-on-light, not dark-on-dark), palm silhouettes
shifted from near-black to a muted olive-green, and the rail itself
recolored to black metal with thinner pickets than the old wood-baluster
version. The old warm porch-light glow — a nighttime accent — became a
softer daytime sun-glow in an upper corner instead. Ground tone nudged
from a deeper terracotta to a lighter warm taupe to sit with the
daylight rework and the actual wood-floor color in the photos. Same
underlying discipline throughout: muted/desaturated rather than
postcard-saturated, one soft glow accent, a precise manufactured rail
rather than the old hand-built lattice's deliberate irregularity.

Sanity-checked the new backdrop with the same PIL-based approximation
used for the first balcony version — not pixel-identical to the real
canvas/WebGL output, just a rough compositional check, same caveat as
before. Real verification is Scott's own eyes in the browser.

## 1.0.30 (2026-07-21)

Back to perceptualmechanics itself after a bard.js stretch. Scott: "I want
to create as organic a relationship between the scroll and the
acceleration as possible, particularly on mobile," and separately wasn't
happy with the caption's serif italic — "not that I want to go full
cultural appropriation here, but I would like something that's a bit
more fluid without necessarily being in italics."

Checked web haptics first, since Scott asked directly: no reliable
cross-platform vibration API exists — Chrome/Android has
`navigator.vibrate()`, but Safari has never implemented it on iOS, and
the "workarounds" floating around exploit undocumented native-input side
effects that could break the moment Apple patches them. Not something to
build a portfolio piece around.

So the real fix was physics, not haptics. The old scroll-to-fall coupling
in leaf.js assumed a fixed 1/60s frame step and smoothed toward the
scroll position with a flat exponential factor (`currentFrac +=
(target - currentFrac) * 0.18`) every frame regardless of how far off
target actually was — wrong on a 120Hz phone, a throttled tab, or a fast
flick. Replaced both: `animate()` now uses real elapsed time
(`performance.now()` deltas, clamped so a backgrounded tab doesn't fling
the drop across the whole fall in one frame), and the follow itself is a
critically-damped-ish spring (stiffness 130, damping just under
critical) instead of a fixed-rate lerp. A spring's restoring acceleration
is proportional to displacement, so a fast flick — which jumps
targetScrollFrac far ahead in one tick — resolves with real velocity and
a touch of organic overshoot, while a slow scroll barely displaces it at
all. That's the scroll-to-acceleration coupling Scott asked for, without
needing to separately hand-track scroll velocity. Verified the spring
settles to target from both a small and a large displacement, that a
bigger jump genuinely produces a bigger peak velocity, and that it still
converges under a deliberately janky variable-dt sequence, all before
touching the visual code.

Font: dropped serif/italic entirely for Zen Maru Gothic — a real
Japanese rounded-sans type family, added to index.html's Google Fonts
link. Fluid without being a caricature "brush font," and its rounded
forms read as much Scandinavian-minimalist as Japanese, which mattered
once the next part landed.

Scott, asked to name the vibe of his own apartment: Japandi (Japanese x
Scandinavian design — natural materials, warm neutrals, restraint). Used
that to replace the Japanese-shoji-wall backdrop with an actual Boca
Raton balcony at dusk — a muted, desaturated Florida dusk gradient (not
postcard-saturated), a simple distant condo-silhouette skyline, two
minimal palm silhouettes, one Japandi-habit sculptural plant in a
corner, and a precise, evenly-spaced balcony rail in place of the old
kumiko lattice's deliberate hand-built irregularity — a manufactured
rail should read as uniform, unlike a hand-built shoji screen, so that's
the one habit that intentionally flips. Rebuilt as a single texture
sized to the actual viewport aspect ratio rather than a repeating tiled
pattern, so the horizon and railing don't distort at portrait mobile
ratios the way a `RepeatWrapping` tile would. Ground glow recolored from
mossy forest green to warm terracotta, since the drop now lands in a
balcony planter, not a forest floor. Rendered a rough PIL approximation
of the new backdrop composition to sanity-check colors/layout before
ever loading a real browser (this sandbox has no headless browser
available for true WebGL verification) — same honest caveat as always:
the real render still needs Scott's own eyes.

## 1.0.29 (2026-07-19, same day)

Scott's next screenshot ("oh i can tell this is gonna be fun") showed
progress: actors were finally visible after 1.0.28's fix, but Pangloss
and Candide were overlapping the venue banner, and the Candide chorus
line was sprawling edge to edge, reading like a much bigger font than
anything around it.

Root cause of the overlap wasn't a new positioning bug — it was the
picker panel simply being too tall. An always-open 8-row scene select
plus a venue select plus the footer easily runs 400-500px, and on a
typical laptop-height viewport that, combined with the header, leaves
#stage-frame's padded content area barely any room. Flexbox doesn't
shrink content below its natural size, so the actor row + caption
overflowed *upward*, past the reserved top padding, straight into the
venue-top banner. Fixed by making the picker/venue/footer section a
collapsible #options-panel, hidden by default behind a new options
button in the controls row — collapsed, overlay-bottom is just the
compact playback row, so the stage gets its room back. Opening it is a
deliberate, temporary trade of stage space for choosing a play, not
something eating the black box by default. Toggling re-runs the same
syncLayout() from 1.0.28 so the stage padding adjusts either way.

The "giant" chorus line wasn't actually a wrong font size — clamp() was
capping it correctly. .bard-caption just had no max-width, so at a full
viewport a long sentence stretched across nearly the entire screen
instead of sitting in a readable column, which reads as "huge" next to
the header's own width-constrained text right above it. Gave it the
same treatment as the header's .sub paragraph: a sensible max-width with
auto margins, in DomRenderer itself (any consumer at a wide viewport
would hit the same problem, not just this demo).

Verified with a jsdom check that the options panel is genuinely hidden
by default, toggles correctly, and that the injected .bard-caption rule
now carries a max-width — then a clean vite build.

## 1.0.28 (2026-07-19, same day)

A real bug in 1.0.27, caught immediately from Scott's own screenshot: at
3/71 the stage looked empty — no actor, no bubble, no chorus caption
anywhere on screen, just the venue banner bleeding through the title.
Not a rough edge, an actual regression.

Root cause: DomRenderer's `.bard-stage` still hardcoded `height: 100%`
from the "make everything bigger" pass. That was harmless when
`#stage-frame` was a small, auto-sized box (percentage heights against
an auto-height parent just resolve to auto) — but 1.0.27 made
`#stage-frame` a real, fixed-size, full-viewport box, so `height: 100%`
suddenly meant something: `.bard-stage` claimed the *entire* viewport,
leaving `.bard-caption` nowhere to render (pushed below the fold, and
`overflow: hidden` on body clipped it outright), and pushed the actors —
bottom-aligned via `align-items: flex-end` — to the literal bottom edge
of the screen, directly behind the opaque controls/picker panel.
Removed the hardcoded height entirely; `.bard-stage` sizes to its own
content now, same as it always did before this renderer had to also work
at full-viewport scale.

That alone isn't enough, though — something still has to push the actor
row + caption down to the *bottom* of the usable black box rather than
letting them float at the top. Restored the exact pattern the original
small boxed demo used for this: `#stage-frame` is a column flex
container with `justify-content: flex-end`, so its children (the actor
row, then the caption) stack naturally and the whole group settles at
the bottom.

The venue-banner/title overlap was a second, related bug: venue art was
pinned at a fixed `top: 0.75rem`, with no actual knowledge of how tall
the title overlay really was. Replaced the fixed offsets with a
`syncLayout()` in main.js that measures the overlays' real rendered
height and uses it to both pad `#stage-frame` and reposition the venue
frames — on load, after a layout tick, and on resize — so nothing can
overlap the title or the controls regardless of viewport width or how
many lines the header text wraps to.

Verified with a jsdom smoke test driving the real demo end to end
(mount, build both pickers, play, advance, switch venues, dispatch a
resize) — confirmed structurally that `.bard-stage`'s injected rule no
longer contains `height: 100%`, that `#stage-frame` children stack in
the right order, and that actors are actually present on stage after
advancing — then a clean vite build. The actual pixel-perfect visual
result still can't be verified without a real browser, same caveat as
always; asked Scott to confirm on his end.

## 1.0.27 (2026-07-19, same day)

"Let's break this out even further." Scott: "The default stage will be a
black box space that takes up the entire window. Make everything a bit
bigger to accommodate. Then, we will create ASCII layers over this core
setup -- Athenian amphitheater, the Globe, French theater, movie
theater, that sort of thing."

Two real changes, split by where they belong. The bigger-everything part
went into bardjs's own DomRenderer — this is the reference renderer,
meant to work whether it's embedded in a small box or filling an entire
viewport, so its mask/bubble/name/caption sizes are clamp()'d to scale
with the space instead of fixed at rem values sized for a 640px demo box.

The venue art did not go into bardjs. Its own README already draws this
line: "everything about how a specific production looks... is staging,
not the amphitheater itself, and deliberately lives in the consuming
site instead of here." So packages/bardjs/demo/venues.js is new,
demo-only: four ASCII backdrops (Athenian Amphitheater, the Globe,
French/Molière-era theater, a movie theater) plus a bare-stage default —
picking one changes nothing about how the engine runs a scene, it's
paint laid over the black box, not plumbing under it. The demo's own
layout changed to match: the stage is now a fixed, full-viewport black
box by default, with the title/controls/pickers floating as overlays on
top rather than boxing the stage in.

Verified venue data (every populated venue actually has top/bottom art
and an accent color, the bare-stage default is genuinely empty) before
touching layout, then a clean vite build.

## 1.0.26 (2026-07-19, same day)

Scott: "randomize the plays, and can we have a dropdown menu instead of
checkboxes?" Two small changes to the demo, one of which turned into a
small addition to bard.js itself.

The reel now reshuffles on every load, restart, and apply — the exact
same idea theater.js already applies to its own three plays. Rather than
give the demo its own private copy of that shuffle, pulled it into
bard.js as a real export: packages/bardjs/src/shuffle.js, a plain
Fisher–Yates, re-exported from the package root. "What order do these
scenes play in" is generic enough that any bard.js consumer running more
than one scene in a sitting will want it, not just this demo.

The checkbox list is gone, replaced with a native multi-select dropdown
(`<select multiple size="8">`) — click one play, cmd/ctrl-click (or
shift-click) for more. Select-all/select-none still work against it, and
"apply" was renamed "shuffle & apply" since it now reshuffles the chosen
subset every time rather than just replaying it in fixed order.

Verified shuffle doesn't mutate its input and actually produces different
orderings (checked over 20 trials before trusting it), then a clean
vite build.

## 1.0.25 (2026-07-19, same day)

Scott spotted a real bug in the demo screenshot the moment it loaded:
Clytemnestra and Agamemnon's speech bubbles overlapping into unreadable
mush. Root cause was in bardjs's own `DomRenderer.onLine` — it only
cleared the *speaking* actor's own previous bubble before drawing a new
one, not bubbles left behind by whoever spoke earlier in the same scene,
so they piled up and overlapped since nothing else ever removed them.
theater.js's `TheaterRenderer` already had this right (a stage-wide
`clearBubbles()`); ported that same pattern into `DomRenderer`, wired it
into `onChorus` too, and filled in a small real gap while in there — the
reference renderer never actually implemented `onIntermission`, so
demo pages went visually silent for ~4 seconds at every gap between
plays. Now it shows "— intermission —".

Also, per Scott: "we'll absolutely need to build functionality so people
can choose the scenes. It can be an optional feature, but I know people
would want that." Added a scene picker to the demo — checkboxes for all
eight plays, select all/none, and an apply-and-restart button. No new
engine API required for this: `compileScript` already takes any array of
scenes, including a single one (which correctly drops the intermission
event entirely, since that already defaults off below two scenes).
Verified the filtering itself against the real compiler/Player before
touching the DOM — a 3-scene subset and a 1-scene subset both compiled
and played clean, then a full `vite build` came back clean.

## 1.0.24 (2026-07-19, same day)

bard.js's first real test drive. Scott: "create a dummy page so I can test
this locally" and asked for demo/dummy text pulled from The Oresteia,
Medea, Lysistrata, As You Like It, Macbeth, Candide, The Misanthrope, and
The Importance of Being Earnest — eight plays, eight scenes, one shared
cast map, one DomRenderer instance, run entirely through the real engine
(compileScript + Player), nothing bespoke.

Lives at packages/bardjs/demo — index.html, main.js, scenes.js — kept
inside the package itself since it's a demo of bard.js, not a
perceptualmechanics scene. Wired into vite.config.js as a third
multi-page entry (`bardDemo`) alongside main and utils/shorts.html, so
`npm run dev` serves it at /packages/bardjs/demo/ like any other page on
the site. Verified the whole timeline compiles and plays end-to-end
before ever loading a browser: a Node script ran the real
`compileScript`/`Player` against all eight scenes with a mock renderer —
71 timeline events, zero missing cast entries, walked cleanly from start
to the final Wilde line with no thrown errors — then a full `vite build`
came back clean (only the pre-existing >500kB orrery chunk warning).

The Greek/Voltaire/Molière scenes are original condensed adaptations, not
translated text, since translation copyright is its own murky thing; the
Shakespeare and Wilde scenes use lightly-trimmed lines from the actual
English originals, which have been public domain for a very long time.

## 1.0.23 (2026-07-19, same day)

bard.js v0.1. Scott: "so i'm thinking bard.js is an ampitheater. The very
bare bones of human drama. we can add modern amenities such as camera
angles and modern theatrical staging later on, but it should start at
greek theater. that's the root." So the root vocabulary is deliberately
small — chorus (narration), enter, exit, line (dialogue), and intermission
(the gap between one performed piece and the next in a sitting, which is
itself an old idea — a festival of plays back to back). No camera, no
blocking coordinates, no lighting design: there is no camera in an
amphitheater, the audience has one fixed seat, and those are explicitly
left for a later "modern amenities" layer to add on top of this one.

Lives at packages/bardjs — its own package.json, its own README, zero
perceptualmechanics-specific code, wired in via an npm workspace so
`import { Player } from 'bardjs'` just resolves. `Player` walks a compiled
timeline (play/pause/next/prev/goTo/restart) and calls whichever methods
a renderer defines; it doesn't know or care how anything is drawn.
`compile.js` turns scenes into that timeline — including
`compileLegacyScene`/`compileLegacyScript`, written purely so
theater.js's three already-produced plays (Truth and Beauty, Paul Revere,
You've Got a Friend in Satan) could move onto the new engine without
hand-transcribing a single line of dialogue. `renderers/dom` is the
reference renderer (ASCII masks, cowsay bubbles, a caption line) for
anyone starting a project from scratch on this.

theater.js itself now runs on bard.js: its own bespoke state machine
(setupScene/showBeat/goTo/restart/scheduleAutoplay, ~180 lines) is gone,
replaced by a `TheaterRenderer` class that reuses the exact same `.tab-*`
DOM structure and CSS the site already had — no visual or CSS changes,
only what drives the visuals changed. Verified two ways before touching
anything live: first, a structural check ran the real compileLegacyScript
output against every one of theater.js's 773 resulting events for all 16
scenes (615 spoken lines, 24 of them legitimately off-stage "voice" lines)
and found zero characters speaking while both absent and not marked
voice — the compiler is faithful to the actual, already-written plays.
Second, a jsdom smoke test drove the real, live createTheater() through
its actual controls — 800 "next" clicks (only 773 needed), prev, play/
pause toggling, reaching the real end card, and restarting/reshuffling —
with zero thrown errors. That second test caught two genuine bugs before
they shipped: Player.play() didn't handle starting from a fresh,
never-advanced state (fixed in bard.js itself, not papered over here),
and — a latent bug that turned out to predate bard.js entirely, in the
*original* goTo() — clicking "next" repeatedly after already reaching the
end could stack up duplicate end cards, since nothing guarded against
re-entry. Fixed that one too while in there.

Not built yet, in order: richer event types (blocking, camera, sound)
once a renderer exists that can use them; a text-based authoring layer on
top of the same event model, ideally Fountain-compatible rather than
inventing new syntax; and a second renderer (Three.js, a real camera) as
the actual test of whether "renderer-agnostic" is true or just a claim
with one implementation behind it.

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
