// ─── Spectra ────────────────────────────────────────────────────────────────
// A comparison plate of dramatic voice. Each speaker in Theater's three plays
// is a light source; their spectrum is what their dialogue is made of.
//
// The physics is the whole point rather than a decoration on it. The same
// element gives bright lines on black or dark lines across a bright continuum,
// at identical wavelengths, depending on whether you are looking AT the source
// or THROUGH it. One fingerprint, two positions. This site has spent ten scenes
// arguing that perception is positional; this one hands the visitor the switch.
//
//   EMISSION    the seven style features this speaker produces, as bright lines
//               at fixed wavelengths, intensity = how far they run from their
//               cast's own centre.
//   ABSORPTION  the same seven wavelengths, drawn as the cast's continuum with
//               this speaker's shortfalls notched out of it — what they take
//               out of the play's voice on the way to you.
//
// Why a stacked plate and not a chart. A single spectrum is a barcode, which is
// the flattest geometry on this site. A real comparison plate is not one
// spectrum: it is several exposures stacked on one photographic plate so the
// lines can be read against each other, which is exactly what a cast is. The
// geometry came from the subject rather than from wanting to avoid a bar chart.
//
// Every number is computed in spectra.data.js from theater.text.js at runtime.
// Nothing here holds a copy, and nothing here decides a ruler — the rulers are
// named at the point of measurement and reprinted on the /text/ page.

import * as THREE from 'three';
import {
  claimContainer, disposeSceneGraph, manageRenderer, createFrameClock, trackTimers,
  bindGuardedResize, prefersReducedMotion, onReducedMotionChange,
  createPanelCloser, createJumpList, parseHTML,
} from '../../utils/sceneKit.js';
import { measurePlays, FEATURES, SPEAKER_FLOOR, SENTENCE_SPLIT } from './spectra.data.js';
import spectraHtml from './spectra.html?raw';
import './spectra.css';

// Each play gets a hue drawn from a real emission line, so the three plates are
// told apart the way three elements would be rather than by an arbitrary
// palette: sodium's amber for the 2001 musician's script, mercury's cyan for a
// daylit duck tour, hydrogen-alpha's red for the one set in Hell.
const PLAY_LIGHT = {
  truthAndBeauty: { hex: 0xffb648, css: '#ffb648', name: 'sodium' },
  paulRevere:     { hex: 0x5fd8ff, css: '#5fd8ff', name: 'mercury' },
  friendInSatan:  { hex: 0xff4a3d, css: '#ff4a3d', name: 'hydrogen α' },
};
const FALLBACK_LIGHT = { hex: 0xe8e4dc, css: '#e8e4dc', name: 'continuum' };

// A soft round-ended vertical line, drawn once into a canvas and reused as the
// only texture in the scene. Every spectral line is this quad; a plate of 8
// exposures x 7 lines is one draw call, not 56.
function makeLineTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 8;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0.0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Normalise a feature to 0..1 against the axis ends declared in the data
// module. Clamped rather than rescaled: an axis that rescales to its extremes
// redraws every other speaker whenever one new line of dialogue is added, which
// makes two readings of the same plate incomparable.
const norm = (v, f) => Math.max(0, Math.min(1, (v - f.lo) / (f.hi - f.lo)));

// The plate's wavelength axis, in normalised device coordinates. It starts well
// right of centre-left to leave a gutter for the exposure labels — a plate is
// annotated in its margin, and the first version ran the axis under the names.
// Declared once and used by the geometry, the label row and the printed scale
// alike: three places computing the same seven positions is three places for
// them to drift apart, which is the whole failure mode this scene is about.
// The full scene reserves a left gutter for the exposure labels; the thumbnail
// has no labels, so it uses the whole plate and centres. A tile that inherited
// the gutter spent its left third on nothing and ran the last line off the
// right edge.
const AXIS = { full: [-0.58, 0.92], preview: [-0.84, 0.84] };
let X0 = AXIS.full[0], X1 = AXIS.full[1];
const featureX = i => X0 + (i / (FEATURES.length - 1)) * (X1 - X0);
// As a CSS percentage of the container's width. Only correct because the camera
// deliberately does not letterbox; see bindGuardedResize below.
const featurePct = i => ((featureX(i) + 1) / 2) * 100;

