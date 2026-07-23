import * as THREE from 'three';
import { libraryItems } from '../text/library.js';
import { cdRackItems } from '../text/cdRack.js';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, bindEscapeClose,
} from '../utils/sceneKit.js';

// ─── The Library ────────────────────────────────────────────────────────────
// Scott: "for that picture of the bookshelf in the assets folder, can you
// scan that and see if you can identify all the media there?" — then, once
// the catalog existed (src/text/library.js, 107 books/films/decks read off
// a real photo of his shelf, corrected against IMG_1202.jpeg after an
// earlier pass used the wrong picture): "add a new scene to
// perceptualmechanics, library. Build out infrastructure as usual."
//
// A 4x2 Kallax-style cube shelf, same physical layout as the real one
// (row/col/pos in library.js preserve left-to-right shelf order), rebuilt
// as a floating 3D object rather than a room you walk through — closer to
// the sphere/egg model (drag to orbit, click something small to read about
// it) than the orrery's walk-around warehouse, since a shelf reads fine as
// an object held up to the light rather than a space to stand inside.
//
// No real cover art or spine photography anywhere — same rule as every
// other scene's canvas-drawn textures (the orrery's poster/audio system is
// the clearest precedent: real film/album titles, but nothing lifted from
// an actual copyrighted image). Every spine here is a plain canvas
// background color plus the title/creator drawn as text, standing in for
// the real spine design rather than reproducing it.

const CUBBY_W = 2.4;
const CUBBY_H = 1.7;
const CUBBY_D = 1.0;
const FRAME_T = 0.09;
// Scott, 2026-07-23: "let's turn the bookcase vertical." Was a 4x2
// landscape grid (4 wide, 2 tall); now 2x4 portrait (2 wide, 4 tall) — a
// pure 90-degree transpose of the same cubbies. Every item's stored
// row/col in library.js is untouched (still "left-to-right shelf order"
// off the real photo); only which axis COLS/ROWS walks, and which field
// feeds cubbyLeft() vs cubbyTop() in buildItems(), swapped.
const COLS = 2;
const ROWS = 4;
const TOTAL_W = COLS * CUBBY_W + (COLS + 1) * FRAME_T;
const TOTAL_H = ROWS * CUBBY_H + (ROWS + 1) * FRAME_T;

// ─── CDs ────────────────────────────────────────────────────────────────────
// Scott, 2026-07-23: "i have the notion of adding a CD rack to the bookshelf
// :D" — invented wholesale, not catalogued off a real photo like the shelf
// (he doesn't own any of these anymore). Built up album-by-album across a
// long back-and-forth: 114 albums, 55 artists, hand-dictated rather than
// filler (src/text/cdRack.js carries the full provenance note).
//
// Two earlier passes tried building this as its own object: first sharing
// the shelf's camera and rotation pivot (broke down because anything off to
// the side of a shared pivot swings through a much bigger arc than the
// centered object, and was out of frame entirely on mobile), then as a
// second object with its own rotation group and a "Shelf / CD Rack" switch
// to pick which was active (which worked, but per Scott: "we're
// overthinking this. just put the CDs in the bookcase with the books and
// movies. the switch is a bit too much architecture.").
//
// So: no separate object, no separate camera, no switch. The CDs are just
// more items in the same cubbies as the books and films — placeCdsInCubbies()
// distributes them across the shelf's existing 8 cubbies, appended after
// whatever books/films are already there, and buildItems() (below) renders
// and sizes them like any other item, just thinner and shorter, with their
// own texture (makeCdSpineTexture). They ride the exact same root group,
// camera, drag/zoom, and raycast as every other spine on the shelf — nothing
// about the shelf itself changed to make room for them.
//
// Interaction is still lighter than the books, though: no click-to-panel —
// a click/tap surfaces a small tooltip with the artist, album, and Apple
// Music/Spotify search-links, nothing else (see the `cd-tooltip` DOM element
// and its branch in onContainerClick, below).

// Muted, curated palette — deliberately not a rainbow of random hues, so
// the shelf reads as "someone's actual bookshelf" rather than a bar chart.
const PALETTE = [
  '#c9c0ab', '#242226', '#7a3230', '#2f4d3a', '#28344a',
  '#8a5a3f', '#5a4a6b', '#9c8a45', '#3a3a3a', '#647568',
  '#a8433a', '#3d5a6b',
];
// Divination decks/boxes get their own small, darker, starrier palette —
// they read as distinct objects on the real shelf (Kim Krans' two boxes),
// not just thicker books.
const BOX_PALETTE = ['#141428', '#1c1830', '#101018'];

// Shared between the #cd-tooltip CSS (max-width) and positionCdTooltip's
// edge-clamping math below, so the two can't quietly drift out of sync.
const CD_TOOLTIP_MAX_W = 230;

// Cheap deterministic string hash (djb2) — used so a given title always
// gets the same simulated thickness/color/height on every visit, rather
// than reshuffling the shelf each reload.
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function hash01(str, salt) {
  return (hash(str + salt) % 10000) / 10000;
}

