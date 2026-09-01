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
// In The End It Falls Slowly Through The Aether (Cartography.doc) — a
// raindrop's fall told through real physics, one paragraph per stage of the
// drop — is slotted by its own OLE metadata (created 2002-03-11, last saved
// 2003-04-19) between Self-Mutilation and The Vigil.
//
// Pygmalion is the oldest-dated piece on the scroll — internally dated to
// May 2000, same cluster as Iron Gods/Flying/Thoughts Of Death Abounds, so
// it's slotted in there rather than tacked on at the end. A found-out catfishing essay
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
// The Vigil are considerably darker and more graphic than the neighboring
// pieces — body horror, a body-swap turn, and a dying man's bathroom-floor
// bitterness — a deliberate contrast rather than a tonal mismatch. Full,
// unedited text; nothing softened.
//
// Rendering leans on a few hidden inline SVG filters (feTurbulence/
// feDisplacementMap for grain and wobble) alongside the CSS, in service of
// one goal: this should read as a beaten, handled object, not a rendered
// one. Every patch is clipped to its own
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

import { getOutboundLinks, getInboundLinks } from '../../links.js';
import { escapeHtml, parseHTML, wireCrossLinks, prefersReducedMotion, claimContainer, trackTimers } from '../../utils/sceneKit.js';
import { TONES, RUBRICS, INTENSITIES, OGHAM_LINES, OPENING_GROUP } from './scroll.marks.js';
import scrollHtml from './scroll.html?raw';
import './scroll.css';

// PATCHES (built from scrollPieces) moved inside createScroll's dynamic
// import below — scrollPieces is full-mode-only content now (v3.10.3), not
// available at module scope. See buildPatches().

const MOTIF_CYCLE = ['spiral', 'chevron', 'cupring', 'dots'];

// Phrases already present in the raw text that get wired as live
// cross-links used to live in a LINKS array here, keyed by `patch` (the
// piece's own key string) + paragraph index. Migrated into the shared
// src/links.js store — { scene: 'scroll', id: pieceId, field: 'body',
// index: para } — alongside every other scene's, using the same numeric
// id scrollPieces entries carry now instead of the patch key. RUBRICS,
// INTENSITIES, and SCRIPT_INSERTS are a different concern
// (styling/typesetting, not links) and were untouched by that migration.
// They now live in ./scroll.marks.js — see that file's header for why
// they moved out of this one, and scripts/verify-scroll-marks.mjs for
// what now checks them.

// A verbatim scene, pulled out of its home paragraph and set in real
// screenplay format — rendered after the given paragraph index (post-split,
// i.e. the index the scene's *lead-in* paragraph has once it's isolated
// from the script content that used to trail it).
// Derived from scroll.text.js rather than restated here, so the scroll and
// the published /text/scroll/ page insert the scene at the same place.
// Also moved inside createScroll's dynamic import (see buildPatches()) —
// same reason as PATCHES above.

// Builds PATCHES and SCRIPT_INSERTS from a resolved scrollPieces module —
// pulled out into its own function so createScroll's dynamic import (full
// mode only, v3.10.3) can call it once scroll.text.js actually resolves,
// rather than these being computed unconditionally at module scope the way
// they were when scrollPieces was a static top-of-file import.
function buildPatches(scrollPieces) {
  const PATCHES = scrollPieces.map(p => ({
    key: p.key,
    pieceId: p.id, // stable per-scene id (src/links.js addressing) — id below is a DOM element id string, a different thing that happens to share the name "id"
    id: `patch-${p.key}`,
    body: p.body,
    tone: TONES[p.key] ?? 0,
  }));
  const SCRIPT_INSERTS = scrollPieces
    .filter(p => p.script)
    .map(p => ({ patch: p.key, afterIndex: p.script.after, script: p.script.lines }));
  return { PATCHES, SCRIPT_INSERTS };
}

