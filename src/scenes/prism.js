import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion,
  bindTapVsDrag, bindEscapeClose, createPanelCloser, createJumpList,
  HINT_TEXT_COLOR,
} from '../utils/sceneKit.js';
import {
  ANCHORS_META, SEED_PIECES, SEED_PIECES_BY_ID, GROWTH_PIECES, GROWTH_PIECES_BY_ID,
  PRISM_STRUCTURE, STRUCTURE_BY_ID,
} from '../text/prismManifest.js';
import { hashSeed } from '../utils/dla.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ─── Prism ──────────────────────────────────────────────────────────────────
// Supersedes Lens entirely (2026-07-30) — not a revision of the shelved
// four-facet gem. Unlike Leaf/Cycle/the golden hare (paused experiments kept
// on disk, "comment out, don't delete"), this is a real rename/replacement,
// same discipline as Egg→Orbiter and Manuscript→Scroll: lens.js is gone
// (its content lives on in git history, same as always), this file is what
// replaces it — an organically-grown crystal, geode/mineral-accretion
// energy rather than a cut gem, that grows a new branch for every real
// piece of writing on the site. The growth algorithm (diffusion-limited
// aggregation) and the full structure it produces live in src/utils/dla.js
// and src/text/prismManifest.js; this file only renders the already-grown
// structure and handles interaction.
//
// ─── Round 2 (2026-07-30): seed is scenery, growth is content ─────────────
// SEED_PIECES (the 68 pieces from the six original scenes) are the material
// Prism grows FROM, never clickable, never a permanent label — the only way
// any of their text is ever fully legible is the ambient cycle (see below).
// GROWTH_PIECES (src/text/prismEntries.js) are genuinely new writing, added
// through utils/prism-curator.html, and are the only clickable content.
//
// ─── Round 3 (2026-07-30): connectivity was real in the data, invisible on
// screen — see prismManifest.js and NOTES.md 1.11.0 for the full account.
// Branch/joint rendering was rescaled to match dla.js's own PARTICLE_RADIUS
// and anchor spacing tightened (R=0.45→0.14) so the six arms genuinely read
// as one connected mass instead of isolated clusters.
//
// ─── Round 4 (2026-07-30): design pass — gem vs. matrix, jewel palette,
// locked text, a cave ─────────────────────────────────────────────────────
// Pure rendering/material/environment work — no change to dla.js, the
// seed/growth data split, or the curator tool. Four things, all from
// Scott's own explicit brief (see NOTES.md 1.12.0 for the full account):
//
//   1. Two substances, not one. Every stuck point (`ANCHOR_GEMS`/growth) now
//      renders as a genuinely glassy, low-poly-faceted gem (octahedron,
//      MeshPhysicalMaterial, real transmission — the same technique proven
//      on the old Lens gem and Orbiter's core), while the connective shard
//      between a point and its parent renders as a rough, matte "matrix"
//      material derived from the same hue — a real geode's dull rock
//      exterior around its dazzling crystal interior.
//   2. Palette derived, not invented. Each anchor's gem color is pulled from
//      that scene's own established on-site palette (see the comment above
//      ANCHOR_GEMS) and desaturated toward a jewel-tone register — this is
//      the same "systematic, not picked by eye" discipline the old hue-wheel
//      palette used, just deriving from real precedent instead of an
//      arbitrary wheel.
//   3. Text is genuinely hard to read, not decoratively so — via real
//      obstacles, not a fake duplicated-copy effect (round 4 shipped a
//      ghosted double-print that read as broken text rendering, not
//      refraction; corrected in round 5, see makeTextTexture's own
//      header). Every piece of text on the crystal (seed or growth) other
//      than the one line the existing ambient cycle currently illuminates
//      now renders as a small, plainly-baked (no ghosting), fixed-
//      orientation (not camera-facing) plane, nudged behind/inside the gem
//      it belongs to. Three real, independent obstacles stack: true
//      optical smallness (too small to resolve at the default camera
//      distance — see the zoom range below); a real angle dependency
//      (the plane doesn't billboard, so whether it's face-on or edge-on to
//      the camera depends on the crystal's current rotation); and actual
//      optical bending from the gem's own MeshPhysicalMaterial
//      transmission, which is a real per-frame render of whatever sits
//      behind the transmissive surface, not a decorative stand-in for one.
//      Clicking a growth piece no longer depends on its label being
//      legible — the
//      raycast target is the gem itself, not the label plane.
//   4. A cave, lit by one fire. The plain dark void is gone; a low-poly rock
//      dome now encloses the scene, lit primarily by one warm, flickering
//      point light (not the crystal's own rotating group — a fixed light
//      and fixed walls, so the crystal's rotation genuinely changes the
//      shadow it throws), with the crystal's own parts casting real shadows
//      onto the distant walls. No figures, no narrative staging — same
//      restraint Orrery already uses for its warehouse.
//
// ─── The epigraph ───────────────────────────────────────────────────────────
// "If God is white light, then we are all prisms." — Scott's own line,
// found in the Spoonfed archive (spoonfed/cyclone/thinks/about/
// refraction.html, Scott's first site, pre-dating Kinetic Muse). Surfaced
// here the same way Orbiter surfaces "sing, orbiter" — a plain caption,
// uncredited in-scene, full citation in the colophon's bibliography.
//
// ─── Distortion is the content, not a flaw ─────────────────────────────────
// Every warped text texture on this crystal is baked from several
// overlapping, offset, hue-shifted, per-character sine-warped copies of
// itself — genuinely hard to read head-on, the same way looking straight
// into a rough crystal distorts whatever's behind it. Once a growth piece
// is actually opened, the read panel is the site's standard plain
// read-more panel — no distortion carried in.