// ─── Cross-links, 2026-07-23 ────────────────────────────────────────────────
// Same mechanism, and the same rule, as sphere.js's fragment-links, egg.js's
// poem-links, and manuscript.js's LINKS: only phrases already sitting in the
// catalog text get wired up as jumps to another item's panel. Scott: "given
// this analysis, curate the excerpts to create hyperlinks between them a la
// my other writings in the site" — "this analysis" being a close read of the
// whole 107-item catalog for real resonances (see library_resonances.md),
// which is also where the curated note/excerpt additions in
// src/text/library.js supporting these phrases came from. Keyed by item id
// + field name (note/scene/excerpt/excerpt_from), since — unlike poems.js's
// stanza-indexed text — library items don't share a single "the text" field.
const LIBRARY_LINKS = [
  // A coin decides everything, twice: Chigurh's coin toss and Stoppard's,
  // played completely straight in one and as metaphysical comedy in the
  // other.
  { id: 49, field: 'scene',   phrase: 'coin toss',                        target: 72 },
  { id: 72, field: 'excerpt', phrase: 'A coin spins in the air',          target: 49 },
  // "The Origin of Love" is a direct staging of Aristophanes' speech from
  // the Symposium, sitting a few cubbies away.
  { id: 40, field: 'scene',        phrase: 'Origin of Love',              target: 13 },
  { id: 13, field: 'excerpt_from', phrase: 'Hedwig and the Angry Inch',   target: 40 },
  // Kubrick's stargate, argued over by the two directors who built on it:
  // Tarkovsky's Solaris as a rebuttal, Malick's Tree of Life borrowing
  // Kubrick's own effects supervisor.
  { id: 63, field: 'note', phrase: 'The Tree of Life',        target: 33 },
  { id: 63, field: 'note', phrase: 'Solaris',                 target: 53 },
  { id: 53, field: 'note', phrase: '2001: A Space Odyssey',   target: 63 },
  { id: 53, field: 'note', phrase: 'The Tree of Life',        target: 33 },
  { id: 33, field: 'note', phrase: '2001: A Space Odyssey',   target: 63 },
  { id: 33, field: 'note', phrase: 'Solaris',                 target: 53 },
  // Kurosawa's one idea about honor and code, tested across four decades
  // and, in Jarmusch's case, two cultures.
  { id: 31, field: 'note', phrase: 'Throne of Blood',                     target: 41 },
  { id: 31, field: 'note', phrase: 'Dreams',                              target: 44 },
  { id: 31, field: 'note', phrase: 'Ghost Dog: The Way of the Samurai',   target: 54 },
  { id: 41, field: 'note', phrase: 'Seven Samurai',                      target: 31 },
  { id: 44, field: 'note', phrase: 'Seven Samurai',                      target: 31 },
  { id: 54, field: 'note', phrase: 'Seven Samurai',                      target: 31 },
  // Joyce dismantling, book by book, his own faith that a story has a
  // beginning and an end — and Hofstadter's "strange loop" describing the
  // same shape from mathematics instead of prose.
  { id: 11, field: 'note', phrase: 'Ulysses',                             target: 85 },
  { id: 85, field: 'note', phrase: 'A Portrait of the Artist as a Young Man', target: 11 },
  { id: 85, field: 'note', phrase: 'Finnegans Wake',                      target: 89 },
  { id: 89, field: 'note', phrase: 'Gödel, Escher, Bach',                 target: 73 },
  { id: 73, field: 'note', phrase: 'Finnegans Wake',                      target: 89 },
  // wabi-sabi as essay, then as plot.
  { id: 51, field: 'note', phrase: 'In Praise of Shadows',                target: 75 },
  { id: 75, field: 'note', phrase: 'Tokyo Story',                         target: 51 },
  // Interior consciousness dissolving plot, in two very different languages.
  { id: 3,  field: 'note', phrase: '1Q84',                                target: 86 },
  { id: 86, field: 'note', phrase: 'Água Viva',                           target: 3 },
  // The epic relay: Homer to Virgil to Dante, each poet picking up the
  // previous one's hand.
  { id: 82, field: 'note', phrase: 'the Odyssey',                         target: 81 },
  { id: 82, field: 'note', phrase: 'the Iliad',                           target: 80 },
  { id: 82, field: 'note', phrase: 'The Divine Comedy',                   target: 91 },
  { id: 81, field: 'note', phrase: 'the Aeneid',                         target: 82 },
  { id: 80, field: 'note', phrase: 'the Aeneid',                         target: 82 },
  { id: 91, field: 'note', phrase: 'the Aeneid',                         target: 82 },

  // Added 2026-07-23, alongside the 13 new ISBN-sourced books: same rule,
  // phrases already sitting in the (newly curated) note text.
  // Merrill's Sandover <-> the occult-reference cluster.
  { id: 108, field: 'note', phrase: 'Alchemy & Mysticism',                target: 6 },
  { id: 6,   field: 'note', phrase: 'The Changing Light at Sandover',     target: 108 },
  // The Beatles telling their own story two ways.
  { id: 109, field: 'note', phrase: 'The Lyrics',                        target: 103 },
  { id: 103, field: 'note', phrase: 'The Beatles Anthology',              target: 109 },
  // VALIS's literal split-self <-> the Symposium/Hedwig "other half" thread.
  { id: 110, field: 'note', phrase: 'the Symposium',                     target: 13 },
  { id: 110, field: 'note', phrase: 'Hedwig',                            target: 40 },
  { id: 13,  field: 'note', phrase: 'VALIS',                             target: 110 },
  { id: 40,  field: 'note', phrase: 'VALIS',                             target: 110 },
  // Nabokov's two novels here.
  { id: 111, field: 'note', phrase: 'Lolita',                            target: 115 },
  { id: 115, field: 'note', phrase: 'Pale Fire',                         target: 111 },
  // The two volumes of SubGenius scripture.
  { id: 113, field: 'note', phrase: 'Revelation X',                      target: 114 },
  { id: 114, field: 'note', phrase: 'The Book of the SubGenius',         target: 113 },
  // Scott's own two professional Mage sourcebooks, and the core rulebook
  // both were written for.
  { id: 116, field: 'note', phrase: 'Blood Treachery',                   target: 117 },
  { id: 116, field: 'note', phrase: 'The Spirit Ways',                   target: 118 },
  { id: 117, field: 'note', phrase: 'Mage: The Ascension',               target: 116 },
  { id: 118, field: 'note', phrase: 'Mage: The Ascension',               target: 116 },
  { id: 118, field: 'note', phrase: 'Blood Treachery',                   target: 117 },
  // Prometheus Rising joins the physics-vs-feeling triangle.
  { id: 119, field: 'note', phrase: '2001: A Space Odyssey',             target: 63 },
  { id: 119, field: 'note', phrase: 'Solaris',                           target: 53 },
  { id: 119, field: 'note', phrase: 'The Tree of Life',                  target: 33 },
  { id: 33,  field: 'note', phrase: 'Prometheus Rising',                 target: 119 },
  // Everything Is Under Control joins the chance/pattern/paranoia cluster.
  { id: 120, field: 'note', phrase: 'Gravity’s Rainbow',                 target: 78 },
  { id: 120, field: 'note', phrase: 'Borges’s Collected Fictions',       target: 79 },
  { id: 78,  field: 'note', phrase: 'Everything Is Under Control',       target: 120 },
  { id: 79,  field: 'note', phrase: 'Everything Is Under Control',       target: 120 },

  // Added 2026-07-23, named one at a time mid-conversation rather than
  // from a shelf photo or an ISBN batch.
  // Harpur's third-category argument, threaded through the channeled-
  // material / split-self / pattern-finding clusters already on the shelf.
  { id: 121, field: 'note', phrase: 'The Changing Light at Sandover',    target: 108 },
  { id: 121, field: 'note', phrase: 'the Symposium',                    target: 13 },
  { id: 121, field: 'note', phrase: 'Everything Is Under Control',      target: 120 },
  { id: 108, field: 'note', phrase: 'Daimonic Reality',                 target: 121 },
  { id: 13,  field: 'note', phrase: 'Daimonic Reality',                 target: 121 },
  { id: 120, field: 'note', phrase: 'Daimonic Reality',                 target: 121 },
  // Chiang's "Understand" joins the physics-vs-feeling triangle as a
  // fourth telling, this time as plot rather than argument.
  { id: 122, field: 'note', phrase: '2001: A Space Odyssey',            target: 63 },
  { id: 122, field: 'note', phrase: 'Solaris',                          target: 53 },
  { id: 122, field: 'note', phrase: 'The Tree of Life',                 target: 33 },
  { id: 33,  field: 'note', phrase: 'Stories of Your Life and Others',  target: 122 },

  // Added 2026-07-23, a second batch of 25 ISBNs pasted in directly.
  // Merrill's Collected Poems <-> Sandover, the rest of the same career.
  { id: 125, field: 'note', phrase: 'The Changing Light at Sandover',   target: 108 },
  // Huxley's "Mind at Large" and Narby's shamanic DNA-vision both point
  // back to Harpur's third category.
  { id: 128, field: 'note', phrase: 'Daimonic Reality',                target: 121 },
  { id: 131, field: 'note', phrase: 'Daimonic Reality',                target: 121 },
  // Food of the Gods joins the Wilson/McKenna psychedelic-consciousness
  // lineage.
  { id: 129, field: 'note', phrase: 'Prometheus Rising',               target: 119 },
  { id: 129, field: 'note', phrase: 'Everything Is Under Control',     target: 120 },
  // Planetary joins the chance/pattern/paranoia cluster.
  { id: 130, field: 'note', phrase: 'Gravity’s Rainbow',               target: 78 },
  { id: 130, field: 'note', phrase: 'Borges’s Collected Fictions',     target: 79 },
  { id: 130, field: 'note', phrase: 'Everything Is Under Control',     target: 120 },
  // The Kybalion and Holy Blood, Holy Grail both join the
  // channeled-or-invented occult-reference cluster.
  { id: 133, field: 'note', phrase: 'Alchemy & Mysticism',             target: 6 },
  { id: 139, field: 'note', phrase: 'Alchemy & Mysticism',             target: 6 },
  // Kitchen Confidential joins the built-persona cluster.
  { id: 134, field: 'note', phrase: 'Wooderson',                       target: 32 },
  { id: 134, field: 'note', phrase: 'Hedwig',                          target: 40 },
  // The Squared Circle's kayfabe joins the belief-as-technology cluster.
  { id: 137, field: 'note', phrase: 'The Book of the SubGenius',       target: 113 },
  { id: 137, field: 'note', phrase: 'Everything Is Under Control',     target: 120 },
  // Two design monographs, shelved as reference for each other.
  { id: 124, field: 'note', phrase: 'Alexander McQueen',               target: 141 },
  { id: 141, field: 'note', phrase: 'Tord Boontje',                    target: 124 },
  // The Godfather and Wiseguy, two very different tones about the same
  // underworld.
  { id: 142, field: 'note', phrase: 'Wiseguy',                         target: 140 },
  // Decreation joins the split/divided-self cluster a third way.
  { id: 145, field: 'note', phrase: 'Hedwig',                          target: 40 },
  { id: 145, field: 'note', phrase: 'VALIS',                           target: 110 },
];

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// Wraps any LIBRARY_LINKS phrases that belong to this item+field in a
// clickable <a class="library-link" data-target="id">, same beat as
// sphere.js's fragment-links: escape the raw text first, then replace the
// (already-escaped) phrase so nothing else in the string can be
// reinterpreted as markup.
function renderLinkedField(itemId, field, text) {
  let html = escapeHtml(text);
  LIBRARY_LINKS
    .filter(l => l.id === itemId && l.field === field)
    .forEach(link => {
      const esc = escapeHtml(link.phrase);
      html = html.replace(esc, `<a class="library-link" data-target="${link.target}" role="link" tabindex="0">${esc}</a>`);
    });
  return html;
}

// Pulls the video id out of a youtube.com/watch?v=... URL so the panel can
// embed it (youtube-nocookie.com/embed/ID) instead of just linking out.
function youtubeEmbedSrc(url) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('v');
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

function wrapSpineText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Canvas-drawn spine face — vertical (bottom-to-top) title, smaller creator
// line beneath it, on a flat color field. Deliberately plain: this is meant
// to read as "a book on a shelf" from across the room, not as a legible
// cover design up close (the click-to-read panel carries the real text).
//
// Scott, 2026-07-23, after the vertical shelf/Babel work: "the books
// themselves are very plain! What could we do to give them a bit more
// pizzazz?" Added, without touching the "no real cover art" rule: a
// per-item tint wash (so two books sharing one of the ~12 palette colors
// don't render as pixel-identical swatches — different dye lots, same
// cloth), a top-lit vertical gradient and a soft left/right vignette (the
// spine reads as a rounded object catching light, not a flat card), 1-2
// embossed horizontal bands above/below the title (old-hardcover binding
// cords), contrast-aware ink color (light spines get dark ink, dark
// spines keep the cream), and font alternation (since replaced — see
// SPINE_FONT below). Fine per-pixel grain was tried and dropped — at the
// on-screen size a spine actually renders at, it mostly vanishes into
// texture minification, the same "too subtle to register" mistake made
// (and fixed) twice already on the Babel backdrop; broad tonal moves like
// these read at any distance.
//
// Scott, 2026-07-23: "change the title font on the media items to a more
// readable, thinner sans-serif font." The serif alternation (Georgia /
// Times New Roman for books, Helvetica Neue / Georgia for CDs) is gone —
// one system sans stack, lighter weight, used for every spine and the CD
// jewel cases alike. Kept to system fonts rather than adding a Google
// webfont: nothing else in the codebase's canvas-drawn textures (orrery's
// posters, butterfly's caption) loads a custom font for canvas text
// either, and doing so here would risk a FOUT-in-a-texture bug — the
// canvas snapshots synchronously, so if the webfont hasn't finished
// loading yet the fallback gets baked in permanently instead of swapping
// in later like real DOM text would.
const SPINE_FONT = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
function relLuminance(hex) {
  const col = new THREE.Color(hex);
  return 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
}

