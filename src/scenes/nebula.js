import * as THREE from 'three';

// ─── Nebula: The Gaze ─────────────────────────────────────────────────────────
// "When you look at the light of the stars, you look at the past."
//
// Each constellation here is one of Scott's old sites — not the writing on
// them, but the sites themselves: the actual background, link, and hover
// colors pulled straight out of their CSS and HTML, the way they really
// looked, in the years they were live. Kinetic Muse is deliberately excluded;
// it already lives in The Sphere. Constellation shapes and connecting lines
// are hand-drawn, not algorithmic. The clouds drifting behind everything are
// built from the same palettes — the whole archive's light, diffused.
//
// Clicking any star in a constellation opens a period-accurate recreation of
// that site's homepage — real copy, real hex values, framed as an old browser
// window. (A pixel-for-pixel screenshot isn't possible here: this build
// environment has no headless browser and no path to fetch one — the
// recreation is built from the same source files instead.)

const CONSTELLATIONS = [
  {
    name: 'Spoonfed',
    era: 'the original · 1999–2000',
    swatches: [
      { role: 'Background', hex: '#ffffff' },
      { role: 'Link', hex: '#0099ff' },
      { role: 'Hover', hex: '#ffff00' },
      { role: 'Ink', hex: '#000000' },
    ],
    recreate: () => siteWindow({
      titlebar: 'spoonfed.net',
      url: 'http://www.spoonfed.net/',
      bg: '#ffffff', fg: '#000000',
      bodyHTML: `
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:bold;text-decoration:underline;margin-bottom:16px;">spoonfed.net</div>
        <div style="font-family:Tahoma,Verdana,sans-serif;font-size:12px;line-height:2.4;">
          <a style="color:#0099ff;font-weight:bold;">about</a> &nbsp;·&nbsp;
          <a style="color:#0099ff;font-weight:bold;">elsewhere</a> &nbsp;·&nbsp;
          <a style="color:#000;background:#ffff00;font-weight:bold;padding:0 4px;">things</a> &nbsp;·&nbsp;
          <a style="color:#0099ff;font-weight:bold;">forcefed</a> &nbsp;·&nbsp;
          <a style="color:#0099ff;font-weight:bold;">mail</a>
        </div>`,
    }),
    note: 'A wee site created by one Scott Jason Cohen — space for people to visit at work and read something that may or may not amuse them.',
  },
  {
    name: 'Spoonfed Of Color',
    era: 'a sub-site, named for exactly this · c. 2000',
    swatches: [
      { role: 'Ground', hex: '#000000' }, { role: 'Link', hex: '#99ccff' },
      { role: 'apoc', hex: '#006666' }, { role: 'blues', hex: '#000066' },
      { role: 'prev', hex: '#660066' }, { role: 'port', hex: '#660000' },
      { role: 'stuff', hex: '#666600' }, { role: 'mail', hex: '#006600' },
    ],
    recreate: () => siteWindow({
      titlebar: 'spoonfed.net :: of color',
      url: 'http://www.spoonfed.net/ofcolor/',
      bg: '#000000', fg: '#ffffff',
      bodyHTML: `
        <div style="font-family:Tahoma,sans-serif;font-size:12px;">
          <div style="margin-bottom:12px;"><a style="color:#99ccff;font-weight:bold;">« elsewhere</a></div>
          <div style="display:flex;flex-direction:column;gap:7px;">
            ${swatchRow('#006666', 'apoc')}${swatchRow('#000066', 'blues')}${swatchRow('#660066', 'prev')}
            ${swatchRow('#660000', 'port')}${swatchRow('#666600', 'stuff')}${swatchRow('#006600', 'mail')}
          </div>
        </div>`,
    }),
    note: 'Every section of the site got its own color — a deliberate rainbow, laid over black.',
  },
  {
    name: 'Spoonfed, Redesigned',
    era: 'the second pass · 2001–2002',
    swatches: [
      { role: 'Background', hex: '#ffffff' }, { role: 'Accent', hex: '#333366' },
      { role: 'Link', hex: '#333366' }, { role: 'Hover', hex: '#ffff00' },
    ],
    recreate: () => siteWindow({
      titlebar: 'hello from spoonfedland!',
      url: 'http://www.spoonfed.net/',
      bg: '#ffffff', fg: '#000000',
      bodyHTML: `
        <div style="background:#333366;color:#fff;padding:9px 14px;font-family:Georgia,serif;font-weight:bold;font-size:16px;margin:-14px -14px 16px;letter-spacing:0.04em;">SPOONFED</div>
        <div style="font-family:Verdana,Arial,sans-serif;font-style:italic;font-size:13px;margin-bottom:16px;">"If God is white light, then we are all prisms."</div>
        <div style="font-family:Verdana,sans-serif;font-size:11px;">
          <a style="color:#333366;font-weight:bold;">about</a> &nbsp;·&nbsp;
          <a style="color:#333366;font-weight:bold;">roadshow</a> &nbsp;·&nbsp;
          <a style="color:#000;background:#ffff00;font-weight:bold;padding:1px 5px;">archives</a>
        </div>`,
    }),
    note: 'Same domain, same author, a little more sure of its own aesthetic. The indigo survives into everything that comes after.',
  },
  {
    name: 'the butterfly effect',
    era: 'unfinished · 2000–2001',
    swatches: [
      { role: 'Background', hex: '#000000' }, { role: 'Ink', hex: '#ffffff' }, { role: 'Link', hex: '#6666ff' },
    ],
    recreate: () => siteWindow({
      titlebar: 'the butterfly effect',
      url: 'http://www.thebutterflyeffect.net/entrance.html',
      bg: '#000000', fg: '#ffffff',
      bodyHTML: `
        <div style="font-family:Georgia,serif;font-size:19px;letter-spacing:0.04em;margin-bottom:16px;">the butterfly effect.</div>
        <div style="font-family:Tahoma,sans-serif;font-size:11px;line-height:2;color:#6666ff;">
          you're almost there.<br/>
          · Internet Explorer 5.0+ for Mac or PC<br/>
          · a fast connection (56K minimum, cable/T1 preferred)<br/>
          · the Flash 4 plugin<br/>
          · the QuickTime plugin<br/>
          · the Windows Media Player
        </div>
        <div style="margin-top:18px;display:inline-block;border:1px solid #6666ff;color:#6666ff;padding:5px 16px;font-size:11px;letter-spacing:0.2em;opacity:0.35;">ENTER</div>`,
    }),
    note: 'Gated behind a Flash entrance page that checked your browser, your connection speed, your plugins. It never got past that gate.',
    specialNote: 'Nine years later, "a chaos butterfly, a Lorenz attractor" became his own language for heartbreak, in Projection. Twenty-six years later, Chaos Butterfly in Phase Space, 2026 got finished and built — elsewhere on this very site.',
  },
  {
    name: 'Solistrato',
    era: 'later · a subsequent project',
    swatches: [
      { role: 'Background', hex: '#c9e9f6' }, { role: 'Card', hex: '#fafafa' }, { role: 'Ink', hex: '#333333' },
    ],
    recreate: () => siteWindow({
      titlebar: 'stream of consciousness from a skylodge somewhere in new england',
      url: 'https://solistrato.com/',
      bg: '#c9e9f6', fg: '#333333',
      bodyHTML: `
        <div style="background:#fafafa;border:1px solid #bebebe;box-shadow:0 0 16px rgba(0,0,0,0.1);padding:13px 15px;font-family:'Poppins',Arial,sans-serif;font-size:12px;line-height:1.65;">
          <div style="font-size:9px;opacity:0.55;margin-bottom:6px;">24.10.21</div>
          <div>drawing down the axis. cold blue morning, pull back taut, aim at the sky, release and find where the arrow falls… chrome rabbit still reflecting…</div>
        </div>`,
    }),
    note: 'A much later, calmer register — pastel instead of primary, a boxed card instead of a bare page.',
  },
];