// ─── Six anchor gem colors, derived from each scene's own established
// on-site palette (not an arbitrary hue wheel), pulled toward a
// desaturated jewel-tone register ──────────────────────────────────────────
//   sphere  → sapphire — sphere.js's own vertex-color blues (0x4a7fb5 family)
//   scroll  → citrine/topaz — scroll.js's parchment-and-amber palette
//             (#c17a3d, #d99a51)
//   theater → garnet — theater.js's own deep curtain red (#6b1f1f)
//   orbiter → emerald — orbiter.js's positive-lobe green (0x78ffb4); its
//             violet negative lobe (0xc978ff) is amethyst's own family,
//             used as this anchor's accent rather than a second base color
//   leaf    → peridot — leafText's veinMat sage green (0x5a8a55), shifted
//             more yellow-green than orbiter's cooler emerald to stay
//             distinct
//   orrery  → smoky amber — orrery.js's workshop rust/lamp-glow warmth
//             (0x8a2a1f, 0xffaa33), darker and smokier than scroll's citrine
const ANCHOR_GEMS = {
  sphere:  '#4a72a8', // sapphire
  scroll:  '#c8935a', // citrine / topaz
  theater: '#7a2530', // garnet
  orbiter: '#3f8a6b', // emerald
  leaf:    '#7a9a4a', // peridot
  orrery:  '#9a5a2e', // smoky amber
};
const GROWTH_GEM = '#cbb896'; // moonstone — pale, low-saturation, distinct from every seed hue

function gemHue(hex) {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(hex).getHSL(hsl);
  return Math.round(hsl.h * 360);
}
const ANCHOR_HUES = Object.fromEntries(
  ANCHORS_META.map(a => [a.key, gemHue(ANCHOR_GEMS[a.key])])
);
const GROWTH_HUE = gemHue(GROWTH_GEM);

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function lines(s) {
  return esc(s).replace(/\n/g, '<br>');
}