// CSP note: renderScriptBlock/franticWords/the paragraph loop below all bake
// per-load Math.random() values into markup, so a real style="" attribute on
// them can't be hash-allowlisted (unbounded values, not a fixed finite set).
// They carry the declarations in data-style instead; this walks a freshly
// inserted subtree and moves each one into the element's real style via a JS
// property assignment (.style.cssText), which CSP's style-src does not
// restrict — same category as the existing --patch-clip/filter calls below.
function applyDeferredStyles(root) {
  root.querySelectorAll('[data-style]').forEach(el => {
    el.style.cssText += el.getAttribute('data-style');
    el.removeAttribute('data-style');
  });
}

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
  // Randomized per-load values (unbounded, so not CSP-hashable) travel as a
  // data-style carrier rather than a real style="" attribute; applyDeferredStyles()
  // below turns it into a .style.setProperty() call once this HTML is in the
  // DOM — a JS property assignment, which style-src never restricts, same
  // pattern already used for --patch-clip/filter elsewhere in this file.
  return `<div class="scroll-script" data-style="--script-rot: ${rot}deg; --script-delay: ${delay}s;">` +
    `<span class="scroll-script-pin" aria-hidden="true"></span>` +
    `<div class="scroll-script-page">${body}</div>` +
    `</div>`;
}