function makeSpineTexture(baseColor, title, creator, isBox) {
  const c = document.createElement('canvas');
  c.width = 112; c.height = 800;
  const cx = c.getContext('2d');
  cx.fillStyle = baseColor;
  cx.fillRect(0, 0, c.width, c.height);

  // Per-item tint wash — same base swatch, different dye lot each time.
  const tr = Math.floor(hash01(title, 'tr') * 255);
  const tg = Math.floor(hash01(title, 'tg') * 255);
  const tb = Math.floor(hash01(title, 'tb') * 255);
  cx.fillStyle = `rgba(${tr},${tg},${tb},0.07)`;
  cx.fillRect(0, 0, c.width, c.height);

  // Top-lit vertical gradient — light catching the spine from above,
  // rather than a flat, evenly-lit swatch.
  const vgrad = cx.createLinearGradient(0, 0, 0, c.height);
  vgrad.addColorStop(0, 'rgba(255,255,255,0.18)');
  vgrad.addColorStop(0.45, 'rgba(255,255,255,0)');
  vgrad.addColorStop(1, 'rgba(0,0,0,0.24)');
  cx.fillStyle = vgrad;
  cx.fillRect(0, 0, c.width, c.height);

  // Left/right vignette — the spine's slight roundedness, not a flat card.
  const hgrad = cx.createLinearGradient(0, 0, c.width, 0);
  hgrad.addColorStop(0, 'rgba(0,0,0,0.3)');
  hgrad.addColorStop(0.14, 'rgba(0,0,0,0)');
  hgrad.addColorStop(0.86, 'rgba(0,0,0,0)');
  hgrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  cx.fillStyle = hgrad;
  cx.fillRect(0, 0, c.width, c.height);

  if (isBox) {
    // A scattering of small dots standing in for the starry/celestial
    // boxes on the real shelf (Kim Krans' Tarot/Alchemy decks) — an
    // abstraction, not a reproduction of the real box art. A few thin
    // constellation lines between nearby dots read as a considered
    // pattern rather than scattered confetti.
    const dotCount = 22;
    const pts = [];
    for (let i = 0; i < dotCount; i++) {
      pts.push({
        x: hash01(title, `dotx${i}`) * c.width,
        y: hash01(title, `doty${i}`) * c.height,
        r: 0.6 + hash01(title, `dotr${i}`) * 1.3,
      });
    }
    cx.strokeStyle = 'rgba(255,255,255,0.16)';
    cx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const a = pts[Math.floor(hash01(title, `la${i}`) * pts.length)];
      const b = pts[Math.floor(hash01(title, `lb${i}`) * pts.length)];
      if (a === b) continue;
      cx.beginPath();
      cx.moveTo(a.x, a.y);
      cx.lineTo(b.x, b.y);
      cx.stroke();
    }
    cx.fillStyle = 'rgba(255,255,255,0.5)';
    pts.forEach(p => {
      cx.beginPath();
      cx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      cx.fill();
    });
  } else {
    // A thin top/bottom rule, like foil-stamped spine caps.
    cx.fillStyle = 'rgba(255,255,255,0.18)';
    cx.fillRect(0, 10, c.width, 3);
    cx.fillRect(0, c.height - 13, c.width, 3);

    // 1-2 embossed bands above and/or below the title block — the raised
    // binding cords on an old hardcover, kept clear of the text itself.
    const bandSpots = [0.1 + hash01(title, 'b0') * 0.12, 0.8 + hash01(title, 'b1') * 0.12];
    bandSpots.forEach((frac, i) => {
      if (i === 1 && hash01(title, 'bskip') > 0.7) return; // not every spine gets both
      const by = c.height * frac;
      cx.fillStyle = 'rgba(0,0,0,0.22)';
      cx.fillRect(0, by, c.width, 3);
      cx.fillStyle = 'rgba(255,255,255,0.12)';
      cx.fillRect(0, by + 3, c.width, 1);
    });
  }

  // Contrast-aware ink: the palette runs from near-black to pale tan, so
  // one fixed cream text color read poorly against the lightest spines.
  const lum = relLuminance(baseColor);
  const inkTitle = lum > 0.55 ? 'rgba(32,26,20,0.88)' : 'rgba(240,236,224,0.92)';
  const inkCreator = lum > 0.55 ? 'rgba(32,26,20,0.6)' : 'rgba(240,236,224,0.62)';

  cx.save();
  cx.translate(c.width / 2, c.height / 2);
  cx.rotate(-Math.PI / 2);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = inkTitle;
  cx.font = `400 34px ${SPINE_FONT}`;
  const lines = wrapSpineText(title, 26).slice(0, 3);
  const lineH = 40;
  const startY = -((lines.length - 1) * lineH) / 2 - (creator ? 14 : 0);
  lines.forEach((line, i) => cx.fillText(line, 0, startY + i * lineH));
  if (creator) {
    cx.font = `italic 300 22px ${SPINE_FONT}`;
    cx.fillStyle = inkCreator;
    cx.fillText(creator.split(' · ')[0].split(' (')[0], 0, startY + lines.length * lineH + 6);
  }
  cx.restore();

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function cubbyLeft(col) { return -TOTAL_W / 2 + FRAME_T + (col - 1) * (CUBBY_W + FRAME_T); }
function cubbyTop(row) { return TOTAL_H / 2 - FRAME_T - (row - 1) * (CUBBY_H + FRAME_T); }

// Canvas-drawn CD spine — same "no real cover art" rule as makeSpineTexture,
// simplified for a jewel-case spine rather than a book: album title (larger,
// vertical) over a smaller artist line, on a glossier flat color field. No
// dye-wash/embossed-band/dot-constellation treatment the books get — the
// spine is thin enough on screen that that detail would just be noise; a
// simple top-lit gradient plus contrast-aware ink is enough for it to read
// as "a CD," not "a thin book."
function makeCdSpineTexture(baseColor, artist, album) {
  const c = document.createElement('canvas');
  c.width = 72; c.height = 640;
  const cx = c.getContext('2d');
  cx.fillStyle = baseColor;
  cx.fillRect(0, 0, c.width, c.height);

  const vgrad = cx.createLinearGradient(0, 0, 0, c.height);
  vgrad.addColorStop(0, 'rgba(255,255,255,0.3)');
  vgrad.addColorStop(0.5, 'rgba(255,255,255,0)');
  vgrad.addColorStop(1, 'rgba(0,0,0,0.32)');
  cx.fillStyle = vgrad;
  cx.fillRect(0, 0, c.width, c.height);

  const lum = relLuminance(baseColor);
  const ink = lum > 0.55 ? 'rgba(26,22,18,0.88)' : 'rgba(238,234,222,0.92)';
  const inkSub = lum > 0.55 ? 'rgba(26,22,18,0.58)' : 'rgba(238,234,222,0.62)';

  cx.save();
  cx.translate(c.width / 2, c.height / 2);
  cx.rotate(-Math.PI / 2);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.font = `400 30px ${SPINE_FONT}`;
  cx.fillStyle = ink;
  const albumLines = wrapSpineText(album, 24).slice(0, 2);
  const lineH = 34;
  const startY = -((albumLines.length - 1) * lineH) / 2 - 12;
  albumLines.forEach((line, i) => cx.fillText(line, 0, startY + i * lineH));
  cx.font = `italic 300 19px ${SPINE_FONT}`;
  cx.fillStyle = inkSub;
  cx.fillText(artist, 0, startY + albumLines.length * lineH + 10);
  cx.restore();

  return new THREE.CanvasTexture(c);
}

// Distributes the 114 CDs across the same 8 cubbies the books/films already
// live in (row-major reading order), in catalog order so the genre lanes
// cdRack.js was built in mostly stay together within a cubby. Scott, after
// seeing them render as one tidy block at the end of each cubby: "mix up the
// order slightly so it looks like a slightly disorganized bookshelf" — so
// rather than appending (pos = existing max + 1, 2, 3...), each CD is
// slotted in among the existing books instead of after all of them.
//
// It turns out library.js's pos numbers aren't a dense 0..N sequence —
// several cubbies have an early cluster (0-10) and a late cluster (100+),
// a gap left over from whenever those items were appended in a separate
// batch. Scattering CDs by raw pos value filled that dead numeric gap with
// a solid run of 8-10 CDs in a row — a block again, just relocated to the
// middle. Fixed by working in *rank* space instead of raw pos: each CD
// gets a fractional rank relative to the sorted existing books, which
// rankToPos() below maps onto the real book pos values by interpolation
// — so CDs land proportionally to where books actually are, not where
// empty pos numbers happen to be.
//
// First pass at the rank itself gave each CD its own even-width band
// (rank = j*bandW + jitter) so every one landed guaranteed-scattered —
// but evenly-spaced-plus-jitter reads as its own pattern (near-perfect
// book/CD/book/CD alternation), which Scott flagged as "a different kind
// of pattern" rather than mess. Switched to a plain random rank per CD
// (hash01 over the full range, no forced spacing) — real disorder has
// clumps and gaps, not a rhythm.
// Returns items already shaped like a libraryItems entry (type/title/creator/
// row/col/pos) so buildItems can treat them identically — the CD-specific
// artist/album fields ride along too, for the tooltip.
function rankToPos(sortedPos, rank) {
  const n = sortedPos.length;
  if (n === 0) return rank;
  const idx = Math.floor(rank);
  const frac = rank - idx;
  if (idx >= n - 1) return sortedPos[n - 1] + frac + (idx - (n - 1));
  return sortedPos[idx] + frac * (sortedPos[idx + 1] - sortedPos[idx]);
}

