// ─── The Scroll: the eleven pieces, in order ───────────────────────────────
// The scroll itself shows these deliberately bare — no titles, no sources, no
// dates, no glosses (see scenes/scroll.js's header for why: it's meant to
// read as something found, not published). That's a decision about the
// *scroll*, not about the writing, and it doesn't survive contact with a
// crawlable page: a reader arriving from a search result needs to know what
// they've landed on, and a page with no headings is unusable with a screen
// reader besides.
//
// So the titles and dates live here — not invented for the occasion, but the
// real ones, already recorded in scroll.js's own header comment since the
// scene was built, and traceable to the source documents in the archive
// (Fire.doc for The Vigil and The Calamity, Pygmalion.doc, and so on). The
// scene ignores `title` and `date` entirely and renders only `body`, exactly
// as before; the prerender step that builds /text/scroll/ uses all three.
//
// Order is chronological, oldest first — the same order the scroll lashes its
// patches together in, oldest and most soot-stained at the top.
//
// `excerpt` marks the three pieces that aren't the complete source document,
// so the published page can say so plainly rather than implying a full text.

import {
  ironGods, flying, death, pygmalion, selfMutilation, cartography,
  fireVigil, fireCalamity, identityTheft, holography,
  projection, projectionScript, crocodilePhotograph,
} from './scroll.bodies.js';

export const scrollPieces = [
  { key: 'iron',           title: 'Iron Gods',                              date: 'c. 2000',            body: ironGods },
  { key: 'flying',         title: 'Flying',                                 date: 'c. 2000',            body: flying },
  { key: 'death',          title: 'Thoughts Of Death Abounds',              date: 'c. 2000',            body: death },
  { key: 'pygmalion',      title: 'Pygmalion',                              date: 'May 2000',           body: pygmalion },
  { key: 'selfmutilation', title: 'The Impossible Bliss of Self-Mutilation', date: '2002',               body: selfMutilation },
  { key: 'cartography',    title: 'In The End It Falls Slowly Through The Aether', date: '2002–2003',   body: cartography },
  { key: 'firevigil',      title: 'The Vigil',                              date: 'November 2003',      body: fireVigil,
    excerpt: 'One of two scenes embedded in Fire.doc, reproduced complete and unedited from where the source document’s opening word-association litany ends.' },
  { key: 'firecalamity',   title: 'The Calamity',                           date: 'November 2003',      body: fireCalamity,
    excerpt: 'The second of the two scenes embedded in Fire.doc, likewise complete and unedited from that point on.' },
  { key: 'identity',       title: 'Identity Theft',                         date: '2009',               body: identityTheft },
  { key: 'holography',     title: 'Holography',                             date: '2009–2012',          body: holography,
    excerpt: 'One complete, self-contained movement — Jeremy Constantilios’s flight into and landing in Los Angeles — excerpted from a chapter running to roughly 10,500 words, ending at a natural scene break.' },
  { key: 'projection',     title: 'Projection',                             date: '2009–2012',          body: projection,
    // The one island of screenplay formatting on an otherwise all-prose
    // scroll: a scene the narrator is recounting, so it's set as a real
    // script rather than folded into a running paragraph. Not a word of it
    // changed — only the line breaks are new.
    script: { after: 23, lines: projectionScript } },
  { key: 'crocodile',      title: 'The Crocodile Photograph',               date: 'undated, later',     body: crocodilePhotograph },
];
