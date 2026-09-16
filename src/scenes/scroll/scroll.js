
import { getOutboundLinks, getInboundLinks } from '../../links.js';
import { escapeHtml, parseHTML, wireCrossLinks, prefersReducedMotion, claimContainer, trackTimers } from '../../utils/sceneKit.js';
import { createFlame } from './scroll.flame.js';
import { TONES, RUBRICS, INTENSITIES, OGHAM_LINES, OPENING_GROUP } from './scroll.marks.js';
import scrollHtml from './scroll.html?raw';
import './scroll.css';

const MOTIF_CYCLE = ['spiral', 'chevron', 'cupring', 'dots'];


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

function applyDeferredStyles(root) {
  root.querySelectorAll('[data-style]').forEach(el => {
    el.style.cssText += el.getAttribute('data-style');
    el.removeAttribute('data-style');
  });
}

function firstSentences(text, count) {
  const matches = text.match(/[^.!?]*[.!?]+/g) || [text];
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
    const paren = el.parenthetical
      ? `<p class="scroll-script-paren">${escapeHtml(el.parenthetical)}</p>`
      : '';
    return `<div class="scroll-script-dialogue">` +
      `<p class="scroll-script-character">${escapeHtml(el.character)}</p>` +
      paren +
      `<p class="scroll-script-line">${escapeHtml(el.text)}</p>` +
      `</div>`;
  }).join('');
  return `<div class="scroll-script" data-style="--script-rot: ${rot}deg; --script-delay: ${delay}s;">` +
    `<span class="scroll-script-pin" aria-hidden="true"></span>` +
    `<div class="scroll-script-page">${body}</div>` +
    `</div>`;
}

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

function franticWords(escapedPhrase) {
  return escapedPhrase.split(' ').map(word => {
    const rot = (Math.random() * 7 - 3.5).toFixed(1);
    const dy = (Math.random() * 6 - 3).toFixed(1);
    return `<span class="scroll-word" data-style="transform: rotate(${rot}deg) translateY(${dy}px);">${word}</span>`;
  }).join(' ');
}

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
  return `contrast(${contrast.toFixed(2)}) brightness(${brightness.toFixed(2)}) sepia(${sepia.toFixed(2)}) saturate(${saturate.toFixed(2)})`;
}

const STAIN_BLENDS = ['multiply', 'multiply', 'multiply', 'soft-light'];
function buildStain() {
  const el = document.createElement('div');
  el.className = 'scroll-stain';
  el.setAttribute('aria-hidden', 'true');
  const w = 9 + Math.random() * 24;   // % of the patch's width
  const hw = 0.55 + Math.random() * 0.7;
  const left = Math.random() * (100 - w);
  const top = 4 + Math.random() * 78;
  const rot = (Math.random() * 50 - 25).toFixed(1);
  const blend = STAIN_BLENDS[Math.floor(Math.random() * STAIN_BLENDS.length)];
  const opacity = (0.1 + Math.random() * 0.24).toFixed(2);
  const dark = blend === 'multiply';
  const blur = (0.6 + Math.random() * 2.2).toFixed(1);
  el.style.cssText = `left:${left.toFixed(1)}%; top:${top.toFixed(1)}%; width:${w.toFixed(1)}%; aspect-ratio:${(1 / hw).toFixed(3)};` +
    `transform: rotate(${rot}deg); mix-blend-mode: ${blend}; opacity: ${opacity}; filter: blur(${blur}px);` +
    `background: radial-gradient(circle, ${dark ? 'rgba(18,12,5,0.95)' : 'rgba(255,246,224,0.65)'} 0%, transparent 70%);`;
  return el;
}


function buildSvgDefs() {
  if (document.getElementById('scroll-svg-defs')) return;
  const frag = parseHTML(scrollHtml);
  document.body.appendChild(frag.querySelector('#scroll-svg-defs'));
}

