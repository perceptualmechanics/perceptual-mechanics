# Beamline verification + The Constellation — session brief

For review (originally: "so Chat can review it"). Summarizes a completed
fix-verification pass and a proposed plan for a new ninth scene. Nothing
below has been built yet except where noted.

## Part 1 — Beamline terrain: confirmed working, not a regression

A report claimed the 2.3.2 terrain-color fix was verified and clean. A
screenshot taken after that report appeared to show a flat green screen —
no mountains, no ground grid, no waypoint markers. This looked like it
could contradict the closure claim.

Checked directly, live, on `main` at its committed head (clean tree,
nothing uncommitted): default view, zoomed in, zoomed out, dragged to
several different orbit angles, and a fresh hard-reload deep-link
(`#beamline/5`). All five rendered correctly — three mountains in
distinct hypsometric tones, ground grid, waypoint markers, station label.
No flat-green state reproduced anywhere. The camera ground-clamp code
(the one place a stray close-up fill could plausibly originate) is
untouched by the terrain-color work and reads correctly.

**Conclusion: the flat-green screenshot doesn't reflect current `main`.**
Most likely an early frame captured before the terrain finished its first
paint, or a stray capture from a different point in the session. Not a
regression — no fix needed.

## Part 2 — The Constellation

A new, ninth scene: a Tempest-style vector-line constellation connecting
pieces across every scene, with a vector-line spider (eight legs) walking
its underside. Purely atmospheric — it doesn't curate anything itself. It
rests until a strand tied to whatever the visitor's currently interacting
with elsewhere gets touched, then reacts (a flick, a posture shift). That
reaction is the whole interaction model — no separate hover state.

Two link layers, kept deliberately separate:

- **Layer 1** (existing): the verbatim phrase-matched system in
  `src/links.js` / `verify-links.mjs`. Untouched by this work.
- **Layer 2** (new): cross-scene, connotative, LLM-discovered resonance —
  threads between pieces that share thematic or associative connection,
  not a shared phrase. This is what the Constellation actually
  visualizes.

### Where things already stand

All seven found-text scenes (sphere, orbiter, library, scroll, beamline,
theater, orrery — butterfly has no found text and isn't one of the
"seven small experiences") already carry stable per-piece ids from the
2.3.0 linking-infrastructure pass. Theater stays at its existing 16
scene-level ids rather than expanding to the ~773 individual bard.js
dialogue beats underneath them — those are mostly single-line utterances
or stage directions, too fragmentary to hold a standalone resonance, and
773 nodes would outnumber every other scene's pieces combined.

"Previously-unused" text, clarified: not material outside the repo —
every scene's full text already lives in its own `.text.js` file. It
means pieces that have never been an endpoint of an existing Layer 1
link. The discovery pass reads every piece's full text regardless of
whether it's ever been linked before, so this is satisfied by construction
rather than needing separate sourcing.

Full corpus across all seven `.text.js` files: ~334K characters, roughly
80–85K tokens. Comfortably one context. No embedding pre-filter needed.

### Layer 2 schema (proposed)

New file, `src/resonances.js`, structurally distinct from `links.js`:  a
resonance is symmetric (two pieces evoke each other; neither is "source"),
cross-scene by default, and carries a rationale instead of a matched
phrase.

```js
{ id, a: { scene, id }, b: { scene, id }, rationale, status: 'pending' | 'approved' | 'rejected' }
```

No `phrase`/`field` fields — there's nothing verbatim to check a
connotative link against. `status` is the actual review gate: the
discovery pass only ever writes `pending`. Nothing feeds the live scene
unless `status === 'approved'`. A sibling script, `verify-resonances.mjs`,
checks both ids resolve and there are no duplicate unordered pairs.

### Discovery process

One full-context reasoning pass over all seven scenes' complete text
(every piece, not just previously-linked ones), proposing candidate
cross-scene resonances with a one-to-two-sentence rationale each — why
these two pieces evoke each other, not just an assertion that they do.
Since there's no verbatim phrase to check a connotative link against,
the rationale is the only thing that makes a discovered link legible and
reviewable at all.

Output goes into a durable, **committed** document —
`docs/constellation_resonances.md` — every candidate pair, both pieces'
titles/scenes, and the rationale, formatted for a straight top-to-bottom
read with each one marked approved or rejected individually. This
replaces the historical `library_resonances.md`, which — as far as I can
tell from git history — never actually got committed; it matches this
project's recurring pattern of working documents living only in session
scratch space and being lost when the session ended. This time it's a
real commit.