export function createSpectra(container, { preview = false, initialSpeaker = null } = {}) {
  [X0, X1] = preview ? AXIS.preview : AXIS.full;
  const w0 = container.clientWidth || window.innerWidth;
  const h0 = container.clientHeight || window.innerHeight;

  let disposed = false;
  const timers = trackTimers();
  const clock = createFrameClock();
  let reduceMotion = prefersReducedMotion();

  const plays = measurePlays();
  // The plate a visitor lands on. Paul Revere is the most evenly cast text on
  // the site — seven speakers, none above a third, none below 8% — which makes
  // it the one plate where the comparison reads immediately rather than as one
  // bright line and a row of faint ones.
  let plateIndex = Math.max(0, plays.findIndex(p => p.key === 'paulRevere'));
  let mode = 'emission';
  let selected = null;

  const containerClaim = claimContainer(container, {
    cursor: preview ? 'pointer' : 'crosshair',
    tabIndex: preview ? undefined : 0,
  });

  // ─── Scene ────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Orthographic, because a spectrum has no depth and a perspective camera
  // would put the far end of a line further away than the near end — a
  // wavelength axis that foreshortens is a wavelength axis that lies.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 5;

  const lineTex = makeLineTexture();
  const emissionMat = new THREE.MeshBasicMaterial({
    map: lineTex, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, vertexColors: true,
  });
  // Flat, unmapped, and separate on purpose. The line texture is a horizontal
  // gradient with soft ends, which is exactly right for a spectral line and
  // exactly wrong for anything wide: stretched across a continuum band it turns
  // the band into a smear that fades at both edges, and the dark absorption
  // notches drawn over it disappeared into the falloff. Soft shapes and hard
  // shapes get their own mesh.
  const flatMat = new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
  });

  const plate = new THREE.Group();
  scene.add(plate);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  const managedRenderer = manageRenderer(renderer);
  renderer.setSize(w0, h0);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  // ─── Plate geometry ───────────────────────────────────────────────────────
  // One merged geometry per rebuild. `bands` keeps the pixel rectangle of each
  // exposure so a pointer or a keyboard selection can be resolved without a
  // raycaster — the plate is axis-aligned, so a hit test is two comparisons and
  // bringing a raycaster to it would be the more complicated answer.
  let bands = [];
  let softMesh = null, flatMesh = null;

  function layout() {
    const play = plays[plateIndex];
    const rows = play.speakers;
    // The stack sits below the head and the control row and above the
    // wavelength scale. These are the two numbers that keep the plate clear of
    // its own chrome; the chrome is laid out in rem from the top, so they are
    // deliberately generous rather than tuned to one viewport.
    // The thumbnail has no chrome to clear, so its stack fills the tile.
    const top = preview ? 0.80 : 0.34, bottom = preview ? -0.80 : -0.74;
    const h = (top - bottom) / rows.length;
    bands = rows.map((s, i) => ({
      speaker: s,
      y0: top - (i + 1) * h,
      y1: top - i * h,
      cy: top - (i + 0.5) * h,
      height: h,
    }));
  }

  function buildPlate() {
    for (const m of [softMesh, flatMesh]) if (m) { plate.remove(m); m.geometry.dispose(); }
    softMesh = flatMesh = null;
    const play = plays[plateIndex];
    const light = PLAY_LIGHT[play.key] ?? FALLBACK_LIGHT;
    const lightColor = new THREE.Color(light.hex);

    const soft = { pos: [], uv: [], col: [], idx: [], v: 0 };
    const flat = { pos: [], uv: [], col: [], idx: [], v: 0 };
    const into = b => (cx, cy, halfW, halfH, r, g, bl) => {
      b.pos.push(cx - halfW, cy - halfH, 0, cx + halfW, cy - halfH, 0,
                 cx + halfW, cy + halfH, 0, cx - halfW, cy + halfH, 0);
      b.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let k = 0; k < 4; k++) b.col.push(r, g, bl);
      b.idx.push(b.v, b.v + 1, b.v + 2, b.v, b.v + 2, b.v + 3);
      b.v += 4;
    };
    const glow = into(soft);   // soft-ended, additive — spectral lines
    const quad = into(flat);   // hard-edged, plain — bands, notches, rules

    // Cast means, per feature — the continuum an absorption reading is taken
    // against. Computed from the qualifying cast only; a two-word walk-on
    // should not move the baseline the leads are measured against.
    const means = FEATURES.map(f => {
      const vals = play.cast.map(s => norm(s.features[f.key], f));
      return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    });

    for (const band of bands) {
      const s = band.speaker;
      const hh = band.height * 0.34;
      if (s.belowFloor) {
        // Under the floor: an unexposed strip. Drawn as a faint broken rule
        // rather than a solid one, because a solid line across the plate reads
        // as a divider between sections and this is not a divider — it is a
        // cast member with too little text to measure. Silently omitting them
        // would make each play look like it had fewer characters than it has.
        for (let k = 0; k < 20; k++) {
          const x = X0 + (k / 19) * (X1 - X0);
          quad(x, band.cy, 0.010, band.height * 0.005,
               preview ? 0.05 : 0.075, preview ? 0.05 : 0.075, preview ? 0.055 : 0.085);
        }
        continue;
      }
      if (mode === 'absorption') {  // eslint-disable-line no-empty
        // The cast's continuum, this speaker's shortfalls taken out of it.
        // The continuum carries the play's own colour, lifted toward white.
        // A neutral grey band read as concrete rather than as light, and the
        // point of the two views is that they are the same source seen from a
        // different position — so the light has to look like the same light.
        quad((X0 + X1) / 2, band.cy, (X1 - X0) / 2 + 0.03, hh * 0.55,
             0.34 + lightColor.r * 0.52, 0.34 + lightColor.g * 0.52, 0.34 + lightColor.b * 0.52);
        FEATURES.forEach((f, i) => {
          const x = featureX(i);
          const deficit = Math.max(0, means[i] - norm(s.features[f.key], f));
          if (deficit <= 0.01) return;
          // Dark lines are drawn as negative space: a near-black quad over the
          // continuum, widening with the size of the shortfall.
          quad(x, band.cy, 0.0028 + deficit * 0.020, hh * 0.60, 0, 0, 0);
        });
      } else {
        FEATURES.forEach((f, i) => {
          const x = featureX(i);
          const n = norm(s.features[f.key], f);
          // Three channels carry the value, because one did not survive being
          // looked at: the first version varied alpha 0.16..1 and width by two
          // pixels, and on a real plate every line read as the same line.
          // Brightness, width and — through the squared glow term — bloom now
          // move together, which is also how an actual exposure behaves: a
          // strong line is not just brighter, it spreads into the emulsion.
          // The thumbnail is 240px and gets a glance, so its floor is lifted
          // and its lines thickened: at the full scene's values a tile of thin
          // faint lines reads as a tile that has not loaded, which is the
          // mistake Butterfly's preview spent a release making.
          const a = (preview ? 0.34 : 0.10) + n * (preview ? 0.66 : 0.90);
          glow(x, band.cy, (preview ? 0.0032 : 0.0011) + n * (preview ? 0.0090 : 0.0060), hh,
               lightColor.r * a, lightColor.g * a, lightColor.b * a);
          const bloom = n * n;
          glow(x, band.cy, 0.004 + bloom * 0.030, hh * 0.96,
               lightColor.r * bloom * 0.20, lightColor.g * bloom * 0.20, lightColor.b * bloom * 0.20);
        });
      }
      if (selected && selected.key === s.key && selected.play === play.key) {
        quad((X0 + X1) / 2, band.y0 + band.height * 0.06, (X1 - X0) / 2 + 0.03, 0.0016, 0.62, 0.60, 0.56);
      }
    }

    const build = (b, mat, order) => {
      if (!b.v) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      geo.setIndex(b.idx);
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = order;
      plate.add(m);
      return m;
    };
    // Flat first: in absorption the notches are drawn over the continuum, and
    // both live in this mesh, so the order inside it is the order they were
    // pushed. The soft additive pass sits on top and contributes only light.
    flatMesh = build(flat, flatMat, 0);
    softMesh = build(soft, emissionMat, 1);
  }

  // ─── Chrome ───────────────────────────────────────────────────────────────
  let ui = null, panel = null, panelBody = null, panelTitle = null, live = null,
      closer = null, jumpList = null, modeBtn = null, plateBtns = [], rowList = null;

  function speakerLabel(s, play) {
    return `${s.name} — ${play.title}`;
  }

  // ─── Row labels ───────────────────────────────────────────────────────────
  // A real comparison plate is annotated in the margin, and so is this one.
  // They are also the scene's whole interaction surface: real <button>s, one
  // per exposure, positioned from the same `bands` the geometry uses. An
  // earlier version hit-tested pointer coordinates against the band rectangles
  // instead, which worked for a mouse and gave a keyboard visitor nothing to
  // land on — the plate was a single tab stop with no way to reach a speaker.
  // Buttons cost nothing here and carry focus, names and disabled state for
  // free.
  //
  // The under-floor cast appear here as disabled entries with their word count.
  // That is the point of showing them: "Messenger, 15 words" is a fact about
  // the play, and dropping the row silently would make the exclusion invisible.
  function buildRows() {
    if (!rowList) return;
    const play = plays[plateIndex];
    rowList.innerHTML = '';
    for (const band of bands) {
      const s = band.speaker;
      const li = document.createElement('li');
      li.style.top = `${(1 - band.y1) / 2 * 100}%`;
      li.style.height = `${band.height / 2 * 100}%`;
      if (s.belowFloor) {
        const span = document.createElement('span');
        span.className = 'spectra-row-off';
        span.textContent = `${s.name} · ${s.words} words`;
        span.title = `Below the ${SPEAKER_FLOOR}-word floor — not enough dialogue to measure`;
        li.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'spectra-row-btn';
        btn.textContent = s.name;
        btn.setAttribute('aria-pressed', String(!!selected && selected.key === s.key && selected.play === play.key));
        btn.addEventListener('click', e => { e.stopPropagation(); select(s, play); });
        li.appendChild(btn);
      }
      rowList.appendChild(li);
    }
  }

  function renderPanel(s, play) {
    if (!panel) return;
    const light = PLAY_LIGHT[play.key] ?? FALLBACK_LIGHT;
    panelTitle.textContent = s.name;
    const rows = FEATURES.map(f => {
      const val = s.features[f.key];
      const pct = Math.round(norm(val, f) * 100);
      return `<tr><th scope="row">${f.label}</th><td>${val}${f.unit}</td>
        <td class="spectra-bar"><span style="width:${pct}%;background:${light.css}"></span></td></tr>`;
    }).join('');
    const own = s.ownLines.length
      ? `<p class="spectra-own"><span>Lines only this speaker has:</span> ${
          s.ownLines.map(o => `<b>${o.term}</b>&#8202;×&#8202;${o.count}`).join(', ')}</p>`
      : `<p class="spectra-own spectra-none">No term of their own — every word they repeat, someone else in this cast says too.</p>`;
    panelBody.innerHTML =
      `<p class="spectra-sub">${play.title} · ${s.words} spoken words across ${s.lines} lines</p>
       <table class="spectra-table"><caption>Emission — what this voice is made of</caption><tbody>${rows}</tbody></table>
       <p class="spectra-abs"><b>${s.absorptionRate}%</b> of this cast's shared vocabulary never appears in their lines
       — ${s.absorbed.length} of ${play.shared.length} words the rest of them have in common.</p>
       ${own}
       <p class="spectra-ruler">Sentences split on terminal punctuation, with ellipses and dashes left inside the
       sentence (<code>${SENTENCE_SPLIT}</code>). Shared vocabulary is every token three or more of this play's
       ${play.cast.length} qualifying speakers use, with no stopword list — read the percentages for rank rather
       than as absolutes, since the filter moves them.</p>`;
    panel.classList.add('open');
    live.textContent = `${s.name}, ${play.title}. ${s.words} spoken words. Absorption ${s.absorptionRate} percent.`;
    panelTitle.focus();
  }

  function select(s, play) {
    selected = { key: s.key, play: play.key };
    buildPlate();
    buildRows();
    if (!preview) renderPanel(s, play);
  }

  function setMode(next) {
    mode = next;
    if (modeBtn) {
      modeBtn.textContent = mode === 'emission' ? 'Emission' : 'Absorption';
      modeBtn.setAttribute('aria-label',
        mode === 'emission'
          ? 'Showing emission — what each voice produces. Activate to show absorption.'
          : 'Showing absorption — what each voice removes from the cast. Activate to show emission.');
    }
    buildPlate();
    if (live) live.textContent = mode === 'emission'
      ? 'Emission: bright lines are what each speaker produces.'
      : 'Absorption: dark lines are where a speaker falls below their cast.';
  }

  function setPlate(i) {
    plateIndex = i;
    selected = null;
    layout();
    buildPlate();
    buildRows();
    plateBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    if (panel) panel.classList.remove('open');
    if (live) live.textContent = `${plays[i].title}. ${plays[i].cast.length} speakers on the plate, ${plays[i].speakers.length - plays[i].cast.length} below the ${SPEAKER_FLOOR}-word floor.`;
  }

  layout();
  buildPlate();

  if (!preview) {
    ui = parseHTML(spectraHtml);
    container.appendChild(ui);
    panel = container.querySelector('.spectra-panel');
    panelTitle = container.querySelector('.spectra-panel h2');
    panelBody = container.querySelector('.spectra-panel-body');
    live = container.querySelector('.spectra-live');
    rowList = container.querySelector('.spectra-rows');
    const scale = container.querySelector('.spectra-scale');
    FEATURES.forEach((f, i) => {
      const li = document.createElement('li');
      li.textContent = f.label;
      li.style.left = `${featurePct(i).toFixed(2)}%`;
      scale.appendChild(li);
    });
    modeBtn = container.querySelector('.spectra-mode');
    const plateRow = container.querySelector('.spectra-plates');

    plays.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'spectra-plate-btn';
      b.textContent = p.title;
      b.style.setProperty('--line', (PLAY_LIGHT[p.key] ?? FALLBACK_LIGHT).css);
      b.setAttribute('aria-pressed', String(i === plateIndex));
      b.addEventListener('click', e => { e.stopPropagation(); setPlate(i); });
      plateRow.appendChild(b);
      plateBtns.push(b);
    });

    modeBtn.addEventListener('click', e => {
      e.stopPropagation();
      setMode(mode === 'emission' ? 'absorption' : 'emission');
    });
    setMode(mode);
    buildRows();

    closer = createPanelCloser(panel, container, {
      closeBtn: container.querySelector('.spectra-close'),
      onClose: () => { selected = null; buildPlate(); },
    });

    jumpList = createJumpList(container, {
      label: 'Jump to a speaker',
      items: plays.flatMap(p => p.cast.map(s => ({ s, p }))),
      getLabel: ({ s, p }) => speakerLabel(s, p),
      onSelect: ({ s, p }) => {
        const i = plays.indexOf(p);
        if (i !== plateIndex) setPlate(i);
        select(s, p);
      },
    });

    // Up/Down walk the exposures. A plate is a stack, so the arrow keys that
    // match it are the vertical pair; left/right are left for the browser.
    const onKey = e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const play = plays[plateIndex];
      const cast = play.cast;
      if (!cast.length) return;
      const cur = selected ? cast.findIndex(s => s.key === selected.key) : -1;
      const next = e.key === 'ArrowDown'
        ? Math.min(cast.length - 1, cur + 1)
        : Math.max(0, (cur < 0 ? cast.length : cur) - 1);
      e.preventDefault();
      select(cast[next], play);
    };
    container.addEventListener('keydown', onKey);

    if (initialSpeaker) {
      for (const p of plays) {
        const s = p.cast.find(x => x.key === initialSpeaker);
        if (s) { setPlate(plays.indexOf(p)); select(s, p); break; }
      }
    }

    container._spectraTeardown = () => {
      container.removeEventListener('keydown', onKey);
    };
  }

  // ─── Frame loop ───────────────────────────────────────────────────────────
  // The plate is static geometry; the only motion is a slow breath on the
  // emission glow, which is what makes a photographic plate read as light
  // rather than as print. It is scaled by dt, not by frame, and it does not
  // run at all under reduced motion — a spectrum that does not shimmer is
  // still a spectrum, so there is nothing to substitute.
  let animId = null;
  let paused = false;
  let breath = 0;

  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    if (!reduceMotion) {
      breath += dt * 0.55;
      const a = 0.94 + Math.sin(breath) * 0.06;
      emissionMat.opacity = a;
    } else {
      emissionMat.opacity = 1;
    }
    renderer.render(scene, camera);
  }
  // Called directly rather than scheduled: the tile must own a first frame
  // before create() returns, or syncPreviewPlayback() can pause it out of
  // existence before the queued callback ever runs. See harmonics.js.
  animate();

  const motionWatch = onReducedMotionChange(v => {
    reduceMotion = v;
    if (v) emissionMat.opacity = 1;
  });

  const resize = bindGuardedResize(container, (nw, nh) => {
    // Deliberately NOT letterboxed. The camera stays -1..1 on both axes, so
    // normalised x maps linearly onto the container's own width at every
    // viewport — which is what lets the printed wavelength scale in
    // spectra.html sit at the same seven percentages the lines are drawn at.
    // A letterboxed plate would keep its proportions and silently slide the
    // lines out from under their labels on any window that isn't 4:3.
    // Vertical stretch only changes how tall an exposure is, which carries no
    // information here — the reading is horizontal.
    renderer.setSize(nw, nh);
    managedRenderer.applyPixelRatio();
  });

  return {
    setPaused(next) {
      const want = Boolean(next);
      if (want === paused) return;
      paused = want;
      if (paused) { cancelAnimationFrame(animId); animId = null; }
      else { clock.resync(); animate(); }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animId);
      timers.dispose();
      motionWatch.dispose();
      resize.dispose();
      closer?.dispose();
      jumpList?.dispose();
      container._spectraTeardown?.();
      delete container._spectraTeardown;
      ui?.remove();
      disposeSceneGraph(scene);
      lineTex.dispose();
      emissionMat.dispose();
      flatMat.dispose();
      managedRenderer.dispose();
      renderer.domElement.remove();
      containerClaim.restore();
    },
  };
}
