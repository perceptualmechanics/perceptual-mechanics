// ─── The Scroll ────────────────────────────────────────────────────────────
// Pre-Christian. No illumination in the Kells sense — no gold leaf, no
// jewel-bright interlace, no titles. This is meant to read as something
// found, not published: a hide-and-bark scroll a bard kept adding to across
// twelve years (2000–2012), patch lashed to patch as new material came in,
// the oldest hide darkest and most soot-stained, the newest still pale.
// The only mark on it besides the words themselves is the Ogham letter Sail
// (ᏸ, fourth of the Aicme Beithe: four strokes off a stemline), carved once
// at the very top — the same glyph the preview medallion carries.
//
// Seven pieces, chronological, full texts, no titles/sources/dates/glosses:
//   Iron Gods · Flying · Thoughts Of Death Abounds       (Spoonfed / FORCEFED, c. 2000)
//   The Impossible Bliss of Self-Mutilation               (2002)
//   Identity Theft                                        (2009)
//   Holography · Projection                               (2009–2012)
//
// Two honest notes on what's NOT here:
//  — Holography is excerpted, not full. The real chapter runs to roughly
//    10,500 words; what's here is one complete, self-contained movement —
//    Jeremy Constantilios's flight into and landing in Los Angeles — ending
//    at a natural scene break. Everything else on this scroll is the
//    complete original text.
//  — Truth and Beauty didn't make the cut. Its screenplay-dialogue format
//    (CELLIST: / BRIAN: —) sat wrong against straight prose once titles and
//    scene-framing were gone; it's still on the site, in The Theater.
//  — Projection's one embedded scene (Scott and Ali on the patio) is the
//    exception to "straight prose": it was always a scene the narrator was
//    recounting, so it's broken out of the running paragraph and set in
//    real Hollywood script format — slug line, action, character, dialogue —
//    the one deliberate island of screenplay formatting left on the scroll.
//    Not a word of it changed; only the line breaks are new.
//
// A handful of phrases are still live links — words that genuinely echo
// across pieces (Self-Mutilation's refusal to be "afraid to lose everything"
// answering Thoughts Of Death Abounds' own closing line about the same;
// Jeremy Constantilios himself, walking out of Projection and straight into
// Holography). No new text was written to make these connections — they're
// all already there in his own words.
//
// Content note: The Impossible Bliss of Self-Mutilation and Identity Theft
// are both considerably darker and more graphic than what was here before —
// body horror played for pitch-black comedy and social commentary, not a
// tonal match for the neighboring pieces so much as a deliberate contrast.
// Full, unedited text; nothing softened.
//
// No longer CSS-only by design constraint — this pass leans on a few hidden
// inline SVG filters (feTurbulence/feDisplacementMap for grain and wobble)
// alongside the CSS, in service of one goal: this should read as a beaten,
// handled object, not a rendered one. Every patch is clipped to its own
// randomized, ragged, disjointed perimeter — not just a torn top and
// bottom, the whole hide-shape is uneven. Ink stains and worn patches are
// scattered per instance. Every line of body text carries its own small
// random tilt, drift, and size, like it was actually written by a hand and
// not set by a machine. The mood being chased is a bard scribbling fast by
// the last of the candlelight, not a ransom note: emphasis pulls the
// tracking wide and lets it glow like it caught the light, or crowds the
// words together and jostles them off their baseline like the hand
// couldn't keep up. The background behind the scroll is now that same
// candlelight — an unsteady, flickering glow over a dark worktable, not a
// flat vignette. No canvas, no WebGL, no raster images — still all
// vector/filter math, generated fresh in the browser, just with more tools
// in the box.

import { ironGods, flying, death, selfMutilation, identityTheft, holography, projection, projectionScript } from '../text/scrollTexts.js';

const PATCHES = [
  { key: 'iron',           id: 'patch-iron',           body: ironGods,        tone: 0 },
  { key: 'flying',         id: 'patch-flying',         body: flying,          tone: 1 },
  { key: 'death',          id: 'patch-death',          body: death,           tone: 1 },
  { key: 'selfmutilation', id: 'patch-selfmutilation', body: selfMutilation,  tone: 2 },
  { key: 'identity',       id: 'patch-identity',       body: identityTheft,   tone: 2 },
  { key: 'holography',     id: 'patch-holography',     body: holography,      tone: 3 },
  { key: 'projection',     id: 'patch-projection',     body: projection,      tone: 4 },
];

const MOTIF_CYCLE = ['spiral', 'chevron', 'cupring', 'dots'];

// Phrases already present in the raw text that get wired as live cross-links.
const LINKS = [
  { patch: 'selfmutilation', para: 0,  phrase: "You can’t be afraid to lose everything.", target: 'patch-death' },
  { patch: 'projection',     para: 36, phrase: 'Jeremy Constantilios',                    target: 'patch-holography' },
  { patch: 'holography',     para: 0,  phrase: 'Jeremy Constantilios',                    target: 'patch-projection' },
];

