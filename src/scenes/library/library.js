import * as THREE from 'three';
import { libraryItems, cdRackItems } from './library.text.js';
import { getOutboundLinks, getInboundLinks, isRenderedField } from '../../links.js';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag, prefersReducedMotion, onReducedMotionChange, createPanelCloser, escapeHtml, parseHTML, wireCrossLinks, formatInboundNote, setPanelSide, clickedLeftHalf, claimContainer, disposeSceneGraph, manageRenderer, createFrameClock, trackTimers,
} from '../../utils/sceneKit.js';
import './library.css';
import libraryHtml from './library.html?raw';

// ─── The Library ────────────────────────────────────────────────────────────
// A real shelf of books, films, and divination decks, cataloged from a
// photo of Scott's own shelf (library.text.js).
//
// A 2x4 Kallax-style cube shelf, same physical layout as the real one
// (row/col/pos in library.js preserve left-to-right shelf order), rebuilt
// as a floating 3D object rather than a room you walk through — closer to
// the sphere/orbiter model (drag to orbit, click something small to read about
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
// The grid's own shape is derived from the catalog, not hand-set: COLS is
// however many distinct `row` values libraryItems actually uses (the
// shelf's 2-wide axis), ROWS is however many distinct `col` values it uses
// (the 4-tall axis) — see the "Transposed for the vertical shelf" comment
// on buildItems below for why row maps to the wide axis and col to the
// tall one. Add a book to a fifth col or a third row in library.text.js and
// the frame, the camera framing, and every other size derived from
// TOTAL_W/TOTAL_H below grows to fit it — nothing here needs to be told
// the shelf got bigger.
const COLS = Math.max(...libraryItems.map(it => it.row));
const ROWS = Math.max(...libraryItems.map(it => it.col));
const TOTAL_W = COLS * CUBBY_W + (COLS + 1) * FRAME_T;
const TOTAL_H = ROWS * CUBBY_H + (ROWS + 1) * FRAME_T;

// ─── CDs ────────────────────────────────────────────────────────────────────
// Invented wholesale, not catalogued off a real photo like the shelf
// (Scott doesn't own any of these anymore) — 114 albums, 55 artists,
// hand-dictated rather than filler (library.text.js's CD-rack section
// carries the full provenance note).
//
// No separate object, no separate camera, no switch: the CDs are just
// more items in the same cubbies as the books and films — dealIntoCubbies()
// deals them across the shelf's 8 cubbies mixed in with everything else, and
// buildItems() (below) renders
// and sizes them like any other item, just thinner and shorter, with their
// own texture (makeCdSpineTexture). They ride the exact same root group,
// camera, drag/zoom, and raycast as every other spine on the shelf — nothing
// about the shelf itself changes to make room for them.
//
// A CD click falls straight through to the exact same .library-panel
// every book and film already uses — populatePanel() (below) needs no
// CD-specific branch at all, since it already embeds whatever `youtube`/
// `scene` a film carries; CDs just carry the same two fields, pointing at
// a music video or live performance instead of a film scene (see
// library.text.js's CD-rack section for where those live, and its header
// for the research/sourcing note). The kind label just reads "Album"
// instead of "Book"/"Blu-ray".

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

// Discs and CDs get their own narrow, near-monochrome palettes plus their
// own texture treatment (see makeDiscSpineTexture/makeCdSpineTexture
// below), so each material reads as a distinct physical object: matte
// varied-color cloth binding for books, uniform glossy near-black plastic
// cases for the Blu-rays (real disc shelves are famously almost all one
// color, unlike a bookshelf), pale jewel-case paper for the CDs — rather
// than all three sharing a single palette and reading as one thinner
// smear of the same colors.
// Both palettes shifted warm (design-notes pass follow-up, 2026-09-01) —
// Scott's reaction to vividColor's warmer book spines was to want that
// same warmth carried into the discs/CDs too, not just the books. Still
// near-monochrome, still a materially distinct register from the books
// (glossy near-black plastic / pale jewel-case paper) — DISC_PALETTE was
// previously a cool blue-black (hue ~220-230°), now an umber/espresso
// black (hue ~25-30°) so it reads warm at a glance instead of fighting
// the shelf's own warm void/backdrop; CD_PALETTE moves from a neutral
// off-white toward a warmer champagne/tan.
const DISC_PALETTE = ['#160f0a', '#1a1108', '#170e08', '#140c0a'];
const CD_PALETTE = ['#ecdcc0', '#e4cfa8', '#dcc59a', '#e8d3b0'];

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

// ─── Cross-links ────────────────────────────────────────────────────────────
// The catalog's phrase-to-phrase links live in src/links.js now, alongside
// every other scene's — LIBRARY_LINKS used to be its own array here, keyed
// the same way (item id + field name: note/scene/excerpt/excerpt_from,
// since library items don't share a single 'the text' field the way
// orbiter's stanzas or sphere's fragments do), migrated as-is into the
// shared store's { scene: 'library', id, field } shape. See NOTES.md's
// "Linking & addressing" entry for why this moved.

// Wraps whatever links.js's getOutboundLinks() returns for this item+field
// into clickable <a class="library-link">s, same beat as every other
// scene's now-shared wireCrossLinks (sceneKit.js): escape the raw text
// first (the escaped phrase is what getOutboundLinks' phrases are checked
// against — see scripts/verify-links.mjs), then let wireCrossLinks replace
// each one so nothing else in the string can be reinterpreted as markup.
function renderLinkedField(itemId, field, text) {
  const html = escapeHtml(text);
  const links = getOutboundLinks('library', itemId, field).map(l => ({ ...l, phrase: escapeHtml(l.phrase) }));
  return wireCrossLinks(html, links, 'library-link');
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

// YouTube's own static thumbnail file for the same video — plain image,
// none of the embedded player's own UI chrome (the red play button, the
// "Watch on YouTube" mark) baked in, since those belong to the iframe
// player's overlay, not the thumbnail itself.
function youtubeThumbnailSrc(url) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('v');
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

// A click-to-load facade standing in for the embed until the visitor
// actually wants to watch: YouTube's own thumbnail image, muted under a
// scrim and topped with a small site-styled play control (library.css'
// .library-panel-video-facade), rather than the real iframe player
// sitting there by default with its own red play button and "Watch on
// YouTube" branding — a foreign, promotional visual language next to this
// panel's calm serif type and restrained gold accents. The genuine player
// only loads on click, replacing the button in place; the video never
// autoplays unasked, and the request to YouTube itself (and whatever it
// tracks) doesn't happen until the visitor actually commits to watching.
function buildVideoFacade(it, embedSrc) {
  const thumbSrc = youtubeThumbnailSrc(it.youtube);
  const label = it.type === 'cd' ? 'video' : 'pivotal scene';
  const facade = document.createElement('button');
  facade.type = 'button';
  facade.className = 'library-panel-video-facade';
  if (thumbSrc) facade.style.backgroundImage = `url("${thumbSrc}")`;
  facade.setAttribute('aria-label', `Play ${label}: ${it.title}`);
  facade.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `${embedSrc}?autoplay=1`;
    iframe.title = it.scene ? `${it.title} — ${it.scene}` : it.title;
    iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    facade.replaceWith(iframe);
  }, { once: true });
  return facade;
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
// Without touching the "no real cover art" rule, each spine gets: a
// per-item tint wash (so two books sharing one of the ~12 palette colors
// don't render as pixel-identical swatches — different dye lots, same
// cloth), a top-lit vertical gradient and a soft left/right vignette (the
// spine reads as a rounded object catching light, not a flat card), 1-2
// embossed horizontal bands above/below the title (old-hardcover binding
// cords), and contrast-aware ink color (light spines get dark ink, dark
// spines keep the cream). These broad tonal moves read at any distance,
// unlike fine per-pixel grain, which vanishes into texture minification
// at the on-screen size a spine actually renders at.
//
// Font variety comes entirely from curated *system* font stacks, with no
// webfont: nothing else in the codebase's canvas-drawn textures (orrery's
// posters, butterfly's caption) loads a custom font for canvas text,
// since doing so here would risk a FOUT-in-a-texture bug — the canvas
// snapshots synchronously, so if the webfont hasn't finished loading yet
// the fallback gets baked in permanently instead of swapping in later
// like real DOM text would.
//
// A real shelf gets its variety mostly from weight and case (a bold
// all-caps thriller next to a thin italic literary title next to a
// wide-tracked academic serif), not from subtly different serif
// geometries alone — at the size a spine actually renders at, "Georgia"
// vs "Times New Roman" vs "Palatino" all read as "a serif," and
// "-apple-system" vs "Verdana" vs "Trebuchet MS" all read as "a sans." So
// each pool below is a set of *treatments* (family + weight + italic +
// upper/title-case + letter-tracking) rather than just a font-family
// list, picked per-item (via hash01, so a given spine always lands on the
// same face across reloads) from a pool tuned per material: books get the
// widest spread — serif, sans, a monospace outlier, thin to black weight,
// plain and tracked-caps — the way different publishers' and decades'
// house styles actually clash on a real shelf; Blu-rays lean
// bold/condensed/all-caps (movie poster packaging); CDs stay closer to
// clean but range from thin to a punchier tracked-caps treatment for the
// louder genres; the two divination boxes share one fixed tracked-caps
// serif treatment suited to old esoteric-text/grimoire design.
function treatment(font, opts = {}) {
  return { font, weight: 400, italic: false, upper: false, tracking: 0, ...opts };
}
const BOOK_TREATMENTS = [
  treatment('Georgia, "Times New Roman", Times, serif'),
  treatment('"Times New Roman", Times, Georgia, serif', { italic: true }),
  treatment('-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif', { weight: 300 }),
  treatment('Verdana, Geneva, sans-serif', { weight: 700, upper: true, tracking: 1.5 }),
  treatment('"Trebuchet MS", Helvetica, sans-serif', { italic: true }),
  treatment('"Courier New", Courier, monospace', { upper: true, tracking: 1 }),
  treatment('Palatino, "Palatino Linotype", Georgia, serif', { italic: true }),
  treatment('"Arial Narrow", Arial, sans-serif', { weight: 700, upper: true }),
  treatment('"Arial Black", Arial, sans-serif', { weight: 900, upper: true, tracking: 0.5 }),
  treatment('Georgia, serif', { weight: 700, upper: true, tracking: 2 }),
];
const BOX_TREATMENT = treatment('Palatino, "Palatino Linotype", Georgia, serif', { italic: true, upper: true, tracking: 2 });
const DISC_TREATMENTS = [
  treatment('"Arial Narrow", Arial, sans-serif', { weight: 900, upper: true, tracking: 1 }),
  treatment('Arial, Helvetica, sans-serif', { weight: 700, upper: true, tracking: 0.5 }),
  treatment('"Trebuchet MS", Helvetica, sans-serif', { weight: 700, upper: true }),
  treatment('Georgia, "Times New Roman", Times, serif', { weight: 700, upper: true, tracking: 1.5 }),
  treatment('"Arial Black", Arial, sans-serif', { weight: 900, upper: true, tracking: 1 }),
];
const CD_TREATMENTS = [
  treatment('-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif', { weight: 300 }),
  treatment('Verdana, Geneva, sans-serif'),
  treatment('"Trebuchet MS", Helvetica, sans-serif', { weight: 700, upper: true, tracking: 1 }),
  treatment('"Arial Narrow", Arial, sans-serif', { weight: 700, upper: true }),
  treatment('Georgia, "Times New Roman", Times, serif', { italic: true }),
];
function pickTreatment(pool, seed) {
  const idx = Math.floor(hash01(seed, 'font') * pool.length);
  return pool[Math.min(idx, pool.length - 1)];
}
// Applies a treatment to the given size; caller still owns save/restore.
function setTitleFont(cx, t, size) {
  cx.font = `${t.italic ? 'italic ' : ''}${t.weight} ${size}px ${t.font}`;
  if ('letterSpacing' in cx) cx.letterSpacing = `${t.tracking}px`;
}
function titleCase(text, t) {
  return t.upper ? text.toUpperCase() : text;
}
function relLuminance(hex) {
  const col = new THREE.Color(hex);
  return 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
}