// Both marks below run String.replace over HTML that wireCrossLinks has
// already been through — and as of v4.0 that means over a string
// wireCrossLinks re-serialized out of a <template>, not the one it was
// handed. The round trip is stable for the text this scene produces
// (escapeHtml escapes &, <, > and U+00A0; the HTML serializer escapes
// exactly those again coming back out), so an escaped phrase still matches
// — but "still matches" is now a property of two separate pieces of code
// agreeing, which is precisely why scripts/verify-scroll-marks.mjs exists:
// it asserts every RUBRICS/INTENSITIES phrase occurs exactly once in the
// paragraph it names, and that no cross-link phrase overlaps one (an anchor
// injected into the middle of a rubric phrase would split it across element
// boundaries and this replace would silently find nothing).
//
// The callback form of replace, not a replacement string: a replacement
// string interprets $&, $`, $' and $1 in the text being substituted in, so
// any phrase containing a dollar sign would have quietly mangled itself.
// None do today. The callback form has no such syntax at all, so the hazard
// is gone rather than merely unexercised.
function renderParagraph(pieceId, patchKey, index, text) {
  let html = escapeHtml(text);
  const links = getOutboundLinks('scroll', pieceId, 'body', index)
    .map(l => ({ ...l, phrase: escapeHtml(l.phrase) }));
  html = wireCrossLinks(html, links, 'scroll-link');
  const rubric = RUBRICS.find(r => r.patch === patchKey && r.para === index);
  if (rubric) {
    html = html.replace(escapeHtml(rubric.phrase), m => `<span class="scroll-rubric">${m}</span>`);
  }
  const intense = INTENSITIES.find(x => x.patch === patchKey && x.para === index);
  if (intense) {
    html = html.replace(escapeHtml(intense.phrase), m => {
      const inner = intense.mode === 'tight' ? franticWords(m) : m;
      return `<span class="scroll-intense scroll-intense--${intense.mode}">${inner}</span>`;
    });
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
    return `<span class="scroll-word" data-style="transform: rotate(${rot}deg) translateY(${dy}px);">${word}</span>`;
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

// Preview tile, opening Ogham mark, and SVG filter defs live in scroll.html
// — genuinely static markup, unlike the per-piece patches below (those stay
// JS-generated because they're actually built from data).

// Hidden SVG filter defs — feTurbulence/feDisplacementMap for grain and
// hand-wobble, referenced from CSS via filter: url(#id). Inserted once,
// globally — this still has to happen at runtime (it's a real DOM mount,
// not CSS), guarded against double-injection across repeat scene visits.
function buildSvgDefs() {
  if (document.getElementById('scroll-svg-defs')) return;
  const frag = parseHTML(scrollHtml);
  document.body.appendChild(frag.querySelector('#scroll-svg-defs'));
}

export function createScroll(container, { preview = false, initialPieceId = null, onPieceChange = null } = {}) {
  buildSvgDefs();
  // One parse serves whichever branch below actually runs (preview and
  // full are mutually exclusive per call) — the piece that ends up unused
  // is simply never appended anywhere and gets garbage collected.
  const frag = parseHTML(scrollHtml);

  if (preview) {
    const previewRoot = frag.querySelector('.scroll-preview');
    container.appendChild(previewRoot);
    return {
      // See the full-mode setPaused below — same class, same reasoning. A
      // preview tile behind an open scene is display:none'd, which stops
      // nothing: the medallion's ember keyframes keep running and keep
      // re-resolving its SVG filter chain.
      setPaused(paused) { previewRoot.classList.toggle('scroll-paused', paused); },
      dispose() { previewRoot.remove(); },
    };
  }

  // This scene briefly gained a bottom-center title in the 2026-08-25
  // site-wide title consistency pass; removed again same day per Scott's
  // call — no title chrome here, consistent with this scene's own
  // stated design ("no titles/sources/dates/glosses," see file header)
  // and .scroll-patch-refs's own comment in scroll.css.

  // The twelve pieces' actual text (scroll.text.js) is dynamically
  // imported below rather than statically at the top of this file — the
  // preview branch above returns before ever touching it, so a preview
  // thumbnail never needs this text (v3.10.3, same shape as sphere.js/
  // harmonics.js). `disposed` lets the async continuation no-op if the
  // scene is torn down before the import resolves (a fast scene switch).
  // `patchesRef`/`jumpToPatchRef` are set once it resolves; the returned
  // openPieceById() guards on them being non-null.
  let disposed = false;
  let root = null, scroll = null;
  let onLinkClick = null;
  let patchesRef = null, jumpToPatchRef = null;
  let glowObserver = null;
  // Records whatever position/overflow the shared #experience-container had
  // before this scene wrote its own, and hands back the restore() half —
  // see claimContainer's own comment in sceneKit.js for the bug that came
  // of seven scenes writing and one putting anything back.
  const claim = claimContainer(container);
  // The flash-highlight's own 1.4s wind-down and the post-mount focus
  // hand-off, tracked so dispose() drops both — a pending scroll.focus()
  // firing after teardown pulls focus out of whatever scene replaced this
  // one, the same way sphere's side-flip timer used to.
  const timers = trackTimers();

  import('./scroll.text.js').then(({ scrollPieces, toOgham }) => {
    if (disposed) return;

    const { PATCHES, SCRIPT_INSERTS } = buildPatches(scrollPieces);
    patchesRef = PATCHES;

    root = document.createElement('div');
    root.className = 'scroll-root';

    scroll = document.createElement('div');
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
      // Cartography's opening is one 441-character comma-spliced clause running
      // to a single em dash (see firstSentences' comment) — transliterated at
      // the standard 118px column width that comes out roughly 2300px tall,
      // nearly double the piece's own body text: a long stretch of dead space
      // at the bottom of the patch. A wider column for unusually long opening
      // lines keeps every character transliterated (no truncating real text)
      // while bringing the column's height back in proportion to the piece
      // it's marking. 200 characters is comfortably past every other piece's
      // opening (the runner-up is Projection's two-sentence opener at 151;
      // Cartography's is 452 — checked by running firstSentences over all
      // twelve pieces directly rather than guessing).
      const oghamWide = openingLine.length > 200;
      const oghamHtml = `<span class="scroll-ogham-line${oghamWide ? ' scroll-ogham-line--wide' : ''}" aria-hidden="true">${toOgham(openingLine)}</span>`;

      const groupCount = OPENING_GROUP[patch.key] || 0;
      const textWrap = document.createElement('div');
      textWrap.className = groupCount > 0 ? 'scroll-patch-text scroll-patch-text--contained' : 'scroll-patch-text';
      const paragraphHtml = patch.body.map((p, idx) => {
        const rot = (Math.random() * 1.6 - 0.8).toFixed(2);
        const dx = (Math.random() * 6 - 3).toFixed(1);
        // Sometimes slightly larger, sometimes the tracking runs a little
        // longer/looser — a hand doesn't set every line at one fixed size.
        const scale = (0.94 + Math.random() * 0.17).toFixed(3);
        const track = (0.01 + Math.random() * 0.035).toFixed(3);
        const style = `transform: rotate(${rot}deg) translateX(${dx}px); ` +
          `font-size: calc(var(--scroll-base-size, 1.2rem) * ${scale}); letter-spacing: ${track}em;`;
        let out = `<p data-style="${style}">${renderParagraph(patch.pieceId, patch.key, idx, p)}</p>`;
        const insert = SCRIPT_INSERTS.find(s => s.patch === patch.key && s.afterIndex === idx);
        if (insert) out += renderScriptBlock(insert.script);
        return out;
      });
      // See OPENING_GROUP above — groupCount leading paragraphs (0 meaning
      // "none, leave it uncontained") get boxed with the Ogham line into one
      // .scroll-opening clearfix; the rest render exactly as plain siblings.
      textWrap.innerHTML = groupCount > 0
        ? `<div class="scroll-opening">${oghamHtml}${paragraphHtml.slice(0, groupCount).join('')}</div>` +
          paragraphHtml.slice(groupCount).join('')
        : oghamHtml + paragraphHtml.join('');
      applyDeferredStyles(textWrap);
      article.appendChild(textWrap);

      // Inbound-reference acknowledgment — deliberately NOT the "Referenced
      // from X" treatment sphere/orbiter/library use, since this scene's
      // whole point (see file header) is that pieces carry no titles, no
      // sources, no dates on their own hide. Naming the source piece here
      // would be the one thing this scene refuses to do everywhere else, so
      // this only ever marks THAT a passage is echoed elsewhere, never which
      // piece — same quiet-metadata register as the other scenes' notes,
      // just deliberately untitled to match scroll's own bare-text rule.
      if (getInboundLinks('scroll', patch.pieceId).length) {
        const refsEl = document.createElement('p');
        refsEl.className = 'scroll-patch-refs';
        refsEl.textContent = 'echoed elsewhere on the scroll';
        article.appendChild(refsEl);
      }

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

    // Same #landing-bottom-fade recipe (styles/main.css), reused here: a
    // fixed, non-scrolling gradient strip sitting right where
    // .scroll-viewport's own box ends (--footer-safe-zone above the
    // bottom edge), so the last visible line of text fades out instead of
    // hitting that box's hard overflow boundary. Design-notes pass,
    // 2026-09-01.
    const bottomFade = document.createElement('div');
    bottomFade.className = 'scroll-bottom-fade';
    bottomFade.setAttribute('aria-hidden', 'true');
    root.appendChild(bottomFade);

    container.appendChild(root);

    // preventDefault, because this scene's own jump does something a plain
    // fragment navigation can't: it scrolls the patch into view inside
    // .scroll-viewport (its own scroll container, not the document) and
    // flashes it. There is no keydown twin of this any more — wireCrossLinks
    // emits a real <a href="#scene/id"> as of v4.0, and that URL shape is
    // exactly what main.js's hash router parses, so Enter is handled by the
    // anchor itself and comes back round through openPieceById() below. The
    // hand-rolled Enter/Space handler that used to sit here existed only
    // because an href-less <a> isn't activatable.
    onLinkClick = e => {
      const link = e.target.closest('.scroll-link');
      if (!link) return;
      e.preventDefault();
      // Same not-yet-cross-scene note as library.js/orbiter.js: every link in
      // the shared store currently targets 'scroll' itself.
      if (link.dataset.targetScene !== 'scroll') return;
      const targetPatch = PATCHES.find(p => p.pieceId === Number(link.dataset.targetId));
      if (targetPatch) jumpToPatch(targetPatch);
    };
    scroll.addEventListener('click', onLinkClick);

    // Off-screen patches stop running their candlelight glow. .scroll-patch
    // carries content-visibility: auto (scroll.css), which already skips
    // layout and paint for anything off screen — but the ::after glow is a
    // mix-blend-mode: screen layer on an infinite 4.2s keyframe, and its
    // animation keeps being ticked regardless. Toggling animation-play-state
    // from a real IntersectionObserver stops the twelve of them outright,
    // and covers browsers without content-visibility (Safari before 17) too.
    // rootMargin gives a patch a screen's warning so it is already at the
    // right point in its cycle by the time it is actually visible.
    //
    // Patches start WITHOUT the class and the observer adds it, not the
    // other way round. Pre-marking them all and letting the observer clear
    // the visible one saves a frame of animation nobody sees — but it also
    // means that anywhere the observer never reports (no IntersectionObserver
    // at all; a callback the browser hasn't delivered yet; a page that is
    // hidden, where the rendering steps this callback rides on don't run),
    // the glow is off rather than on. This way the failure mode is the
    // behaviour that shipped before this optimisation existed, which is the
    // right direction for something whose whole job is to change nothing
    // visible.
    if ('IntersectionObserver' in window) {
      glowObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          entry.target.classList.toggle('scroll-patch--offscreen', !entry.isIntersecting);
        }
      }, { root: scroll, rootMargin: '100% 0px' });
      scroll.querySelectorAll('.scroll-patch').forEach(el => glowObserver.observe(el));
    }

    // Scrolls to and flashes a patch, reporting it as the "open" piece —
    // shared by onLinkClick above, the initial-load deep link below, and
    // openPieceById (returned below, for a same-scene hash edit). Scroll has
    // no open/closed panel state the way sphere/orbiter/library do (the
    // whole piece is always fully rendered); "opening a piece" here means
    // "scroll to and highlight it," which is also the only moment this scene
    // ever reports a piece change — ordinary scrolling past a patch doesn't.
    //
    // The scroll's own DOM element ids are still built from each patch's
    // `key` (`patch-iron` etc, set on PATCHES above) rather than the numeric
    // id directly — the shared store and the hash only know pieces by id, so
    // this resolves that back to the element id actually in the DOM.
    function jumpToPatch(targetPatch, { smooth = true } = {}) {
      const targetEl = scroll.querySelector(`#${targetPatch.id}`);
      if (!targetEl) return;
      onPieceChange?.(targetPatch.pieceId);
      // A cross-link jump can run the length of up to twelve patches — tens
      // of thousands of pixels of tall, filtered, blended content sliding
      // past in one animated sweep, which is a textbook vestibular trigger
      // and exactly the kind of motion this file's own reduced-motion block
      // (scroll.css) is otherwise thorough about. Read live rather than
      // sampled at mount: the visitor may have turned the setting on since.
      const behavior = smooth && !prefersReducedMotion() ? 'smooth' : 'auto';
      targetEl.scrollIntoView({ behavior, block: 'start' });
      targetEl.classList.add('scroll-flash');
      timers.after(1400, () => targetEl.classList.remove('scroll-flash'));
    }
    jumpToPatchRef = jumpToPatch;

    function openPieceByIdImpl(id) {
      const targetPatch = PATCHES.find(p => p.pieceId === id);
      if (targetPatch) jumpToPatch(targetPatch, { smooth: false });
    }
    // Deep-link entry — jump straight there rather than smooth-scrolling
    // from the top, same reasoning sphere/orbiter/library skip their open
    // transition on initial load.
    if (initialPieceId !== null) openPieceByIdImpl(initialPieceId);

    timers.after(100, () => scroll.focus());
  });

  return {
    // Same-scene deep link support (main.js's expandScene). fragmentsRef/
    // jumpToPatchRef are null until the dynamic import above resolves — a
    // same-scene hash change arriving in that narrow window (sub-second,
    // full mode only) is silently ignored, same defensive stance as a
    // patch id that doesn't resolve at all.
    openPieceById(id) {
      if (!patchesRef || !jumpToPatchRef) return;
      const targetPatch = patchesRef.find(p => p.pieceId === id);
      if (targetPatch) jumpToPatchRef(targetPatch, { smooth: false });
    },
    // main.js pauses a scene it isn't showing — every preview tile while a
    // full scene is open, and everything on `visibilitychange`. There is no
    // requestAnimationFrame loop to cancel here: this scene's motion is all
    // CSS (the candlelight on .scroll-root::before, twelve patch glows, the
    // script page's flutter, the intense passages' text glow), and
    // display:none does not stop a CSS animation any more than it stops a
    // rAF loop. One class, and .scroll-paused (scroll.css) holds every one
    // of them at animation-play-state: paused. Idempotent, because main.js
    // calls it on every sync rather than tracking what it has already told.
    setPaused(paused) { root?.classList.toggle('scroll-paused', paused); },
    dispose() {
      disposed = true;
      timers.dispose();
      glowObserver?.disconnect();
      if (scroll && onLinkClick) scroll.removeEventListener('click', onLinkClick);
      if (root) root.remove();
      claim.restore();
      // #scroll-svg-defs is deliberately NOT removed. buildSvgDefs() appends
      // it to document.body once, guarded by an id check, and every repeat
      // visit to this scene reuses that same node — the CSS in scroll.css
      // references its filters by url(#scroll-grain) / url(#scroll-rough),
      // and a preview tile on the landing page (which this scene's own
      // dispose has no say over) is still using them the moment the full
      // scene closes. Removing it here would break the preview's medallion
      // until the next visit re-injected it. Said here as well as at the
      // injection site so this reads as a decision rather than an omission.
    }
  };
}
