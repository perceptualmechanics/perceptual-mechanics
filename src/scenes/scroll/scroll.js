// ─── The Scroll ────────────────────────────────────────────────────────────
// Pre-Christian. No illumination in the Kells sense — no gold leaf, no
// jewel-bright interlace, no titles. This is meant to read as something
// found, not published: a hide-and-bark scroll a bard kept adding to across
// twenty-plus years (2000–2010s), patch lashed to patch as new material came
// in, the oldest hide darkest and most soot-stained, the newest still pale.
// The only mark on it besides the words themselves is the Ogham letter Sail
// (ᏸ, fourth of the Aicme Beithe: four strokes off a stemline), carved once
// at the very top — the same glyph the preview medallion carries.
//
// Twelve pieces, chronological, full texts, no titles/sources/dates/glosses:
//   Iron Gods · Flying · Thoughts Of Death Abounds · Pygmalion   (c. 2000)
//   The Impossible Bliss of Self-Mutilation               (2002)
//   In The End It Falls Slowly Through The Aether         (2002–2003)
//   The Vigil · The Calamity (both ex Fire.doc)           (Nov 2003)
//   Identity Theft                                        (2009)
//   Holography · Projection                               (2009–2012)
//   The Crocodile Photograph                              (undated, later — newest hide)
//
// In The End It Falls Slowly Through The Aether (Cartography.doc) joined the
// scroll 2026-08-07, folded in from scenes/leaf.js when that scene was
// retired for good rather than shelved again — a raindrop's fall told
// through real physics, one paragraph per stage of the drop. Slotted by its
// source file's own OLE metadata (created 2002-03-11, last saved 2003-04-19),
// between Self-Mutilation and The Vigil.
//
// Pygmalion is the newest addition (2026-07-16, second archive deep dive) but
// the oldest-dated piece on the scroll — internally dated to May 2000, same
// cluster as Iron Gods/Flying/Thoughts Of Death Abounds, so it's slotted in
// there rather than tacked on at the end. A found-out catfishing essay
// (a woman calling herself "Jane" turns out to be a years-long impersonation
// of her own friend), it's already in conversation with Identity Theft and
// Projection — same subject, a self built out of someone else's material —
// just twenty years earlier than either of them.
//
// Four honest notes on what's NOT here:
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
//  — The Vigil and The Calamity are also excerpts of a sort: Fire.doc opens
//    with a word-association litany kept aside for the elements/fire
//    livestream project, then runs straight into these two embedded scenes.
//    Both are reproduced here complete and unedited from that point on.
//
// A handful of phrases are still live links — words that genuinely echo
// across pieces (Self-Mutilation's refusal to be "afraid to lose everything"
// answering Thoughts Of Death Abounds' own closing line about the same;
// Jeremy Constantilios himself, walking out of Projection and straight into
// Holography). No new text was written to make these connections — they're
// all already there in his own words.
//
// Content note: The Impossible Bliss of Self-Mutilation, Identity Theft, and
// The Vigil are all considerably darker and more graphic than what was here
// before — body horror, a body-swap turn, and a dying man's bathroom-floor
// bitterness, not a tonal match for the neighboring pieces so much as a
// deliberate contrast. Full, unedited text; nothing softened.
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

import { scrollPieces, toOgham } from './scroll.text.js';
import { escapeHtml, parseHTML } from '../../utils/sceneKit.js';
import scrollHtml from './scroll.html?raw';
import './scroll.css';

// Hide darkness per patch — oldest hide darkest and most soot-stained, newest
// still pale. Presentation, so it stays here rather than in src/text/, keyed
// off the piece's own key. The ordering and the text itself now come from
// scroll.text.js, which the prerender step for /text/scroll/ also reads —
// one list, so the scroll and the published page can't fall out of order or
// out of sync with each other.
const TONES = {
  iron: 0, flying: 1, death: 1, pygmalion: 1,
  selfmutilation: 2, cartography: 2, firevigil: 2, firecalamity: 2, identity: 2,
  holography: 3, projection: 4, crocodile: 5,
};

const PATCHES = scrollPieces.map(p => ({
  key: p.key,
  id: `patch-${p.key}`,
  body: p.body,
  tone: TONES[p.key] ?? 0,
}));

const MOTIF_CYCLE = ['spiral', 'chevron', 'cupring', 'dots'];

// Phrases already present in the raw text that get wired as live cross-links.
const LINKS = [
  { patch: 'selfmutilation', para: 0,  phrase: "You can’t be afraid to lose everything.", target: 'patch-death' },
  { patch: 'projection',     para: 36, phrase: 'Jeremy Constantilios',                    target: 'patch-holography' },
  { patch: 'holography',     para: 0,  phrase: 'Jeremy Constantilios',                    target: 'patch-projection' },
  // 'Pilgrimage to Hell' used to be rubric-ink only, decorative — but it's
  // the exact same joke, verbatim, in both pieces (Jeremy's own version of
  // it in Holography, the narrator's in Projection), so it's promoted to a
  // real link each way rather than just colored.
  { patch: 'holography',     para: 15, phrase: 'pilgrimage to Hell',                      target: 'patch-projection' },
  { patch: 'projection',     para: 2,  phrase: 'pilgrimage to Hell',                      target: 'patch-holography' },
  // Pygmalion (2000) is the oldest-dated piece on the scroll, nine years
  // before Projection was written — but it already names, in so many words,
  // the exact mechanism Projection spends its whole length dramatizing:
  // falling for a self-built image of someone rather than the person
  // herself. The word is right there in Pygmalion's own text.
  { patch: 'pygmalion',      para: 44, phrase: 'projection',                              target: 'patch-projection' },
];