// Real saturation/lightness boost, applied at the pixel level (baked into
// the canvas texture itself, not a material-color multiply, which is what
// the roughness/lighting tweak below already tried and Scott found
// insufficient live — the shelf still read desaturated against the
// backdrop). PALETTE's own hex values stay untouched (still "someone's
// actual bookshelf," not a rainbow); this only affects what a book's own
// spine texture actually renders, and only for real books — the disc/CD/
// box palettes are deliberately near-monochrome design choices (see
// DISC_PALETTE/CD_PALETTE/BOX_PALETTE's own header comment) that a
// saturation boost would work against, not toward. Design-notes pass
// follow-up, 2026-09-01.
function vividColor(hex) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.s = Math.min(1, hsl.s * 1.55 + 0.08);
  hsl.l = Math.min(0.68, Math.max(hsl.l, hsl.l * 1.18));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return `#${c.getHexString()}`;
}

// ─── Spine texture resolution ───────────────────────────────────────────────
// Every spine canvas below is *drawn* in its own original, hand-tuned design
// space (112x800 for a book, 80x720 for a disc, 72x640 for a CD) and
// *rasterized* at this fraction of it — the 2D context is scaled once, up
// front, so no font size, line width, gradient stop or offset in any of the
// three functions had to be rewritten to change this number.
//
// Why it isn't 1 any more: 265 spines at full size is ~66 MB of level-0 RGBA
// texel data, ~88 MB once three.js builds their mipmaps, for objects that
// occupy roughly 20x140 CSS px on screen. Even on a devicePixelRatio-2
// display that is ~40 device px across a 112-px-wide texture — the top mip
// level was never sampled anywhere near 1:1, so a quarter of the memory is
// invisible at render size. It also quarters the canvas rasterization work in
// the one long synchronous main-thread task that builds all 265 of these at
// scene open. Set it back to 1 to compare directly.
const SPINE_TEXTURE_SCALE = 0.5;