function placeCdsInCubbies() {
  const byKey = new Map();
  libraryItems.forEach(it => {
    const key = `${it.row}-${it.col}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(it.pos);
  });
  byKey.forEach(arr => arr.sort((a, b) => a - b));

  const cubbies = [];
  for (let row = 1; row <= COLS; row++) {
    for (let col = 1; col <= ROWS; col++) cubbies.push({ row, col });
  }

  const perCubby = Math.ceil(cdRackItems.length / cubbies.length);
  const placed = [];
  cubbies.forEach(({ row, col }, i) => {
    const key = `${row}-${col}`;
    const sortedPos = byKey.get(key) || [];
    const cds = cdRackItems.slice(i * perCubby, (i + 1) * perCubby);
    // Plain random rank per CD (own hash, full range, no forced spacing),
    // then mapped to an actual pos via rankToPos so it follows real book
    // density instead of raw pos numbers.
    cds.forEach(cd => {
      const rank = hash01(`${cd.artist}|${cd.album}`, 'shelfmix') * (sortedPos.length + 1.5);
      const pos = rankToPos(sortedPos, rank);
      placed.push({
        id: `cd-${cd.id}`, type: 'cd', title: cd.album, creator: cd.artist,
        artist: cd.artist, album: cd.album, row, col, pos,
      });
    });
  });
  return placed;
}

// ─── Shelf frame ────────────────────────────────────────────────────────────
function buildFrame() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.85, metalness: 0.02 });
  const geos = [];

  function box(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  // Verticals (left edge, 3 dividers, right edge)
  for (let i = 0; i <= COLS; i++) {
    const x = -TOTAL_W / 2 + FRAME_T / 2 + i * (CUBBY_W + FRAME_T);
    box(FRAME_T, TOTAL_H, CUBBY_D, x, 0, 0);
  }
  // Horizontals (top edge, 1 divider, bottom edge)
  for (let i = 0; i <= ROWS; i++) {
    const y = TOTAL_H / 2 - FRAME_T / 2 - i * (CUBBY_H + FRAME_T);
    box(TOTAL_W, FRAME_T, CUBBY_D, 0, y, 0);
  }
  // Back panel, thin — closes the cubbies visually from behind.
  box(TOTAL_W, TOTAL_H, 0.04, 0, 0, -CUBBY_D / 2 - 0.02);

  return { group, mat, geos };
}

// ─── Library of Babel backdrop ──────────────────────────────────────────────
// Scott, 2026-07-23: "what if we treated this bookshelf as a real-world
// extrusion of Borges' Library of Babel? Faintly seen through the Veil in
// the background" — then, clarifying: "the Library of Babel is faintly
// seen through the Veil, the bookshelf looks normal." So: the shelf's own
// materials/lighting are untouched: this is a second, separate layer, a
// receding stack of hexagonal gallery outlines (Borges' library is built
// of identical connected hexagonal rooms, unbroken and — as far as anyone
// inside it can tell — infinite) placed well behind the shelf's back
// panel. scene.fog (matched to the clear color, same trick as orrery.js)
// is what makes it read as "faintly seen through the Veil" rather than
// crisply rendered architecture: the nearest hexagons are just barely
// legible, and the fog swallows the rest into black before the eye can
// resolve how far the recession actually goes — which is the point; the
// Veil is Scott's own term (documented at length in archive_against_library
// .md) for the perceptual screen between ordinary reality and what lies
// past it, so this is deliberately NOT fully renderable.
//
// Second pass (v1.0.61) built a single stack of concentric rings sharing
// one center on-axis behind the shelf — a "tunnel," not a lattice, which
// is also why it swung dramatically to one side under a slight drag.
// Third pass (v1.0.63) fixed that by tiling a proper edge-sharing
// honeycomb across two flat planes behind the shelf.
//
// Fourth pass, Scott: "let's detach the hexagons so they don't form a
// honeycomb pattern, just hexagons attached by strands, and let's make
// the Library of Babel 3d around it... think of it like what you did
// with the butterfly's phase space" — i.e. butterfly.js's volumetric
// spider-silk grid, which fills a real 3D cube around the Lorenz
// attractor rather than sitting behind it as a flat backdrop. So: no
// more shared edges, no more flat planes. Independent hexagon "gallery"
// nodes are scattered through a cube surrounding the shelf on every
// side, each tumbled to its own random 3D orientation, linked to its
// nearest neighbors by thin strand-rods (Borges' galleries connect to
// each other, not tile seamlessly into one surface). A keep-out column
// matching the shelf's own x/y footprint (through every z) keeps any
// node or strand from ever drawing across the shelf's own books —
// "the bookshelf looks normal" still holds, now from every angle, not
// just head-on.
function hexEdgeLocalTransforms(r) {
  const apothem = r * Math.cos(Math.PI / 6);
  const out = [];
  for (let k = 0; k < 6; k++) {
    const thetaMid = Math.PI / 6 + (k + 0.5) * (Math.PI / 3);
    out.push({
      x: apothem * Math.cos(thetaMid),
      y: apothem * Math.sin(thetaMid),
      rotZ: thetaMid + Math.PI / 2,
      length: r, // regular hexagon: edge length equals circumradius
    });
  }
  return out;
}

function buildBabelBackdrop() {
  const group = new THREE.Group();
  const disposables = [];

  // ── Node field: jittered 3D grid, thinned and tumbled, so it reads as
  // scattered galleries rather than a mechanical lattice. Density raised
  // from the first detached-field pass (v1.0.64, ~75 nodes/87 strands)
  // per Scott: "moar hexes and strands."
  const nodes = [];
  const extent = 9.5;
  const step = 2.9;
  const keepOutX = TOTAL_W / 2 + 0.7;
  const keepOutY = TOTAL_H / 2 + 0.7;
  let ni = 0;
  for (let gx = -extent; gx <= extent; gx += step) {
    for (let gy = -extent; gy <= extent; gy += step) {
      for (let gz = -extent; gz <= extent; gz += step) {
        ni++;
        // Keep-out column matches the shelf's own width/height at every
        // depth, not just around its physical thickness — so nothing
        // ever renders in front of or behind the shelf's own silhouette.
        if (Math.abs(gx) < keepOutX && Math.abs(gy) < keepOutY) continue;
        if (hash01(`babel-skip-${ni}`, 'k') > 0.58) continue; // thin the field
        const jit = step * 0.75;
        nodes.push({
          pos: new THREE.Vector3(
            gx + (hash01(`babel-jx-${ni}`, 'x') - 0.5) * jit,
            gy + (hash01(`babel-jy-${ni}`, 'y') - 0.5) * jit,
            gz + (hash01(`babel-jz-${ni}`, 'z') - 0.5) * jit,
          ),
          rx: (hash01(`babel-rx-${ni}`, 'a') - 0.5) * Math.PI,
          ry: (hash01(`babel-ry-${ni}`, 'b') - 0.5) * Math.PI,
          rz: (hash01(`babel-rz-${ni}`, 'c') - 0.5) * Math.PI,
          r: 0.5 + hash01(`babel-r-${ni}`, 'd') * 0.4,
          // Shimmer, per node — same idea as egg.js's per-line flux phase/
          // speed pairs, so the whole field doesn't pulse in lockstep.
          phase: hash01(`babel-ph-${ni}`, 'p') * Math.PI * 2,
          speed: 0.25 + hash01(`babel-sp-${ni}`, 's') * 0.35,
        });
      }
    }
  }

  // ── Hexagon edges: one InstancedMesh for every node's outline, each
  // tumbled to its own orientation (node transform composed with each
  // edge's local placement in the hex's own plane). All 6 edges of a
  // given hex share that node's shimmer phase, so a hexagon brightens
  // and dims as one gallery, not six flickering pieces.
  const edgeColor = new THREE.Color(0x92a9d8);
  const edgeGeo = new THREE.BoxGeometry(1, 0.045, 0.045);
  const edgeMat = new THREE.MeshBasicMaterial({
    color: edgeColor, transparent: true, opacity: 0.26, depthWrite: false, fog: true,
  });
  const edgeMesh = new THREE.InstancedMesh(edgeGeo, edgeMat, nodes.length * 6);
  disposables.push(edgeGeo, edgeMat);

  const dummy = new THREE.Object3D();
  const local = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  let ei = 0;
  nodes.forEach(node => {
    dummy.position.copy(node.pos);
    dummy.rotation.set(node.rx, node.ry, node.rz);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    const nodeMatrix = dummy.matrix.clone();
    node.edgeStart = ei;
    hexEdgeLocalTransforms(node.r).forEach(e => {
      local.position.set(e.x, e.y, 0);
      local.rotation.set(0, 0, e.rotZ);
      local.scale.set(e.length, 1, 1);
      local.updateMatrix();
      edgeMesh.setMatrixAt(ei, nodeMatrix.clone().multiply(local.matrix));
      edgeMesh.setColorAt(ei, edgeColor);
      ei++;
    });
  });
  edgeMesh.instanceMatrix.needsUpdate = true;
  edgeMesh.instanceColor.needsUpdate = true;
  group.add(edgeMesh);

  // ── Strands: connect each node to its nearest neighbors so the field
  // reads as a network, not scattered confetti. Computed once at build
  // time — O(n^2) over a couple hundred nodes is still trivial.
  const strandPairs = [];
  const seen = new Set();
  const maxStrandLen = 6.0;
  nodes.forEach((node, i) => {
    const dists = nodes
      .map((other, j) => (i === j ? null : { j, d: node.pos.distanceTo(other.pos) }))
      .filter(Boolean)
      .sort((a, b) => a.d - b.d);
    let linked = 0;
    for (const { j, d } of dists) {
      if (linked >= 2 || d > maxStrandLen) break;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        strandPairs.push([i, j]);
      }
      linked++;
    }
  });

  let strandMesh = null;
  const strandColor = new THREE.Color(0x7f96c2);
  const strandPhases = [];
  if (strandPairs.length) {
    // Thickness/opacity deliberately close to the hex edges', not fainter —
    // a first pass at 0.02 thickness / 0.16 opacity repeated the exact
    // "too thin to actually render" mistake the very first backdrop
    // attempt made with 1px LineLoop hexagons (v1.0.61): Scott couldn't
    // tell if the strands were showing at all, because they mostly
    // weren't, on a rod this thin over multi-unit lengths.
    const strandGeo = new THREE.BoxGeometry(1, 0.038, 0.038);
    const strandMat = new THREE.MeshBasicMaterial({
      color: strandColor, transparent: true, opacity: 0.24, depthWrite: false, fog: true,
    });
    strandMesh = new THREE.InstancedMesh(strandGeo, strandMat, strandPairs.length);
    disposables.push(strandGeo, strandMat);

    strandPairs.forEach(([i, j], si) => {
      const a = nodes[i].pos, b = nodes[j].pos;
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0), dir.clone().normalize(),
      );
      dummy.position.copy(mid);
      dummy.quaternion.copy(quat);
      dummy.scale.set(len, 1, 1);
      dummy.updateMatrix();
      strandMesh.setMatrixAt(si, dummy.matrix);
      strandMesh.setColorAt(si, strandColor);
      strandPhases.push({
        phase: hash01(`babel-strand-ph-${si}`, 'p') * Math.PI * 2,
        speed: 0.2 + hash01(`babel-strand-sp-${si}`, 's') * 0.3,
      });
    });
    strandMesh.instanceMatrix.needsUpdate = true;
    strandMesh.instanceColor.needsUpdate = true;
    group.add(strandMesh);
  }

  // Shimmer: rather than per-instance materials (impractical at this
  // instance count), fake per-instance opacity by darkening each
  // instance's own color toward black — since the backdrop always sits
  // against the scene's pure-black clear color, dimming color reads
  // identically to dimming opacity, at a fraction of the cost. Skipped
  // entirely under prefers-reduced-motion by the caller.
  function update(t) {
    nodes.forEach(node => {
      const b = 0.55 + Math.sin(t * node.speed + node.phase) * 0.45;
      tmpColor.copy(edgeColor).multiplyScalar(Math.max(0.12, b));
      for (let k = 0; k < 6; k++) edgeMesh.setColorAt(node.edgeStart + k, tmpColor);
    });
    edgeMesh.instanceColor.needsUpdate = true;

    if (strandMesh) {
      strandPhases.forEach((sp, si) => {
        const b = 0.55 + Math.sin(t * sp.speed + sp.phase) * 0.45;
        tmpColor.copy(strandColor).multiplyScalar(Math.max(0.12, b));
        strandMesh.setColorAt(si, tmpColor);
      });
      strandMesh.instanceColor.needsUpdate = true;
    }
  }

  return { group, disposables, update };
}

// ─── Items (books/dvds/blurays/boxes) ──────────────────────────────────────
function buildItems(preview) {
  const group = new THREE.Group();
  const meshes = [];
  const disposables = [];

  // Group items by cubby so widths can be distributed to exactly fill
  // each cubby's available width regardless of how many items landed
  // there (6 on the low end, 25 on the high end, on the real shelf —
  // now with the 114 CDs from placeCdsInCubbies() appended on top).
  const byCubby = new Map();
  [...libraryItems, ...placeCdsInCubbies()].forEach(it => {
    const key = `${it.row}-${it.col}`;
    if (!byCubby.has(key)) byCubby.set(key, []);
    byCubby.get(key).push(it);
  });

  const padX = 0.06;
  const gap = 0.006;
  const floorGap = 0.025;

  byCubby.forEach(items => {
    items.sort((a, b) => a.pos - b.pos);
    const { row, col } = items[0];
    // Transposed for the vertical shelf: old row (1-2) now walks the new
    // 2-wide axis, old col (1-4) now walks the new 4-tall axis — a clean
    // 90-degree rotation of the same cubbies, item row/col values untouched.
    const left = cubbyLeft(row);
    const top = cubbyTop(col);
    const availW = CUBBY_W - padX * 2 - gap * (items.length - 1);

    const weights = items.map(it => {
      const isBox = it.type === 'divination_box';
      const isCd = it.type === 'cd';
      // CDs are thin jewel cases, not much wider than their own gloss —
      // about half a book's width on the shelf.
      const base = isBox ? 2.2 : isCd ? 0.5 : 1.0;
      const jitter = hash01(it.title, 'w') * 0.6;
      return base + jitter;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let cursorX = left + padX;
    items.forEach((it, i) => {
      const isBox = it.type === 'divination_box';
      const isDisc = it.type === 'dvd' || it.type === 'bluray';
      const isCd = it.type === 'cd';
      const w = (weights[i] / totalWeight) * availW;

      const heightFactor = isBox
        ? 0.36 + hash01(it.title, 'h') * 0.1
        : isDisc
        ? 0.76 + hash01(it.title, 'h') * 0.08
        : isCd
        ? 0.5 + hash01(it.title, 'h') * 0.1
        : 0.8 + hash01(it.title, 'h') * 0.18;
      const h = CUBBY_H * heightFactor;

      const depth = isBox
        ? 0.32 + hash01(it.title, 'd') * 0.1
        : isDisc || isCd
        ? 0.12 + hash01(it.title, 'd') * 0.04
        : 0.68 + hash01(it.title, 'd') * 0.16;

      const palette = isBox ? BOX_PALETTE : PALETTE;
      const color = palette[hash(it.title) % palette.length];

      const x = cursorX + w / 2;
      const y = top - CUBBY_H + floorGap + h / 2;
      const z = CUBBY_D / 2 - depth / 2 - 0.01;

      const geo = new THREE.BoxGeometry(Math.max(w, 0.02), h, depth);
      disposables.push(geo);

      let mats;
      if (preview) {
        const flat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
        disposables.push(flat);
        mats = flat;
      } else {
        const tex = isCd
          ? makeCdSpineTexture(color, it.creator, it.title)
          : makeSpineTexture(color, it.title, it.creator, isBox);
        // Finish variety — most spines are a matte cloth/paper binding,
        // a minority (~1 in 5) a glossier trade-paperback laminate, so
        // the shelf doesn't read as one uniform plastic material.
        const isGlossy = hash01(it.title, 'gloss') > 0.8;
        const rough = isGlossy ? 0.35 + hash01(it.title, 'r2') * 0.15 : 0.72 + hash01(it.title, 'r2') * 0.18;
        const metal = isGlossy ? 0.05 : 0;
        // Side/back faces shaded darker than the front — the same base
        // color otherwise made every face of the box read as one flat
        // plane rather than a real 3D object catching light unevenly.
        const sideColor = new THREE.Color(color).multiplyScalar(0.82);
        const backColor = new THREE.Color(color).multiplyScalar(0.7);
        const front = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: metal });
        const side = new THREE.MeshStandardMaterial({ color: sideColor, roughness: rough });
        const pageColor = it.type === 'book' ? '#e9e3d2' : color;
        const pages = new THREE.MeshStandardMaterial({ color: pageColor, roughness: 0.9 });
        const back = new THREE.MeshStandardMaterial({ color: backColor, roughness: rough });
        disposables.push(tex, front, side, pages, back);
        mats = [side, side, pages, pages, front, back];
      }

      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(x, y, z);
      mesh.userData.item = it;
      group.add(mesh);
      meshes.push(mesh);

      cursorX += w + gap;
    });
  });

  return { group, meshes, disposables };
}

export function createLibrary(container, { preview = false } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  // Pulled back from the old 8.5/7.2 landscape framing — the vertical
  // shelf's TOTAL_H is now the tall side (~7.25 vs the old ~3.67), so the
  // camera needs more room to keep it in frame.
  const baseDist = preview ? 14 : 12;
  camera.position.set(0, 0.15, baseDist);
  camera.lookAt(0, 0, 0);
  // Fog matched to the clear color, same convention as orrery.js — kept
  // well past maxDist so the shelf itself never fogs at any zoom level;
  // it only ever dims the Library of Babel backdrop receding behind it.
  scene.fog = new THREE.Fog(0x000000, 18, 56);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  scene.add(root);

  scene.add(new THREE.AmbientLight(0xfff4e0, 0.7));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.1);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fa8ff, 0.4);
  rim.position.set(-5, -2, -4);
  scene.add(rim);

  // Library of Babel first, so it's fully behind the frame/items in the
  // group's draw order as well as in depth — added under root, not scene,
  // so it turns together with the shelf under drag rather than sitting
  // fixed like a skybox.
  const babel = buildBabelBackdrop();
  root.add(babel.group);

  const frame = buildFrame();
  root.add(frame.group);

  // Books, films, divination decks, and now CDs — buildItems() places the
  // CDs among them via placeCdsInCubbies() (see the CDs header comment
  // above), all one shelf, one group, one everything below.
  const items = buildItems(preview);
  root.add(items.group);

  // ─── Caption + hint + panel (full only) ─────────────────────────────────
  let caption = null, hint = null, panel = null, panelTitle = null, panelCreator = null, panelBodyEl = null;
  // Programmatically focusable so closing the panel (✕, outside click, or
  // Escape) has somewhere real to send focus back to, rather than leaving
  // it on a now-hidden close button or nowhere at all.
  if (!preview) container.tabIndex = -1;
  if (!preview && !document.getElementById('library-styles')) {
    const style = document.createElement('style');
    style.id = 'library-styles';
    style.textContent = `
      #library-caption, #library-hint {
        position: fixed; color: rgba(255,255,255,0.35);
        pointer-events: none; text-align: center; z-index: 310;
        font-family: 'Times New Roman', serif;
      }
      #library-caption {
        bottom: 3rem; left: 50%; transform: translateX(-50%);
        font-size: clamp(0.7rem, 1.6vw, 0.95rem); letter-spacing: 0.06em;
        font-style: italic; white-space: nowrap;
        color: rgba(230,215,180,0.55);
      }
      #library-hint {
        top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
        text-transform: uppercase; line-height: 1.8; text-align: right;
        color: rgba(255,255,255,0.3);
      }
      @media (max-width: 600px) {
        #library-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
      }
      #library-panel {
        position: absolute; top: 0; right: 0; width: 34%; height: 100%;
        background: #0a0806; border-left: 1px solid rgba(230,215,180,0.15);
        padding: 3rem 2rem; transform: translateX(100%);
        transition: transform .5s cubic-bezier(.16,1,.3,1);
        overflow-y: auto; z-index: 10;
        scrollbar-color: rgba(230,215,180,0.3) #0a0806; scrollbar-width: thin;
        font-family: 'Times New Roman', serif;
      }
      #library-panel.open { transform: translateX(0); }
      /* Enters from whichever side of the screen was actually clicked --
         same convention as sphere.js. .from-left is toggled in JS right
         before opening; .no-transition suppresses the flip's own
         transition for one frame so it happens while the panel is still
         off-screen, not visibly. The closed-state transform has to flip
         too (-100% instead of 100%) once the panel is left-anchored,
         otherwise a from-left panel closes by sliding to translateX(100%)
         of ITS OWN width while positioned at left:0 -- which lands it
         sitting in the middle of the screen instead of off-screen. The
         .from-left.open compound rule (higher specificity than either
         single-class rule) guarantees the open state still wins when
         both classes are present, regardless of declaration order. */
      #library-panel.from-left {
        left: 0; right: auto;
        border-left: none; border-right: 1px solid rgba(230,215,180,0.15);
        transform: translateX(-100%);
      }
      #library-panel.from-left.open { transform: translateX(0); }
      #library-panel.no-transition { transition: none !important; }
      #library-panel-kind {
        font-size: 0.65rem; letter-spacing: 0.25em; text-transform: uppercase;
        color: rgba(230,215,180,0.5); margin-bottom: 0.6rem;
      }
      #library-panel-title {
        font-size: 1.15rem; letter-spacing: 0.03em;
        color: rgba(245,238,222,0.92); line-height: 1.4;
        border-bottom: 1px solid rgba(230,215,180,0.15);
        padding-bottom: 1.4rem; margin-bottom: 1.4rem;
      }
      #library-panel-creator { color: rgba(230,220,200,0.7); font-size: 0.95rem; font-style: italic; }
      #library-panel-details {
        margin-top: 1.4rem; padding-top: 1.2rem;
        border-top: 1px solid rgba(230,215,180,0.1);
        color: rgba(220,210,195,0.72); font-size: 0.85rem; line-height: 1.9;
      }
      #library-panel-details p { margin: 0 0 0.3rem; }
      #library-panel-note {
        color: rgba(220,190,140,0.6); font-size: 0.8rem; font-style: italic;
        line-height: 1.6; margin-top: 0.9rem;
      }
      #library-panel-excerpt {
        margin: 0 0 1.4rem;
        color: rgba(235,228,210,0.88); font-size: 0.98rem;
        font-style: italic; line-height: 1.8;
      }
      #library-panel-excerpt:empty { display: none; margin: 0; }
      #library-panel-cover {
        display: block; max-width: 42%; height: auto;
        float: left; margin: 0 1.1rem 0.6rem 0;
        border: 1px solid rgba(230,215,180,0.15);
      }
      #library-panel-cover[hidden] { display: none; }
      #library-panel-video {
        margin: 0 0 1.4rem; position: relative;
        width: 100%; aspect-ratio: 16 / 9;
      }
      #library-panel-video:empty { display: none; margin: 0; }
      #library-panel-video iframe {
        position: absolute; inset: 0; width: 100%; height: 100%;
        border: 1px solid rgba(230,215,180,0.15);
      }
      #library-panel-scene {
        display: block; margin: 0.6rem 0 1.4rem;
        color: rgba(220,210,195,0.6); font-size: 0.8rem;
        font-style: italic; clear: both;
      }
      #library-panel-scene:empty { display: none; margin: 0; }
      #library-panel-close {
        position: absolute; top: 1.5rem; right: 1.5rem; background: none;
        border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
        cursor: pointer; padding: .5rem; z-index: 2;
      }
      #library-panel-close:hover { color: rgba(255,255,255,0.9); }
      #library-panel-excerpt-from {
        margin: -1rem 0 1.4rem; color: rgba(220,210,195,0.5);
        font-size: 0.78rem; font-style: italic; line-height: 1.6;
      }
      #library-panel-excerpt-from:empty { display: none; margin: 0; }
      /* Cross-links, same mechanism as sphere.js's fragment-link and egg.js's
         poem-link: a phrase glimmers faintly on its own slow loop so a link
         reads as "alive" even before it's noticed, tuned to library's own
         warm parchment/gold palette instead of sphere's blue or egg's green. */
      @keyframes library-glimmer {
        0%, 85%, 100% { color: inherit; text-shadow: none; }
        92% { color: rgba(225,175,90,.6); text-shadow: 0 0 6px rgba(225,175,90,.2); }
      }
      .library-link {
        color: inherit; text-decoration: none;
        border-bottom: 1px dotted rgba(225,175,90,.35);
        cursor: pointer; transition: color .2s;
        animation: library-glimmer 12s ease-in-out infinite;
      }
      .library-link:hover, .library-link:focus {
        color: rgba(230,180,95,.95); text-shadow: 0 0 10px rgba(230,180,95,.3);
        animation: none; outline: none;
      }
      @media (prefers-reduced-motion: reduce) { .library-link { animation: none; } }
      @media (max-width: 700px) {
        #library-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
      }
      /* CD rack tooltip — deliberately much lighter than the book panel:
         no kind/details/note/cross-links, just artist, album, and the two
         search-links. Click/tap only (Scott, 2026-07-23: "forget the hover
         tooltip, change to onclick") — one click shows it, pinned open
         until the next click anywhere — see showCdTooltip/hideCdTooltip
         and onContainerClick below. */
      #cd-tooltip {
        position: fixed; z-index: 320; pointer-events: auto;
        background: #0a0806; border: 1px solid rgba(230,215,180,0.25);
        padding: 0.7rem 0.95rem; max-width: ${CD_TOOLTIP_MAX_W}px;
        font-family: 'Times New Roman', serif;
        color: rgba(235,228,210,0.92); font-size: 0.82rem; line-height: 1.5;
        box-shadow: 0 6px 22px rgba(0,0,0,0.45);
      }
      #cd-tooltip[hidden] { display: none; }
      #cd-tooltip .cd-tooltip-album {
        display: block; margin-bottom: 0.15rem; font-style: italic;
        color: rgba(245,238,222,0.95);
      }
      #cd-tooltip .cd-tooltip-artist {
        display: block; margin-bottom: 0.55rem;
        color: rgba(220,210,195,0.72); font-size: 0.78rem;
      }
      #cd-tooltip .cd-tooltip-links { display: flex; gap: 0.8rem; }
      #cd-tooltip .cd-tooltip-links a {
        color: rgba(230,180,95,0.9); text-decoration: none;
        font-size: 0.72rem; letter-spacing: 0.05em; text-transform: uppercase;
        border-bottom: 1px dotted rgba(230,180,95,0.4);
      }
      #cd-tooltip .cd-tooltip-links a:hover,
      #cd-tooltip .cd-tooltip-links a:focus { color: rgba(240,195,110,1); outline: none; }
    `;
    document.head.appendChild(style);
  }
  if (!preview) {
    caption = document.createElement('p');
    caption.id = 'library-caption';
    caption.textContent = 'the library — once removed';
    caption.setAttribute('aria-hidden', 'true');
    document.body.appendChild(caption);

    hint = document.createElement('p');
    hint.id = 'library-hint';
    hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; scroll to zoom &nbsp;·&nbsp; click a spine to read &nbsp;·&nbsp; click a CD for links';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    panel = document.createElement('aside');
    panel.id = 'library-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'library-panel-title');
    panel.innerHTML = `
      <button type="button" id="library-panel-close" aria-label="Close panel">✕</button>
      <div id="library-panel-body">
        <div id="library-panel-kind"></div>
        <div id="library-panel-title" tabindex="-1"></div>
        <div id="library-panel-creator"></div>
        <div id="library-panel-video"></div>
        <p id="library-panel-scene"></p>
        <img id="library-panel-cover" hidden alt="" />
        <p id="library-panel-excerpt"></p>
        <p id="library-panel-excerpt-from"></p>
        <div id="library-panel-details"></div>
        <p id="library-panel-note"></p>
      </div>
    `;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(panel);
    panelTitle = panel.querySelector('#library-panel-title');
    panelCreator = panel.querySelector('#library-panel-creator');
    panelBodyEl = panel.querySelector('#library-panel-body');

    panel.addEventListener('click', e => e.stopPropagation());
    panel.querySelector('#library-panel-close').addEventListener('click', e => {
      e.stopPropagation();
      closePanel();
      container.focus();
    });

    // Cross-link navigation — follow the threads (click + keyboard), same
    // fade-out/swap-content/fade-in beat as sphere.js's navigateToFragment
    // and egg.js's navigateToPoem. Deliberately doesn't touch `selected`/the
    // spine the panel was originally opened from, same precedent those two
    // set — following a link swaps panel content, nothing in the 3D scene.
    // populatePanel (defined below, hoisted) re-stripes every .library-link
    // it renders, so no separate stagger step is needed here.
    function navigateToItem(targetId) {
      const target = libraryItems.find(i => i.id === targetId);
      if (!target) return;
      panelBodyEl.style.transition = 'opacity .18s';
      panelBodyEl.style.opacity = '0';
      setTimeout(() => {
        populatePanel(target);
        panel.scrollTop = 0;
        panelBodyEl.style.opacity = '1';
        setTimeout(() => panelTitle.focus(), 50);
      }, 180);
    }
    panelBodyEl.addEventListener('click', e => {
      const link = e.target.closest('.library-link');
      if (!link) return;
      e.stopPropagation();
      navigateToItem(Number(link.dataset.target));
    });
    panelBodyEl.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const link = e.target.closest('.library-link');
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
      navigateToItem(Number(link.dataset.target));
    });
  }

  // ─── CD rack tooltip ─────────────────────────────────────────────────────
  let cdTooltip = null;
  if (!preview) {
    cdTooltip = document.createElement('div');
    cdTooltip.id = 'cd-tooltip';
    // role="status" (a passive live region) was wrong here — this holds
    // real actionable links, not an announcement, so it gets a dialog role
    // plus a per-album aria-label (set in showCdTooltip) instead.
    cdTooltip.setAttribute('role', 'dialog');
    cdTooltip.hidden = true;
    document.body.appendChild(cdTooltip);
  }

  function cdSearchUrls(cd) {
    const q = `${cd.artist} ${cd.album}`;
    return {
      apple: `https://music.apple.com/search?term=${encodeURIComponent(q)}`,
      spotify: `https://open.spotify.com/search/${encodeURIComponent(q)}`,
    };
  }

  // Clamped near the cursor, flipping to the other side of the pointer
  // rather than running off the edge of the screen — same beat as the
  // book panel's from-left/from-right flip, at tooltip scale.
  function positionCdTooltip(clientX, clientY) {
    if (!cdTooltip) return;
    const pad = 16;
    const rectW = CD_TOOLTIP_MAX_W, rectH = 96; // rectH is a rough estimate — no fixed-height CSS to match
    let left = clientX + pad;
    let top = clientY + pad;
    if (left + rectW > window.innerWidth) left = clientX - rectW - pad;
    if (top + rectH > window.innerHeight) top = clientY - rectH - pad;
    cdTooltip.style.left = `${Math.max(8, left)}px`;
    cdTooltip.style.top = `${Math.max(8, top)}px`;
  }

  function showCdTooltip(cd, clientX, clientY) {
    if (!cdTooltip) return;
    cdTooltip.setAttribute('aria-label', `${cd.album} by ${cd.artist} — search links`);
    const { apple, spotify } = cdSearchUrls(cd);
    cdTooltip.innerHTML = `
      <span class="cd-tooltip-album">${escapeHtml(cd.album)}</span>
      <span class="cd-tooltip-artist">${escapeHtml(cd.artist)}</span>
      <span class="cd-tooltip-links">
        <a href="${apple}" target="_blank" rel="noopener noreferrer">Apple Music</a>
        <a href="${spotify}" target="_blank" rel="noopener noreferrer">Spotify</a>
      </span>`;
    cdTooltip.hidden = false;
    positionCdTooltip(clientX, clientY);
  }

  function hideCdTooltip() {
    if (cdTooltip) cdTooltip.hidden = true;
    pinnedCd = null;
  }

  // Shared by all four ways the book panel can close (✕ button, outside
  // click, Escape, and a CD click landing while it's open) — previously
  // each site repeated the same three statements. Focus management stays
  // with each caller, since not every close should move focus (the
  // in-place item swap, for one, deliberately doesn't call this at all).
  function closePanel() {
    if (!panel) return;
    panel.classList.remove('open');
    panel.querySelector('#library-panel-video').innerHTML = '';
    selected = null;
  }

  // ─── Hover/click raycast, screen-space mouse (matches egg/sphere) ───────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null, selected = null, pinnedCd = null;
  let onContainerMouseMove = null, onContainerClick = null, onContainerMouseLeave = null;

  // Fills the (already-open, or about-to-open) panel with one item's
  // content. Pulled out into its own function so both a direct spine click
  // and following a cross-link (navigateToItem, above) can populate the
  // same panel without duplicating this logic.
  function populatePanel(it) {
    panel.querySelector('#library-panel-kind').textContent =
      ({ book: 'Book', dvd: 'DVD', bluray: 'Blu-ray', divination_box: 'Divination deck' })[it.type] || it.type;
    panelTitle.textContent = it.title;
    panelCreator.textContent = it.creator || '';

    // Bibliographic/filmographic detail lines — only the fields a given
    // item actually has (books carry isbn13/publisher/pages, films carry
    // release_year/runtime/country; not every field applies to every
    // item). See src/text/library.js's header for how these were sourced.
    const detailsEl = panel.querySelector('#library-panel-details');
    const noteEl = panel.querySelector('#library-panel-note');
    const excerptEl = panel.querySelector('#library-panel-excerpt');
    const excerptFromEl = panel.querySelector('#library-panel-excerpt-from');
    const coverEl = panel.querySelector('#library-panel-cover');
    const videoEl = panel.querySelector('#library-panel-video');
    const sceneEl = panel.querySelector('#library-panel-scene');
    const lines = [];
    if (it.publisher) lines.push(`${it.publisher}${it.publish_year ? `, ${it.publish_year}` : ''}`);
    if (it.pages) lines.push(`${it.pages} pages`);
    if (it.isbn13) lines.push(`ISBN ${it.isbn13}`);
    if (it.release_year) lines.push(`${it.release_year}${it.country ? ` · ${it.country}` : ''}`);
    if (it.runtime_min) lines.push(`${it.runtime_min} min`);
    if (it.writer) lines.push(`written by ${it.writer}`);
    if (it.producer) lines.push(`produced by ${it.producer}`);
    detailsEl.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
    // Note text disabled for now (Scott, 2026-07-23: "I'm not sure I want
    // it there yet") -- commented out rather than deleted so it's a
    // one-line revert. Underlying `note` data and the cross-links that
    // live inside it (LIBRARY_LINKS, field: 'note') are untouched.
    // noteEl.innerHTML = it.note ? renderLinkedField(it.id, 'note', it.note) : '';
    noteEl.innerHTML = '';

    // Content area, above the bibliographic details: a film gets its
    // pivotal scene embedded (not just linked), a book gets its excerpt
    // (plain text, not a blockquote, sits above the details block per
    // Scott's request) plus a cover thumbnail when a cover image is
    // publicly available via Open Library's covers API (keyed off the
    // ISBN we already looked up) -- this is the "real image" allowance
    // for the art/photo/reference books that don't have a natural
    // textual excerpt. See src/text/library.js's header for the
    // sourcing/copyright discipline behind these fields. Cross-links
    // (2026-07-23) live inline in note/scene/excerpt/excerpt_from text,
    // rendered via renderLinkedField -- see LIBRARY_LINKS above.
    videoEl.innerHTML = '';
    sceneEl.innerHTML = '';
    if (it.youtube) {
      const embedSrc = youtubeEmbedSrc(it.youtube);
      if (embedSrc) {
        const iframe = document.createElement('iframe');
        iframe.src = embedSrc;
        iframe.title = it.scene ? `${it.title} — ${it.scene}` : it.title;
        iframe.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.loading = 'lazy';
        videoEl.appendChild(iframe);
      }
      sceneEl.innerHTML = it.scene ? `pivotal scene: ${renderLinkedField(it.id, 'scene', it.scene)}` : '';
    }

    excerptEl.innerHTML = it.excerpt ? `“${renderLinkedField(it.id, 'excerpt', it.excerpt)}”` : '';
    excerptFromEl.innerHTML = it.excerpt_from ? `— ${renderLinkedField(it.id, 'excerpt_from', it.excerpt_from)}` : '';

    if (it.isbn13) {
      coverEl.hidden = false;
      coverEl.onerror = () => { coverEl.hidden = true; };
      coverEl.src = `https://covers.openlibrary.org/b/isbn/${it.isbn13}-L.jpg`;
      coverEl.alt = `Cover of ${it.title}`;
    } else {
      coverEl.hidden = true;
      coverEl.removeAttribute('src');
    }

    panel.querySelectorAll('.library-link').forEach(link => {
      const delay = (Math.random() * 12).toFixed(1);
      const duration = (9 + Math.random() * 7).toFixed(1);
      link.style.animationDelay = `-${delay}s`;
      link.style.animationDuration = `${duration}s`;
      const targetItem = libraryItems.find(i => i.id === Number(link.dataset.target));
      link.setAttribute('aria-label', `Go to: ${targetItem ? targetItem.title : 'related item'}`);
    });
  }

  if (!preview) {
    onContainerMouseMove = e => {
      if (panel.classList.contains('open')) return;
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(items.meshes);
      const hitMesh = hits.length ? hits[0].object : null;
      if (hitMesh !== hovered) {
        if (hovered) hovered.scale.set(1, 1, 1);
        hovered = hitMesh;
        if (hovered) hovered.scale.set(1.04, 1.02, 1.15);
      }
      container.style.cursor = hovered ? 'pointer' : 'default';
    };
    container.addEventListener('mousemove', onContainerMouseMove);

    onContainerMouseLeave = () => {
      if (hovered) { hovered.scale.set(1, 1, 1); hovered = null; }
      if (!pinnedCd) hideCdTooltip();
      container.style.cursor = 'default';
    };
    container.addEventListener('mouseleave', onContainerMouseLeave);

    onContainerClick = e => {
      // Reset any pinned CD tooltip on every click; the CD branch below
      // re-pins it if the click actually landed on a CD.
      hideCdTooltip();

      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(items.meshes);
      const hitMesh = hits.length ? hits[0].object : null;
      const it = hitMesh ? hitMesh.userData.item : null;

      if (hitMesh && hovered !== hitMesh) {
        if (hovered) hovered.scale.set(1, 1, 1);
        hovered = hitMesh;
        hovered.scale.set(1.04, 1.02, 1.15);
      }

      // CDs never open the book panel — same shelf, same raycast, but a
      // click/tap on one just pins the tooltip (artist, album, search
      // links) open until the next click anywhere. See the CDs header
      // comment above for why this stayed a separate, lighter interaction
      // even after CDs moved into the same cubbies as the books.
      if (it && it.type === 'cd') {
        if (panel.classList.contains('open')) closePanel();
        pinnedCd = it;
        showCdTooltip(it, e.clientX, e.clientY);
        return;
      }

      if (panel.classList.contains('open')) {
        // Any click that reaches here is on the canvas, not the panel —
        // panel's own listener (above) already stopPropagation()s clicks
        // inside it, so `!panel.contains(e.target)` was never actually
        // doing anything: this branch always fired and just closed the
        // panel, even when the click landed on a different spine. Scott,
        // 2026-07-23: "when the panel's open and I click on a new item,
        // the old item still remains for a few seconds before it gets
        // replaced" — that was this: click #1 closed the panel (old
        // content visible through the close transition), and only a
        // second click actually opened the new item. Raycast the click
        // directly (already done above) and, if it hit a spine, swap the
        // panel's content in place (same fade beat as navigateToItem)
        // instead of closing.
        if (hitMesh) {
          selected = hitMesh;

          // Scott, 2026-07-23: "if a left panel is open and then I click on
          // the right-hand side, the new content will appear in the open
          // left panel, rather than closing the left and opening the
          // right." The in-place content fade below never re-checked which
          // side the new click actually landed on, so it just kept
          // whichever anchor the panel already had. If the click is on the
          // panel's current side, that fade is still right (no need to
          // move anything) -- only cross to a real close/reopen when the
          // side actually changes, so the panel visibly relocates the way
          // it does on a fresh open, instead of an instant same-frame
          // teleport (which flipping `from-left` while `open` would cause,
          // since the panel is fully on-screen at that point, unlike the
          // closed-panel case this trick was originally written for).
          const clickedLeft = (e.clientX - rect.left) < rect.width / 2;
          if (panel.classList.contains('from-left') !== clickedLeft) {
            panel.classList.remove('open');
            setTimeout(() => {
              panel.classList.add('no-transition');
              panel.classList.toggle('from-left', clickedLeft);
              void panel.offsetWidth; // force reflow before re-enabling the transition
              panel.classList.remove('no-transition');
              populatePanel(it);
              panel.scrollTop = 0;
              panelBodyEl.style.opacity = '1'; // guard against a same-side fade-out still in flight
              panel.classList.add('open');
              setTimeout(() => panelTitle.focus(), 50);
            }, 500); // matches #library-panel's own close transition (transform .5s)
            return;
          }

          panelBodyEl.style.transition = 'opacity .18s';
          panelBodyEl.style.opacity = '0';
          setTimeout(() => {
            populatePanel(it);
            panel.scrollTop = 0;
            panelBodyEl.style.opacity = '1';
          }, 180);
          return;
        }
        closePanel();
        container.focus();
        return;
      }

      if (!hitMesh) return;
      selected = hitMesh;
      populatePanel(it);

      // Open from whichever side of the screen was actually clicked --
      // ported from sphere.js. Panel is guaranteed closed here (the block
      // above already returns early for an open-panel click), so flipping
      // the anchor is invisible to the user.
      const clickedLeft = (e.clientX - rect.left) < rect.width / 2;
      if (panel.classList.contains('from-left') !== clickedLeft) {
        panel.classList.add('no-transition');
        panel.classList.toggle('from-left', clickedLeft);
        void panel.offsetWidth; // force reflow before re-enabling the transition
        panel.classList.remove('no-transition');
      }

      panel.classList.add('open');
      setTimeout(() => panelTitle.focus(), 50);
    };
    container.addEventListener('click', onContainerClick);
  }

  // ─── Drag to orbit + wheel zoom ─────────────────────────────────────────
  // Auto-rotate stopped per Scott, 2026-07-22: "let's stop the auto-rotate
  // for the moment." Shelf now only turns under drag. (The old `autoRotate`
  // flag was hardcoded false and never toggled anywhere, so it was
  // removed rather than kept as permanently-dead code — if it needs to
  // come back, reintroduce the flag and check it in animate() below.)
  const orbitDrag = bindOrbitDrag(container, {
    onDrag: (dx, dy) => {
      root.rotation.y += dx;
      root.rotation.x = Math.max(-0.4, Math.min(0.4, root.rotation.x + dy));
    },
  });

  const minDist = preview ? 6.5 : 4.2;
  // Raised from 11/11.5 so the taller vertical shelf can still be zoomed
  // out to fit, and so there's room to drift toward the Babel backdrop
  // before the fog (near=18) swallows it.
  const maxDist = preview ? 17 : 17;
  const wheelZoom = bindWheelZoom(container, {
    isBlocked: () => !preview && panel?.classList.contains('open'),
    onZoom: deltaY => {
      const dist = camera.position.length();
      const next = Math.max(minDist, Math.min(maxDist, dist + deltaY * 0.004));
      camera.position.setLength(next);
    },
  });

  const reduceMotion = prefersReducedMotion();

  let animId;
  let babelT = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    // Library of Babel shimmer — Scott, 2026-07-23: "let's make them a bit
    // dynamic, maybe the shimmer effect?" Same per-object phase/speed
    // pulse convention as egg.js's field-line flux and aurora shimmers,
    // adapted to InstancedMesh (see buildBabelBackdrop's update()).
    if (!reduceMotion) {
      babelT += 0.016;
      babel.update(babelT);
    }
    renderer.render(scene, camera);
  }
  animate();

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });

  const escapeClose = !preview ? bindEscapeClose(() => {
    // The pinned CD tooltip had no keyboard dismissal at all — Escape only
    // ever checked the book panel, so a tooltip left pinned open (it stays
    // up until the next click anywhere) was invisible to keyboard-only use.
    if (pinnedCd) hideCdTooltip();
    if (panel && panel.classList.contains('open')) {
      closePanel();
      container.focus();
    }
  }) : null;

  return {
    dispose() {
      cancelAnimationFrame(animId);
      orbitDrag.dispose();
      wheelZoom.dispose();
      resize.dispose();
      escapeClose?.dispose();
      if (onContainerMouseMove) container.removeEventListener('mousemove', onContainerMouseMove);
      if (onContainerClick) container.removeEventListener('click', onContainerClick);
      if (onContainerMouseLeave) container.removeEventListener('mouseleave', onContainerMouseLeave);
      renderer.dispose();
      frame.geos.forEach(g => g.dispose());
      frame.mat.dispose();
      items.disposables.forEach(d => d.dispose());
      babel.disposables.forEach(d => d.dispose());
      if (caption) caption.remove();
      if (hint) hint.remove();
      if (panel) panel.remove();
      if (cdTooltip) cdTooltip.remove();
      renderer.domElement.remove();
    },
  };
}
