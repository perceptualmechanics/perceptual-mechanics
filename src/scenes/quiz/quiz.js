import {
  bindGuardedResize, prefersReducedMotion, onReducedMotionChange,
  createFrameClock, claimContainer, parseHTML, escapeHtml,
} from '../../utils/sceneKit.js';
import {
  PHASES, PHASE_BY_N, ITEMS, CHOICES, PREAMBLE, score,
  maskPhase, creativeMindPhase, bodyOfFatePhase, quarterOf, tinctureOf, CARDINAL,
} from './quiz.text.js';
import quizHtml from './quiz.html?raw';
import './quiz.css';

// ─── Quiz — the Wheel of the twenty-eight incarnations, and where you are on it
// Fourteenth scene, 2026-09-06. Sixteen sincere questions, and then a verdict
// delivered without hedging: your phase, your Quarter, your element, all four
// of your Faculties, your symbol, and the people Yeats put where you are.
//
// **The system is treated as literally true and the scene never winks.** There
// is no "of course this is only a poetic schema" anywhere in it. That is a
// tonal decision and it is the whole piece: an instrument that apologises for
// itself is a quiz in a magazine, and Yeats did not think he was writing one.
// The visitor is trusted to know what century they are in.
//
// ─── NOTHING SIGNALS WHAT IS COMING ────────────────────────────────────────
// The hardest rule here and the one that broke first. Until the form is
// submitted, no part of this scene may name Yeats, the Wheel, the phases, or
// the number twenty-eight — not the preamble, not the items, not the hint, not
// the registry blurb that becomes the tile's aria-label, and not the picture.
// The first build spent all of it in a four-line preamble and then a second
// gyre and a rim of twenty-eight marks turned behind the questions.
//
// Every one of those was written by somebody who already knew the ending and
// was enjoying it, which is the failure mode this rule exists for. The checks
// are in three places because there are three ways to leak: quiz.text.js's
// PREAMBLE and ITEMS comments, `revealed` below for the picture, and
// registry.js's entry for the landing page.
//
// ─── The two halves, and the join between them ─────────────────────────────
// Answering is quiet. Plain column, plain type, the wheel turning behind a
// scrim, nothing shouting. Then the form goes, the gyres come off their leash
// and whirl into the full frame, and the judgment lands in capitals. The join
// is the point of the scene and everything here is arranged around it: the
// form's exit is fast and upward, the whirl overshoots before it settles, and
// the verdict does not fade in until the spin is past its peak, so the type
// arrives on a frame that is already moving.
//
// ─── Why 2D canvas and not Three.js ────────────────────────────────────────
// The same reason apollo.js gives, and it has got sharper since: every WebGL
// scene holds a permanent context, the landing page keeps one alive per tile,
// and the browser force-loses the OLDEST context when it runs past its cap —
// which is the tiles. A fourteenth WebGL scene is a fourteenth context against
// a cap near sixteen. It would also buy nothing. Two gyres are two polylines;
// what they need is trails, additive compositing and enormous type on top,
// and a 2D context does all three natively.
//
// ─── State does not persist, deliberately ──────────────────────────────────
// No localStorage, no hash argument, nothing carried between visits. Leaving
// the scene and coming back gives you a blank form, and re-answering can give
// you a different phase. A quiz that remembered your result would be making a
// claim this one does not make — that the phase is a fact about you that the
// site now holds — and the piece is about a system that assigns you a fate,
// not about a site that files one.

// ─── The gyres ──────────────────────────────────────────────────────────────
// Yeats's double cone: two interpenetrating gyres, each widening as the other
// narrows. Drawn as spirals on a cone in three dimensions and projected, not
// as flat spirals — a flat spiral reads as a decoration and a cone reads as a
// solid, and the difference is entirely in the depth cue.
//
// **Truncated at both ends, and the truncation is not cosmetic.** Two things
// meet at it. The first is drawing: a spiral run all the way to its apex puts
// every turn within a pixel of every other and produces a snarl — the same
// failure the Medium board's arcs had, and for the same reason, which is that
// equal steps in the PARAMETER are unequal steps in ARC LENGTH on a curve of
// changing radius. The second is Yeats: the apex is Phase 1 and the mouth is
// Phase 15, and nobody is born at either. The curve stops where the Wheel
// stops carrying lives.
const GYRE_TURNS = 4.25;
const GYRE_U0 = 0.16;         // where the apex would be, cut back to the first cradle
const GYRE_SEGMENTS = 420;