function makeSpineTexture(baseColor, title, creator, isBox) {
  // Drawn at 112x800, rasterized at SPINE_TEXTURE_SCALE of it — see that
  // constant's own comment. W/H below are the design-space dimensions the
  // rest of this function works in; the context scale does the rest.
  const W = 112, H = 800;
  const c = document.createElement('canvas');
  c.width = Math.round(W * SPINE_TEXTURE_SCALE);
  c.height = Math.round(H * SPINE_TEXTURE_SCALE);
  const cx = c.getContext('2d');
  cx.scale(SPINE_TEXTURE_SCALE, SPINE_TEXTURE_SCALE);
  cx.fillStyle = baseColor;
  cx.fillRect(0, 0, W, H);

  // Per-item tint wash — same base swatch, different dye lot each time.
  const tr = Math.floor(hash01(title, 'tr') * 255);
  const tg = Math.floor(hash01(title, 'tg') * 255);
  const tb = Math.floor(hash01(title, 'tb') * 255);
  cx.fillStyle = `rgba(${tr},${tg},${tb},0.07)`;
  cx.fillRect(0, 0, W, H);

  // Top-lit vertical gradient — light catching the spine from above,
  // rather than a flat, evenly-lit swatch.
  const vgrad = cx.createLinearGradient(0, 0, 0, H);
  vgrad.addColorStop(0, 'rgba(255,255,255,0.18)');
  vgrad.addColorStop(0.45, 'rgba(255,255,255,0)');
  vgrad.addColorStop(1, 'rgba(0,0,0,0.24)');
  cx.fillStyle = vgrad;
  cx.fillRect(0, 0, W, H);

  // Left/right vignette — the spine's slight roundedness, not a flat card.
  const hgrad = cx.createLinearGradient(0, 0, W, 0);
  hgrad.addColorStop(0, 'rgba(0,0,0,0.3)');
  hgrad.addColorStop(0.14, 'rgba(0,0,0,0)');
  hgrad.addColorStop(0.86, 'rgba(0,0,0,0)');
  hgrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  cx.fillStyle = hgrad;
  cx.fillRect(0, 0, W, H);

  if (isBox) {
    // A scattering of small dots standing in for the starry/celestial
    // boxes on the real shelf (Kim Krans' Tarot/Alchemy decks) — an
    // abstraction, not a reproduction of the real box art. A few thin
    // harmonics lines between nearby dots read as a considered
    // pattern rather than scattered confetti.
    const dotCount = 22;
    const pts = [];
    for (let i = 0; i < dotCount; i++) {
      pts.push({
        x: hash01(title, `dotx${i}`) * W,
        y: hash01(title, `doty${i}`) * H,
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
    cx.fillRect(0, 10, W, 3);
    cx.fillRect(0, H - 13, W, 3);

    // 1-2 embossed bands above and/or below the title block — the raised
    // binding cords on an old hardcover, kept clear of the text itself.
    const bandSpots = [0.1 + hash01(title, 'b0') * 0.12, 0.8 + hash01(title, 'b1') * 0.12];
    bandSpots.forEach((frac, i) => {
      if (i === 1 && hash01(title, 'bskip') > 0.7) return; // not every spine gets both
      const by = H * frac;
      cx.fillStyle = 'rgba(0,0,0,0.22)';
      cx.fillRect(0, by, W, 3);
      cx.fillStyle = 'rgba(255,255,255,0.12)';
      cx.fillRect(0, by + 3, W, 1);
    });
  }

  // Contrast-aware ink: the palette runs from near-black to pale tan, so
  // one fixed cream text color read poorly against the lightest spines.
  const lum = relLuminance(baseColor);
  const inkTitle = lum > 0.55 ? 'rgba(32,26,20,0.88)' : 'rgba(240,236,224,0.92)';
  const inkCreator = lum > 0.55 ? 'rgba(32,26,20,0.6)' : 'rgba(240,236,224,0.62)';

  const t = isBox ? BOX_TREATMENT : pickTreatment(BOOK_TREATMENTS, title);

  cx.save();
  cx.translate(W / 2, H / 2);
  cx.rotate(Math.PI / 2);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = inkTitle;
  setTitleFont(cx, t, 34);
  const lines = wrapSpineText(title, 26).slice(0, 3);
  const lineH = 40;
  const startY = -((lines.length - 1) * lineH) / 2 - (creator ? 14 : 0);
  lines.forEach((line, i) => cx.fillText(titleCase(line, t), 0, startY + i * lineH));
  if (creator) {
    cx.font = `italic 300 22px ${t.font}`;
    if ('letterSpacing' in cx) cx.letterSpacing = '0px';
    cx.fillStyle = inkCreator;
    cx.fillText(creator.split(' · ')[0].split(' (')[0], 0, startY + lines.length * lineH + 6);
  }
  cx.restore();

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function cubbyLeft(col) { return -TOTAL_W / 2 + FRAME_T + (col - 1) * (CUBBY_W + FRAME_T); }
function cubbyTop(row) { return TOTAL_H / 2 - FRAME_T - (row - 1) * (CUBBY_H + FRAME_T); }

// Canvas-drawn Blu-ray/DVD spine — deliberately near-featureless next to a
// book. A real disc shelf reads as a uniform block of dark glossy plastic,
// not a rainbow of cloth bindings, so this skips the dye-wash/embossed-
// band/foil-cap treatment makeSpineTexture gives books entirely, and draws
// from DISC_PALETTE's narrow near-black range instead of the book PALETTE.
// A tight, bright specular streak stands in for the hard-plastic shine a
// spine of book cloth never has; the only per-item color variety is a
// single thin accent bar (hue varies per title — never a specific studio's
// real branding), echoing the small colored spine labels real disc sets
// sometimes carry.
//
// No director byline: real disc spines essentially never carry a director
// credit (that's back-of-case/booklet information), unlike a book spine
// where the author's name is the whole point. The panel still shows
// writer/producer in its detail lines when the catalog has them.
function makeDiscSpineTexture(baseColor, title) {
  // Drawn at 80x720, rasterized at SPINE_TEXTURE_SCALE of it — see that
  // constant's own comment. W/H below are the design-space dimensions the
  // rest of this function works in; the context scale does the rest.
  const W = 80, H = 720;
  const c = document.createElement('canvas');
  c.width = Math.round(W * SPINE_TEXTURE_SCALE);
  c.height = Math.round(H * SPINE_TEXTURE_SCALE);
  const cx = c.getContext('2d');
  cx.scale(SPINE_TEXTURE_SCALE, SPINE_TEXTURE_SCALE);
  cx.fillStyle = baseColor;
  cx.fillRect(0, 0, W, H);

  const streakX = W * (0.25 + hash01(title, 'streak') * 0.35);
  const sgrad = cx.createLinearGradient(streakX - 14, 0, streakX + 14, 0);
  sgrad.addColorStop(0, 'rgba(255,255,255,0)');
  sgrad.addColorStop(0.5, 'rgba(255,255,255,0.24)');
  sgrad.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = sgrad;
  cx.fillRect(0, 0, W, H);

  const vgrad = cx.createLinearGradient(0, 0, 0, H);
  vgrad.addColorStop(0, 'rgba(255,255,255,0.1)');
  vgrad.addColorStop(0.5, 'rgba(255,255,255,0)');
  vgrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  cx.fillStyle = vgrad;
  cx.fillRect(0, 0, W, H);

  // A single thin accent bar, low on the spine — the only per-item hue
  // variety a disc case gets.
  const hue = Math.floor(hash01(title, 'accent') * 360);
  cx.fillStyle = `hsla(${hue}, 45%, 48%, 0.55)`;
  cx.fillRect(0, H - 34, W, 4);

  const lum = relLuminance(baseColor);
  const ink = lum > 0.55 ? 'rgba(26,22,18,0.9)' : 'rgba(238,234,222,0.92)';
  const t = pickTreatment(DISC_TREATMENTS, title);

  cx.save();
  cx.translate(W / 2, H / 2);
  cx.rotate(Math.PI / 2);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = ink;
  setTitleFont(cx, t, 32);
  const lines = wrapSpineText(title, 24).slice(0, 3);
  const lineH = 38;
  const startY = -((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => cx.fillText(titleCase(line, t), 0, startY + i * lineH));
  cx.restore();

  return new THREE.CanvasTexture(c);
}

// Canvas-drawn CD spine — same "no real cover art" rule as makeSpineTexture,
// simplified for a jewel-case spine rather than a book: album title (larger,
// vertical) over a smaller artist line, on a glossier flat color field. No
// dye-wash/embossed-band/dot-harmonics treatment the books get — the
// spine is thin enough on screen that that detail would just be noise; a
// simple top-lit gradient plus contrast-aware ink is enough for it to read
// as "a CD," not "a thin book." Draws from the pale CD_PALETTE (the paper
// tray-card visible through a jewel case's clear plastic spine) rather than
// the book PALETTE, plus a thin prismatic sliver near one edge — the
// reflective disc itself, just visible through the spine — since a flat
// pale card alone would read too much like a thin, blank book.
function makeCdSpineTexture(baseColor, artist, album) {
  // Drawn at 72x640, rasterized at SPINE_TEXTURE_SCALE of it — see that
  // constant's own comment. W/H below are the design-space dimensions the
  // rest of this function works in; the context scale does the rest.
  const W = 72, H = 640;
  const c = document.createElement('canvas');
  c.width = Math.round(W * SPINE_TEXTURE_SCALE);
  c.height = Math.round(H * SPINE_TEXTURE_SCALE);
  const cx = c.getContext('2d');
  cx.scale(SPINE_TEXTURE_SCALE, SPINE_TEXTURE_SCALE);
  cx.fillStyle = baseColor;
  cx.fillRect(0, 0, W, H);

  const vgrad = cx.createLinearGradient(0, 0, 0, H);
  vgrad.addColorStop(0, 'rgba(255,255,255,0.3)');
  vgrad.addColorStop(0.5, 'rgba(255,255,255,0)');
  vgrad.addColorStop(1, 'rgba(0,0,0,0.32)');
  cx.fillStyle = vgrad;
  cx.fillRect(0, 0, W, H);

  // A thin prismatic sliver near one edge — the reflective edge of the CD
  // itself, just visible through the jewel case spine. Never a full "shiny
  // disc" render, just enough to read as "there's a mirrored disc in
  // here," distinguishing a CD from a plain pale slip of card.
  const prism = cx.createLinearGradient(0, 0, 0, H);
  prism.addColorStop(0, 'rgba(255,130,180,0.4)');
  prism.addColorStop(0.25, 'rgba(255,220,120,0.34)');
  prism.addColorStop(0.5, 'rgba(140,255,200,0.34)');
  prism.addColorStop(0.75, 'rgba(140,180,255,0.36)');
  prism.addColorStop(1, 'rgba(200,140,255,0.34)');
  cx.fillStyle = prism;
  cx.fillRect(5, 0, 5, H);

  const lum = relLuminance(baseColor);
  const ink = lum > 0.55 ? 'rgba(26,22,18,0.88)' : 'rgba(238,234,222,0.92)';
  const inkSub = lum > 0.55 ? 'rgba(26,22,18,0.58)' : 'rgba(238,234,222,0.62)';
  const t = pickTreatment(CD_TREATMENTS, album);

  cx.save();
  cx.translate(W / 2, H / 2);
  cx.rotate(Math.PI / 2);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  setTitleFont(cx, t, 30);
  cx.fillStyle = ink;
  const albumLines = wrapSpineText(album, 24).slice(0, 2);
  const lineH = 34;
  const startY = -((albumLines.length - 1) * lineH) / 2 - 12;
  albumLines.forEach((line, i) => cx.fillText(titleCase(line, t), 0, startY + i * lineH));
  cx.font = `italic 300 19px ${t.font}`;
  if ('letterSpacing' in cx) cx.letterSpacing = '0px';
  cx.fillStyle = inkSub;
  cx.fillText(artist, 0, startY + albumLines.length * lineH + 10);
  cx.restore();

  return new THREE.CanvasTexture(c);
}

// ─── Dealing the shelf ──────────────────────────────────────────────────────
// Everything on the shelf — 104 books, 44 films, 2 divination decks and 114
// CDs — is dealt fresh into the eight cubbies on every visit, mixed.
//
// It did not used to be. `row`/`col`/`pos` in library.text.js were
// photographed off Scott's real shelf and they used to decide placement, with
// only the CONTENT permuted among a type's own slots. The trouble is that the
// real shelf is sorted the way real shelves are: 43 of the 44 films sit in two
// cubbies and books fill the other six, so two of the eight were a wall of
// Criterion cases and the rest a wall of paperbacks. Interleaving within a
// cubby (see below) cannot touch that — there is nothing in a films-only
// cubby to interleave WITH. So the deal itself had to change.
//
// row/col/pos stay in the catalog. They are the record of a real object and
// that is worth keeping; they are simply no longer what the scene reads for
// placement. What the scene still derives from them is the SHAPE of the grid
// — COLS/ROWS at the top of this file — because the shelf is a real 4x2 piece
// of furniture whatever is standing in it.
//
// Each cubby gets the same PROPORTIONS as the shelf as a whole rather than
// the same count of each type: deal each type round-robin from a shuffled
// list, starting each type at a different cubby so the remainders do not all
// land in the same place. 264 items over 8 cubbies is 33 apiece, which is
// also tidier than what was there — the real shelf ran 29 to 46 items per
// cubby, and since a cubby divides its width among whatever it holds, that
// was a visible difference in spine width from one cubby to the next.
//
// Math.random, not hash01, like everything else in this section: hash01 keeps
// a given item looking the same across reloads once you have found it, and
// this does the opposite on purpose.
function dealIntoCubbies(items, cds) {
  const cubbies = [];
  for (let row = 1; row <= COLS; row++) {
    for (let col = 1; col <= ROWS; col++) cubbies.push({ row, col, items: [] });
  }
  const pools = [
    shuffled(items.filter(it => it.type === 'book')),
    shuffled(items.filter(it => isFilmType(it))),
    shuffled(items.filter(it => it.type === 'divination_box')),
    shuffled(cds).map(cd => ({
      id: `cd-${cd.id}`, type: 'cd', title: cd.album, creator: cd.artist,
      artist: cd.artist, album: cd.album, scene: cd.video, youtube: cd.youtube,
    })),
  ];
  pools.forEach((pool, k) => {
    // A different starting cubby per type. Deal every type from cubby 0 and
    // the leftovers of all four land together in the first few cubbies, which
    // is the lumpiness this function exists to remove.
    const start = Math.floor(Math.random() * cubbies.length) + k;
    pool.forEach((it, i) => cubbies[(start + i) % cubbies.length].items.push(it));
  });
  return cubbies;
}

// ─── How a cubby is ordered ─────────────────────────────────────────────────
// Until 4.11.21 this was `shelfGroup()`: books first, then one contiguous
// block of Blu-rays and CDs at the end of every cubby. It was deliberate and
// it was wrong about what a shelf looks like. Nobody's shelf sorts itself by
// media; things land next to what they were being read with, and a Criterion
// case ends up leaning against a paperback because that is where there was
// room. Two of the eight cubbies were also a solid wall of film cases and the
// rest a solid wall of paperbacks, so the eye got no reason to travel.
//
// What replaces it is not a straight shuffle. A uniform shuffle of a mixed
// cubby produces runs of length 1 most of the time — which reads as static,
// not as a shelf. Real shelves cluster: three or four of a kind together,
// because they were bought together or shelved in one go. So each type's
// items are broken into short RUNS first and the runs are shuffled, which
// keeps the little groupings and mixes them.
//
// Run length is capped per TYPE rather than globally, and that is the part
// that was got wrong on the first pass. A CD jewel case is drawn half a book's
// width and noticeably shorter, so a run of four of them is a wide pale trough
// in the skyline — and CDs are 43% of everything on the shelf, so at a shared
// cap of four the troughs were the thing the eye landed on. Books are the
// substrate and can run longest; films are the dark punctuation; CDs read best
// as one or two at a time, which is also how they end up on a real shelf,
// tucked into whatever gap there was.
//
// Within a type the length is skewed toward the middle by taking the smaller
// of two draws. Per visit, like everything else in this section: Math.random,
// not hash01, because the point is that the shelf is arranged differently
// every time you come back.
const RUN_MAX = { book: 4, bluray: 3, dvd: 3, divination_box: 1, cd: 2 };
function interleaveCubby(items) {
  const byType = new Map();
  for (const it of items) {
    if (!byType.has(it.type)) byType.set(it.type, []);
    byType.get(it.type).push(it);
  }
  const runs = [];
  for (const [type, list] of byType) {
    const cap = RUN_MAX[type] ?? 3;
    // Each type keeps its own internal order — the per-visit content
    // reshuffle above has already decided that, and shuffling it twice would
    // just be shuffling.
    let i = 0;
    while (i < list.length) {
      const draw = () => 1 + Math.floor(Math.random() * cap);
      const n = Math.min(draw(), draw());
      runs.push(list.slice(i, i + n));
      i += n;
    }
  }
  return shuffled(runs).flat();
}

// ─── Per-visit randomness ───────────────────────────────────────────────────
// The shelf is dealt fresh on every visit, so it is never twice in the same
// arrangement — see dealIntoCubbies() above for what that means now that a
// type is no longer confined to its own photographed slots. Deliberately real
// per-load randomness (Math.random), not the deterministic hash01 used
// everywhere else in this file — hash01 exists so a given item looks the same
// across reloads once you have found it; this does the opposite, on purpose.
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// `reshuffleWithinType()` stood here until 4.11.21. It permuted item CONTENT
// among the row/col/pos slots the photographed shelf gave each type, which is
// what a per-visit shuffle has to look like when placement is fixed and only
// the occupant may change. dealIntoCubbies() above does the whole job now —
// it decides the cubby as well as the order — so there are no fixed slots
// left for anything to be permuted among.
const isBookType = it => it.type === 'book' || it.type === 'divination_box';
const isFilmType = it => it.type === 'dvd' || it.type === 'bluray';

// Concatenates a set of already-positioned BoxGeometries into one. Deliberately
// hand-rolled rather than pulled from three's own BufferGeometryUtils: importing
// mergeGeometries added ~5.7 kB to this scene's code-split chunk (measured, v4.0)
// to save eight draw calls, and every geometry this is ever handed is a
// BoxGeometry — same three attributes, same layout, always indexed — so the
// general-purpose version's attribute reconciliation, morph-target handling and
// group bookkeeping are all cost with nothing to do here. See STANDARDS.md's
// dynamic-import section for why this file's chunk size is worth defending.
function mergeBoxes(parts) {
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const size = parts[0].getAttribute(name).itemSize;
    const total = parts.reduce((n, g) => n + g.getAttribute(name).count, 0);
    const arr = new Float32Array(total * size);
    let at = 0;
    for (const g of parts) { arr.set(g.getAttribute(name).array, at); at += g.getAttribute(name).array.length; }
    merged.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  const indices = [];
  let vertexOffset = 0;
  for (const g of parts) {
    for (const i of g.getIndex().array) indices.push(i + vertexOffset);
    vertexOffset += g.getAttribute('position').count;
    g.dispose(); // the copy above is the survivor
  }
  merged.setIndex(indices);
  return merged;
}

// ─── Shelf frame ────────────────────────────────────────────────────────────
function buildFrame() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.85, metalness: 0.02 });
  const parts = [];

  // Collected rather than meshed one at a time: the frame's nine boxes never
  // move relative to each other and all share one material, so their
  // positions bake straight into a single merged BufferGeometry below —
  // nine render items become one, for free.
  function box(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(x, y, z);
    parts.push(geo);
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

  group.add(new THREE.Mesh(mergeBoxes(parts), mat));

  // No geos/mat handed back for teardown any more: dispose() now walks the
  // real scene graph via sceneKit's disposeSceneGraph(root), which reaches
  // this mesh (and every texture slot on every material in the scene) on its
  // own — see createLibrary's dispose().
  return { group };
}

// ─── Library of Babel backdrop ──────────────────────────────────────────────
// This bookshelf is treated as a real-world extrusion of Borges' Library
// of Babel, faintly seen through the Veil in the background: the shelf's
// own materials/lighting stay untouched, and this is a second, separate
// layer — a field of hexagonal gallery outlines (Borges' library is built
// of identical connected hexagonal rooms, unbroken and — as far as anyone
// inside it can tell — infinite) surrounding the shelf on every side.
// scene.fog (matched to the clear color, same trick as orrery.js) is what
// makes it read as "faintly seen through the Veil" rather than crisply
// rendered architecture: the nearest hexagons are just barely legible,
// and the fog swallows the rest into black before the eye can resolve how
// far the recession actually goes — which is the point; the Veil is
// Scott's own term (documented at length in archive_against_library.md)
// for the perceptual screen between ordinary reality and what lies past
// it, so this is deliberately NOT fully renderable.
//
// Independent hexagon "gallery" nodes are scattered through a cube
// surrounding the shelf on every side, each tumbled to its own random 3D
// orientation, linked to its nearest neighbors by thin strand-rods
// (Borges' galleries connect to each other, not tile seamlessly into one
// surface, the same volumetric-field approach butterfly.js's phase-space
// grid uses around the Lorenz attractor). A keep-out column
// matching the shelf's own x/y footprint (through every z) keeps any
// node or strand from ever drawing across the shelf's own books —
// "the bookshelf looks normal" still holds, now from every angle, not
// just head-on.
//
// Each hexagon carries both a wireframe outline (edgeMesh, unlit — the
// gallery's own structural rods) and a filled pane behind it (faceMesh,
// a real MeshStandardMaterial catching this scene's key/rim/ambient
// lights at whatever angle that node's own tumble presents to them) —
// the fill is what turns a scattered set of line segments into something
// that reads as an actual lit room at a distance, rather than wireframe
// decoration. Depth itself needs no separate parallax mechanism: nodes
// sit at real, varying distances along every axis (not a flat field at
// one depth), and drag rotates the whole babel+shelf assembly as one
// rigid body under this scene's fixed lights and fixed camera — under a
// perspective projection, a rigid body's own nearer points sweep faster
// across the screen than its farther ones for the same rotation, exactly
// the differential motion a hand-tuned two-speed layer trick would be
// trying to fake, except this version falls straight out of the real 3D
// placement and the projection math instead of an eyeballed ratio.
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

// A unit-circumradius hexagon, triangle-fanned from its own center, lying
// in the local XY plane — the filled counterpart to hexEdgeLocalTransforms'
// wireframe edges. Vertex k sits at angle pi/6 + k*(pi/3): the same angle
// hexEdgeLocalTransforms implies for the corner between its edge k-1 and
// edge k, so a face and its six edges share exact corners rather than two
// independently-eyeballed hexagons that happen to be close. Instanced and
// scaled per node by that node's own r (see buildBabelBackdrop), the same
// way the edges scale their own length by r.
function hexFaceGeometry() {
  const positions = [0, 0, 0];
  for (let k = 0; k <= 6; k++) {
    const theta = Math.PI / 6 + k * (Math.PI / 3);
    positions.push(Math.cos(theta), Math.sin(theta), 0);
  }
  const indices = [];
  for (let k = 1; k <= 6; k++) indices.push(0, k, k + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildBabelBackdrop() {
  const group = new THREE.Group();

  // ── Node field: jittered 3D grid, thinned and tumbled, so it reads as
  // scattered galleries rather than a mechanical lattice.
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
        if (hash01(`babel-skip-${ni}`, 'k') > 0.5) continue; // thin the field
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
          // Shimmer, per node — same idea as orbiter.js's per-particle drift
          // phase/speed pairs, so the whole field doesn't pulse in lockstep.
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
  // Recolored warm gold (design-notes pass, 2026-09-01) — was a cool blue
  // (0x92a9d8) that fought this scene's own warm paper-and-wood palette
  // rather than reading as part of the same space; the structural depth
  // here (lit faces, fog recession, shimmer) was already real, so this
  // only changes hue and opacity, not the underlying technique. Opacity
  // nudged up slightly too — against the newly-tinted, no-longer-pure-
  // black void, the previous values read fainter than intended.
  const edgeColor = new THREE.Color(0xc9a874);
  const edgeGeo = new THREE.BoxGeometry(1, 0.045, 0.045);
  const edgeMat = new THREE.MeshBasicMaterial({
    color: edgeColor, transparent: true, opacity: 0.38, depthWrite: false, fog: true,
  });
  const edgeMesh = new THREE.InstancedMesh(edgeGeo, edgeMat, nodes.length * 6);

  // ── Hexagon faces: a filled, lit pane behind each node's own six edges
  // — real MeshStandardMaterial, not the unlit MeshBasicMaterial the edges
  // use, so the key/rim/ambient lights already set up below (same three
  // this scene lights the shelf with) fall across each gallery's face at
  // its own tumbled angle and actually shade it, rather than every hex
  // reading as a flat, uniformly-lit outline regardless of orientation.
  // Kept nearly transparent (a pane of glass, not a wall) so it reads as
  // "a hexagonal room," not a solid tile blocking the depth behind it.
  const faceGeo = hexFaceGeometry();
  const faceMat = new THREE.MeshStandardMaterial({
    color: edgeColor, transparent: true, opacity: 0.14, roughness: 0.5,
    metalness: 0, side: THREE.DoubleSide, depthWrite: false, fog: true,
  });
  const faceMesh = new THREE.InstancedMesh(faceGeo, faceMat, nodes.length);

  const dummy = new THREE.Object3D();
  const local = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  let ei = 0;
  nodes.forEach((node, ni) => {
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

    // Same node transform as the edges, scaled by this node's own
    // circumradius so the face exactly fills the hexagon its edges
    // outline (hexFaceGeometry's unit hexagon needs that scale applied
    // per-instance, the same way hexEdgeLocalTransforms bakes r into
    // each edge's own local length).
    dummy.scale.set(node.r, node.r, node.r);
    dummy.updateMatrix();
    faceMesh.setMatrixAt(ni, dummy.matrix);
    faceMesh.setColorAt(ni, edgeColor);
  });
  edgeMesh.instanceMatrix.needsUpdate = true;
  edgeMesh.instanceColor.needsUpdate = true;
  faceMesh.instanceMatrix.needsUpdate = true;
  faceMesh.instanceColor.needsUpdate = true;
  group.add(faceMesh);
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
  // Warm sibling of edgeColor, same 2026-09-01 recolor.
  const strandColor = new THREE.Color(0xb89760);
  const strandPhases = [];
  if (strandPairs.length) {
    // Thickness/opacity deliberately close to the hex edges', not
    // fainter — a rod this thin over multi-unit lengths barely registers
    // at lower thickness/opacity values.
    const strandGeo = new THREE.BoxGeometry(1, 0.038, 0.038);
    const strandMat = new THREE.MeshBasicMaterial({
      color: strandColor, transparent: true, opacity: 0.28, depthWrite: false, fog: true,
    });
    strandMesh = new THREE.InstancedMesh(strandGeo, strandMat, strandPairs.length);

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
    nodes.forEach((node, ni) => {
      const b = 0.55 + Math.sin(t * node.speed + node.phase) * 0.45;
      tmpColor.copy(edgeColor).multiplyScalar(Math.max(0.12, b));
      for (let k = 0; k < 6; k++) edgeMesh.setColorAt(node.edgeStart + k, tmpColor);
      // Same phase/speed as this node's edges, so a hexagon's face and its
      // own outline brighten and dim together, as one gallery.
      faceMesh.setColorAt(ni, tmpColor);
    });
    edgeMesh.instanceColor.needsUpdate = true;
    faceMesh.instanceColor.needsUpdate = true;

    if (strandMesh) {
      strandPhases.forEach((sp, si) => {
        const b = 0.55 + Math.sin(t * sp.speed + sp.phase) * 0.45;
        tmpColor.copy(strandColor).multiplyScalar(Math.max(0.12, b));
        strandMesh.setColorAt(si, tmpColor);
      });
      strandMesh.instanceColor.needsUpdate = true;
    }
  }

  // Every geometry and material built above hangs off a mesh inside `group`,
  // so the hand-kept disposables list this used to return is gone — dispose()
  // reaches all of it through disposeSceneGraph(root) instead.
  return { group, update };
}

// ─── Rim light on spine edges (design-notes pass, 2026-09-01) ─────────────
// Book spines have real silhouette edges — a box's corner, the seam
// between front cover and side — the same candidate outside.js's own
// Fresnel technique was built for (see that file's own header comment).
// Same patch-the-compiled-shader approach: onBeforeCompile injects a real
// Fresnel term (view direction vs. surface normal) into the standard
// MeshStandardMaterial shader three.js already compiles for lighting,
// rather than swapping in a heavier custom ShaderMaterial — but unlike
// Outside's petals (translucent, so Fresnel drives both an alpha mix and
// an edge glow), a book spine is an opaque solid, so this only adds the
// glow term, never touches alpha. Kept deliberately faint (glow 0.035) —
// a bookshelf should read as lit, not as glowing sci-fi objects; the goal
// is a little more dimension at the silhouette, not a visual effect that
// calls attention to itself.
function addSpineRim(material, colorHex = 0xffe6bd, power = 2.4, glow = 0.035) {
  material.onBeforeCompile = shader => {
    shader.uniforms.pmRimColor = { value: new THREE.Color(colorHex) };
    shader.uniforms.pmRimPower = { value: power };
    shader.uniforms.pmRimGlow  = { value: glow };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform vec3 pmRimColor;
        uniform float pmRimPower;
        uniform float pmRimGlow;
      `)
      .replace('#include <dithering_fragment>', `
        float pmRim = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), pmRimPower);
        gl_FragColor.rgb += pmRim * pmRimGlow * pmRimColor;
        #include <dithering_fragment>
      `);
  };
}

// ─── Two draw calls per spine, not six ──────────────────────────────────────
// A mesh with a material ARRAY costs one render item — one draw call — per
// geometry GROUP, and BoxGeometry ships six of them (+x, -x, +y, -y, +z, -z).
// So `[side, side, pages, pages, front, back]` was six draw calls per item
// even though it only ever names three distinct materials, which is 1,590 of
// this scene's 1,603 calls a frame.
//
// This regroups the box into exactly two runs — "the spine face you read"
// and "the five faces you don't" — and keeps the three distinct non-spine
// colours by baking them into a vertex-colour attribute that the one body
// material multiplies through, rather than by naming three materials. Same
// rendered result; a third of the calls.
//
// Two mechanical details worth knowing before touching this:
//   * Two groups that share a materialIndex are still two render items, so
//     "everything else" has to be one CONTIGUOUS index run — hence moving
//     the +z face's six indices to the end of the buffer first.
//   * BoxGeometry lays out four vertices per face in that same +x, -x, +y,
//     -y, +z, -z order, 24 in all, which is what the colour loop below
//     indexes. The +z entry is a placeholder: those vertices are only ever
//     drawn by the spine material, which has vertexColors off and ignores
//     the attribute entirely.
function splitBoxIntoSpineAndBody(geo, sideColor, pageColor, backColor) {
  const idx = Array.from(geo.getIndex().array);
  const spine = idx.slice(24, 30); // +z
  geo.setIndex([...idx.slice(0, 24), ...idx.slice(30, 36), ...spine]);
  geo.clearGroups();
  geo.addGroup(0, 30, 0); // body: +x, -x, +y, -y, -z
  geo.addGroup(30, 6, 1); // spine face: +z

  const faceColors = [sideColor, sideColor, pageColor, pageColor, sideColor, backColor];
  const colors = new Float32Array(24 * 3);
  faceColors.forEach((col, f) => {
    for (let v = 0; v < 4; v++) {
      const o = (f * 4 + v) * 3;
      colors[o] = col.r; colors[o + 1] = col.g; colors[o + 2] = col.b;
    }
  });
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

// ─── Items (books/dvds/blurays/boxes) ──────────────────────────────────────
function buildItems(preview) {
  const group = new THREE.Group();
  const meshes = [];

  // Preview tiles are ~200px across on the landing page, where a spine is a
  // sub-pixel sliver of flat colour: nothing there needs its own geometry or
  // its own material. One unit cube scaled per item replaces 265 separate
  // BoxGeometries, and one material per distinct palette colour (~20 of them)
  // replaces 265 MeshStandardMaterials. The tile renders identically — this
  // is purely the cost of building it.
  const previewBox = preview ? new THREE.BoxGeometry(1, 1, 1) : null;
  const previewMats = new Map();

  // One deal per visit (dealIntoCubbies above), so which cubby an item lands
  // in changes every time as well as where in the cubby it stands.
  const byCubby = dealIntoCubbies(libraryItems, cdRackItems);

  const padX = 0.06;
  const gap = 0.006;
  const floorGap = 0.025;

  byCubby.forEach(({ row, col, items: dealt }) => {
    const items = interleaveCubby(dealt);
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

      const palette = isBox ? BOX_PALETTE : isDisc ? DISC_PALETTE : isCd ? CD_PALETTE : PALETTE;
      const rawColor = palette[hash(it.title) % palette.length];
      // Books only — see vividColor's own header comment for why discs/
      // CDs/boxes are excluded.
      const color = (!isBox && !isDisc && !isCd) ? vividColor(rawColor) : rawColor;

      const x = cursorX + w / 2;
      const y = top - CUBBY_H + floorGap + h / 2;
      const z = CUBBY_D / 2 - depth / 2 - 0.01;

      let mesh;
      if (preview) {
        let flat = previewMats.get(color);
        if (!flat) {
          flat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
          previewMats.set(color, flat);
        }
        mesh = new THREE.Mesh(previewBox, flat);
        mesh.scale.set(Math.max(w, 0.02), h, depth);
      } else {
        const geo = new THREE.BoxGeometry(Math.max(w, 0.02), h, depth);
        const tex = isCd
          ? makeCdSpineTexture(color, it.creator, it.title)
          : isDisc
          ? makeDiscSpineTexture(color, it.title)
          : makeSpineTexture(color, it.title, it.creator, isBox);
        // Finish variety — most book spines are a matte cloth/paper
        // binding, a minority (~1 in 5) a glossier trade-paperback
        // laminate, so the shelf doesn't read as one uniform plastic
        // material. Discs and CDs skip the roulette entirely: real disc
        // cases and jewel cases are hard glossy plastic every time, which
        // is itself part of what makes them read as a different material
        // from the books.
        const isGlossy = isDisc || isCd || hash01(it.title, 'gloss') > 0.8;
        // Matte range trimmed from 0.72-0.90 to 0.6-0.8 (design-notes
        // pass, 2026-09-01) — the audit found the shelf reading muted/
        // grey even though the books already carry real palette color;
        // 0.9 roughness is nearly pure Lambertian diffuse, which under
        // this scene's two-directional-light setup (no environment map)
        // shows almost no specular variation at all, reading flatter than
        // intended. A touch less roughness lets a visible highlight track
        // the key light across each spine without turning matte cloth
        // binding into glossy laminate.
        const rough = isDisc
          ? 0.22 + hash01(it.title, 'r2') * 0.1
          : isCd
          ? 0.3 + hash01(it.title, 'r2') * 0.12
          : isGlossy
          ? 0.35 + hash01(it.title, 'r2') * 0.15
          : 0.6 + hash01(it.title, 'r2') * 0.2;
        const metal = isDisc ? 0.18 : isCd ? 0.1 : isGlossy ? 0.05 : 0;
        // Side/back faces shaded darker than the front — the same base
        // color otherwise made every face of the box read as one flat
        // plane rather than a real 3D object catching light unevenly.
        // These three colors now travel as vertex colors on the one body
        // material rather than as three separate materials; see
        // splitBoxIntoSpineAndBody above for why, and note the one thing
        // that genuinely changed: the top/bottom page faces used to carry
        // roughness 0.9 of their own and now share the body's `rough`
        // (0.6-0.8 for a matte book). Under this scene's two directional
        // lights and no environment map that difference is not visible on a
        // face this small; the colors themselves are untouched.
        const sideColor = new THREE.Color(color).multiplyScalar(0.82);
        const backColor = new THREE.Color(color).multiplyScalar(0.7);
        const pageColor = new THREE.Color(it.type === 'book' ? '#e9e3d2' : color);
        splitBoxIntoSpineAndBody(geo, sideColor, pageColor, backColor);

        const front = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: metal });
        const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough });
        // Rim light on the faces that carry a visible silhouette edge
        // against the cubby's shadowed interior/its shelf neighbors — the
        // spine face itself and the box around it (which is the edge a
        // browsing eye catches at an angle, now one material rather than
        // the old separate `side`). Skipped on disc/CD/box items' own
        // already-distinct glossy-plastic finish, which doesn't need the
        // same "used cloth binding" dimension cue.
        if (!isDisc && !isCd && !isBox) {
          addSpineRim(front);
          addSpineRim(body);
        }
        mesh = new THREE.Mesh(geo, [body, front]);
      }

      mesh.position.set(x, y, z);
      mesh.userData.item = it;
      group.add(mesh);
      meshes.push(mesh);

      cursorX += w + gap;
    });
  });

  // No disposables list handed back: dispose() walks the real scene graph
  // via sceneKit's disposeSceneGraph(root), which reaches every geometry,
  // every material and — the part the old hand-kept arrays got wrong
  // sitewide — every texture SLOT on each of them.
  return { group, meshes };
}

// Hover affordance for a spine: a small scale bump plus a warm glow on its
// front (title) face — same accent color as the panel's own cross-link
// glimmer (rgba(230,180,95,...) in library.css) — so a spine visibly
// signals "this is clickable" before the cursor even changes. Only the
// front material gets the glow — index 1 of the [body, front] array
// buildItems assembles per item, which was index 4 of a six-entry array
// before the regrouping in splitBoxIntoSpineAndBody above. Each item's
// materials are unique instances, never shared, so this never bleeds onto
// a neighboring spine.
const HOVER_GLOW_HEX = 0xe6b45f;
function setSpineHovered(mesh, isHovered) {
  mesh.scale.set(isHovered ? 1.04 : 1, isHovered ? 1.02 : 1, isHovered ? 1.15 : 1);
  const front = mesh.material[1];
  front.emissive.setHex(isHovered ? HOVER_GLOW_HEX : 0x000000);
  front.emissiveIntensity = isHovered ? 0.5 : 0;
}

// Distance a perspective camera must sit at to fit a `width` x `height`
// rectangle fully in frame, with `margin` extra room beyond an exact fit
// (1 = exact fit; >1 pulls back further). Checks both the vertical fit
// (straight from the camera's own fov) and the horizontal fit (derived
// from fov + the camera's actual aspect, the standard relationship
// between a perspective camera's vertical and horizontal field of view)
// and returns whichever one the rectangle's shape actually needs — so the
// shelf reframes itself correctly however wide or tall the grid grows
// (see COLS/ROWS above), rather than a distance hand-picked to fit
// today's 2x4 grid specifically.
function distanceToFit(camera, width, height, margin) {
  const halfFovY = THREE.MathUtils.degToRad(camera.fov) / 2;
  const distForHeight = ((height / 2) * margin) / Math.tan(halfFovY);
  const distForWidth = ((width / 2) * margin) / (Math.tan(halfFovY) * camera.aspect);
  return Math.max(distForHeight, distForWidth);
}

export function createLibrary(container, { preview = false, initialPieceId = null, onPieceChange = null } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  // Pulled back enough to keep the whole shelf in frame — computed from
  // the grid's actual TOTAL_W/TOTAL_H (see COLS/ROWS above) and this
  // camera's own fov/aspect, not a fixed distance, so the framing stays
  // correct however the grid's shape changes. The margin (an actual
  // design choice, not a derivable quantity) leaves room for the Library
  // of Babel backdrop to recede behind the shelf before the fog swallows
  // it.
  // Re-derivable rather than computed once: distanceToFit reads
  // camera.aspect, and every bound below is a ratio of what it returns, so
  // all of it has to be recomputed when the aspect changes — see the resize
  // handler at the bottom of this function for the bug that wasn't.
  //
  // Zoom range as a ratio of baseDist rather than a fixed distance, so it
  // scales along with the shelf if the grid ever grows (see COLS/ROWS
  // above). The ratios themselves are a real design choice, not a
  // derivable quantity — preview tiles get a narrower range since they're
  // a small, mostly non-interactive thumbnail, not a scene meant to be
  // explored up close.
  let baseDist, minDist, maxDist;
  function recomputeZoomRange() {
    baseDist = distanceToFit(camera, TOTAL_W, TOTAL_H, 1.3);
    minDist = baseDist * (preview ? 0.46 : 0.35);
    maxDist = baseDist * (preview ? 1.21 : 1.42);
  }
  recomputeZoomRange();
  camera.position.set(0, 0.15, baseDist);
  camera.lookAt(0, 0, 0);
  // Void tint (design-notes pass, 2026-09-01): was flat 0x000000, same
  // page-fallback black every other under-treated scene defaults to —
  // this shelf's own palette (PALETTE above) is a warm paper-and-wood
  // register, so the void around it now carries a matching dark umber
  // rather than a neutral black that fights it. Fog matched to the same
  // color, same convention as orrery.js — kept well past maxDist so the
  // shelf itself never fogs at any zoom level; it only ever dims the
  // Library of Babel backdrop receding behind it.
  const VOID_COLOR = 0x120d08;
  scene.fog = new THREE.Fog(VOID_COLOR, 18, 56);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setClearColor(VOID_COLOR, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  // This scene carries more geometry than any other on the site and was the
  // only one still handing the renderer a raw devicePixelRatio — a DPR-3
  // phone was shading nine fragments per CSS pixel, on exactly the scene
  // least able to afford it. manageRenderer caps that at 2 (indistinguishable
  // at these sizes, per the same finding beamline shipped on), and owns the
  // two other things this scene never had: a webglcontextlost handler, and a
  // real forceContextLoss() on teardown so a scene switch actually gives the
  // context back instead of orphaning it against the browser's ~16 cap.
  const managed = manageRenderer(renderer, {
    onLost: () => { cancelAnimationFrame(animId); animId = null; },
  });

  const root = new THREE.Group();
  scene.add(root);

  // Ambient trimmed slightly and key raised to compensate (design-notes
  // pass, 2026-09-01): flat ambient light washes matte materials evenly
  // regardless of surface angle, which is part of why the audit's "muted/
  // grey" read happened even though the books already carry real color —
  // less flat fill and a stronger directional key gives each spine more
  // local contrast (real shadow falloff across the box, a visible
  // highlight where the key catches it) instead of a uniformly lit block.
  scene.add(new THREE.AmbientLight(0xfff4e0, 0.55));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.35);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fa8ff, 0.4);
  rim.position.set(-5, -2, -4);
  scene.add(rim);

  // Library of Babel first, so it's fully behind the frame/items in the
  // group's draw order as well as in depth — added under root, not scene,
  // so it turns together with the shelf under drag rather than sitting
  // fixed like a skybox.
  // Full mode only. 197 nodes become 1,182 edge instances plus ~350 strands,
  // and its update() reissues ~1,700 setColorAt calls and flags three
  // instanceColor buffers for a full re-upload every single frame — all of
  // it invisible inside a 200px landing thumbnail, where the shelf itself
  // fills the frame and the backdrop is at most a few dark pixels at the
  // corners. Gated here and again in animate() below.
  const babel = preview ? null : buildBabelBackdrop();
  if (babel) root.add(babel.group);

  const frame = buildFrame();
  root.add(frame.group);

  // Books, films, divination decks, and now CDs — buildItems() places the
  // CDs among them via dealIntoCubbies() (see the CDs header comment
  // above), all one shelf, one group, one everything below.
  const items = buildItems(preview);
  root.add(items.group);

  // ─── Hint + panel (full only) ────────────────────────────────────────────
  let hint = null, panel = null, panelTitle = null, panelCreator = null, panelBodyEl = null, panelCloser = null, jumpList = null;
  let panelSlideMs = 500; // replaced from CSS once the panel is in the document — see below
  // container is the one shared #experience-container element, which main.js
  // empties between scenes but never replaces — so every inline style and
  // attribute a scene writes onto it outlives that scene. This one wrote
  // position, overflow, tabIndex and (on every hover) cursor, and put none of
  // them back. claimContainer records what was there first and hands back the
  // restore() dispose() now calls; every cursor write below goes through its
  // setCursor so the restore is guaranteed to cover them too.
  //
  // tabIndex -1 makes the container programmatically focusable, so closing
  // the panel (✕, outside click, or Escape) has somewhere real to send focus
  // back to rather than leaving it on a now-hidden close button or nowhere.
  const claim = preview ? null : claimContainer(container, { tabIndex: -1 });

  // Every deferred bit of panel choreography below is scheduled through this
  // so dispose() can drop all of it in one call. The 500ms side-flip was the
  // live bug: click a spine on the opposite side of the container, then leave
  // the scene within half a second, and populatePanel() ran against a
  // detached panel and called onPieceChange() — which is how main.js writes
  // the URL, so a scene the visitor had already left rewrote location.hash
  // out from under the one that replaced it. theater.js's endCardTimer
  // already solves exactly this shape.
  const timers = trackTimers();
  // Hint/panel/library-link markup+styles live in library.html and
  // library.css — no runtime element construction or style injection
  // needed now that both are real files, pulled in via parseHTML. This
  // scene briefly had a bottom-center title/subtitle ("Library" / "the
  // library — once removed") in the 2026-08-25 site-wide title
  // consistency pass; removed again same day, both lines, per Scott's
  // call — no title chrome here.
  if (!preview) {
    const shell = parseHTML(libraryHtml);
    hint = shell.querySelector('.library-hint');
    panel = shell.querySelector('.library-panel');
    document.body.appendChild(hint);

    container.appendChild(panel);
    panelTitle = panel.querySelector('.library-panel-title');
    panelCreator = panel.querySelector('.library-panel-creator');
    panelBodyEl = panel.querySelector('.library-panel-body');

    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('.library-panel-close'),
      onClose: closePanel,
    });

    // The side-flip below has to wait out .library-panel's own close
    // transition before it can re-anchor and reopen the panel. That duration
    // belongs to the stylesheet, not to a magic 500 hand-mirrored here with a
    // comment promising the two agree — same single-source-of-truth move
    // main.js makes for --scene-crossfade, including the fallback, because
    // getPropertyValue returns '' for an undeclared property and a NaN
    // timeout fires immediately (which here would flip the panel's side
    // mid-slide, in full view).
    const rawSlide = getComputedStyle(panel).getPropertyValue('--library-panel-slide').trim();
    const slideNum = parseFloat(rawSlide);
    panelSlideMs = !Number.isFinite(slideNum) ? 500 : (rawSlide.endsWith('ms') ? slideNum : slideNum * 1000);

    // Cross-link navigation — follow the threads (click + keyboard), same
    // fade-out/swap-content/fade-in beat as sphere.js's navigateToFragment
    // and orbiter.js's navigateToPoem. Deliberately doesn't touch `selected`/the
    // spine the panel was originally opened from, same precedent those two
    // set — following a link swaps panel content, nothing in the 3D scene.
    // populatePanel (defined below, hoisted) re-stripes every .library-link
    // it renders, so no separate stagger step is needed here.
    // `targetScene` is always 'library' today — links.js has no cross-scene
    // entries yet (this pass builds the addressing/store the next one needs,
    // it doesn't author new cross-scene links itself; see NOTES.md). A
    // non-library target is left as a no-op rather than silently mis-firing:
    // whichever pass wires up cross-scene navigation gives this a real body
    // (main.js's hash router already resolves `#scene/id` for any scene, so
    // that'll likely just be `location.hash = \`${targetScene}/${targetId}\``).
    function navigateToItem(targetScene, targetId) {
      if (targetScene !== 'library') return;
      const target = libraryItems.find(i => i.id === targetId);
      if (!target) return;
      panelBodyEl.style.transition = 'opacity .18s';
      panelBodyEl.style.opacity = '0';
      timers.after(180, () => {
        populatePanel(target);
        panel.scrollTop = 0;
        panelBodyEl.style.opacity = '1';
        timers.after(50, () => panelTitle.focus());
      });
    }
    // One handler, not two. wireCrossLinks now emits a real
    // <a href="#library/id">, and pressing Enter on a real anchor dispatches
    // a click — so this listener already IS the keyboard path, and the
    // separate Enter/Space keydown handler that used to sit here (needed only
    // because an <a> with no href isn't activatable) is duplicate work on the
    // same event. Space on a link was always a semantic mismatch anyway.
    //
    // What the handler still owns is the in-panel fade-and-swap: following a
    // thread replaces the panel's content in place rather than reloading the
    // scene through the hash router, and populatePanel's own onPieceChange
    // keeps the URL in step. preventDefault is what stops the anchor ALSO
    // navigating and double-handling the same jump — but only for a plain
    // primary click, so the middle-click/⌘-click/open-in-new-tab behaviour a
    // real href just gave these links back still reaches the browser.
    // stopPropagation stays: without it this click carries on to the
    // container's own canvas click handler underneath the panel.
    panelBodyEl.addEventListener('click', e => {
      const link = e.target.closest('.library-link');
      if (!link) return;
      e.stopPropagation();
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigateToItem(link.dataset.targetScene, Number(link.dataset.targetId));
    });
  }

  // The scene-specific half of a close: panelCloser (sceneKit.js) handles
  // the .open toggle, Escape, the outside-click trigger, and returning
  // focus to `container` — this only does what's specific to the library
  // (clear the video embed, deselect the spine). Doesn't touch focus itself,
  // since not every close should move it (the in-place item swap, for one,
  // deliberately doesn't call this at all).
  function closePanel() {
    if (!panel) return;
    panel.querySelector('.library-panel-video').innerHTML = '';
    selected = null;
  }

  // ─── Hover/click raycast, screen-space mouse (matches orbiter/sphere) ───────
  // The container's rect is cached rather than measured per pointer event.
  // getBoundingClientRect() forces a synchronous layout, and a mousemove
  // listener fires at the pointer's poll rate — up to 120Hz on a recent
  // trackpad, not the frame rate — so hovering used to cost one forced layout
  // plus 265 bounding-sphere tests plus a freshly allocated results array per
  // pointer sample, most of them between two frames nobody ever saw. Now a
  // move only records where the pointer is; the raycast happens once per
  // frame, in animate().
  //
  // The rect is refreshed from three places, which between them cover every
  // way it can move: the existing guarded-resize callback, window scroll, and
  // the pointer entering the container (which is what covers the overlay's
  // own open/close transition — that animates the container's box over
  // ~600ms and fires no resize event at all).
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null, selected = null;
  let containerRect = null;
  const pointer = { x: 0, y: 0 };
  let pointerMoved = false;
  let onContainerMouseMove = null, onContainerClick = null, onContainerMouseLeave = null,
      onContainerMouseEnter = null, onWindowScroll = null;
  let touchGuard = null;

  function refreshRect() { containerRect = container.getBoundingClientRect(); }

  function pickAt(clientX, clientY) {
    if (!containerRect) refreshRect();
    mouse.x = ((clientX - containerRect.left) / containerRect.width) * 2 - 1;
    mouse.y = -((clientY - containerRect.top) / containerRect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(items.meshes);
    return hits.length ? hits[0].object : null;
  }

  // ─── Cover prefetch ─────────────────────────────────────────────────────
  // Scott: "when I open a book, there's a pause between the imageload and the
  // render." There was, and the reason is that the cover request did not start
  // until the panel opened — `coverEl.src = ...` in populatePanel was the
  // first anybody had asked for it, so the panel drew, sat empty, and then
  // reflowed when the bytes arrived.
  //
  // Preloading all 103 covers on entry is the obvious answer and the wrong
  // one: 103 requests to a third party for images almost none of which anybody
  // will look at. But you cannot click a spine without pointing at it first,
  // so hovering IS the prefetch signal, and it is already computed once a
  // frame by the raycast below. One `new Image()` per newly-hovered spine, at
  // most one request per cover per visit, and by the time the click lands the
  // browser cache has it.
  //
  // Requesting the same size the panel actually draws matters as much as the
  // timing. It asked Open Library for `-L`, their large size, and drew it at
  // 26% of a panel — a few hundred pixels of image for about a hundred
  // pixels of space. `-M` is the size that fits, retina included.
  const coverSeen = new Set();
  function coverUrl(it) {
    return it?.isbn13 ? `https://covers.openlibrary.org/b/isbn/${it.isbn13}-M.jpg` : null;
  }
  function prefetchCover(it) {
    const url = coverUrl(it);
    if (!url || coverSeen.has(url)) return;
    coverSeen.add(url);
    const img = new Image();
    // Nothing reads this Image again — it exists so the browser puts the
    // bytes in its own cache, where the panel's <img> will find them.
    img.decoding = 'async';
    img.src = url;
  }

  // Called once a frame from animate() — see the note above.
  function updateHover() {
    if (!pointerMoved || panel?.classList.contains('open')) return;
    pointerMoved = false;
    const hitMesh = pickAt(pointer.x, pointer.y);
    if (hitMesh !== hovered) {
      if (hovered) setSpineHovered(hovered, false);
      hovered = hitMesh;
      if (hovered) {
        setSpineHovered(hovered, true);
        prefetchCover(hovered.userData.item);
      }
    }
    claim?.setCursor(hovered ? 'pointer' : 'default');
  }

  // Fills the (already-open, or about-to-open) panel with one item's
  // content. Pulled out into its own function so both a direct spine click
  // and following a cross-link (navigateToItem, above) can populate the
  // same panel without duplicating this logic.
  function populatePanel(it) {
    // CDs-on-shelf carry a string id ("cd-<n>", dealIntoCubbies above) —
    // deliberately disambiguated from libraryItems' plain numeric ids
    // since they share the same 1..N range in their own source arrays.
    // links.js and the #library/<id> hash only ever address the numeric
    // (book/film/deck) space today, so a CD's own numeric id isn't
    // reported here — see NOTES.md's "Linking & addressing" entry.
    if (typeof it.id === 'number') onPieceChange?.(it.id);
    panel.querySelector('.library-panel-kind').textContent =
      ({ book: 'Book', dvd: 'DVD', bluray: 'Blu-ray', divination_box: 'Divination deck', cd: 'Album' })[it.type] || it.type;
    panelTitle.textContent = it.title;
    panelCreator.textContent = it.creator || '';

    // Bibliographic/filmographic detail lines — only the fields a given
    // item actually has (books carry isbn13/publisher/pages, films carry
    // release_year/runtime/country; not every field applies to every
    // item). See library.text.js's header for how these were sourced.
    const detailsEl = panel.querySelector('.library-panel-details');
    const excerptEl = panel.querySelector('.library-panel-excerpt');
    const excerptFromEl = panel.querySelector('.library-panel-excerpt-from');
    const coverEl = panel.querySelector('.library-panel-cover');
    const videoEl = panel.querySelector('.library-panel-video');
    const sceneEl = panel.querySelector('.library-panel-scene');
    const refsEl = panel.querySelector('.library-panel-refs');
    refsEl.textContent = typeof it.id === 'number'
      ? formatInboundNote(
          getInboundLinks('library', it.id).map(l => libraryItems.find(i => i.id === l.from.id)?.title)
        ) ?? ''
      : '';
    // One imprint line, then credits. Until 4.11.21 this was a stack of up to
    // seven short paragraphs, and on a book — which has no video, no scene
    // caption and, for most of the shelf, no excerpt — that stack WAS the
    // panel: publisher, then page count, then a thirteen-digit ISBN, each on
    // its own line. Three lines of inventory is what a catalogue record looks
    // like, not what a shelf looks like.
    //
    // So the bibliographic facts join into one line and the ISBN comes out of
    // the display entirely. It stays in the data: it is how the cover is
    // looked up (Open Library keys on it), and it is the identifier that made
    // the catalogue checkable in the first place. It is simply not something
    // anybody opens a panel to read.
    const facts = [];
    if (it.publisher) facts.push(`${it.publisher}${it.publish_year ? `, ${it.publish_year}` : ''}`);
    if (it.release_year) facts.push(String(it.release_year));
    if (it.country) facts.push(it.country);
    if (it.pages) facts.push(`${it.pages} pages`);
    if (it.runtime_min) facts.push(`${it.runtime_min} min`);
    const lines = [];
    if (facts.length) lines.push(facts.join(' · '));
    if (it.writer) lines.push(`written by ${it.writer}`);
    if (it.producer) lines.push(`produced by ${it.producer}`);
    // Escaped at the join rather than field by field: publisher, writer and
    // producer were being interpolated raw into innerHTML while every
    // neighbouring field in this function went through escapeHtml. Nothing in
    // today's catalog carries markup, so this was latent rather than broken —
    // but "latent" is a property of the data, and library.text.js's own
    // header describes fields transcribed from real bibliographic sources.
    // One escape here covers every line the block can ever grow.
    detailsEl.innerHTML = lines.map(l => `<p>${escapeHtml(l)}</p>`).join('');
    // The `note` field is gone from the catalog as of 4.11.21 — see
    // src/links.js's own block on what it was and why it went. Nothing here
    // renders commentary any more; a panel shows what the object is, what it
    // says, and what it is referenced by.

    // Content area, above the bibliographic details: a film gets its
    // pivotal scene embedded (not just linked), a CD gets a music video or
    // live performance the same way (see the CDs header comment above), a
    // book gets its excerpt (plain text, not a blockquote, sits above the
    // details block) plus a cover thumbnail when a cover image is
    // publicly available via Open Library's covers API (keyed off the
    // ISBN we already looked up) -- this is the "real image" allowance
    // for the art/photo/reference books that don't have a natural
    // textual excerpt. See library.text.js's header for the
    // sourcing/copyright discipline behind these fields. Cross-links
    // live inline in note/scene/excerpt/excerpt_from text, rendered via
    // renderLinkedField -- see src/links.js.
    videoEl.innerHTML = '';
    sceneEl.innerHTML = '';
    if (it.youtube) {
      const embedSrc = youtubeEmbedSrc(it.youtube);
      if (embedSrc) videoEl.appendChild(buildVideoFacade(it, embedSrc));
      const captionLabel = it.type === 'cd' ? 'video' : 'pivotal scene';
      sceneEl.innerHTML = it.scene ? `${captionLabel}: ${renderLinkedField(it.id, 'scene', it.scene)}` : '';
    }

    excerptEl.innerHTML = it.excerpt ? `“${renderLinkedField(it.id, 'excerpt', it.excerpt)}”` : '';
    excerptFromEl.innerHTML = it.excerpt_from ? `— ${renderLinkedField(it.id, 'excerpt_from', it.excerpt_from)}` : '';

    // The cover is very likely already in cache (prefetchCover, above). When
    // it is not — a keyboard visitor, a deep link straight to #library/<id>,
    // a cold cache — it fades in over its own reserved box instead of
    // appearing and shoving the text down. `hidden` still does the hiding on
    // error, so a cover Open Library does not have leaves no gap.
    const coverSrc = coverUrl(it);
    if (coverSrc) {
      coverEl.hidden = false;
      coverEl.classList.remove('loaded');
      coverEl.onerror = () => { coverEl.hidden = true; };
      coverEl.onload = () => { coverEl.classList.add('loaded'); };
      coverEl.src = coverSrc;
      coverEl.alt = `Cover of ${it.title}`;
      // A cached image can finish before onload is attached in some engines.
      if (coverEl.complete && coverEl.naturalWidth) coverEl.classList.add('loaded');
    } else {
      coverEl.hidden = true;
      coverEl.removeAttribute('src');
    }

    panel.querySelectorAll('.library-link').forEach(link => {
      const delay = (Math.random() * 12).toFixed(1);
      const duration = (9 + Math.random() * 7).toFixed(1);
      link.style.animationDelay = `-${delay}s`;
      link.style.animationDuration = `${duration}s`;
      const targetItem = link.dataset.targetScene === 'library'
        ? libraryItems.find(i => i.id === Number(link.dataset.targetId))
        : null;
      link.setAttribute('aria-label', `Go to: ${targetItem ? targetItem.title : 'related item'}`);
    });
  }

  // Populate the panel with one item and open it fresh — shared by the
  // spine click handler's own "nothing open yet" branch and the keyboard
  // jump list below, neither of which needs the click handler's other
  // branch (swapping content in an already-open panel without closing it
  // first, tuned for a mouse clicking rapidly across adjacent spines).
  function openItem(mesh, { fromLeft } = {}) {
    selected = mesh;
    populatePanel(mesh.userData.item);
    if (!panel.classList.contains('open') && fromLeft !== undefined
        && panel.classList.contains('from-left') !== fromLeft) {
      setPanelSide(panel, fromLeft);
    }
    panel.classList.add('open');
    timers.after(50, () => panelTitle.focus());
  }

  // ─── Keyboard jump list ──────────────────────────────────────────────────
  // Keyboard equivalent for "point at a spine" — spines are otherwise
  // raycast-only, and nothing simulates "point at one" from a keyboard.
  // Selecting closes first (a harmless no-op if nothing's open) rather than
  // reusing the click path's in-place-swap animation, which is tuned for a
  // mouse rapidly clicking across adjacent spines, not a single deliberate
  // keyboard pick.
  //
  // Built here rather than through sceneKit's shared createJumpList, which
  // every other raycast scene still uses. That helper builds one flat <ul> of
  // buttons parked off-screen and revealed one at a time on focus — exactly
  // right for sphere's 24 facets, and a WCAG 2.4.1 (Bypass Blocks) failure at
  // this scene's 265, where a keyboard visitor entering the scene has 265 tab
  // stops in front of them, no grouping, no search, and no way past. The 115
  // CDs are most of it.
  //
  // Three native <details> groups (Books / Films / Music) inside a <nav>, all
  // closed to begin with, plus a leading "skip the shelf" control: closed,
  // the whole list is four tab stops; open one and you get that group and
  // nothing else. <details>/<summary> is keyboard-operable on its own, so
  // there is no roving-tabindex or type-ahead machinery here to get wrong.
  // Within a group the items are sorted by title rather than left in shelf
  // order — a jump list is for finding a known title, not for walking the
  // shelf, which is what the shelf itself is for.
  //
  // What this would want from createJumpList to move back into sceneKit (that
  // file is another owner's): an optional `groups` shape — [{ label, items }]
  // — rendering one collapsed <details> per group with a count in the
  // summary, a `skipLabel` option for the leading bypass control, and a
  // caller-supplied sort. Every scene that passes a flat `items` array today
  // would keep working unchanged.
  function buildJumpList() {
    const nav = document.createElement('nav');
    nav.className = 'library-jumplist';
    nav.setAttribute('aria-label', 'Browse the shelf');
    // The list lives INSIDE the scene container (it has to — it's the
    // keyboard equivalent of pointing at something in it), so without this
    // every activation bubbles straight on to the container's own canvas
    // click handler. That handler sees a panel that is now open and a
    // raycast that hit nothing — a keyboard-activated click reports
    // clientX/clientY of 0, i.e. the viewport's top-left corner — and
    // closes the panel the button just opened. Found live in v4.0 while
    // rebuilding this list: it predates the rebuild (sceneKit's
    // createJumpList appends into the container the same way), and it made
    // the entire keyboard path silently useless whenever the corner of the
    // frame happened to be empty. Same guard createPanelCloser puts on the
    // panel itself, for the same reason.
    nav.addEventListener('click', e => e.stopPropagation());

    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'library-jumplist-skip';
    skip.textContent = 'Skip the shelf';
    skip.addEventListener('click', () => {
      // Collapse whatever was open on the way past, so the next Tab doesn't
      // drop the visitor straight back into 115 albums.
      nav.querySelectorAll('details[open]').forEach(d => { d.open = false; });
      container.focus();
    });
    nav.appendChild(skip);

    const GROUPS = [
      { label: 'Books', match: it => isBookType(it) },
      { label: 'Films', match: it => isFilmType(it) },
      { label: 'Music', match: it => it.type === 'cd' },
    ];
    GROUPS.forEach(g => {
      const group = items.meshes
        .filter(m => g.match(m.userData.item))
        .sort((a, b) => a.userData.item.title.localeCompare(b.userData.item.title));
      if (!group.length) return;
      const details = document.createElement('details');
      details.className = 'library-jumplist-group';
      const summary = document.createElement('summary');
      summary.textContent = `${g.label} — ${group.length}`;
      details.appendChild(summary);
      const ul = document.createElement('ul');
      group.forEach(mesh => {
        const it = mesh.userData.item;
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = it.creator ? `${it.title} — ${it.creator}` : it.title;
        btn.addEventListener('click', () => { closePanel(); openItem(mesh, { fromLeft: false }); });
        li.appendChild(btn);
        ul.appendChild(li);
      });
      details.appendChild(ul);
      nav.appendChild(details);
    });

    container.appendChild(nav);
    return { dispose() { nav.remove(); } };
  }

  if (!preview) {
    // The trailing click a touch-drag fires when the finger lifts. Library
    // was the last raycast scene without this guard, and it was not a
    // theoretical hazard here: bindOrbitDrag binds touch, so on a phone
    // EVERY drag to spin the shelf ended by opening the read panel for
    // whichever spine happened to be under the finger when it left the
    // glass. sphere, orrery, outside, harmonics and beamline all already
    // consume this the same way — see bindTapVsDrag's own comment.
    touchGuard = bindTapVsDrag(container);

    onContainerMouseMove = e => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointerMoved = true; // the raycast itself happens in animate()
    };
    container.addEventListener('mousemove', onContainerMouseMove);

    onContainerMouseEnter = refreshRect;
    container.addEventListener('mouseenter', onContainerMouseEnter);

    onWindowScroll = refreshRect;
    window.addEventListener('scroll', onWindowScroll, { passive: true });

    onContainerMouseLeave = () => {
      if (hovered) { setSpineHovered(hovered, false); hovered = null; }
      pointerMoved = false;
      claim?.setCursor('default');
    };
    container.addEventListener('mouseleave', onContainerMouseLeave);

    onContainerClick = e => {
      if (touchGuard.consume()) return;
      // A click is rare enough to afford its own fresh measurement, and
      // measuring here means the panel's side is decided against the box the
      // visitor actually clicked in rather than a possibly stale one.
      refreshRect();
      const rect = containerRect;
      const hitMesh = pickAt(e.clientX, e.clientY);
      const it = hitMesh ? hitMesh.userData.item : null;

      if (hitMesh && hovered !== hitMesh) {
        if (hovered) setSpineHovered(hovered, false);
        hovered = hitMesh;
        setSpineHovered(hovered, true);
      }

      if (panel.classList.contains('open')) {
        // Any click that reaches here is on the canvas, not the panel —
        // the panel's own listener (above) already stopPropagation()s
        // clicks inside it. Raycast the click directly (already done
        // above) and, if it hit a spine, swap the panel's content in
        // place (same fade beat as navigateToItem) instead of closing, so
        // clicking a new item while the panel's open replaces the content
        // immediately rather than needing a second click.
        if (hitMesh) {
          selected = hitMesh;

          // The in-place content fade below only applies when the click
          // is on the panel's current side (no need to move anything) —
          // it crosses to a real close/reopen when the side actually
          // changes, so the panel visibly relocates the way it does on a
          // fresh open, instead of an instant same-frame teleport (which
          // flipping `from-left` while `open` would cause, since the
          // panel is fully on-screen at that point).
          const clickedLeft = clickedLeftHalf(e, rect);
          if (panel.classList.contains('from-left') !== clickedLeft) {
            panel.classList.remove('open');
            // panelSlideMs is .library-panel's own --library-panel-slide,
            // read from the stylesheet rather than hardcoded here; tracked so
            // leaving the scene inside that window can't land populatePanel
            // (and its onPieceChange -> location.hash write) on a detached
            // panel.
            timers.after(panelSlideMs, () => {
              setPanelSide(panel, clickedLeft);
              populatePanel(it);
              panel.scrollTop = 0;
              panelBodyEl.style.opacity = '1'; // guard against a same-side fade-out still in flight
              panel.classList.add('open');
              timers.after(50, () => panelTitle.focus());
            });
            return;
          }

          panelBodyEl.style.transition = 'opacity .18s';
          panelBodyEl.style.opacity = '0';
          timers.after(180, () => {
            populatePanel(it);
            panel.scrollTop = 0;
            panelBodyEl.style.opacity = '1';
          });
          return;
        }
        panelCloser.close();
        return;
      }

      if (!hitMesh) return;
      // Panel is guaranteed closed here (the block above already returns
      // early for an open-panel click), so flipping the anchor side is
      // invisible to the user.
      openItem(hitMesh, { fromLeft: clickedLeftHalf(e, rect) });
    };
    container.addEventListener('click', onContainerClick);

    jumpList = buildJumpList();
  }

  // Deep-link entry/re-entry — resolves a (numeric, book/film/deck-space —
  // see populatePanel's comment) piece id to its spine mesh and opens it,
  // same beat as a real spine click or jump-list pick. No-op in preview
  // mode or if the id doesn't resolve.
  function openPieceById(id) {
    const mesh = items.meshes.find(m => m.userData.item.id === id);
    if (mesh) openItem(mesh, { fromLeft: false });
  }
  if (!preview && initialPieceId !== null) openPieceById(initialPieceId);

  // ─── Drag to orbit/pan + wheel zoom ──────────────────────────────────────
  // The shelf only turns under drag, no auto-rotate.
  //
  // Vertical drag pans the camera rather than tilting the shelf object:
  // the camera and its look target translate up/down together along the
  // shelf's height (an "elevator," not a tilt), the same `dy` sign
  // convention orrery.js's mouse-look uses (drag up -> look up). This
  // keeps the top and bottom row's center reachable at any zoom level,
  // which a fixed-angle object tilt can't guarantee once the shelf is
  // tall enough that the topmost row sits well off dead-center at min
  // zoom. `panLimit` is sized off TOTAL_H/CUBBY_H so the top and bottom
  // row's center is always reachable, with a little headroom past it.
  // Horizontal drag is unchanged — still spins the shelf object itself.
  const baseCamLift = 0.15; // small permanent downward-look bias, kept from the original framing
  let camDist = camera.position.length();
  let panY = 0;
  const panLimit = TOTAL_H / 2 - CUBBY_H / 2 + 0.3;
  const vertPanScale = panLimit / 0.4; // scales drag distance to the pan range
  function updateCamera() {
    camera.position.set(0, panY + baseCamLift, camDist);
    camera.lookAt(0, panY, 0);
  }

  const orbitDrag = bindOrbitDrag(container, {
    onDrag: (dx, dy) => {
      root.rotation.y += dx;
      panY = Math.max(-panLimit, Math.min(panLimit, panY - dy * vertPanScale));
      updateCamera();
    },
  });

  // minDist/maxDist live in recomputeZoomRange() near the camera above, since
  // every one of them is re-derived on resize.
  const wheelZoom = bindWheelZoom(container, {
    isBlocked: () => !preview && panel?.classList.contains('open'),
    onZoom: deltaY => {
      camDist = Math.max(minDist, Math.min(maxDist, camDist + deltaY * 0.004));
      updateCamera();
    },
  });

  // Sampled live, not only at mount: a visitor who turns the OS setting on
  // while the scene is already open used to keep the shimmer until they
  // navigated away. The shimmer is a per-frame color write, so flipping it at
  // runtime costs nothing — this is exactly the case onReducedMotionChange
  // exists for (a scene that bakes the decision into geometry legitimately
  // can't).
  let reduceMotion = prefersReducedMotion();
  const motionWatch = onReducedMotionChange(m => { reduceMotion = m; });

  // Real elapsed time, not a fixed constant per frame. requestAnimationFrame
  // fires at the display's refresh rate, so the old `babelT += 0.016` ran the
  // shimmer at double speed on any 120Hz display and half speed on a
  // throttled one — orrery, outside and harmonics all already derived theirs
  // from performance.now(); library was the outlier.
  const clock = createFrameClock();

  let animId = null;
  let paused = false;
  let disposed = false;
  let babelT = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    // Library of Babel shimmer — same per-object phase/speed pulse
    // convention as orbiter.js's per-particle drift and aurora shimmers,
    // adapted to InstancedMesh (see buildBabelBackdrop's update()). `dt * 60`
    // preserves the rate the old per-frame 0.016 was hand-tuned at on a 60Hz
    // display, rather than silently retuning it while fixing the timebase.
    if (babel && !reduceMotion) {
      babelT += dt * 60 * 0.016;
      babel.update(babelT);
    }
    updateHover();
    renderer.render(scene, camera);
  }
  animate();

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    // A window dragged between a Retina and a non-Retina display changes
    // devicePixelRatio with no other signal — see manageRenderer's comment.
    managed.applyPixelRatio();
    // The zoom range is derived from how far back this camera has to sit to
    // fit the shelf, which depends on camera.aspect — which just changed.
    // Before v4.0 the handler updated the aspect and the renderer and left
    // the clamp bounds at whatever the aspect had been at construction: open
    // the library in landscape on a phone and rotate to portrait, and the
    // shelf's left and right edges ran off frame with no zoom range able to
    // recover them, though distanceToFit's own comment promises the framing
    // stays correct however the grid's shape changes. The visitor's current
    // zoom is carried across as a RATIO of the new base distance, so rotating
    // the phone re-frames the shelf without also throwing away how far in
    // they had zoomed.
    const zoomRatio = camDist / baseDist;
    recomputeZoomRange();
    camDist = Math.max(minDist, Math.min(maxDist, baseDist * zoomRatio));
    panY = Math.max(-panLimit, Math.min(panLimit, panY));
    updateCamera();
    refreshRect();
    // setSize() clears the drawing buffer, and while paused nothing is going
    // to redraw it — so a resize that lands on a paused scene (a background
    // tab, an off-screen preview tile) would otherwise leave a black canvas
    // sitting there until the visitor came back. One frame, only when the
    // loop isn't running to produce it.
    if (paused) renderer.render(scene, camera);
  });

  return {
    // Same-scene deep link support (main.js's expandScene) — see
    // openPieceById above.
    openPieceById,
    // The other half of that: `#library/12` edited back down to `#library`
    // means "close the piece," which main.js asks every scene with piece-level
    // open/closed state for (optional-chained, so scenes without one need no
    // stub). The library has exactly that state, so it answers.
    closePiece() { panelCloser?.close(); },
    // main.js pauses preview tiles while a full scene is open, and pauses on
    // visibilitychange. Pausing stops the rAF loop outright rather than
    // rendering into a canvas nobody is looking at — which for this scene is
    // 265 spines and, in full mode, the whole Babel field's per-frame color
    // re-upload.
    setPaused(nextPaused) {
      // A torn-down scene stays down: main.js pauses and resumes from
      // document-level listeners that can outlive one scene's lifetime by a
      // frame or two, and resuming here would restart the loop against a
      // renderer whose context has already been released.
      if (disposed) return;
      const wanted = !!nextPaused;
      if (wanted === paused) return;
      paused = wanted;
      if (paused) {
        cancelAnimationFrame(animId);
        animId = null;
      } else {
        // Resync first, or the first frame back carries the whole paused span
        // as one clamped dt and the shimmer visibly jumps.
        clock.resync();
        animate();
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animId);
      timers.dispose();
      motionWatch.dispose();
      orbitDrag.dispose();
      touchGuard?.dispose();
      wheelZoom.dispose();
      resize.dispose();
      panelCloser?.dispose();
      jumpList?.dispose();
      if (onContainerMouseMove) container.removeEventListener('mousemove', onContainerMouseMove);
      if (onContainerClick) container.removeEventListener('click', onContainerClick);
      if (onContainerMouseLeave) container.removeEventListener('mouseleave', onContainerMouseLeave);
      if (onContainerMouseEnter) container.removeEventListener('mouseenter', onContainerMouseEnter);
      if (onWindowScroll) window.removeEventListener('scroll', onWindowScroll);
      // One traversal of the actual scene graph instead of three hand-kept
      // arrays. This scene's own three-arrays version was complete and
      // correct, unusually — but only for the slots it happened to name, and
      // routing it through the shared helper is what makes the texture-slot
      // coverage uniform site-wide rather than per-scene folklore. It also
      // reaches anything added to `root` later that a hand-kept array
      // wouldn't have known about.
      disposeSceneGraph(root);
      // Frees the GL context for real (THREE's renderer.dispose() does not)
      // and removes the canvas — see manageRenderer's own comment.
      managed.dispose();
      claim?.restore();
      if (hint) hint.remove();
      if (panel) panel.remove();
    },
  };
}
