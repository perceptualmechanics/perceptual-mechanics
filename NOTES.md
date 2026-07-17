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
- elements/"cycle" scene — five-element live-stream piece (earth/water/air/fire/wood), embed via
  YouTube iframe API (`embed/VIDEO_ID` or `embed/live_stream?channel=CHANNEL_ID`, auto-switches to
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

- text-overlay source material for the elements scene (from archive/Writing archive, 2003-04 era,
  author: Scott Cohen — full research trail behind these picks now lives in A Manual of Perceptual
  Mechanics.scriv, Research/"Archive Research Notes"):
  - Fire → `Fire.doc`: word-association litany ("Fire. Burn. Sun. Light... The ash... Bunsen
    burner. Bonfire. Beach bonfire. Burning Man...") plus a longer two-part dialogue scene ending
    with a real wildfire visible from a party. Reserved for the fire stream's text overlay.
  - Water/Air/Earth/Wood → `Cartography.doc`'s "In The End It Falls Slowly Through The Aether": a
    single raindrop falling off a leaf, told through real physics (surface tension, friction,
    oxygen/nitrogen, root, sun) — touches water, air, earth, and wood in one continuous piece.
    This is the source text for the new "leaf" scene (see "gems wired into the site").

## full archive deep-dive (2026-07-16)

Did a complete pass on the entire `archives/Writing archive/` folder (228 files, ~1.84M words,
~2000–2025) hunting for site-usable material. Full write-up + the general findings (perceptual
mechanics' name origin, the fire-obsession stat, the L.A. Project, etc.) now live in A Manual of
Perceptual Mechanics.scriv, Research/"Archive Research Notes" — that project is the source of
truth for the archive-research history going forward.

What actually landed on the site from that pass: "The Crocodile Photograph" (dark-comedy short
story), "The Golden Hare" (one-sentence myth fragment, now the wandering interstitial), "The
Orrery of Los Feliz" (noir sci-fi vignette, now a clickable object in nebula.js) — see "gems wired
into the site" below.

## gems wired into the site (2026-07-16, same session)

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
  the old "pending decisions" text used to describe (Webb-style clouds and hand-drawn constellation
  lines are already built, just built around real-site history instead of a curator-tool/astronomy
  concept) — that's now reflected above.
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

## nebula.js reality check (flagged, not yet resolved)

`nebula.js` and `egg.js` are still commented out in `main.js` ("deactivated for now, being
reworked"). Worth a proper activation pass once both are ready for real traffic.

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

## infrastructure done, needs real content
- `src/scenes/nebula.js` — built (real-site constellations + Orrery), just not yet re-activated in `main.js`
- `src/scenes/egg.js` — placeholder green sphere; slated to become an Earth view with aurorae,
  magnetic field lines, and orbiting satellites (in progress, 2026-07-16)
- `src/scenes/leaf.js` — new, not yet built; source text is Cartography.doc's "In The End It Falls
  Slowly Through The Aether" (see "pending decisions" above)
- `src/scenes/cycle.js` — new, not yet built; the five-element livestream piece (see "pending
  decisions" above for the full roster)

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