// Equal arc length along the spiral, so the drawn segments are the same size
// near the apex as at the mouth. ds = R * sqrt(1 + (2*pi*T*u)^2) du for the
// radial spiral; integrated once into a table and inverted by lookup, which is
// cheaper per frame than the bisection medium.text.js needs because nothing
// here asks for an arbitrary target length.
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

// The parameter u at a given fraction of the total arc length.
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

// One gyre's points, in the cone's own space. `dir` is +1 for the gyre whose
// apex is at the left and -1 for its opposite, which is what makes them
// interpenetrate rather than merely overlap.
// **The cone's axis runs INTO the screen, not across it.** The first version
// put the axis along screen x, which is a perfectly correct projection of a
// gyre and looks like a sine wave: with the axis across the frame every turn
// of the spiral is a crossing, and what you see is a scribble in a band. The
// axis has to point mostly at the viewer, so the turns read as turns and the
// widening reads as depth. It was obvious the moment the thing was rendered
// and not before, which is the argument for rendering it.
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

export function createQuiz(container, { preview = false } = {}) {
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
  const againBtn = frag.querySelector('.quiz-again');
  const srLive = frag.querySelector('.quiz-sr-live');

  // The tile is the wheel and nothing else: a form at 170px would be a form
  // nobody can read, and a preview that shows an unreadable form advertises
  // the scene as unreadable. What the tile shows is the object the scene is
  // about, turning.
  if (preview) {
    // The scrims go too, and that is not an oversight fixed later — it was.
    // They exist to hold a fixed ground under TEXT, and a tile has no text on
    // it. Left in, the flat scrim's 0.88 took the tile down to a smudge: the
    // curves were all there, all correct, and nobody could see them. Measured
    // rather than eyeballed, because "the tile renders" and "the tile is
    // visible" are different claims and this project has confused them before.
    for (const el of [titleRow, hintEl, form, verdict, srLive, ...scrimEls]) el?.remove();
  }
  container.appendChild(frag);

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let disposed = false, paused = false, animId = null;
  let reduced = prefersReducedMotion();

  // ─── The answers ──────────────────────────────────────────────────────────
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
    // Counted rather than "n of 16", because what a visitor wants to know
    // partway down a long form is how much is left, not how far they have come.
    remainingEl.textContent = left === 0
      ? 'All sixteen answered.'
      : `${left} ${left === 1 ? 'question' : 'questions'} left.`;
    submitBtn.disabled = left !== 0;
  }

  // ─── The whirl ────────────────────────────────────────────────────────────
  // `spin` is the gyres' own rotation and `whirl` is how hard they are being
  // driven. Answering runs at rest; submitting drives whirl to 1 over about a
  // second with an overshoot, and it decays back to a raised idle that never
  // quite returns to the quiet state — the wheel has been woken and stays awake.
  let spin = 0, whirl = 0, whirlTarget = 0, whirlV = 0;
  let markN = null;            // the phase to light, once there is one
  let markPulse = 0;
  // **Nothing on screen may name the ending before the ending.** Two
  // interpenetrating cones ARE the diagram in `A Vision`, and a rim of exactly
  // twenty-eight marks is the answer with the working shown — a visitor who
  // would recognise either has been told what this is while they are still on
  // question three, which is the one thing the scene cannot afford. So while
  // the form is up there is ONE gyre and no rim: a turning form, unreadable as
  // anything in particular. The second cone and the twenty-eight arrive with
  // the whirl, which is the moment the piece stops pretending.
  //
  // In the preview tile `revealed` starts true, and that is not an
  // inconsistency: a tile is the scene's face on the landing page, the way
  // every other tile is, and a visitor looking at it has not started anything
  // to be spoiled. What must not leak is anything a person sees while
  // ANSWERING.
  let revealed = preview;

  const clock = createFrameClock();

  // Tilted off the axis so the mouth of each cone reads as a circle seen at an
  // angle rather than as a circle seen flat — a gyre viewed exactly down its
  // own axis is a target, and a target has no depth. The tilt breathes, which
  // is what keeps the pair reading as one solid turning object rather than as
  // two curves that happen to overlap.
  function project(p, t) {
    const tilt = 0.62 + 0.09 * Math.sin(t * 0.19);
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    const y = p.y * c - p.z * sn;
    const z = p.y * sn + p.z * c;
    // The divide is on the rotated depth, so the near end of each cone is
    // genuinely larger than the far end. 2.6 is the eye distance in cone
    // units; smaller is a wider lens and turns the far turns inside out.
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

  // The 28 marks. Drawn on the mouth circle of the widening gyre, which is
  // where the Wheel is: the phases are positions on the rim, not points in the
  // cone's interior. Cardinal Phases are drawn longer, because 1, 8, 15 and 22
  // are not in a Quarter and the rim should say so before anyone is told.
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

  function frame() {
    animId = null;
    if (disposed || paused) return;
    const dt = clock.tick();
    const t = clock.elapsed;

    // A light spring rather than a tween, so the overshoot is a property of
    // the motion and not a keyframe somebody has to keep in step with the CSS.
    const stiff = 46, damp = 9.2;
    whirlV += (whirlTarget - whirl) * stiff * dt - whirlV * damp * dt;
    whirl += whirlV * dt;
    spin += dt * (0.10 + whirl * 5.4);
    if (markPulse > 0) markPulse = Math.max(0, markPulse - dt * 0.5);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Trails rather than a clear: the whirl is only legible as a whirl if the
    // frame keeps a little of where the curve just was. The alpha is tied to
    // whirl so the quiet state is crisp and the driven state smears.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(4,4,8,${reduced ? 1 : 0.34 - whirl * 0.19})`;
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cyy = H / 2;
    // Big enough to be the frame rather than an ornament in it, and the whirl
    // pushes it past the edges — the gyres are supposed to arrive, not appear.
    const scale = Math.min(W, H) * (0.40 + whirl * 0.42);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, Math.min(W, H) / 620) * (1 + whirl * 0.9);
    ctx.lineJoin = 'round';

    // The peak is meant to be loud. 0.30 at rest is a texture behind a form;
    // the driven value is over 1, which a canvas clamps per stroke but which
    // still reads brighter once the two gyres and the rim overlap in
    // 'lighter'. The whirl is the one moment this scene raises its voice.
    const a = 0.30 + whirl * 1.05;
    drawGyre(gyrePoints(spin, 1), t, scale, cx, cyy, `rgba(196,206,232,${a})`);
    if (revealed) {
      drawGyre(gyrePoints(spin, -1), t, scale, cx, cyy, `rgba(226,196,150,${a})`);
      drawWheel(t, scale, cx, cyy, 0.22 + whirl * 0.5);
    }

    ctx.globalCompositeOperation = 'source-over';
    if (!reduced) animId = requestAnimationFrame(frame);
  }

  // ─── The verdict ──────────────────────────────────────────────────────────
  const roman = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT',
    'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
    'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY', 'TWENTY-ONE', 'TWENTY-TWO',
    'TWENTY-THREE', 'TWENTY-FOUR', 'TWENTY-FIVE', 'TWENTY-SIX', 'TWENTY-SEVEN',
    'TWENTY-EIGHT'];

  function row(dt, dd) { return `<dt>${escapeHtml(dt)}</dt><dd>${dd}</dd>`; }

  function facultyRow(label, n, spec, which) {
    const p = PHASE_BY_N[n];
    const head = `drawn from phase ${n}, ${escapeHtml(p.will)}`;
    if (!spec) return row(label, head);
    const forms = which === 'bf'
      ? `<b>${escapeHtml(spec)}</b>`
      : `true: <b>${escapeHtml(spec.t)}</b> &nbsp; false: <b>${escapeHtml(spec.f)}</b>`;
    return row(label, `${head}<br>${forms}`);
  }

  function renderVerdict(result) {
    const p = result.phase;
    const q = quarterOf(p.n);
    const mn = maskPhase(p.n), cn = creativeMindPhase(p.n), bn = bodyOfFatePhase(p.n);
    vNumber.textContent = `Phase ${roman[p.n]}`;
    vName.textContent = p.will;

    // The Faculties are read off THIS phase's row, not off the phase they are
    // drawn from. Yeats attributes a Faculty to the phase it comes from and
    // describes it by what it does here, and conflating the two is the single
    // easiest mistake to make in the whole system.
    const parts = [
      row('Number', `<b>${p.n}</b> of 28`),
      q ? row('Quarter', `<b>${escapeHtml(q.name)}</b> &nbsp; element ${escapeHtml(q.element)} &nbsp; ${escapeHtml(q.dominant)} dominates`)
        : row('Quarter', `<b>None.</b> A Cardinal Phase, on the boundary between quarters`),
      row('Tincture', `<b>${escapeHtml(tinctureOf(p.n))}</b>`),
      facultyRow('Will', p.n, null),
      facultyRow('Mask', mn, p.mask, 'mask'),
      facultyRow('Creative Mind', cn, p.cm, 'cm'),
      facultyRow('Body of Fate', bn, p.bf, 'bf'),
      row('Symbol', escapeHtml(p.symbol)),
    ];
    if (p.who.length) parts.push(row('Others here', p.who.map(escapeHtml).join(' &nbsp;·&nbsp; ')));
    if (p.attributed.length) parts.push(row('Placed here by others', p.attributed.map(escapeHtml).join(' &nbsp;·&nbsp; ')));
    vSheet.innerHTML = parts.join('');

    vClose.textContent = p.n === 22 || p.n === 8
      ? 'You are at a phase of crisis. The wheel does not hold still here, and neither will you.'
      : 'This is your place on the wheel. It was not chosen and it cannot be refused.';

    // One flat sentence for a screen reader, before the capitals arrive. The
    // sheet that follows is a real <dl> and reads correctly on its own; this
    // is the headline, so the announcement is not eleven terms deep before it
    // says what happened.
    srLive.textContent = `Phase ${p.n} of 28. ${p.will}. ${q ? `${q.name}, element ${q.element}.` : 'A Cardinal Phase, outside the quarters.'} Your mask is drawn from phase ${mn}, your creative mind from phase ${cn}, your body of fate from phase ${bn}.`;
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

    // The verdict waits for the spin to be past its peak. Reduced motion has
    // no peak to wait for, so it does not wait.
    const delay = reduced ? 0 : 1150;
    verdictTimer = setTimeout(() => {
      verdictTimer = null;
      form.hidden = true;
      verdict.hidden = false;
      // A frame between unhide and the class, so the opacity transition has
      // two values to run between rather than one.
      requestAnimationFrame(() => { verdict.dataset.shown = 'true'; });
      verdict.querySelector('.quiz-verdict-name')?.focus?.();
      whirlTarget = 0.42;
    }, delay);
    if (reduced) { spin += 2.2; frame(); }
  }

  function again() {
    responses.clear();
    itemList.querySelectorAll('input[type="radio"]').forEach(el => { el.checked = false; });
    updateRemaining();
    verdict.dataset.shown = 'false';
    verdict.hidden = true;
    form.hidden = false;
    form.dataset.leaving = 'false';
    hintEl?.removeAttribute('data-hidden');
    scrimEls.forEach(el => { delete el.dataset.verdict; });
    markN = null; whirlTarget = 0; revealed = false;
    srLive.textContent = 'The form is blank again.';
    form.scrollTop = 0;
    form.querySelector('input')?.focus?.();
  }

  if (!preview) {
    buildForm();
    form.addEventListener('submit', submit);
    againBtn.addEventListener('click', again);
    vName.tabIndex = -1;
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
    if (reduced) frame();
  });

  const reducedWatch = onReducedMotionChange((next) => {
    reduced = next;
    if (!reduced && animId === null && !paused && !disposed) { clock.resync(); frame(); }
    if (reduced) frame();
  });

  if (!reduced) frame(); else frame();

  return {
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
      againBtn?.removeEventListener('click', again);
      responses.clear();
      claim.restore();
      container.innerHTML = '';
    },
  };
}