// Rubric ink — color only, no link. Sparingly applied, echoing across pieces.
const RUBRICS = [
  { patch: 'iron',           para: 0,  phrase: 'absolute lie' },
  { patch: 'flying',         para: 8,  phrase: "I'm flying. Finally." },
  { patch: 'death',          para: 2,  phrase: 'Thoughts of death abound' },
  { patch: 'selfmutilation', para: 16, phrase: 'Fuck them.' },
  { patch: 'identity',       para: 18, phrase: 'Something detached.' },
  { patch: 'holography',     para: 15, phrase: 'pilgrimage to Hell' },
  { patch: 'projection',     para: 2,  phrase: 'pilgrimage to Hell' },
  { patch: 'projection',     para: 7,  phrase: 'Los Angeles is an otherworld' },
];

// Intense passages — letter-spacing distortion only, no color, no link.
// 'wide' pulls the tracking apart for the declarative/ominous lines;
// 'tight' crushes it for the breathless/visceral ones. Every phrase below
// is verbatim, already present in the source text at that paragraph.
const INTENSITIES = [
  { patch: 'iron',           para: 10, phrase: 'the men with the cold smiles and the iron eyes smile with satisfaction, and they turn off the stars.', mode: 'wide' },
  { patch: 'flying',         para: 6,  phrase: 'Tied down shackled chained to the ground wrapped in iron and thrown in a river', mode: 'tight' },
  { patch: 'death',          para: 11, phrase: 'Sometimes, you must be ready to lose everything before you grasp what you need.', mode: 'wide' },
  { patch: 'selfmutilation', para: 9,  phrase: 'my entire body torn apart by horses', mode: 'tight' },
  { patch: 'holography',     para: 29, phrase: 'he has no idea where on Earth he is', mode: 'wide' },
  { patch: 'projection',     para: 18, phrase: 'the earth fissuring and swallowing me whole', mode: 'tight' },
  { patch: 'projection',     para: 38, phrase: 'swirling upwards and out, like smoke over hills refracting the endless yellow light', mode: 'wide' },
];

// A verbatim scene, pulled out of its home paragraph and set in real
// screenplay format — rendered after the given paragraph index (post-split,
// i.e. the index the scene's *lead-in* paragraph has once it's isolated
// from the script content that used to trail it).
const SCRIPT_INSERTS = [
  { patch: 'projection', afterIndex: 23, script: projectionScript },
];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderScriptBlock(elements) {
  const rot = (Math.random() * 3 - 1.5).toFixed(2);
  const delay = (Math.random() * -15).toFixed(2); // negative delay: starts mid-cycle, not synced
  const body = elements.map(el => {
    if (el.type === 'slug') {
      return `<p class="ms-script-slug">${escapeHtml(el.text)}</p>`;
    }
    if (el.type === 'action') {
      return `<p class="ms-script-action">${escapeHtml(el.text)}</p>`;
    }
    // dialogue
    const paren = el.parenthetical
      ? `<p class="ms-script-paren">${escapeHtml(el.parenthetical)}</p>`
      : '';
    return `<div class="ms-script-dialogue">` +
      `<p class="ms-script-character">${escapeHtml(el.character)}</p>` +
      paren +
      `<p class="ms-script-line">${escapeHtml(el.text)}</p>` +
      `</div>`;
  }).join('');
  return `<div class="ms-script" style="--script-rot: ${rot}deg; --script-delay: ${delay}s;">` +
    `<span class="ms-script-pin" aria-hidden="true"></span>` +
    `<div class="ms-script-page">${body}</div>` +
    `</div>`;
}

function renderParagraph(patchKey, index, text) {
  let html = escapeHtml(text);
  const link = LINKS.find(l => l.patch === patchKey && l.para === index);
  if (link) {
    const esc = escapeHtml(link.phrase);
    html = html.replace(esc, `<a class="ms-link" data-target="${link.target}" role="link" tabindex="0">${esc}</a>`);
  }
  const rubric = RUBRICS.find(r => r.patch === patchKey && r.para === index);
  if (rubric) {
    const esc = escapeHtml(rubric.phrase);
    html = html.replace(esc, `<span class="ms-rubric">${esc}</span>`);
  }
  const intense = INTENSITIES.find(x => x.patch === patchKey && x.para === index);
  if (intense) {
    const esc = escapeHtml(intense.phrase);
    const inner = intense.mode === 'tight' ? franticWords(esc) : esc;
    html = html.replace(esc, `<span class="ms-intense ms-intense--${intense.mode}">${inner}</span>`);
  }
  return html;
}