function swatchRow(hex, label) {
  return `<div><span style="display:inline-block;width:11px;height:11px;background:${hex};margin-right:8px;vertical-align:-1px;border-radius:2px;"></span>${label}</div>`;
}

function siteWindow({ titlebar, url, bg, fg, bodyHTML }) {
  return `
    <div class="ns-window">
      <div class="ns-titlebar">
        <span class="ns-dot"></span><span class="ns-dot"></span><span class="ns-dot"></span>
        <span class="ns-titletext">${titlebar}</span>
      </div>
      <div class="ns-urlbar">${url}</div>
      <div class="ns-body" style="background:${bg};color:${fg};">${bodyHTML}</div>
    </div>`;
}

// Hand-drawn positions relative to each constellation's center (not algorithmic).
// "Spoonfed Of Color" is laid out as a literal ring — a color wheel.
function ringLayout(n, radius) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius * 0.85, Math.sin(a * 2) * 0.3]);
  }
  return pts;
}

const CENTERS = {
  'Spoonfed':               [-6.5, 2.4, -2.5],
  'Spoonfed Of Color':      [6.5, 1.6, -3.5],
  'Spoonfed, Redesigned':   [-5.6, -2.8, 3.0],
  'the butterfly effect':   [5.4, -2.2, 2.2],
  'Solistrato':             [0, 4.6, -1.0],
};