export function createScroll(container, { preview = false, initialPieceId = null, onPieceChange = null } = {}) {
  buildSvgDefs();
  const frag = parseHTML(scrollHtml);

  if (preview) {
    const previewRoot = frag.querySelector('.scroll-preview');
    container.appendChild(previewRoot);
    return {
      setPaused(paused) { previewRoot.classList.toggle('scroll-paused', paused); },
      dispose() { previewRoot.remove(); },
    };
  }


  let disposed = false;
  let root = null, scroll = null;
  let onLinkClick = null;
  let patchesRef = null, jumpToPatchRef = null;
  let flameStop = null;
  const claim = claimContainer(container);
  const timers = trackTimers();

  import('./scroll.text.js').then(({ scrollPieces, toOgham }) => {
    if (disposed) return;

    const { PATCHES, SCRIPT_INSERTS } = buildPatches(scrollPieces);
    patchesRef = PATCHES;

    root = document.createElement('div');
    root.className = 'scroll-root';

    scroll = document.createElement('section');
    scroll.className = 'scroll-viewport';
    scroll.setAttribute('tabindex', '-1');
    scroll.setAttribute('aria-label', 'A scroll of found writing, carved fragments, 2000 to the 2010s');

    scroll.appendChild(frag.querySelector('.scroll-ogham-panel'));

    PATCHES.forEach((patch, i) => {
      const article = document.createElement('article');
      article.className = `scroll-patch scroll-patch-tone-${patch.tone}`;
      article.id = patch.id;
      article.style.setProperty('--patch-clip', patchClipPath());
      article.style.setProperty('--flame-gain', (0.55 + Math.random() * 0.8).toFixed(2));
      article.style.setProperty('--patch-aging', agingFilter(patch.tone));

      const stainCount = 2 + Math.floor(Math.random() * 2);
      for (let s = 0; s < stainCount; s++) {
        article.appendChild(buildStain());
      }

      const openingLine = firstSentences(patch.body[0], OGHAM_LINES[patch.key] || 1);
      const oghamWide = openingLine.length > 200;
      const oghamHtml = `<span class="scroll-ogham-line${oghamWide ? ' scroll-ogham-line--wide' : ''}" aria-hidden="true">${toOgham(openingLine)}</span>`;

      const groupCount = OPENING_GROUP[patch.key] || 0;
      const textWrap = document.createElement('div');
      textWrap.className = groupCount > 0 ? 'scroll-patch-text scroll-patch-text--contained' : 'scroll-patch-text';
      const paragraphHtml = patch.body.map((p, idx) => {
        const rot = (Math.random() * 1.6 - 0.8).toFixed(2);
        const dx = (Math.random() * 6 - 3).toFixed(1);
        const scale = (0.94 + Math.random() * 0.17).toFixed(3);
        const track = (0.01 + Math.random() * 0.035).toFixed(3);
        const style = `transform: rotate(${rot}deg) translateX(${dx}px); ` +
          `font-size: calc(var(--scroll-base-size, 1.2rem) * ${scale}); letter-spacing: ${track}em;`;
        let out = `<p data-style="${style}">${renderParagraph(patch.pieceId, patch.key, idx, p)}</p>`;
        const insert = SCRIPT_INSERTS.find(s => s.patch === patch.key && s.afterIndex === idx);
        if (insert) out += renderScriptBlock(insert.script);
        return out;
      });
      textWrap.innerHTML = groupCount > 0
        ? `<div class="scroll-opening">${oghamHtml}${paragraphHtml.slice(0, groupCount).join('')}</div>` +
          paragraphHtml.slice(groupCount).join('')
        : oghamHtml + paragraphHtml.join('');
      applyDeferredStyles(textWrap);
      article.appendChild(textWrap);

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

    const bottomFade = document.createElement('div');
    bottomFade.className = 'scroll-bottom-fade';
    bottomFade.setAttribute('aria-hidden', 'true');
    root.appendChild(bottomFade);

    container.appendChild(root);

    startFlame();

    onLinkClick = e => {
      const link = e.target.closest('.scroll-link');
      if (!link) return;
      e.preventDefault();
      if (link.dataset.targetScene !== 'scroll') return;
      const targetPatch = PATCHES.find(p => p.pieceId === Number(link.dataset.targetId));
      if (targetPatch) jumpToPatch(targetPatch);
    };
    scroll.addEventListener('click', onLinkClick);


    function jumpToPatch(targetPatch, { smooth = true } = {}) {
      const targetEl = scroll.querySelector(`#${targetPatch.id}`);
      if (!targetEl) return;
      onPieceChange?.(targetPatch.pieceId);
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
    if (initialPieceId !== null) openPieceByIdImpl(initialPieceId);

    timers.after(100, () => scroll.focus());
  });

  function startFlame() {
    if (!root || flameStop || disposed || prefersReducedMotion()) return;
    const flame = createFlame();
    let id = requestAnimationFrame(function tick(now) {
      const f = flame.at(now / 1000);
      const s = root.style;
      s.setProperty('--flame', f.lum.toFixed(4));
      s.setProperty('--flame-x', f.x.toFixed(4));
      s.setProperty('--flame-y', f.y.toFixed(4));
      id = requestAnimationFrame(tick);
    });
    flameStop = () => cancelAnimationFrame(id);
  }

  function stopFlame() {
    flameStop?.();
    flameStop = null;
  }


  return {
    openPieceById(id) {
      if (!patchesRef || !jumpToPatchRef) return;
      const targetPatch = patchesRef.find(p => p.pieceId === id);
      if (targetPatch) jumpToPatchRef(targetPatch, { smooth: false });
    },
    setPaused(paused) {
      root?.classList.toggle('scroll-paused', paused);
      if (paused) stopFlame(); else startFlame();
    },
    dispose() {
      disposed = true;
      timers.dispose();
      stopFlame();
      if (scroll && onLinkClick) scroll.removeEventListener('click', onLinkClick);
      if (root) root.remove();
      claim.restore();
    }
  };
}