// A word at a time, each jostled slightly off its baseline and tilted its
// own small amount — a hand that's writing faster than it can properly
// form the letters, not a typeface doing a "menacing" trick.
function franticWords(escapedPhrase) {
  return escapedPhrase.split(' ').map(word => {
    const rot = (Math.random() * 7 - 3.5).toFixed(1);
    const dy = (Math.random() * 6 - 3).toFixed(1);
    return `<span class="ms-word" style="transform: rotate(${rot}deg) translateY(${dy}px);">${word}</span>`;
  }).join(' ');
}

// ─── Randomized wear: a fresh ragged perimeter, a fresh scatter of stains,
// every load. Walks the box clockwise — top, right, bottom, left — biting
// a small random amount inward at each step, so the whole hide-shape is
// disjointed rather than just the top and bottom edges. The bite stays
// well inside the patch's own padding, so text is never actually clipped.
function patchClipPath() {
  const bite = () => (Math.random() * 12).toFixed(1);
  const steps = 7;
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(`${((i / steps) * 100).toFixed(1)}% ${bite()}px`);
  for (let i = 1; i <= steps; i++) pts.push(`calc(100% - ${bite()}px) ${((i / steps) * 100).toFixed(1)}%`);
  for (let i = steps - 1; i >= 0; i--) pts.push(`${((i / steps) * 100).toFixed(1)}% calc(100% - ${bite()}px)`);
  for (let i = steps - 1; i >= 1; i--) pts.push(`${bite()}px ${((i / steps) * 100).toFixed(1)}%`);
  return `polygon(${pts.join(', ')})`;
}

function agingFilter(tone) {
  const j = () => Math.random() - 0.5;
  const contrast = 1 + tone * 0.03 + j() * 0.07;
  const brightness = 1 - tone * 0.018 + j() * 0.05;
  const sepia = Math.max(0, 0.06 + tone * 0.03 + j() * 0.05);
  const saturate = 1 - tone * 0.025 + j() * 0.06;
  // drop-shadow (unlike box-shadow) follows the clipped ragged silhouette,
  // so the torn edge reads as a physical, lifted piece of hide.
  return `contrast(${contrast.toFixed(2)}) brightness(${brightness.toFixed(2)}) sepia(${sepia.toFixed(2)}) saturate(${saturate.toFixed(2)}) drop-shadow(0 3px 4px rgba(0,0,0,0.4))`;
}

const STAIN_BLENDS = ['multiply', 'multiply', 'multiply', 'soft-light'];
function buildStain() {
  const el = document.createElement('div');
  el.className = 'ms-stain';
  el.setAttribute('aria-hidden', 'true');
  const w = 9 + Math.random() * 24;
  const h = w * (0.55 + Math.random() * 0.7);
  const left = Math.random() * (100 - w);
  const top = 4 + Math.random() * 78;
  const rot = (Math.random() * 50 - 25).toFixed(1);
  const blend = STAIN_BLENDS[Math.floor(Math.random() * STAIN_BLENDS.length)];
  const opacity = (0.1 + Math.random() * 0.24).toFixed(2);
  const dark = blend === 'multiply';
  const blur = (0.6 + Math.random() * 2.2).toFixed(1);
  el.style.cssText = `left:${left.toFixed(1)}%; top:${top.toFixed(1)}%; width:${w.toFixed(1)}%; height:${(h / w * 100).toFixed(1)}%;` +
    `transform: rotate(${rot}deg); mix-blend-mode: ${blend}; opacity: ${opacity}; filter: blur(${blur}px);` +
    `background: radial-gradient(circle, ${dark ? 'rgba(18,12,5,0.95)' : 'rgba(255,246,224,0.65)'} 0%, transparent 70%);`;
  return el;
}