const LAYOUTS = {
  'Spoonfed': [[0, 1.0, 0], [1.0, -0.2, 0.3], [0, -1.1, -0.2], [-1.0, -0.1, 0.2]],
  'Spoonfed Of Color': ringLayout(8, 1.5),
  'Spoonfed, Redesigned': [[0, 0.9, 0], [1.0, -0.1, 0.3], [0, -1.0, -0.2], [-1.0, 0, 0.2]],
  'the butterfly effect': [[0, 0.9, 0], [0.9, -0.6, 0.2], [-0.9, -0.6, -0.2]],
  'Solistrato': [[0, 0.7, 0], [0.9, -0.5, 0.2], [-0.9, -0.5, -0.2]],
};

const LINE_PATHS = {
  'Spoonfed': [[0, 1], [1, 2], [2, 3], [3, 0]],
  'Spoonfed Of Color': [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]],
  'Spoonfed, Redesigned': [[0, 1], [1, 2], [2, 3], [3, 0]],
  'the butterfly effect': [[0, 1], [1, 2], [2, 0]],
  'Solistrato': [[0, 1], [1, 2], [2, 0]],
};

// Cloud palette pulled from the same site archive — every hue here is real.
const CLOUD_HUES = [0x0099ff, 0xffff00, 0x333366, 0x6666ff, 0xc9e9f6, 0x006666, 0x660066, 0x006600];

