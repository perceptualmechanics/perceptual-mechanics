# Spectra — shelved 2026-09-02

Built, verified, and taken back out before it ever shipped. Scott's call. The
files are all here and they all still build; the scene is simply not registered,
so nothing loads it and nothing links to it.

This file exists so that nobody has to reconstruct any of it — not the code, not
the reasoning, and not the reasons it was worth building.

## What it is

A comparison plate of dramatic voice. Every speaker in Theater's three plays is
a light source. **Emission** is the seven style features their dialogue produces,
drawn as bright lines at fixed wavelengths on a black plate. **Absorption** is
the same wavelengths drawn as their cast's continuum with their shortfalls
notched out of it — what they take out of the play's voice on the way to you.
One fingerprint, two positions.

Three plates, one per play, cast-scoped. Eighteen speakers qualify; eight more
appear greyed with their word counts, because an excluded cast member is a fact
about the play rather than housekeeping.

## Why it was worth building

The site-wide version of the same idea was measured first and **failed** — no
element appeared in exactly one scene, none appeared in nine or ten, and five of
ten scenes had almost no text. That measurement is
`spectra-measurement-2026-09-02.md`, and its recommendation was *don't build
this*.

The dialogue-scoped version was then measured and **survived**, for a specific
reason worth keeping: **no two of the eighteen speakers share a style profile**,
where content vocabulary separated only twelve and mostly by topic. Style is the
instrument; content is a garnish. And absorption scoped to a cast is genuinely
different information from emission rather than its complement — which is the
exact failure that killed the site-wide version.

The single most persuasive number: **Satan absorbs 59% of his own play's shared
vocabulary on 147 words, more than Traci at 57% on 121.** Not a size artifact.
The character who speaks least like everyone else in the play is the Devil.

## What is still here

| file | what it holds |
|---|---|
| `spectra.data.js` | the measurement, computed from `theater.text.js` at runtime — no copied numbers, per the published-copies-import rule. Every ruler is named where it is used. |
| `spectra.js` | the scene: orthographic plate, merged soft/flat geometry, emission and absorption modes, panel, jump list, keyboard walking |
| `spectra.html` | shell markup; the wavelength scale and the row labels are written from `FEATURES` rather than typed |
| `spectra.css` | mobile-first, nested queries, contrast measured against the plate's own black |

`spectra.data.js` is imported by nothing else and is safe to keep. It is also
the part most likely to be wanted independently — the eighteen style profiles
and the three absorption tables are a real reading of the plays whether or not
they are ever drawn.

## To bring it back

Three edits, all of them in the commit that shelved it:

1. **`src/scenes/registry.js`** — restore the `spectra` entry (`exportName`,
   `label`, `ariaLabel`). The loader comes from `import.meta.glob` in `main.js`,
   so there is no second list to touch.
2. **`index.html`** — restore the nav icon and the `preview-spectra` tile.
3. **`styles/main.css`** — `--nav-count: 10` back to `11`. That is the one value
   an added icon changes; the row's sizing is derived from it and was verified
   not to clip at 320 / 360 / 375 / 390 / 414 / 768 / 780 / 1280.

And, if the `/text/` page is wanted, restore `buildSpectra()` in
`scripts/prerender.js` and add it to the `pages` array. The decision recorded at
the time was **option two of three**: a page carrying the measurement rather than
the dialogue, because a spectrum's content genuinely is the measurement, those
tables exist nowhere else, and it puts the rulers in public.

## What did NOT get shelved, and should not be

Three things came out of this build that stand on their own and stayed:

- **`src/scenes/registry.js`** — the scene registry, out of `main.js` so that
  Node can read it. It has no imports, and that is load-bearing: keeping the
  `load: () => import(...)` members there pulled the whole scene graph into
  Vite's own config bundle and killed the build before it started.
- **`import.meta.glob` loaders in `main.js`** — derived from the registry's keys,
  so scene names are listed exactly once.
- **The scenes-sum assertion in `scripts/prerender.js`** — every scene either
  builds a `/text/` page or is named in `TEXT_EXEMPT` with a reason, failing the
  build in both directions. It had been in the punch list since 2026-09-01 and an
  eleventh scene is what finally made it concrete.
