// ─── Butterfly: the found text is the title itself ──────────────────────────
// Every other found-text scene has body copy to address. Butterfly doesn't —
// its only "found" text is its own placard line, "Chaos Butterfly in Phase
// Space, 2026" (the fixed label in butterfly.html / the `label` string in
// main.js's SCENES map). Broken out into its own module, id kept for
// consistency with every other scene's addressing scheme (see NOTES.md's
// Linking & Addressing entry), so the Constellation's Layer 2 discovery pass
// can address it as a piece like any other scene's pieces, even though it's
// one line rather than a paragraph. Not wired into butterfly.html or
// main.js's rendering — those already carry their own (slightly differently
// punctuated, placard vs. aria-label) copies of this string and this module
// isn't replacing either; it exists solely so resonances.js/
// verify-resonances.mjs/build-resonances-doc.mjs have something to resolve
// `{ scene: 'butterfly', id: 1 }` against.

export const BUTTERFLY = {
  id: 1,
  title: 'Chaos Butterfly in Phase Space, 2026',
  text: 'Chaos Butterfly in Phase Space, 2026',
};