function buildStyles() {
  if (document.getElementById('manuscript-styles')) return;
  const style = document.createElement('style');
  style.id = 'manuscript-styles';
  style.textContent = `
    .ms-root {
      width: 100%; height: 100%;
      background: linear-gradient(165deg, #14100b 0%, #1d1912 50%, #110d08 100%);
      color: #e9ddc2;
      font-family: 'IM Fell English', Georgia, serif;
      overflow: hidden;
      position: relative;
    }
    /* an unsteady candle somewhere off to the side, not a flat vignette.
       negative z-index so it always sits behind the (non-positioned) scroll
       content, rather than fighting default stacking order. */
    .ms-root::before {
      content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
      background:
        radial-gradient(circle at 24% 18%, rgba(255,214,150,0.85), rgba(255,196,120,0.4) 18%, transparent 42%),
        radial-gradient(circle at 78% 66%, rgba(255,180,100,0.4), transparent 50%),
        radial-gradient(ellipse at 18% 8%, rgba(0,0,0,0.45), transparent 48%),
        radial-gradient(ellipse at 84% 88%, rgba(0,0,0,0.6), transparent 55%),
        repeating-linear-gradient(38deg, rgba(0,0,0,0.045) 0 1px, transparent 1px 6px);
      animation: ms-candlelight 4.2s ease-in-out infinite;
    }
    @keyframes ms-candlelight {
      0%, 100%  { opacity: 1; }
      15%       { opacity: 0.62; }
      30%       { opacity: 1; }
      46%       { opacity: 0.7; }
      58%       { opacity: 0.95; }
      74%       { opacity: 0.6; }
      88%       { opacity: 0.9; }
    }
    .ms-scroll {
      width: 100%; height: 100%;
      overflow-y: auto; overflow-x: hidden;
      padding: 3.2rem 1.4rem 6rem;
      scrollbar-color: rgba(140,105,55,0.4) transparent;
      scrollbar-width: thin;
    }
    .ms-scroll:focus { outline: none; }

    /* dust and scratches on the glass, over everything, static through scroll */
    .ms-grain {
      position: absolute; inset: 0; z-index: 5; pointer-events: none;
      filter: url(#ms-grain);
      mix-blend-mode: multiply;
      opacity: 0.13;
    }

    /* ── Opening mark: the Ogham letter Sail, carved once at the top of the
       scroll — the same glyph the preview medallion carries, here bare on
       the hide itself rather than cut into stone. Reuses .ms-ogham's own
       stem/stroke markup; this override just gives it room to be the sole
       mark on the page instead of one small carving inside a medallion. ── */
    .ms-ogham-panel {
      max-width: 100px; margin: 0 auto 2.6rem; aspect-ratio: 0.6 / 1;
      display: flex; align-items: center; justify-content: center;
    }
    .ms-ogham-panel .ms-ogham {
      width: 82%; height: 92%;
      filter: url(#ms-rough) drop-shadow(0 2px 3px rgba(0,0,0,0.5));
    }

    /* ── Primordial marginal motifs — spiral, chevron, cup-and-ring, dots ── */
    .ms-motif { display: block; width: 100%; height: 100%; opacity: 0.85; filter: url(#ms-rough); }
    .ms-motif-spiral {
      background: conic-gradient(from 90deg, transparent 0deg, #a8702f 40deg, transparent 90deg,
        #a8702f 170deg, transparent 220deg, #a8702f 300deg, transparent 360deg);
      border-radius: 50%;
      -webkit-mask: radial-gradient(circle, transparent 18%, black 24%, black 42%, transparent 48%);
              mask: radial-gradient(circle, transparent 18%, black 24%, black 42%, transparent 48%);
    }
    .ms-motif-chevron {
      background-image: repeating-linear-gradient(45deg, transparent 0 6px, #a8702f 6px 9px, transparent 9px 15px),
                         repeating-linear-gradient(-45deg, transparent 0 6px, #8a3b22 6px 9px, transparent 9px 15px);
      -webkit-mask: radial-gradient(circle, black 40%, transparent 72%);
              mask: radial-gradient(circle, black 40%, transparent 72%);
    }
    .ms-motif-cupring {
      background: radial-gradient(circle, transparent 8%, #a8702f 10% 14%, transparent 16% 30%, #8a3b22 32% 36%, transparent 38%);
      border-radius: 50%;
    }
    .ms-motif-dots {
      background-image: radial-gradient(#a8702f 22%, transparent 24%);
      background-size: 30% 30%;
      background-position: 15% 15%, 65% 15%, 15% 65%, 65% 65%;
    }

    /* ── Seam: where one patch of hide was lashed to the next ── */
    .ms-seam {
      max-width: 820px; margin: 0 auto; height: 44px; position: relative;
      display: flex; align-items: center; justify-content: center;
    }
    .ms-seam::before {
      content: ''; position: absolute; left: 4%; right: 4%; top: 50%; height: 2px;
      background: repeating-linear-gradient(90deg, #5c4426 0 10px, transparent 10px 14px);
      opacity: 0.55; transform: translateY(-50%);
      filter: url(#ms-rough);
    }
    .ms-seam::after {
      content: ''; position: absolute; left: 4%; right: 4%; top: 50%; height: 10px;
      background-image: repeating-linear-gradient(90deg, transparent 0 12px, rgba(60,44,24,0.5) 12px 13px, transparent 13px 24px);
      transform: translateY(-50%) rotate(-1deg);
      filter: url(#ms-rough);
    }
    .ms-seam-motif { width: 26px; height: 26px; position: relative; z-index: 1;
      background: radial-gradient(circle, rgba(28,23,18,0.9) 55%, transparent 72%); border-radius: 50%; }

    /* ── Patch: one section of hide, one uninterrupted stretch of text ──
       clip-path (set per instance in JS, --patch-clip below) cuts the whole
       perimeter into a ragged, disjointed hide-shape — not just top/bottom. */
    .ms-patch {
      max-width: 820px; margin: 0 auto; padding: 2.2rem 1.9rem;
      position: relative; scroll-margin-top: 2rem;
      transition: box-shadow 0.4s ease;
      clip-path: var(--patch-clip, none);
    }
    .ms-patch.ms-flash { box-shadow: 0 0 0 2px rgba(184,122,50,0.55) inset; }

    .ms-patch-tone-0 { background: linear-gradient(160deg, #241d14 0%, #2c2417 55%, #221b12 100%); }
    .ms-patch-tone-1 { background: linear-gradient(160deg, #2e2517 0%, #382c1a 55%, #2a2115 100%); }
    .ms-patch-tone-2 { background: linear-gradient(160deg, #3c2f1b 0%, #47381f 55%, #382b18 100%); }
    .ms-patch-tone-3 { background: linear-gradient(160deg, #4c3c20 0%, #584722 55%, #453620 100%); }
    .ms-patch-tone-4 { background: linear-gradient(160deg, #5d4a26 0%, #6a5628 55%, #55441f 100%); }

    /* ink stains and worn patches, scattered per instance, behind the text */
    .ms-stain { position: absolute; pointer-events: none; border-radius: 50%; z-index: 0; }

    /* The ambient candlelight (.ms-root::before) sits behind every patch, so
       on its own it only ever shows in the gaps between them — never while
       actually reading one. This is the same light, painted again on top of
       the parchment itself: a soft warm wash that pulses on the same rhythm,
       screen-blended so it only ever adds light and never dims the text.
       Each patch runs on its own negative delay so the whole scroll doesn't
       flicker in unison — one candle, many patches catching it differently. */
    .ms-patch::after {
      content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none;
      background: radial-gradient(ellipse at 26% 14%, rgba(255,205,140,0.22), transparent 58%);
      mix-blend-mode: screen;
      animation: ms-candlelight 4.2s ease-in-out infinite;
      animation-delay: var(--glow-delay, 0s);
    }

    .ms-patch-text { position: relative; z-index: 1; }
    .ms-patch-text { --ms-base-size: 1.2rem; }
    .ms-patch-text > p {
      font-family: 'IM Fell English', Georgia, serif;
      font-size: var(--ms-base-size); line-height: 1.85; margin: 0 0 1.15rem;
      color: #e9ddc2;
      text-shadow: 1px 1px 0 rgba(255,240,210,0.1), -1px -1px 1px rgba(0,0,0,0.55);
      letter-spacing: 0.01em;
    }
    .ms-patch-text > p:last-child { margin-bottom: 0; }

    /* incised versal opening each patch — Cinzel, sparingly, as an inscriptional accent */
    .ms-patch-text > p:first-of-type::first-letter {
      font-family: 'Cinzel', 'IM Fell English', serif;
      font-weight: 600;
      font-size: 3.4rem; line-height: 0.72;
      float: left; margin: 0.05em 0.12em 0 0;
      color: #c17a3d;
      text-shadow: 1.5px 1.5px 0 rgba(0,0,0,0.65), -1px -1px 0 rgba(255,220,170,0.15);
    }

    .ms-rubric {
      color: #c17a3d;
      text-shadow: 1px 1px 0 rgba(255,220,170,0.12), -1px -1px 1px rgba(0,0,0,0.6);
    }

    /* intense passages: the hand pressing harder, not a color change.
       'wide' — deliberate, weighty, the pen slowing down; a faint candlelit
       glow on the tracking rather than a static effect.
       'tight' — the hand writing faster than it can properly form letters;
       words crowd together and jostle off the baseline, not a "sinister
       whisper" italic. */
    .ms-intense--wide {
      letter-spacing: 0.2em; word-spacing: 0.12em;
      animation: ms-candle-text 3.6s ease-in-out infinite;
    }
    @keyframes ms-candle-text {
      0%, 100% { text-shadow: 1px 1px 0 rgba(255,240,210,0.1), -1px -1px 1px rgba(0,0,0,0.55); }
      50%      { text-shadow: 0 0 7px rgba(255,210,140,0.28), 1px 1px 0 rgba(255,240,210,0.12), -1px -1px 1px rgba(0,0,0,0.5); }
    }
    .ms-intense--tight {
      letter-spacing: -0.01em;
      text-shadow: 0 0 3px rgba(233,221,194,0.28), 1px 1px 0 rgba(0,0,0,0.5), -1px -1px 1px rgba(0,0,0,0.3);
    }
    .ms-intense--tight .ms-word { display: inline-block; }

    .ms-link {
      color: inherit; text-decoration: none; cursor: pointer;
      border-bottom: 1px dashed rgba(193,122,61,0.65);
      padding: 0 0.08em; transition: color 0.2s, border-color 0.2s, text-shadow 0.2s;
    }
    .ms-link:hover, .ms-link:focus {
      color: #d99a51;
      border-bottom-color: #d99a51;
      text-shadow: 0 0 8px rgba(217,154,81,0.5);
    }

    /* ── A pinned-in script page: the one scene the narrator recounts is set
       in real Hollywood format on a typed sheet tucked into the hide, clean-
       edged on purpose — a deliberate contrast against the ragged parchment
       around it, a different object entirely. Paper leans slightly toward
       washi-white rather than aged manila, with a faint fiber grain and a
       whisper of dye-bleed under the pin — a quiet nod to a tanzaku strip
       tied at the top, not a costume change. Pinned only at that top point,
       so every so often a draft catches it and it rustles, tugging back to
       rest — the rest of the scroll stays still. ── */
    .ms-script {
      position: relative; z-index: 1;
      max-width: 540px; margin: 1.9rem auto 2.3rem;
      background: linear-gradient(178deg, #f2ead4 0%, #e6d9b8 55%, #dccca4 100%);
      box-shadow: 0 6px 16px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.2) inset;
      padding: 2.1rem 1.6rem 1.9rem 2.1rem;
      transform: rotate(var(--script-rot, 0deg));
      transform-origin: 50% 0%;
      animation: ms-script-flutter 15s ease-in-out infinite;
      animation-delay: var(--script-delay, 0s);
    }
    @keyframes ms-script-flutter {
      0%, 4%, 15%, 27%, 40%, 55%, 100% { transform: rotate(var(--script-rot, 0deg)); }
      6%  { transform: rotate(calc(var(--script-rot, 0deg) + 0.6deg)) skewX(0.22deg); }
      9%  { transform: rotate(calc(var(--script-rot, 0deg) - 0.32deg)) skewX(-0.18deg); }
      12% { transform: rotate(calc(var(--script-rot, 0deg) + 0.18deg)); }
      42% { transform: rotate(calc(var(--script-rot, 0deg) - 0.68deg)) skewX(-0.26deg); }
      46% { transform: rotate(calc(var(--script-rot, 0deg) + 0.36deg)) skewX(0.18deg); }
      50% { transform: rotate(var(--script-rot, 0deg)); }
    }
    .ms-script-pin {
      position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
      width: 13px; height: 13px; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #a24a3a, #6b2a1f 70%, #4a1c14);
      box-shadow: 0 2px 3px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.3);
      z-index: 2;
    }
    /* a short cord trailing from the pin, like a tanzaku's tying thread */
    .ms-script-pin::after {
      content: ''; position: absolute; top: 11px; left: 50%; transform: translateX(-50%);
      width: 1.5px; height: 16px;
      background: linear-gradient(180deg, rgba(140,50,40,0.75), rgba(140,50,40,0.15));
    }
    /* faint dye-bleed under the pin, and a whisper of vertical fiber grain
       across the whole sheet — both subtle enough to read as paper, not
       pattern. Anchored to the outer box (not the padded inner content) so
       they still line up correctly at the tighter mobile padding below. */
    .ms-script::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; z-index: 0;
      height: 5px; pointer-events: none;
      background: linear-gradient(90deg,
        transparent, rgba(150,55,45,0.16) 18%, rgba(70,85,120,0.13) 50%,
        rgba(150,55,45,0.16) 82%, transparent);
    }
    .ms-script::after {
      content: ''; position: absolute; inset: 0; z-index: 0;
      pointer-events: none;
      background: repeating-linear-gradient(90deg,
        transparent 0 3px, rgba(120,90,50,0.05) 3px 4px);
      mix-blend-mode: multiply;
    }
    .ms-script-page {
      font-family: 'Courier Prime', 'Courier New', Courier, monospace;
      color: #2b2314;
      font-size: 0.92rem; line-height: 1.65;
      position: relative;
      z-index: 1;
    }
    .ms-script-slug {
      font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; margin: 0 0 0.9rem;
    }
    .ms-script-action {
      margin: 0 0 0.9rem;
    }
    .ms-script-dialogue {
      max-width: 68%; margin: 0 auto 0.9rem;
    }
    .ms-script-character {
      text-align: center; text-transform: uppercase; font-weight: 700;
      letter-spacing: 0.03em; margin: 0 0 0.15rem;
    }
    .ms-script-paren {
      text-align: center; font-style: italic; font-size: 0.85em;
      opacity: 0.82; margin: 0 0 0.15rem;
    }
    .ms-script-line { margin: 0; }

    /* ── Preview: dark, cracked stone medallion, Ogham Sail carved into it ── */
    .ms-preview {
      width: 100%; height: 100%; position: relative;
      display: flex; align-items: center; justify-content: center;
      background: radial-gradient(ellipse at center, #2a2318 0%, #1a1510 100%);
    }
    .ms-preview .ms-grain { opacity: 0.22; }
    .ms-preview-medallion {
      width: 62%; height: 62%; position: relative;
      border-radius: 58% 42% 53% 47% / 45% 55% 42% 58%; /* worn stone, not a coin */
      background:
        radial-gradient(circle at 30% 25%, rgba(255,255,255,0.05), transparent 40%),
        radial-gradient(circle at 68% 75%, rgba(0,0,0,0.38), transparent 55%),
        radial-gradient(circle, #4a3c24 0%, #241d14 78%);
      box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 0 22px rgba(193,122,61,0.18);
      display: flex; align-items: center; justify-content: center;
      animation: ms-ember 4.2s steps(7) infinite;
      filter: url(#ms-rough-strong) contrast(1.1) sepia(0.15);
    }
    @keyframes ms-ember {
      0%, 100% { box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 0 14px rgba(193,122,61,0.12); }
      35%      { box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 0 26px rgba(217,154,81,0.3); }
      60%      { box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 0 18px rgba(193,122,61,0.18); }
    }
    .ms-crack {
      position: absolute; z-index: 2; pointer-events: none;
      background: linear-gradient(180deg, transparent, rgba(0,0,0,0.75) 20%, rgba(0,0,0,0.5) 65%, transparent 100%);
      filter: url(#ms-rough-strong);
    }
    .ms-crack-main { left: 12%; top: 4%; width: 2px; height: 62%; transform: rotate(21deg); }
    .ms-crack-branch { left: 40%; top: 38%; width: 1.5px; height: 26%; transform: rotate(-32deg); opacity: 0.7; }

    /* ── Ogham letter Sail: stemline + four strokes off one side ── */
    .ms-ogham { position: relative; width: 46%; height: 66%; z-index: 1; }
    .ogham-stem, .ogham-stroke {
      position: absolute;
      background: linear-gradient(180deg, #d9b276, #a8702f 60%, #7a4f1f);
      box-shadow: 1px 1px 0 rgba(0,0,0,0.5), -1px -1px 0 rgba(255,224,180,0.12);
      border-radius: 1px;
    }
    .ogham-stem { left: 8%; top: 0; bottom: 0; width: 11%; }
    .ogham-stroke { left: 8%; width: 76%; height: 9%; }
    .ogham-stroke.s1 { top: 6%; }
    .ogham-stroke.s2 { top: 30%; }
    .ogham-stroke.s3 { top: 54%; }
    .ogham-stroke.s4 { top: 78%; }

    @media (prefers-reduced-motion: reduce) {
      .ms-preview-medallion { animation: none; }
      .ms-patch-text > p { transform: none !important; }
      .ms-script { transform: rotate(var(--script-rot, 0deg)) !important; animation: none !important; }
      .ms-root::before { animation: none; opacity: 1; }
      .ms-patch::after { animation: none; }
      .ms-intense--wide { animation: none; }
    }

    @media (max-width: 600px) {
      .ms-patch { padding: 1.7rem 1.1rem; }
      .ms-patch-text { --ms-base-size: 1.05rem; }
      .ms-patch-text > p:first-of-type::first-letter { font-size: 2.6rem; }
      .ms-ogham-panel { max-width: 76px; }
      .ms-script { padding: 1.7rem 1.1rem 1.5rem 1.5rem; }
      .ms-script-page { font-size: 0.85rem; }
      .ms-script-dialogue { max-width: 88%; }
    }
  `;
  document.head.appendChild(style);
}