// Rubric ink — color only, no link. Sparingly applied, echoing across pieces.
const RUBRICS = [
  { patch: 'iron',           para: 0,  phrase: 'absolute lie' },
  { patch: 'flying',         para: 8,  phrase: "I'm flying. Finally." },
  { patch: 'death',          para: 2,  phrase: 'Thoughts of death abound' },
  { patch: 'selfmutilation', para: 16, phrase: 'Fuck them.' },
  { patch: 'identity',       para: 18, phrase: 'Something detached.' },
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
// Derived from scroll.text.js rather than restated here, so the scroll and
// the published /text/scroll/ page insert the scene at the same place.
const SCRIPT_INSERTS = scrollPieces
  .filter(p => p.script)
  .map(p => ({ patch: p.key, afterIndex: p.script.after, script: p.script.lines }));

// How many opening sentences of each patch's first paragraph get set as an
// Ogham line in the margin — computed from the real paragraph text itself
// (not retyped), so it can never drift out of sync with it. Most pieces open
// on one complete, substantial sentence; a couple open short ("A symphony.")
// and read better with their second sentence carried along too.
const OGHAM_LINES = {
  iron: 1, flying: 2, death: 1, pygmalion: 1, selfmutilation: 2, cartography: 1,
  firevigil: 1, firecalamity: 1, identity: 1, holography: 1, projection: 2,
  crocodile: 1,
};

function firstSentences(text, count) {
  // Em dash counts as a sentence boundary here alongside .!? — cartography's
  // opening paragraph is one long comma-spliced clause building to an em
  // dash with no terminal punctuation at all ("...until there's no more
  // time and —"), so without this the fallback below (`|| [text]`) would
  // hand the Ogham margin line the ENTIRE paragraph instead of one clause.
  // Checked against every other piece's opening paragraph first (none
  // contain an em dash before their own first real sentence-ending
  // punctuation), so this only ever changes cartography's own output.
  const matches = text.match(/[^.!?—]*[.!?—]+/g) || [text];
  return matches.slice(0, count).join(' ').trim();
}

function renderScriptBlock(elements) {
  const rot = (Math.random() * 3 - 1.5).toFixed(2);
  const delay = (Math.random() * -15).toFixed(2); // negative delay: starts mid-cycle, not synced
  const body = elements.map(el => {
    if (el.type === 'slug') {
      return `<p class="scroll-script-slug">${escapeHtml(el.text)}</p>`;
    }
    if (el.type === 'action') {
      return `<p class="scroll-script-action">${escapeHtml(el.text)}</p>`;
    }
    // dialogue
    const paren = el.parenthetical
      ? `<p class="scroll-script-paren">${escapeHtml(el.parenthetical)}</p>`
      : '';
    return `<div class="scroll-script-dialogue">` +
      `<p class="scroll-script-character">${escapeHtml(el.character)}</p>` +
      paren +
      `<p class="scroll-script-line">${escapeHtml(el.text)}</p>` +
      `</div>`;
  }).join('');
  return `<div class="scroll-script" style="--script-rot: ${rot}deg; --script-delay: ${delay}s;">` +
    `<span class="scroll-script-pin" aria-hidden="true"></span>` +
    `<div class="scroll-script-page">${body}</div>` +
    `</div>`;
}

function renderParagraph(patchKey, index, text) {
  let html = escapeHtml(text);
  const link = LINKS.find(l => l.patch === patchKey && l.para === index);
  if (link) {
    const esc = escapeHtml(link.phrase);
    html = html.replace(esc, `<a class="scroll-link" data-target="${link.target}" role="link" tabindex="0">${esc}</a>`);
  }
  const rubric = RUBRICS.find(r => r.patch === patchKey && r.para === index);
  if (rubric) {
    const esc = escapeHtml(rubric.phrase);
    html = html.replace(esc, `<span class="scroll-rubric">${esc}</span>`);
  }
  const intense = INTENSITIES.find(x => x.patch === patchKey && x.para === index);
  if (intense) {
    const esc = escapeHtml(intense.phrase);
    const inner = intense.mode === 'tight' ? franticWords(esc) : esc;
    html = html.replace(esc, `<span class="scroll-intense scroll-intense--${intense.mode}">${inner}</span>`);
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
    return `<span class="scroll-word" style="transform: rotate(${rot}deg) translateY(${dy}px);">${word}</span>`;
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
  el.className = 'scroll-stain';
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

// Preview tile, opening Ogham mark, and SVG filter defs all moved to
// scroll.html — genuinely static markup, unlike the per-piece patches below
// (those stay JS-generated because they're actually built from data).

// Hidden SVG filter defs — feTurbulence/feDisplacementMap for grain and
// hand-wobble, referenced from CSS via filter: url(#id). Inserted once,
// globally — this still has to happen at runtime (it's a real DOM mount,
// not CSS), guarded against double-injection across repeat scene visits.
function buildSvgDefs() {
  if (document.getElementById('scroll-svg-defs')) return;
  const frag = parseHTML(scrollHtml);
  document.body.appendChild(frag.querySelector('#scroll-svg-defs'));
}

export function createScroll(container, { preview = false } = {}) {
  buildSvgDefs();
  // One parse serves whichever branch below actually runs (preview and
  // full are mutually exclusive per call) — the piece that ends up unused
  // is simply never appended anywhere and gets garbage collected.
  const frag = parseHTML(scrollHtml);

  if (preview) {
    const root = frag.querySelector('.scroll-preview');
    container.appendChild(root);
    return { dispose() { root.remove(); } };
  }

  const root = document.createElement('div');
  root.className = 'scroll-root';

  const scroll = document.createElement('div');
  scroll.className = 'scroll-viewport';
  scroll.setAttribute('tabindex', '-1');
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'A scroll of found writing, carved fragments, 2000 to the 2010s');

  scroll.appendChild(frag.querySelector('.scroll-ogham-panel'));

  PATCHES.forEach((patch, i) => {
    const article = document.createElement('article');
    article.className = `scroll-patch scroll-patch-tone-${patch.tone}`;
    article.id = patch.id;
    article.style.setProperty('--patch-clip', patchClipPath());
    article.style.setProperty('--glow-delay', `${(Math.random() * -4.2).toFixed(2)}s`);
    article.style.filter = agingFilter(patch.tone);

    const stainCount = 2 + Math.floor(Math.random() * 2);
    for (let s = 0; s < stainCount; s++) {
      article.appendChild(buildStain());
    }

    const openingLine = firstSentences(patch.body[0], OGHAM_LINES[patch.key] || 1);
    const oghamHtml = `<span class="scroll-ogham-line" aria-hidden="true">${toOgham(openingLine)}</span>`;

    const textWrap = document.createElement('div');
    textWrap.className = 'scroll-patch-text';
    textWrap.innerHTML = oghamHtml + patch.body.map((p, idx) => {
      const rot = (Math.random() * 1.6 - 0.8).toFixed(2);
      const dx = (Math.random() * 6 - 3).toFixed(1);
      // Sometimes slightly larger, sometimes the tracking runs a little
      // longer/looser — a hand doesn't set every line at one fixed size.
      const scale = (0.94 + Math.random() * 0.17).toFixed(3);
      const track = (0.01 + Math.random() * 0.035).toFixed(3);
      const style = `transform: rotate(${rot}deg) translateX(${dx}px); ` +
        `font-size: calc(var(--scroll-base-size, 1.2rem) * ${scale}); letter-spacing: ${track}em;`;
      let out = `<p style="${style}">${renderParagraph(patch.key, idx, p)}</p>`;
      const insert = SCRIPT_INSERTS.find(s => s.patch === patch.key && s.afterIndex === idx);
      if (insert) out += renderScriptBlock(insert.script);
      return out;
    }).join('');
    article.appendChild(textWrap);
    scroll.appendChild(article);

    if (i < PATCHES.length - 1) {
      const seam = document.createElement('div');
      seam.className = 'scroll-seam';
      seam.setAttribute('aria-hidden', 'true');
      const motifType = MOTIF_CYCLE[i % MOTIF_CYCLE.length];
      seam.innerHTML = `<span class="scroll-seam-motif"><span class="scroll-motif scroll-motif-${motifType}"></span></span>`;
      scroll.appendChild(seam);
    }
  });

  root.appendChild(scroll);
  const grain = document.createElement('div');
  grain.className = 'scroll-grain';
  root.appendChild(grain);

  container.appendChild(root);
  container.style.position = 'relative';
  container.style.overflow = 'hidden';

  function onLinkClick(e) {
    const link = e.target.closest('.scroll-link');
    if (!link) return;
    e.preventDefault();
    const targetEl = scroll.querySelector(`#${link.dataset.target}`);
    if (!targetEl) return;
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    targetEl.classList.add('scroll-flash');
    setTimeout(() => targetEl.classList.remove('scroll-flash'), 1400);
  }
  scroll.addEventListener('click', onLinkClick);
  function onLinkKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('.scroll-link')) return;
    e.preventDefault();
    onLinkClick(e);
  }
  scroll.addEventListener('keydown', onLinkKeydown);

  setTimeout(() => scroll.focus(), 100);

  return {
    dispose() {
      scroll.removeEventListener('click', onLinkClick);
      scroll.removeEventListener('keydown', onLinkKeydown);
      root.remove();
    }
  };
}