Nothing writes `status: 'approved'` into `src/resonances.js` until that
review has actually happened. A technically working Constellation full of
unreviewed links isn't considered done, regardless of how clean the build
is.

### The scene itself

Camera orbits underneath a canopy of thin glowing vector-line strands —
same visual family as Orbiter's wireframe geodesic and Library's
hexagons, house style for this kind of thing. Ceiling-viewed-from-below
is the natural framing for "walking the underside of the web." Proposed
starting point: reuse `orbiter.js`'s spherical-orbit camera math rather
than inventing new orbit logic, since it's already the closest thing on
the site to "look at a structure from a fixed pivot."

Each strand is one approved resonance, connecting two points mapped from
their home pieces. The spider (eight legs, standard anatomy) idles on its
own cycle and reacts when a strand tied to the visitor's current
elsewhere-interaction gets touched.

### Reaching it — brainstorm, not a decision

Scott's ask: think of ways into this scene that aren't the nav bar or a
landing-page preview thumbnail. Some directions, all in the site's
existing "found by chance" vocabulary (the colophon's own hidden hare
mark, the site's whole found-text conceit) rather than a normal menu
item:

1. **Follow a thread from where you already are.** Since every resonance
   connects two *specific* pieces, a visitor standing inside a piece
   that participates in one could see a single thin filament-glint at
   the edge of their current scene — not a clickable phrase like Layer 1,
   just a found, atmospheric thread. Following it is what actually drops
   you into the Constellation, arriving already oriented at the strand
   that brought you. Reuses the inbound/outbound link machinery that
   already exists per-piece; the entry point is distributed across every
   scene rather than being one destination to advertise.

2. **The hare mark, reinterpreted.** The colophon's hidden hare already
   carries the moon, Venus, Mercury, a sun, and a star "cut straight
   through its body" — it's already a small constellation. A found
   interaction on the mark itself (long-press, or specifically the star
   within it) could open the Constellation instead of — or alongside —
   the colophon panel. Ties the entry point directly to imagery already
   on the site that's thematically the same idea.

3. **A recurring star across skyboxes.** Several scenes already render
   night sky (beamline's skybox, sphere's own form, orbiter's orbits). A
   single star, quietly present at the same relative position across
   multiple scenes' skies, would be the kind of thing an attentive
   repeat visitor notices on their own — clicking it is the door. Very
   much in the site's existing register of found coincidence rather than
   an announced feature.

4. **Earned by use, not always present.** The spider's whole premise is
   that it reacts to what a visitor's already done elsewhere. Extending
   that: the Constellation itself might not be reachable at all until a
   visitor has opened pieces across at least two different scenes in one
   sitting — at which point something small and new becomes visible
   (a star appears somewhere it wasn't). Strongest fit with the "found,
   not curated" framing, but the most implementation work, and worth
   weighing against just being frustrating if it's too well-hidden.

5. **Something for the technically curious** — a hash route or similar
   that isn't advertised anywhere visually. Lowest effort, least
   interesting, included mainly as a floor rather than a real
   recommendation.

None of these are decided. Flagging them here for review rather than
picking one — genuinely Scott's/Chat's call, and it interacts with how
discoverable vs. how "found" the whole piece is meant to feel.

### Site consequences

`colophon.html`'s live copy — "seven small experiences built around found
and written text" — needs to become eight once this ships. Open question,
not decided here: does the Constellation count as an eighth "experience
built around found and written text," given it doesn't present its own
found text so much as visualize connections between the other seven's
text? Leaning yes (its entire content is those seven pieces, just
diagrammed rather than read), but it's not mine to default into.

`vite.config.js` has two internal dev-comment mentions of "eight scenes"
(not user-facing) that become nine for accuracy. Nav bar needs a ninth
icon and a `SCENES` entry in `main.js`. `packages/bardjs`'s own
"eight scenes, eight plays" demo fixture is an unrelated coincidental
count (eight classic-play adaptations) and doesn't need to change.

### Proposed staging

1. Build `src/resonances.js` + `verify-resonances.mjs`, run the discovery
   pass, write `docs/constellation_resonances.md`, commit it.
2. Scott reviews and marks approvals. Work stops here until that happens.
3. Build the actual scene against only the approved set; wire
   nav/colophon/copy; settle on an entry-point approach from the
   brainstorm above (or a different one).
4. Verify live, in motion, same discipline as everything else on this
   project. Build, version, commit.

Nothing past step 1 happens without a decision on step 2's actual
content — the review gate is the point of the whole design, not a
formality.