// Hidden SVG filter defs — feTurbulence/feDisplacementMap for grain and
// hand-wobble, referenced from CSS via filter: url(#id). Inserted once,
// globally, same singleton pattern as buildStyles().
function buildSvgDefs() {
  if (document.getElementById('ms-svg-defs')) return;
  const wrap = document.createElement('div');
  wrap.id = 'ms-svg-defs';
  wrap.style.cssText = 'position:absolute; width:0; height:0; overflow:hidden;';
  wrap.innerHTML = `
    <svg width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id="ms-grain" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" stitchTiles="stitch" result="n"/>
          <feColorMatrix in="n" type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.85 0" result="a"/>
          <feComposite in="a" in2="SourceGraphic" operator="over"/>
        </filter>
        <filter id="ms-rough" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="2" seed="7" result="t"/>
          <feDisplacementMap in="SourceGraphic" in2="t" scale="6" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <filter id="ms-rough-strong" x="-35%" y="-35%" width="170%" height="170%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.09" numOctaves="3" seed="3" result="t2"/>
          <feDisplacementMap in="SourceGraphic" in2="t2" scale="15" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>
  `;
  document.body.appendChild(wrap);
}

function oghamSail() {
  return `<div class="ms-ogham" aria-hidden="true">
    <span class="ogham-stem"></span>
    <span class="ogham-stroke s1"></span>
    <span class="ogham-stroke s2"></span>
    <span class="ogham-stroke s3"></span>
    <span class="ogham-stroke s4"></span>
  </div>`;
}