// ─── Ambient line extraction (seed content only) ───────────────────────────
// One representative sentence per seed piece — used for the passive
// on-crystal glimmer (the ambient cycle, unchanged from round 2) and now
// also as the source text for that same piece's permanent, heavily-ghosted
// label plane (round 4) — never a full-text render, never a panel.
function firstSentence(text, maxLen = 96) {
  const clean = String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const m = clean.match(/^.{1,200}?[.!?](?=\s|$)/);
  let s = m ? m[0] : clean;
  if (s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + '…';
  return s;
}
function extractAmbientLine(piece) {
  switch (piece.kind) {
    case 'fragment': return firstSentence(piece.data.text);
    case 'scroll':   return firstSentence(piece.data.body[0] || piece.title);
    case 'theater': {
      const dialogue = piece.data.beats.find(b => b.t);
      const action = piece.data.beats.find(b => b.a);
      return firstSentence(dialogue?.t ?? action?.a ?? piece.title);
    }
    case 'poem': {
      const firstLine = (piece.data.stanzas[0] || '').split('\n').map(l => l.trim()).find(Boolean);
      return firstSentence(firstLine ?? piece.title);
    }
    case 'leaf':   return firstSentence(piece.data.stages[0]?.text ?? piece.title);
    case 'orrery': return firstSentence(piece.data.note ?? piece.title);
    default:       return piece.title;
  }
}

function renderGrowthBody(piece) {
  return (piece.data.paragraphs || []).map(p => `<p>${lines(p)}</p>`).join('\n');
}

// ─── Text texture, plain (round 5) ──────────────────────────────────────────
// Round 4 baked THREE offset, semi-transparent copies of the same string as
// its "distortion" — on screen that read exactly as what it was, a
// duplicated ghosted echo, not refraction, which warps a single underlying
// image continuously based on the surface it passes through and never
// prints a second faint copy nearby. Scott's own diagnosis, confirmed.
//
// What actually produces real distortion here is the gem's own
// MeshPhysicalMaterial transmission — a genuine per-frame render of
// whatever sits behind the transmissive surface — with this texture baked
// onto a plane nudged behind/inside its own gem (placeLabel, below). That
// only works, confirmed by direct live testing (see NOTES.md 1.13.0): the
// label material has to be OPAQUE (`transparent: false`). Three.js's
// transmission background pass only captures the opaque render queue —
// a transparent-blended plane sitting behind a transmissive gem is
// invisible to it and never appears bent through the glass at all, it just
// alpha-composites normally (this was tested directly: switching one live
// label's material from transparent to opaque was the difference between
// nothing showing through a gem and the same text visibly, differently
// warped through two separate facets of it). Since the plane has to be
// opaque, its canvas can't have a transparent background either — it's
// filled with a solid near-black base (matching the cave's own fog color)
// so the small rectangle blends into the generally dark scene instead of
// showing as a flat color card.
function makeTextTexture(text, hue, { legibility = 1, maxChars = 34, canvasW = 320, opaqueBg = false } = {}) {
  const w = canvasW, h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  // opaqueBg is for the permanent labels only (see the header above) —
  // the ambient sprite keeps a real transparent background, since it's a
  // billboard meant to fade its own opacity in/out cleanly, not something
  // that needs to be captured by the transmission pass.
  if (opaqueBg) { ctx.fillStyle = '#0a0704'; ctx.fillRect(0, 0, w, h); }
  const label = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
  ctx.font = `22px 'Times New Roman', serif`;
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.35 + 0.65 * legibility;
  ctx.fillStyle = `hsla(${((hue % 360) + 360) % 360}, 70%, 80%, 1)`;
  ctx.textAlign = 'center';
  ctx.fillText(label, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || document.getElementById('prism-styles')) { stylesInjected = true; return; }
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'prism-styles';
  style.textContent = `
    .prism-preview { width: 100%; height: 100%; }
    .prism-preview canvas { width: 100% !important; height: 100% !important; display: block; }

    #prism-title, #prism-hint, #prism-caption {
      position: fixed; color: rgba(255,255,255,0.82);
      text-align: center; pointer-events: none; z-index: 310;
      font-family: 'Times New Roman', serif;
    }
    #prism-title {
      top: 4.4rem; left: 50%; transform: translateX(-50%);
      text-shadow: 0 0 18px rgba(0,0,0,0.85), 0 1px 0 rgba(0,0,0,0.6);
    }
    #prism-title-main {
      display: block; font-size: clamp(1rem, 3vw, 1.7rem);
      letter-spacing: 0.32em; text-transform: uppercase;
    }
    #prism-title-sub {
      display: block; margin-top: 0.55rem; font-size: clamp(0.62rem, 1.3vw, 0.8rem);
      font-style: italic; color: rgba(225,225,235,0.5);
    }
    #prism-hint {
      top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
      line-height: 1.8; text-align: right; text-transform: uppercase;
      color: ${HINT_TEXT_COLOR};
    }
    #prism-caption {
      bottom: 3rem; left: 50%; transform: translateX(-50%);
      font-size: clamp(0.85rem, 2.3vw, 1.5rem); letter-spacing: 0.05em;
      font-style: italic; white-space: nowrap;
      color: rgba(225,215,255,0.75);
      text-shadow: 0 0 16px rgba(180,150,255,0.3);
    }
    #prism-hint.stacked {
      top: 7.6rem; right: 6vw; left: 6vw;
      font-size: 0.5rem; letter-spacing: 0.14em; line-height: 1.6; text-align: center;
    }
    @media (max-width: 600px) {
      #prism-title { top: 3.9rem; width: 90vw; }
      #prism-caption { white-space: normal; width: 88vw; font-size: 0.75rem; }
      #prism-hint {
        top: 7.6rem; right: 6vw; left: 6vw;
        font-size: 0.5rem; letter-spacing: 0.14em; line-height: 1.6; text-align: center;
      }
    }
    #prism-title.panel-open, #prism-hint.panel-open, #prism-caption.panel-open { opacity: 0; transition: opacity 0.3s ease; }

    #prism-panel {
      position: absolute; top: 0; right: 0; width: 38%; height: 100%;
      background: radial-gradient(ellipse at 30% 0%, rgba(40,36,60,0.25), transparent 60%), #0a0910;
      border-left: 1px solid rgba(200,190,220,0.15);
      padding: 3rem 2rem; transform: translateX(100%);
      transition: transform .5s cubic-bezier(.16,1,.3,1);
      overflow-y: scroll; z-index: 10;
      scrollbar-color: rgba(200,190,220,0.3) #0a0910; scrollbar-width: thin;
      font-family: 'Times New Roman', serif;
    }
    #prism-panel.open { transform: translateX(0); }
    #prism-panel-eyebrow {
      font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase;
      color: rgba(220,210,240,0.55); margin-bottom: 0.3rem;
    }
    #prism-panel-title {
      font-size: 1.15rem; letter-spacing: 0.1em;
      color: rgba(230,225,245,0.9); margin-bottom: 0.9rem;
      border-bottom: 1px solid rgba(200,190,220,0.15); padding-bottom: 1.2rem;
    }
    #prism-panel-body {
      font-size: 0.96rem; line-height: 1.85; color: rgba(228,225,238,0.78);
      white-space: pre-line;
    }
    #prism-panel-body p { margin: 0 0 1.1rem; }
    #prism-panel-close {
      position: absolute; top: 1.5rem; right: 1.5rem; background: none;
      border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
      cursor: pointer; padding: .5rem; z-index: 2;
    }
    #prism-panel-close:hover { color: rgba(255,255,255,0.9); }
    @media (max-width: 700px) {
      #prism-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      #prism-panel { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

export function createPrism(container, { preview = false } = {}) {
  injectStyles();

  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 100);
  // Round 3: tightened alongside R (0.45 → 0.14, prismManifest.js) — the
  // structure's own max radius shrank from ~0.77 to ~0.55 units, so the
  // camera moves in by the same ratio to keep the same framing rather than
  // leaving the now-denser crystal looking small and adrift in the frame.
  camera.position.set(preview ? 0.65 : 0.79, preview ? 0.36 : 0.47, preview ? 1.08 : 1.37);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  // Round 4: warm near-black, matching the cave rather than the previous
  // cool violet void — same register Orrery's own warehouse fog uses.
  renderer.setClearColor(0x0a0704, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.shadowMap.enabled = !preview;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // ─── Round 5 fix: no environment map existed anywhere, for any material.
  // MeshPhysicalMaterial's transmission does auto-sample the live rendered
  // frame behind an object (no environment map needed for that part) — but
  // clearcoat and the material's own specular/Fresnel response, which are
  // what make a low-roughness surface actually read as "glass" rather than
  // "flat colored plastic," need a real environment to reflect. Confirmed
  // live: assigning this to `scene.environment` (global) made the fix
  // visible immediately — real specular facets appeared — but it also
  // washed out the cave/matrix/fire mood scene-wide, since every PBR
  // material in the scene (matrix, cave dome) picks up `scene.environment`
  // as ambient IBL too. Scoped instead to `envMap` on the gem materials
  // only, below, so only the thing that needed an environment to look
  // glassy gets one.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  pmrem.dispose();

  scene.fog = new THREE.Fog(0x0a0704, preview ? 1.6 : 2.0, preview ? 5.5 : 8.5);

  // ─── Round 4: a cave, lit by one fire ───────────────────────────────────
  // The plain star-strewn void is gone. A low-poly rock dome, added to
  // `scene` directly (not `root` — it must stay fixed while the crystal
  // rotates, or the shadows the crystal throws would never actually
  // change), encloses the whole scene; one warm point light, flickering,
  // stands in for the fire, and is the dominant light source — this is
  // also, not incidentally, real environment lighting for the gem
  // material's own specular highlights and transmission to catch, which a
  // flat ambient void never gave it.
  const caveGeo = new THREE.IcosahedronGeometry(preview ? 2.6 : 3.6, 1);
  const caveMat = new THREE.MeshStandardMaterial({
    color: 0x181310, roughness: 0.96, metalness: 0.04,
    flatShading: true, side: THREE.BackSide,
  });
  const cave = new THREE.Mesh(caveGeo, caveMat);
  cave.receiveShadow = !preview;
  scene.add(cave);

  scene.add(new THREE.HemisphereLight(0x453626, 0x08060c, 0.32));
  const fill = new THREE.DirectionalLight(0x8899bb, 0.1);
  fill.position.set(-2, 1.5, -2);
  scene.add(fill);

  // decay=2 is physically-correct inverse-square falloff — realistic, but
  // it means reaching the cave wall a few units out needs an intensity
  // that looks huge next to the DirectionalLights used elsewhere on this
  // site (which don't fall off with distance at all). Tuned empirically
  // against a live screenshot rather than guessed: low enough not to blow
  // out the nearby crystal, high enough that the wall actually reads as
  // lit rock instead of merging into the fog.
  // Positioned roughly along the camera's own viewing axis (not opposite
  // it) — light travels from near the viewer, past the crystal, onto the
  // far wall the camera is actually looking at, so the crystal's own
  // shadow lands somewhere genuinely visible rather than on a wall behind
  // the camera that's never in frame.
  const fireLight = new THREE.PointLight(0xff8a44, 7.5, preview ? 6 : 9, 2);
  fireLight.position.set(1.0, 0.55, 1.3);
  fireLight.castShadow = !preview;
  if (!preview) {
    fireLight.shadow.mapSize.set(512, 512);
    fireLight.shadow.bias = -0.002;
  }
  scene.add(fireLight);
  const fireBaseIntensity = 7.5;
  const firePos0 = fireLight.position.clone();

  const root = new THREE.Group();
  scene.add(root);

  // ─── Round 4: two substances — gem (nodes) vs. matrix (connective
  // growth). Colors keyed by ANCHOR_GEMS (derived from each scene's own
  // established palette, see the comment above), plus a neutral moonstone
  // for new growth. Gem: MeshPhysicalMaterial pushed hard toward genuinely
  // glassy (low roughness, real transmission, clearcoat) — same technique
  // proven on the old Lens gem and Orbiter's core, just scaled down to this
  // crystal's much smaller per-node radius. Matrix: the same hue, desaturated
  // and darkened, rough and barely transmissive — raw mineral rock, not cut
  // stone. ─────────────────────────────────────────────────────────────────
  function makeGemMaterial(hex) {
    const c = new THREE.Color(hex);
    return new THREE.MeshPhysicalMaterial({
      color: c, metalness: 0, roughness: 0.05, flatShading: true,
      transmission: 0.88, thickness: 0.11, ior: 1.9,
      clearcoat: 1, clearcoatRoughness: 0.04,
      attenuationColor: c, attenuationDistance: 0.22,
      emissive: c, emissiveIntensity: 0.08,
      transparent: true, opacity: 0.97,
      envMap: envRT.texture, envMapIntensity: 1.1,
    });
  }
  function makeMatrixMaterial(hex) {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    const m = new THREE.Color().setHSL(hsl.h, hsl.s * 0.4, Math.min(0.3, hsl.l * 0.55));
    return new THREE.MeshPhysicalMaterial({
      color: m, metalness: 0.05, roughness: 0.85, flatShading: true,
      transmission: 0.03, clearcoat: 0,
      emissive: m, emissiveIntensity: 0.02,
    });
  }
  const gemMaterials = {};
  const matrixMaterials = {};
  ANCHORS_META.forEach(a => {
    gemMaterials[a.key] = makeGemMaterial(ANCHOR_GEMS[a.key]);
    matrixMaterials[a.key] = makeMatrixMaterial(ANCHOR_GEMS[a.key]);
  });
  gemMaterials.growth = makeGemMaterial(GROWTH_GEM);
  matrixMaterials.growth = makeMatrixMaterial(GROWTH_GEM);
  function gemFor(sceneKey) { return gemMaterials[sceneKey ?? 'growth']; }
  function matrixFor(sceneKey) { return matrixMaterials[sceneKey ?? 'growth']; }

  const rand = (() => { let s = 0x9e3779b9; return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0; return ((s >>> 0) / 4294967296);
  }; })();

  // ─── The six anchor seeds — small glowing gems, not clickable. Low-poly
  // faceted (octahedron, detail 0 — "doesn't need to be elaborate to read
  // as cut," per the brief) and sized slightly ABOVE dla.js's own
  // PARTICLE_RADIUS (0.045) rather than below it (round 3's own fix: an
  // anchor that renders smaller than the branches are physically modeled
  // to be is part of why the whole crystal used to read as thin wire). ───
  const anchorGeo = new THREE.OctahedronGeometry(0.058, 0);
  ANCHORS_META.forEach(a => {
    const mesh = new THREE.Mesh(anchorGeo, gemMaterials[a.key]);
    const pt = STRUCTURE_BY_ID.get(`anchor:${a.key}`);
    mesh.position.set(pt.x, pt.y, pt.z);
    mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    mesh.castShadow = !preview;
    root.add(mesh);
  });

  // ─── Gems + matrix shards — every point (seed and growth alike) gets a
  // faceted gem at its own stuck position, plus a rough matrix shard back
  // to whatever it actually stuck to. Growth pieces get their own cloned
  // gem material (not the shared per-anchor instance) so hovering/opening
  // one can be reflected on-screen without lighting up every growth gem at
  // once — seed gems stay on the shared instance; nothing about seed
  // content is ever individually emphasized. ─────────────────────────────
  const branchGeometries = [];
  const BEAD_RADIUS = 0.045; // == dla.js's PARTICLE_RADIUS — the model's own scale
  const growthBeadMats = new Map();
  const pieceHitMeshes = [];
  const growthLabelMeshes = new Map();
  const seedLabelGeo = new THREE.PlaneGeometry(0.034, 0.013);
  const growthLabelGeo = new THREE.PlaneGeometry(0.05, 0.019);
  const labelTextures = [];
  const labelMaterials = [];

  // A small, fixed (never camera-facing) orientation + position nudge for
  // a point's own label plane — deterministic from the point's own id, so
  // reloading the page doesn't reshuffle which gems happen to face the
  // camera favorably right now. Nudging toward the point's own parent
  // (rather than the world origin) pushes the label a little further
  // "inside" the local cluster of stuck material regardless of where in
  // the structure that point happens to sit.
  function placeLabel(mesh, point, parent, idSeed) {
    const nudge = 0.34;
    mesh.position.set(
      point.x + (parent.x - point.x) * nudge,
      point.y + (parent.y - point.y) * nudge,
      point.z + (parent.z - point.z) * nudge,
    );
    const h = hashSeed(idSeed);
    const rx = (((h % 1000) / 1000) - 0.5) * Math.PI;
    const ry = ((((h >>> 10) % 1000) / 1000) - 0.5) * Math.PI;
    const rz = ((((h >>> 20) % 1000) / 1000) - 0.5) * 0.6;
    mesh.rotation.set(rx, ry, rz);
    const scale = 0.75 + (((h >>> 5) % 1000) / 1000) * 0.5;
    mesh.scale.setScalar(scale);
  }

  PRISM_STRUCTURE.points.forEach(p => {
    if (p.isAnchor) return;
    const isGrowth = GROWTH_PIECES_BY_ID.has(p.id);
    const seedPiece = !isGrowth ? SEED_PIECES_BY_ID.get(p.id) : null;

    // Gem
    const beadRadius = BEAD_RADIUS * (0.72 + rand() * 0.26);
    const beadGeo = new THREE.OctahedronGeometry(beadRadius, 0);
    branchGeometries.push(beadGeo);
    let beadMat = gemFor(isGrowth ? null : p.sceneKey);
    if (isGrowth) {
      beadMat = beadMat.clone();
      growthBeadMats.set(p.id, beadMat);
    }
    const bead = new THREE.Mesh(beadGeo, beadMat);
    bead.position.set(p.x, p.y, p.z);
    bead.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    bead.castShadow = !preview;
    if (isGrowth) {
      bead.userData.pieceId = p.id;
      pieceHitMeshes.push(bead);
    }
    root.add(bead);

    // Matrix shard back to parent
    const parent = STRUCTURE_BY_ID.get(p.parentId);
    const from = new THREE.Vector3(parent.x, parent.y, parent.z);
    const to = new THREE.Vector3(p.x, p.y, p.z);
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = Math.max(dir.length(), 0.001);
    const radiusBase = beadRadius * (0.78 + rand() * 0.14);
    const radiusTip = radiusBase * (0.62 + rand() * 0.22);
    const radialSegments = 6 + Math.floor(rand() * 2);
    const geo = new THREE.CylinderGeometry(radiusTip, radiusBase, len, radialSegments, 1, false);
    geo.translate(0, len / 2, 0);
    branchGeometries.push(geo);
    const shard = new THREE.Mesh(geo, matrixFor(isGrowth ? null : p.sceneKey));
    shard.position.copy(from);
    shard.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    shard.rotateY(rand() * Math.PI * 2);
    shard.castShadow = !preview;
    shard.receiveShadow = !preview;
    root.add(shard);

    // ─── Round 4/5: a permanent, tiny, non-billboard label for every piece
    // of text on the crystal — seed and growth alike. Never a raycast
    // target: growth stays clickable via its gem (above), seed stays fully
    // non-clickable exactly as round 2 specified. This is what makes the
    // structure read as containing text throughout, not text-plus-empty-
    // decoration, per the brief.
    //
    // Round 5: the bake itself is now plain — one crisp copy, no ghosting
    // baked in (see makeTextTexture's own header for why the previous
    // ghosted-copy version was wrong) — because the actual distortion
    // mechanic is now the gem's own real transmission material bending
    // this plane where it sits nudged behind/inside it (placeLabel,
    // below), stacked with true optical smallness and the fixed (non-
    // camera-facing) orientation. Three real, independent obstacles, none
    // of them a fake duplicate-text effect. ─────────────────────────────
    if (!preview && (seedPiece || isGrowth)) {
      const line = seedPiece ? extractAmbientLine(seedPiece) : p.title ?? GROWTH_PIECES_BY_ID.get(p.id)?.title;
      const hue = isGrowth ? GROWTH_HUE : ANCHOR_HUES[p.sceneKey];
      const tex = makeTextTexture(line ?? '', hue, {
        legibility: 1, maxChars: isGrowth ? 30 : 40, canvasW: isGrowth ? 300 : 260, opaqueBg: true,
      });
      labelTextures.push(tex);
      // transparent MUST stay false — see makeTextTexture's own header.
      // A transparent-blended plane is invisible to three.js's transmission
      // background capture and never appears bent through the gem in front
      // of it; opaque is the only configuration that was confirmed, live,
      // to actually show the text refracted through real facet geometry.
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: false, side: THREE.DoubleSide,
      });
      labelMaterials.push(mat);
      const label = new THREE.Mesh(isGrowth ? growthLabelGeo : seedLabelGeo, mat);
      placeLabel(label, p, parent, p.id);
      root.add(label);
      if (isGrowth) growthLabelMeshes.set(p.id, label);
    }
  });

  // ─── Ambient seed cycle — the ONE exception. A single line, from a
  // randomly chosen seed piece, at that piece's own grown position,
  // rendered crisp and camera-facing (billboard Sprite, high legibility,
  // unlike every other label above), brightening in, holding, fading out,
  // then picking a new one. Fully passive — never a raycast target, never
  // wired to click/hover. Unchanged from round 2/3 except in name only. ──
  const ambientPool = !preview ? SEED_PIECES.map(p => {
    const pt = STRUCTURE_BY_ID.get(p.id);
    return { line: extractAmbientLine(p), hue: ANCHOR_HUES[p.sceneKey], x: pt.x, y: pt.y, z: pt.z };
  }) : [];
  let ambientSprite = null, ambientTex = null;
  const AMBIENT_FADE_IN = 1.4, AMBIENT_HOLD = 4.2, AMBIENT_FADE_OUT = 1.4, AMBIENT_GAP = 1.2;
  let ambientPhase = 'gap', ambientT = 0, ambientLastIndex = -1;
  function pickAmbientEntry() {
    if (!ambientPool.length) return null;
    let idx;
    do { idx = Math.floor(Math.random() * ambientPool.length); } while (ambientPool.length > 1 && idx === ambientLastIndex);
    ambientLastIndex = idx;
    return ambientPool[idx];
  }
  function startAmbientEntry() {
    const entry = pickAmbientEntry();
    if (!entry || !ambientSprite) return;
    ambientTex?.dispose();
    ambientTex = makeTextTexture(entry.line, entry.hue, { legibility: 1, maxChars: 64, canvasW: 460 });
    ambientSprite.material.map = ambientTex;
    ambientSprite.material.needsUpdate = true;
    ambientSprite.position.set(entry.x, entry.y, entry.z);
  }
  if (!preview && ambientPool.length) {
    const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 });
    ambientSprite = new THREE.Sprite(mat);
    ambientSprite.scale.set(0.62, 0.19, 1);
    root.add(ambientSprite);
  }

  // Warm ember dust, replacing the previous cool lavender "star field"
  // motes — same ambient-life idiom as lens.js/orrery.js, recolored for a
  // cave lit by fire rather than a void lit by nothing.
  const moteCount = preview ? 24 : 70;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const r = 0.35 + Math.random() * (preview ? 0.5 : 0.85);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    motePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    motePositions[i * 3 + 1] = r * Math.cos(phi) * 0.5;
    motePositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({ color: 0xffaa55, size: 0.006, transparent: true, opacity: 0.32, sizeAttenuation: true });
  const motes = new THREE.Points(moteGeo, moteMat);
  scene.add(motes);

  if (preview) {
    const wrap = document.createElement('div');
    wrap.className = 'prism-preview';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.appendChild(renderer.domElement);
    container.appendChild(wrap);

    const reduceMotionPreview = prefersReducedMotion();
    let animId, t = 0;
    function animatePreview() {
      animId = requestAnimationFrame(animatePreview);
      t += 0.005;
      if (!reduceMotionPreview) root.rotation.y = t * 0.25;
      renderer.render(scene, camera);
    }
    animatePreview();

    const resize = bindGuardedResize(container, (nw, nh) => {
      camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
    });

    return {
      dispose() {
        cancelAnimationFrame(animId);
        resize.dispose();
        renderer.dispose();
        envRT.dispose();
        anchorGeo.dispose();
        caveGeo.dispose(); caveMat.dispose();
        Object.values(gemMaterials).forEach(m => m.dispose());
        Object.values(matrixMaterials).forEach(m => m.dispose());
        branchGeometries.forEach(g => g.dispose());
        moteGeo.dispose(); moteMat.dispose();
        wrap.remove();
      },
    };
  }

  container.appendChild(renderer.domElement);
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  container.tabIndex = -1;

  // ─── Title, hint, caption ───────────────────────────────────────────────
  const title = document.createElement('div');
  title.id = 'prism-title';
  title.innerHTML = `
    <span id="prism-title-main">Prism</span>
    <span id="prism-title-sub">A crystal, grown — one branch per piece of writing.</span>
  `;
  title.setAttribute('aria-hidden', 'true');
  document.body.appendChild(title);

  const hint = document.createElement('p');
  hint.id = 'prism-hint';
  // Round 4: scroll-to-zoom was already wired (bindWheelZoom, below) but
  // never advertised — legibility now genuinely depends on zoom level, so
  // the hint has to say so, matching Butterfly/Library's own convention.
  hint.innerHTML = GROWTH_PIECES.length
    ? 'drag to orbit &nbsp;·&nbsp; scroll to zoom &nbsp;·&nbsp; click a gem to read'
    : 'drag to orbit &nbsp;·&nbsp; scroll to zoom';
  hint.setAttribute('aria-hidden', 'true');
  document.body.appendChild(hint);

  const caption = document.createElement('p');
  caption.id = 'prism-caption';
  caption.textContent = 'If God is white light, then we are all prisms.';
  caption.setAttribute('aria-hidden', 'true');
  document.body.appendChild(caption);

  function checkTitleHintCollision() {
    const t = title.getBoundingClientRect();
    const hh = hint.getBoundingClientRect();
    const overlaps = t.right > hh.left && t.left < hh.right && t.bottom > hh.top && t.top < hh.bottom;
    hint.classList.toggle('stacked', overlaps);
    hint.style.top = overlaps ? `${t.bottom + 16}px` : '';
  }
  requestAnimationFrame(checkTitleHintCollision);

  // ─── Panel — growth pieces only ─────────────────────────────────────────
  const panel = document.createElement('aside');
  panel.id = 'prism-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'prism-panel-title');
  panel.innerHTML = `
    <button type="button" id="prism-panel-close" aria-label="Close panel">✕</button>
    <div id="prism-panel-eyebrow"></div>
    <div id="prism-panel-title" tabindex="-1"></div>
    <div id="prism-panel-body"></div>
  `;
  container.appendChild(panel);
  const panelEyebrow = panel.querySelector('#prism-panel-eyebrow');
  const panelTitle   = panel.querySelector('#prism-panel-title');
  const panelBody    = panel.querySelector('#prism-panel-body');

  function hideAmbient(hidden) {
    title.classList.toggle('panel-open', hidden);
    hint.classList.toggle('panel-open', hidden);
    caption.classList.toggle('panel-open', hidden);
  }

  let selectedId = null;

  function openPiece(id) {
    const piece = GROWTH_PIECES_BY_ID.get(id);
    if (!piece) return;
    selectedId = id;
    const ordinal = GROWTH_PIECES.findIndex(p => p.id === id) + 1;
    panel.style.setProperty('--fc', `hsl(${GROWTH_HUE}, 45%, 75%)`);
    panelEyebrow.textContent = `New growth — ${ordinal} of ${GROWTH_PIECES.length}`;
    panelTitle.textContent = piece.title;
    panelBody.innerHTML = renderGrowthBody(piece);
    panel.classList.add('open');
    hideAmbient(true);
    setTimeout(() => panelTitle.focus(), 50);
  }

  const panelCloser = createPanelCloser(panel, container, {
    closeBtn: panel.querySelector('#prism-panel-close'),
    onClose: () => { selectedId = null; hideAmbient(false); },
  });

  // ─── Keyboard jump list — only meaningful once there's something
  // browsable; skipped entirely while GROWTH_PIECES is empty rather than
  // rendering a labeled list with nothing in it. ──────────────────────────
  const jumpList = GROWTH_PIECES.length ? createJumpList(container, {
    label: 'Read a newly grown piece of writing',
    items: GROWTH_PIECES,
    getLabel: p => p.title,
    onSelect: p => openPiece(p.id),
  }) : null;

  // ─── Interaction — growth gems only. Round 4: the raycast target is now
  // the gem mesh itself (pieceHitMeshes), not a label — clicking a growth
  // piece never depended on being able to read its name first, and
  // shouldn't start now that the name is often illegible on purpose. ─────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null;

  const onContainerMouseMove = e => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pieceHitMeshes);
    hovered = hits.length ? hits[0].object : null;
    container.style.cursor = hovered ? 'pointer' : 'default';
  };
  container.addEventListener('mousemove', onContainerMouseMove);

  const touchGuard = bindTapVsDrag(container);
  const onContainerClick = e => {
    if (touchGuard.consume()) return;
    if (panel.classList.contains('open') && !hovered) {
      panelCloser.close();
      return;
    }
    if (!hovered) return;
    openPiece(hovered.userData.pieceId);
  };
  container.addEventListener('click', onContainerClick);

  // ─── Drag to orbit / scroll to zoom ─────────────────────────────────────
  // Round 4: zoom range widened at both ends — close enough (0.22) to get
  // a single gem within actual reading distance if the angle happens to
  // resolve it, far enough out (4.2) to see the whole cave.
  let targetRotationY = root.rotation.y;
  const orbitDrag = bindOrbitDrag(container, {
    onDrag: dx => { targetRotationY += dx; },
  });
  const wheelZoom = bindWheelZoom(container, {
    isBlocked: e => panel && panel.contains(e.target),
    onZoom: deltaY => {
      camera.position.multiplyScalar(1 + deltaY * 0.0012);
      const dist = camera.position.length();
      if (dist < 0.22) camera.position.setLength(0.22);
      if (dist > 3.15) camera.position.setLength(3.15);
    },
  });

  const reduceMotion = prefersReducedMotion();
  const escapeClose = bindEscapeClose(() => {
    if (panel.classList.contains('open')) panelCloser.close();
  });

  // ─── Animate ─────────────────────────────────────────────────────────────
  let animId, t = 0, dtPrev = performance.now();
  function animate() {
    animId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - dtPrev) / 1000, 0.1);
    dtPrev = now;
    t += 0.006;

    // Fire flicker — layered sine waves plus a touch of noise so it reads
    // as combustion, not a metronome; the light itself drifts slightly
    // too, the way a real flame does.
    const flicker = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 23.7) * 0.28 + Math.sin(t * 5.3) * 0.34;
    fireLight.intensity = fireBaseIntensity + flicker + (Math.random() - 0.5) * 0.22;
    fireLight.position.set(
      firePos0.x + Math.sin(t * 3.1) * 0.02,
      firePos0.y + Math.sin(t * 4.7) * 0.015,
      firePos0.z + Math.cos(t * 2.6) * 0.02,
    );

    if (reduceMotion) {
      root.rotation.y = targetRotationY;
    } else {
      root.rotation.y += (targetRotationY - root.rotation.y) * 0.06;
      motes.rotation.y += 0.0004;
    }

    // Growth gems get a slow independent shimmer (idle) and a brighter,
    // steady glow while hovered or open — each has its own cloned
    // material, so this never touches a seed gem or another growth gem.
    GROWTH_PIECES.forEach((piece, i) => {
      const mat = growthBeadMats.get(piece.id);
      if (!mat) return;
      const emphasized = (hovered && hovered.userData.pieceId === piece.id) || selectedId === piece.id;
      const idle = 0.08 + Math.sin(t * 0.8 + i * 0.7) * 0.04;
      mat.emissiveIntensity = emphasized ? 0.32 : idle;
    });

    // ─── Ambient seed cycle state machine — runs regardless of
    // reduced-motion (it's a slow, deliberate fade, not autonomous
    // spinning/jitter; same category of exception the panel's own open/
    // close slide already gets across this site). ─────────────────────────
    if (ambientSprite) {
      ambientT += dt;
      if (ambientPhase === 'gap' && ambientT >= AMBIENT_GAP) {
        startAmbientEntry();
        ambientPhase = 'in'; ambientT = 0;
      } else if (ambientPhase === 'in') {
        ambientSprite.material.opacity = Math.min(1, ambientT / AMBIENT_FADE_IN);
        if (ambientT >= AMBIENT_FADE_IN) { ambientPhase = 'hold'; ambientT = 0; }
      } else if (ambientPhase === 'hold') {
        ambientSprite.material.opacity = 1;
        if (ambientT >= AMBIENT_HOLD) { ambientPhase = 'out'; ambientT = 0; }
      } else if (ambientPhase === 'out') {
        ambientSprite.material.opacity = Math.max(0, 1 - ambientT / AMBIENT_FADE_OUT);
        if (ambientT >= AMBIENT_FADE_OUT) { ambientPhase = 'gap'; ambientT = 0; }
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
    checkTitleHintCollision();
  });

  return {
    dispose() {
      cancelAnimationFrame(animId);
      orbitDrag.dispose();
      wheelZoom.dispose();
      resize.dispose();
      escapeClose.dispose();
      touchGuard.dispose();
      panelCloser.dispose();
      jumpList?.dispose();
      container.removeEventListener('mousemove', onContainerMouseMove);
      container.removeEventListener('click', onContainerClick);
      renderer.dispose();
      envRT.dispose();
      anchorGeo.dispose();
      caveGeo.dispose(); caveMat.dispose();
      seedLabelGeo.dispose(); growthLabelGeo.dispose();
      Object.values(gemMaterials).forEach(m => m.dispose());
      Object.values(matrixMaterials).forEach(m => m.dispose());
      growthBeadMats.forEach(m => m.dispose());
      branchGeometries.forEach(g => g.dispose());
      labelTextures.forEach(tx => tx.dispose());
      labelMaterials.forEach(m => m.dispose());
      ambientTex?.dispose();
      ambientSprite?.material.dispose();
      moteGeo.dispose(); moteMat.dispose();
      title.remove();
      hint.remove();
      caption.remove();
      panel.remove();
      renderer.domElement.remove();
    },
  };
}
