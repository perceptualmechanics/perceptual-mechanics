import {
  bindGuardedResize, prefersReducedMotion, onReducedMotionChange,
  createFrameClock, claimContainer, parseHTML, escapeHtml,
} from '../../utils/sceneKit.js';
import {
  PHASES, PHASE_BY_N, ITEMS, CHOICES, PREAMBLE, score,
  report, CARDINAL,
} from './quiz.text.js';
import quizHtml from './quiz.html?raw';
import './quiz.css';


const GYRE_TURNS = 4.25;
const GYRE_U0 = 0.16;         // where the apex would be, cut back to the first cradle
const GYRE_SEGMENTS = 420;

const ARC_TABLE = (() => {
  const N = 2048, k = 2 * Math.PI * GYRE_TURNS;
  const u = new Float64Array(N + 1), s = new Float64Array(N + 1);
  let acc = 0;
  for (let i = 0; i <= N; i++) {
    const uu = GYRE_U0 + (1 - GYRE_U0) * (i / N);
    if (i > 0) {
      const du = uu - u[i - 1];
      const mid = (uu + u[i - 1]) / 2;
      acc += Math.sqrt(1 + (k * mid) ** 2) * du;
    }
    u[i] = uu; s[i] = acc;
  }
  return { u, s, total: acc, N };
})();

function uAtArc(frac) {
  const { u, s, total, N } = ARC_TABLE;
  const target = frac * total;
  let lo = 0, hi = N;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid] < target) lo = mid + 1; else hi = mid; }
  if (lo === 0) return u[0];
  const span = s[lo] - s[lo - 1];
  const t = span > 0 ? (target - s[lo - 1]) / span : 0;
  return u[lo - 1] + (u[lo] - u[lo - 1]) * t;
}

function gyrePoints(spin, dir) {
  const out = new Array(GYRE_SEGMENTS);
  const k = 2 * Math.PI * GYRE_TURNS;
  for (let i = 0; i < GYRE_SEGMENTS; i++) {
    const u = uAtArc(i / (GYRE_SEGMENTS - 1));
    const th = k * u * dir + spin * dir;
    out[i] = { x: u * Math.cos(th), y: u * Math.sin(th), z: dir * (2 * u - 1), u };
  }
  return out;
}