function oghamPanel() {
  return `<div class="ms-ogham-panel" aria-hidden="true">${oghamSail()}</div>`;
}

export function createManuscript(container, { preview = false } = {}) {
  buildStyles();
  buildSvgDefs();

  if (preview) {
    const root = document.createElement('div');
    root.className = 'ms-preview';
    root.setAttribute('aria-hidden', 'true');
    const grain = document.createElement('div');
    grain.className = 'ms-grain';
    const medallion = document.createElement('div');
    medallion.className = 'ms-preview-medallion';
    const crackMain = document.createElement('div');
    crackMain.className = 'ms-crack ms-crack-main';
    const crackBranch = document.createElement('div');
    crackBranch.className = 'ms-crack ms-crack-branch';
    medallion.appendChild(crackMain);
    medallion.appendChild(crackBranch);
    medallion.insertAdjacentHTML('beforeend', oghamSail());
    root.appendChild(medallion);
    root.appendChild(grain);
    container.appendChild(root);
    return { dispose() { root.remove(); } };
  }

  const root = document.createElement('div');
  root.className = 'ms-root';

  const scroll = document.createElement('div');
  scroll.className = 'ms-scroll';
  scroll.setAttribute('tabindex', '-1');
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'A scroll of found writing, carved fragments, 2000 to 2012');

  scroll.insertAdjacentHTML('beforeend', oghamPanel());

  PATCHES.forEach((patch, i) => {
    const article = document.createElement('article');
    article.className = `ms-patch ms-patch-tone-${patch.tone}`;
    article.id = patch.id;
    article.style.setProperty('--patch-clip', patchClipPath());
    article.style.setProperty('--glow-delay', `${(Math.random() * -4.2).toFixed(2)}s`);
    article.style.filter = agingFilter(patch.tone);

    const stainCount = 2 + Math.floor(Math.random() * 2);
    for (let s = 0; s < stainCount; s++) {
      article.appendChild(buildStain());
    }

    const textWrap = document.createElement('div');
    textWrap.className = 'ms-patch-text';
    textWrap.innerHTML = patch.body.map((p, idx) => {
      const rot = (Math.random() * 1.6 - 0.8).toFixed(2);
      const dx = (Math.random() * 6 - 3).toFixed(1);
      // Sometimes slightly larger, sometimes the tracking runs a little
      // longer/looser — a hand doesn't set every line at one fixed size.
      const scale = (0.94 + Math.random() * 0.17).toFixed(3);
      const track = (0.01 + Math.random() * 0.035).toFixed(3);
      const style = `transform: rotate(${rot}deg) translateX(${dx}px); ` +
        `font-size: calc(var(--ms-base-size, 1.2rem) * ${scale}); letter-spacing: ${track}em;`;
      let out = `<p style="${style}">${renderParagraph(patch.key, idx, p)}</p>`;
      const insert = SCRIPT_INSERTS.find(s => s.patch === patch.key && s.afterIndex === idx);
      if (insert) out += renderScriptBlock(insert.script);
      return out;
    }).join('');
    article.appendChild(textWrap);
    scroll.appendChild(article);

    if (i < PATCHES.length - 1) {
      const seam = document.createElement('div');
      seam.className = 'ms-seam';
      seam.setAttribute('aria-hidden', 'true');
      const motifType = MOTIF_CYCLE[i % MOTIF_CYCLE.length];
      seam.innerHTML = `<span class="ms-seam-motif"><span class="ms-motif ms-motif-${motifType}"></span></span>`;
      scroll.appendChild(seam);
    }
  });

  root.appendChild(scroll);
  const grain = document.createElement('div');
  grain.className = 'ms-grain';
  root.appendChild(grain);

  container.appendChild(root);
  container.style.position = 'relative';
  container.style.overflow = 'hidden';

  function onLinkClick(e) {
    const link = e.target.closest('.ms-link');
    if (!link) return;
    e.preventDefault();
    const targetEl = scroll.querySelector(`#${link.dataset.target}`);
    if (!targetEl) return;
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    targetEl.classList.add('ms-flash');
    setTimeout(() => targetEl.classList.remove('ms-flash'), 1400);
  }
  scroll.addEventListener('click', onLinkClick);
  scroll.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('.ms-link')) return;
    e.preventDefault();
    onLinkClick(e);
  });

  setTimeout(() => scroll.focus(), 100);

  return {
    dispose() {
      scroll.removeEventListener('click', onLinkClick);
      root.remove();
    }
  };
}
