# perceptual mechanics — notes & punch list

## next up
- [ ] butterfly auto-rotate / camera sweep for YouTube Shorts (9:16 vertical)
- [ ] nebula: integrate curator tool output into nebula.js
- [ ] nebula: Webb/Hubble background image (bring a favorite)
- [ ] nebula: drawn constellation connections (hand-curated, not algorithmic)
- [ ] notebook review — new piece ideas

## pending decisions
- nebula star data — use curator tool to populate, then drop into nebula.js
- worldline/egg — Google Maps JS API + actual coordinates (Boston, LA, Boca, Michigan)

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