export function createQuiz(container, { preview = false, initialPieceId = null, onPieceChange = null } = {}) {
  const claim = claimContainer(container, { overflow: 'hidden' });
  const frag = parseHTML(quizHtml);
  const canvas = frag.querySelector('.quiz-canvas');
  const scrimEls = [...frag.querySelectorAll('.quiz-scrim')];
  const titleRow = frag.querySelector('.quiz-title-row');
  const hintEl = frag.querySelector('.quiz-hint');
  const form = frag.querySelector('.quiz-form');
  const itemList = frag.querySelector('.quiz-items');
  const remainingEl = frag.querySelector('.quiz-remaining');
  const submitBtn = frag.querySelector('.quiz-submit');
  const verdict = frag.querySelector('.quiz-verdict');
  const vNumber = frag.querySelector('.quiz-verdict-number');
  const vName = frag.querySelector('.quiz-verdict-name');
  const vSheet = frag.querySelector('.quiz-verdict-sheet');
  const vClose = frag.querySelector('.quiz-verdict-close');
  const citeEl = frag.querySelector('.quiz-cite');
  const ledeEl = frag.querySelector('.quiz-verdict-lede');
  const takeBtn = frag.querySelector('.quiz-take');
  const srLive = frag.querySelector('.quiz-sr-live');

  if (preview) {
    for (const el of [titleRow, hintEl, form, verdict, srLive, ...scrimEls]) el?.remove();
  }
  container.appendChild(frag);

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let disposed = false, paused = false, animId = null;
  let reduced = prefersReducedMotion();

  const responses = new Map();

  function buildForm() {
    if (preview) return;
    const pre = container.querySelector('.quiz-preamble');
    if (pre) pre.textContent = PREAMBLE.join(' ');
    itemList.innerHTML = ITEMS.map((item, i) => `
      <li class="quiz-item">
        <fieldset>
          <legend><span class="quiz-item-n">${i + 1}.</span>${escapeHtml(item.text)}</legend>
          <div class="quiz-choices">
            ${CHOICES.map(c => `
              <label class="quiz-choice">
                <input type="radio" name="quiz-item-${item.id}" value="${c.value}">
                <span>${escapeHtml(c.label)}</span>
              </label>`).join('')}
          </div>
        </fieldset>
      </li>`).join('');
    itemList.addEventListener('change', (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || el.type !== 'radio') return;
      const id = Number(el.name.replace('quiz-item-', ''));
      responses.set(id, Number(el.value));
      updateRemaining();
    });
    updateRemaining();
  }

  function updateRemaining() {
    const left = ITEMS.length - responses.size;
    remainingEl.textContent = left === 0
      ? 'All sixteen answered.'
      : `${left} ${left === 1 ? 'question' : 'questions'} left.`;
    submitBtn.disabled = left !== 0;
  }

  let spin = 0, whirl = 0, whirlTarget = 0, whirlV = 0;
  let markN = null;            // the phase to light, once there is one
  let markPulse = 0;
  let revealed = preview;

  const clock = createFrameClock();

  function project(p, t) {
    const tilt = 0.62 + 0.09 * Math.sin(t * 0.19);
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    const y = p.y * c - p.z * sn;
    const z = p.y * sn + p.z * c;
    const persp = 2.6 / (2.6 + z);
    return { x: p.x * persp, y: y * persp, depth: z };
  }

  function drawGyre(pts, t, scale, cx, cyy, hue) {
    let started = false;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const q = project(pts[i], t);
      const X = cx + q.x * scale, Y = cyy + q.y * scale;
      if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y);
    }
    ctx.strokeStyle = hue;
    ctx.stroke();
  }

  function drawWheel(t, scale, cx, cyy, alpha) {
    for (let i = 1; i <= 28; i++) {
      const th = ((i - 1) / 28) * Math.PI * 2 - Math.PI / 2 + t * 0.06;
      const p = project({ x: Math.cos(th), y: Math.sin(th), z: 0 }, t);
      const inner = CARDINAL.includes(i) ? 0.84 : 0.92;
      const p2 = project({ x: Math.cos(th) * inner, y: Math.sin(th) * inner, z: 0 }, t);
      const lit = markN === i;
      ctx.beginPath();
      ctx.moveTo(cx + p.x * scale, cyy + p.y * scale);
      ctx.lineTo(cx + p2.x * scale, cyy + p2.y * scale);
      ctx.lineWidth = lit ? 3 : 1;
      ctx.strokeStyle = lit
        ? `rgba(246,226,164,${Math.min(1, alpha * 2 + markPulse)})`
        : `rgba(214,208,192,${alpha * (CARDINAL.includes(i) ? 0.9 : 0.55)})`;
      ctx.stroke();
    }
  }

  function drawTile() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgb(4,4,8)';
    ctx.fillRect(0, 0, W, H);
    const rows = 4, pips = 5;
    const pad = W * 0.17;
    const inner = W - pad * 2;
    const rowH = (H - pad * 2) / rows;
    const answered = [3, 1, 4, 2];
    const lens = [0.96, 0.72, 0.88, 0.6];
    for (let r = 0; r < rows; r++) {
      const y = pad + rowH * r + rowH * 0.22;
      ctx.fillStyle = 'rgba(232,228,220,0.78)';
      ctx.fillRect(pad, y, inner * lens[r], Math.max(2, H / 90));
      if (lens[r] > 0.9) {
        ctx.fillStyle = 'rgba(232,228,220,0.46)';
        ctx.fillRect(pad, y + H / 42, inner * 0.42, Math.max(2, H / 90));
      }
      const py = y + rowH * 0.52;
      const step = inner / (pips - 1);
      const rad = Math.max(2.2, W / 52);
      for (let i = 0; i < pips; i++) {
        const cxp = pad + step * i;
        ctx.beginPath();
        ctx.arc(cxp, py, rad, 0, Math.PI * 2);
        if (i === answered[r]) {
          ctx.fillStyle = 'rgba(226,206,150,0.92)';
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(226,222,214,0.42)';
          ctx.lineWidth = Math.max(1, W / 220);
          ctx.stroke();
        }
      }
    }
  }

  function frame() {
    animId = null;
    if (disposed || paused) return;
    if (preview) { drawTile(); return; }
    const dt = clock.tick();
    const t = clock.elapsed;

    const stiff = 46, damp = 9.2;
    whirlV += (whirlTarget - whirl) * stiff * dt - whirlV * damp * dt;
    whirl += whirlV * dt;
    spin += dt * (0.10 + whirl * 5.4);
    if (markPulse > 0) markPulse = Math.max(0, markPulse - dt * 0.5);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(4,4,8,${reduced ? 1 : 0.34 - whirl * 0.19})`;
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cyy = H / 2;
    const scale = Math.min(W, H) * (0.40 + whirl * 0.42);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, Math.min(W, H) / 780) * (1 + whirl * 1.35);
    ctx.lineJoin = 'round';

    const a = 0.42 + whirl * 1.05;
    drawGyre(gyrePoints(spin, 1), t, scale, cx, cyy, `rgba(196,206,232,${a})`);
    drawGyre(gyrePoints(spin, -1), t, scale, cx, cyy, `rgba(226,196,150,${a})`);
    if (revealed) drawWheel(t, scale, cx, cyy, 0.22 + whirl * 0.5);

    ctx.globalCompositeOperation = 'source-over';
    if (!reduced) animId = requestAnimationFrame(frame);
  }

  const roman = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT',
    'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
    'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY', 'TWENTY-ONE', 'TWENTY-TWO',
    'TWENTY-THREE', 'TWENTY-FOUR', 'TWENTY-FIVE', 'TWENTY-SIX', 'TWENTY-SEVEN',
    'TWENTY-EIGHT'];

  const seg = (segs) => segs
    .map(x => (x.t === 'strong' ? `<b>${escapeHtml(x.s)}</b>` : escapeHtml(x.s)))
    .join('');

  function renderVerdict(result, { shared = false } = {}) {
    const r = report(result, { shared, origin: location.origin });
    ledeEl.hidden = shared;
    vNumber.textContent = `Phase ${roman[r.n]}`;
    vName.textContent = r.name;
    vSheet.innerHTML = r.rows
      .map(row => `<dt>${escapeHtml(row.label)}</dt><dd>${seg(row.segs)}</dd>`)
      .join('');
    vClose.innerHTML = r.closers
      .map(lines => lines.map(l => `<span>${escapeHtml(l)}</span>`).join('<br>'))
      .join('<br>');
    citeEl.innerHTML = `W. B. Yeats, <cite>A Vision</cite> (1937)`
      + ` &nbsp;·&nbsp; Neil Mann, `
      + `<a href="${r.citeUrl}" target="_blank" rel="noopener noreferrer">yeatsvision.com</a>`;
    srLive.textContent = r.announcement;
    takeBtn.hidden = !shared;
  }

  function showPhase(n, { shared = true } = {}) {
    if (!PHASE_BY_N[n] || n === 1 || n === 15) return false;
    renderVerdict({ n, raw: n, displaced: false }, { shared });
    markN = n; markPulse = 1; revealed = true;
    whirl = 0.42; whirlTarget = 0.42;
    scrimEls.forEach(el => { el.dataset.verdict = 'true'; });
    form.hidden = true;
    hintEl?.setAttribute('data-hidden', 'true');
    verdict.hidden = false;
    requestAnimationFrame(() => { verdict.dataset.shown = 'true'; });
    return true;
  }

  function startQuiz() {
    responses.clear();
    itemList.querySelectorAll('input[type="radio"]').forEach(el => { el.checked = false; });
    updateRemaining();
    verdict.dataset.shown = 'false';
    verdict.hidden = true;
    form.hidden = false;
    form.dataset.leaving = 'false';
    hintEl?.removeAttribute('data-hidden');
    scrimEls.forEach(el => { delete el.dataset.verdict; });
    markN = null; revealed = false; whirlTarget = 0;
    onPieceChange?.(null);
    form.scrollTop = 0;
    form.querySelector('input')?.focus?.();
  }

  let verdictTimer = null;
  function submit(e) {
    e?.preventDefault?.();
    if (responses.size !== ITEMS.length) return;
    const result = score(Object.fromEntries(responses));
    renderVerdict(result);
    markN = result.n;
    markPulse = 1;
    revealed = true;

    form.dataset.leaving = 'true';
    hintEl?.setAttribute('data-hidden', 'true');
    scrimEls.forEach(el => { el.dataset.verdict = 'true'; });
    whirlTarget = 1;

    const delay = reduced ? 0 : 1150;
    verdictTimer = setTimeout(() => {
      verdictTimer = null;
      form.hidden = true;
      verdict.hidden = false;
      requestAnimationFrame(() => { verdict.dataset.shown = 'true'; });
      verdict.querySelector('.quiz-verdict-name')?.focus?.();
      whirlTarget = 0.42;
      onPieceChange?.(result.n);
    }, delay);
    if (reduced) { spin += 2.2; frame(); }
  }

  if (!preview) {
    buildForm();
    form.addEventListener('submit', submit);
    takeBtn.addEventListener('click', startQuiz);
    vName.tabIndex = -1;
    if (initialPieceId) showPhase(Number(initialPieceId));
  }

  const resize = bindGuardedResize(container, () => {
    const r = container.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgb(4,4,8)';
    ctx.fillRect(0, 0, W, H);
    if (reduced || preview) frame();
  });

  const reducedWatch = onReducedMotionChange((next) => {
    reduced = next;
    if (!reduced && animId === null && !paused && !disposed) { clock.resync(); frame(); }
    if (reduced) frame();
  });

  if (!reduced) frame(); else frame();

  return {
    openPieceById(id) { showPhase(Number(id)); },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (paused) { if (animId !== null) { cancelAnimationFrame(animId); animId = null; } }
      else { clock.resync(); if (animId === null && !reduced) frame(); }
    },
    dispose() {
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      if (verdictTimer !== null) clearTimeout(verdictTimer);
      resize.dispose();
      reducedWatch.dispose();
      form?.removeEventListener('submit', submit);
      takeBtn?.removeEventListener('click', startQuiz);
      responses.clear();
      claim.restore();
      container.innerHTML = '';
    },
  };
}