export function createNebula(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(60, w / h, 0.1, 500);
  camera.position.z = preview ? 12 : 14;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  // ─── Webb-style nebula clouds ────────────────────────────────────────────
  function makeCloudTexture(hue) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const cx = c.getContext('2d');
    const col = new THREE.Color(hue);
    const rgb = `${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)}`;
    const blobs = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < blobs; i++) {
      const bx = 60 + Math.random() * 136;
      const by = 60 + Math.random() * 136;
      const br = 50 + Math.random() * 80;
      const grad = cx.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0,   `rgba(${rgb},${0.35 + Math.random() * 0.2})`);
      grad.addColorStop(0.5, `rgba(${rgb},0.14)`);
      grad.addColorStop(1,   `rgba(${rgb},0)`);
      cx.fillStyle = grad;
      cx.beginPath();
      cx.arc(bx, by, br, 0, Math.PI * 2);
      cx.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);
  const clouds = [];
  const cloudCount = preview ? 5 : 11;
  for (let i = 0; i < cloudCount; i++) {
    const hue = CLOUD_HUES[i % CLOUD_HUES.length];
    const tex = makeCloudTexture(hue);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: preview ? 0.16 : 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const scale = (preview ? 8 : 14) + Math.random() * (preview ? 6 : 12);
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(
      (Math.random() - 0.5) * (preview ? 18 : 32),
      (Math.random() - 0.5) * (preview ? 14 : 24),
      -6 - Math.random() * (preview ? 8 : 16)
    );
    cloudGroup.add(sprite);
    clouds.push({ sprite, driftPhase: Math.random() * Math.PI * 2, driftSpeed: 0.02 + Math.random() * 0.03 });
  }

  // ─── Ambient deep field ─────────────────────────────────────────────────────
  const starCount = preview ? 400 : 1200;
  const positions = new Float32Array(starCount * 3);
  const sizes     = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * (preview ? 24 : 40);
    positions[i * 3 + 1] = (Math.random() - 0.5) * (preview ? 24 : 40);
    positions[i * 3 + 2] = (Math.random() - 0.5) * (preview ? 10 : 16) - 4;
    sizes[i] = Math.random() * (preview ? 1.4 : 2.2) + 0.4;
  }
  const ambientGeo = new THREE.BufferGeometry();
  ambientGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  ambientGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const ambientMat = new THREE.PointsMaterial({
    color: 0xddeeff, size: preview ? 0.03 : 0.05,
    transparent: true, opacity: 0.4, sizeAttenuation: true,
  });
  const ambientField = new THREE.Points(ambientGeo, ambientMat);
  scene.add(ambientField);

  // ─── Named constellation stars, colored from real site palettes ────────────
  const root = new THREE.Group();
  scene.add(root);

  const starMeshes = [];
  const lineObjects = [];

  function makeHaloTexture(hexColor) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const cx = c.getContext('2d');
    const col = new THREE.Color(hexColor);
    const rgb = `${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)}`;
    const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb},0.9)`);
    grad.addColorStop(0.4, `rgba(${rgb},0.35)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  CONSTELLATIONS.forEach(constellation => {
    const layout = LAYOUTS[constellation.name];
    const center = CENTERS[constellation.name];
    const starGeo = new THREE.SphereGeometry(preview ? 0.09 : 0.11, 12, 12);
    const positionsWorld = [];

    constellation.swatches.forEach((swatch, i) => {
      const [ox, oy, oz] = layout[i];
      const [cx, cy, cz] = center;
      const pos = new THREE.Vector3(cx + ox, cy + oy, cz + oz);
      positionsWorld.push(pos);

      const color = new THREE.Color(swatch.hex);
      const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const mesh = new THREE.Mesh(starGeo, glowMat);
      mesh.position.copy(pos);
      root.add(mesh);

      const haloMat = new THREE.SpriteMaterial({
        map: makeHaloTexture(swatch.hex), color, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(preview ? 0.7 : 1.0, preview ? 0.7 : 1.0, 1);
      mesh.add(halo);

      starMeshes.push({ mesh, glowMat, haloMat, constellation });
    });

    const paths = LINE_PATHS[constellation.name] || [];
    const linePts = [];
    const lineColors = [];
    paths.forEach(([a, b]) => {
      linePts.push(positionsWorld[a].x, positionsWorld[a].y, positionsWorld[a].z);
      linePts.push(positionsWorld[b].x, positionsWorld[b].y, positionsWorld[b].z);
      const ca = new THREE.Color(constellation.swatches[a].hex);
      const cb = new THREE.Color(constellation.swatches[b].hex);
      lineColors.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
    });
    if (linePts.length) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePts), 3));
      lineGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lineColors), 3));
      const lineMat = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: preview ? 0.4 : 0.32,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      root.add(lines);
      lineObjects.push(lines);
    }
  });

  // ─── Panel + window-chrome styling ───────────────────────────────────────
  if (!preview && !document.getElementById('nebula-styles')) {
    const style = document.createElement('style');
    style.id = 'nebula-styles';
    style.textContent = `
      #nebula-panel {
        position: absolute; top: 0; right: 0; width: 38%; height: 100%;
        background: #07060a; border-left: 1px solid rgba(200,200,220,0.2);
        padding: 3rem 2rem; transform: translateX(100%);
        transition: transform .5s cubic-bezier(.16,1,.3,1);
        overflow-y: scroll; z-index: 10;
        scrollbar-color: rgba(200,200,220,0.3) #07060a; scrollbar-width: thin;
        font-family: 'Electrolize', sans-serif;
      }
      #nebula-panel.open { transform: translateX(0); }
      #nebula-panel-constellation {
        font-size: 0.65rem; letter-spacing: 0.3em; text-transform: uppercase;
        color: rgba(255,255,255,0.5); margin-bottom: 0.4rem;
      }
      #nebula-panel-era {
        font-size: 0.7rem; letter-spacing: 0.05em; color: rgba(255,255,255,0.3);
        margin-bottom: 1.6rem; font-style: italic;
      }
      #nebula-panel-note {
        font-size: 0.92rem; line-height: 1.85; color: rgba(220,225,240,0.68);
        margin-top: 1.4rem;
      }
      #nebula-panel-special {
        margin-top: 1.4rem; padding-top: 1.2rem;
        border-top: 1px solid rgba(255,255,255,0.1);
        font-size: 0.85rem; line-height: 1.8; color: rgba(255,224,138,0.55);
        font-style: italic;
      }
      #nebula-panel-close {
        position: absolute; top: 1.5rem; right: 1.5rem; background: none;
        border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
        cursor: pointer; padding: .5rem; z-index: 2;
      }
      #nebula-panel-close:hover { color: rgba(255,255,255,0.9); }

      .ns-window {
        border-radius: 6px; overflow: hidden;
        border: 1px solid rgba(255,255,255,0.15);
        box-shadow: 0 10px 34px rgba(0,0,0,0.55);
      }
      .ns-titlebar {
        background: #2b2b30; display: flex; align-items: center; gap: 5px;
        padding: 7px 10px;
      }
      .ns-dot { width: 8px; height: 8px; border-radius: 50%; background: #55555c; display: inline-block; }
      .ns-titletext {
        margin-left: 8px; font-family: 'Electrolize', sans-serif; font-size: 10px;
        color: rgba(255,255,255,0.55); letter-spacing: 0.02em;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .ns-urlbar {
        background: #1c1c1f; padding: 5px 10px; font-family: monospace;
        font-size: 10px; color: rgba(255,255,255,0.35);
        border-bottom: 1px solid rgba(255,255,255,0.08);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .ns-body { padding: 16px; min-height: 140px; font-size: 12px; }

      @media (max-width: 700px) {
        #nebula-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
      }
      #nebula-hint, #nebula-caption {
        position: fixed; color: rgba(255,255,255,0.3);
        text-transform: uppercase; pointer-events: none; text-align: center;
        z-index: 202; font-family: 'Times New Roman', serif;
      }
      #nebula-hint {
        top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
        line-height: 1.8; text-align: right;
      }
      #nebula-caption {
        bottom: 2rem; left: 50%; transform: translateX(-50%);
        font-size: clamp(0.7rem, 1.6vw, 0.95rem); letter-spacing: 0.08em;
        white-space: nowrap; font-style: italic; text-transform: none;
        color: rgba(255,255,255,0.4);
      }
      @media (max-width: 600px) {
        #nebula-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Panel (full only) ────────────────────────────────────────────────────
  let panel = null, panelConstellation = null, panelEra = null,
      panelRecreation = null, panelNote = null, panelSpecial = null;
  let hint = null, caption = null;
  if (!preview) {
    panel = document.createElement('aside');
    panel.id = 'nebula-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'nebula-panel-constellation');
    panel.innerHTML = `
      <button id="nebula-panel-close" aria-label="Close site panel">✕</button>
      <div id="nebula-panel-constellation" tabindex="-1"></div>
      <div id="nebula-panel-era"></div>
      <div id="nebula-panel-recreation"></div>
      <div id="nebula-panel-note"></div>
      <div id="nebula-panel-special"></div>
    `;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(panel);
    panelConstellation = panel.querySelector('#nebula-panel-constellation');
    panelEra        = panel.querySelector('#nebula-panel-era');
    panelRecreation  = panel.querySelector('#nebula-panel-recreation');
    panelNote        = panel.querySelector('#nebula-panel-note');
    panelSpecial     = panel.querySelector('#nebula-panel-special');

    panel.addEventListener('click', e => e.stopPropagation());
    panel.querySelector('#nebula-panel-close').addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.remove('open');
      if (selected) { setEmphasis(selected, false); selected = null; }
    });

    hint = document.createElement('p');
    hint.id = 'nebula-hint';
    hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; click a star';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    caption = document.createElement('p');
    caption.id = 'nebula-caption';
    caption.textContent = 'when you look at the light of the stars, you look at the past';
    caption.setAttribute('aria-hidden', 'true');
    document.body.appendChild(caption);
  }

  // ─── Interaction ─────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null, selected = null;

  function setEmphasis(entry, on) {
    entry.glowMat.opacity = on ? 1.0 : 0.95;
    entry.mesh.scale.setScalar(on ? 1.6 : 1.0);
  }

  function openPanel(entry) {
    const c = entry.constellation;
    panelConstellation.textContent = `✦ ${c.name}`;
    panelEra.textContent = c.era;
    panelRecreation.innerHTML = c.recreate();
    panelNote.textContent = c.note || '';
    panelSpecial.textContent = c.specialNote || '';
    panelSpecial.style.display = c.specialNote ? 'block' : 'none';
    panel.classList.add('open');
    setTimeout(() => panelConstellation.focus(), 50);
  }

  if (!preview) {
    container.addEventListener('mousemove', e => {
      const rect = container.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(starMeshes.map(s => s.mesh));
      const newHoverEntry = hits.length ? starMeshes.find(s => s.mesh === hits[0].object) : null;
      if (newHoverEntry !== hovered) {
        if (hovered && hovered !== selected) setEmphasis(hovered, false);
        hovered = newHoverEntry;
        if (hovered && hovered !== selected) setEmphasis(hovered, true);
      }
      container.style.cursor = hovered ? 'pointer' : 'default';
    });

    let touchMoved = false;
    container.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });
    container.addEventListener('touchstart', () => { touchMoved = false; }, { passive: true });
    container.addEventListener('click', e => {
      if (touchMoved) { touchMoved = false; return; }
      if (panel.classList.contains('open') && !panel.contains(e.target)) {
        panel.classList.remove('open');
        if (selected) { setEmphasis(selected, false); selected = null; }
        return;
      }
      if (!hovered) return;
      if (selected && selected !== hovered) setEmphasis(selected, false);
      selected = hovered;
      setEmphasis(selected, true);
      openPanel(selected);
    });
  }

  // ─── Drag to orbit ────────────────────────────────────────────────────────
  let isDragging = false, prevMouse = { x: 0, y: 0 }, autoRotate = true;
  container.addEventListener('mousedown', e => {
    isDragging = true; autoRotate = false;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
    setTimeout(() => { autoRotate = true; }, 2500);
  });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    root.rotation.y += (e.clientX - prevMouse.x) * 0.004;
    root.rotation.x += (e.clientY - prevMouse.y) * 0.004;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  container.addEventListener('wheel', e => {
    if (panel && panel.contains(e.target)) return;
    camera.position.z = Math.max(6, Math.min(28, camera.position.z + e.deltaY * 0.01));
  });

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.001;
    ambientField.rotation.y = Math.sin(t * 0.3) * 0.05;
    ambientField.rotation.x = Math.sin(t * 0.2) * 0.02;

    clouds.forEach(c => {
      c.driftPhase += c.driftSpeed * 0.02;
      c.sprite.material.rotation = c.driftPhase * 0.3;
    });
    cloudGroup.rotation.y = t * 0.02;

    if (autoRotate && !isDragging) {
      root.rotation.y += preview ? 0.0009 : 0.0006;
    }

    starMeshes.forEach((entry, i) => {
      if (entry === hovered || entry === selected) return;
      const pulse = 0.85 + Math.sin(t * 20 + i * 1.7) * 0.08;
      entry.mesh.scale.setScalar(pulse);
    });

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    // A hidden ancestor (e.g. the landing grid behind an active full-screen
    // scene) makes clientWidth/Height read 0 — don't fall through to
    // window.innerWidth/Height in that case, or a small preview container
    // would get resized to fill the whole viewport once it's shown again.
    if (!container.clientWidth || !container.clientHeight) return;
    const nw = container.clientWidth || window.innerWidth;
    const nh = container.clientHeight || window.innerHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 100));

  return {
    dispose() {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      renderer.dispose();
      ambientGeo.dispose();
      ambientMat.dispose();
      lineObjects.forEach(l => { l.geometry.dispose(); l.material.dispose(); });
      starMeshes.forEach(s => { s.glowMat.dispose(); s.haloMat.dispose(); });
      clouds.forEach(c => { c.sprite.material.map?.dispose(); c.sprite.material.dispose(); });
      if (panel) panel.remove();
      if (hint) hint.remove();
      if (caption) caption.remove();
      renderer.domElement.remove();
    }
  };
}
