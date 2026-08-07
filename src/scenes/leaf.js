import * as THREE from 'three';
import {
  prefersReducedMotion, mountClippedPreviewCanvas, bindGuardedResize,
  bindOrbitDrag, bindWheelZoom,
} from '../utils/sceneKit.js';
import '../../styles/scenes/leaf.css';
// The text lives in src/text/ — the prerender step that builds /text/leaf/
// imports the same module, so the published piece and the staged one are
// guaranteed to be the same words. Untouched by this rebuild: the found
// text (Cartography.doc, Scott Cohen) already ends exactly where this
// version needs it to — impact/vaporization/absorption in one stage,
// "those few floating adjust themselves to wind and water" in the next —
// so the cosmic half of the piece plays under words that were already
// there, not new ones written to fit it.
import { TEXT_STAGES } from '../text/leafText.js';

// ─── Leaf: In The End It Falls Slowly Through The Aether ──────────────────
// Ground-up rebuild (2026-07-31), replacing every prior version of this
// scene entirely — not a revision of 1.8.x. Same name on purpose: the
// smallness of the framing is the whole point of the piece, and naming it
// toward the cosmic half would spoil the one thing it's actually about.
//
// Two states, one hard cut between them:
//   1. LEAF — a small, locked-camera diorama. Scroll is the only input:
//      it drives the found text and, through it, a real threshold-driven
//      droplet (gravity vs. surface tension at the leaf-tip neck, carried
//      forward unchanged from the 1.8.0 physics brief — see the physics
//      section below). No drag, no zoom, no free camera. The visitor is
//      stuck at one fixed point of view, the way you're stuck watching one
//      actual droplet in real life.
//   2. COSMIC — the instant the drop hits the ground, a hard cut (not a
//      dissolve) to an expanding field of light/particulate matter
//      pressing against a shimmering boundary that never fully resolves —
//      a holographic edge encoding the field in fewer dimensions, not a
//      Big Bounce that contracts and resets cleanly. Camera unlocks the
//      instant the cut happens: full drag-to-orbit + wheel-zoom, same
//      sceneKit.js conventions as every other full scene on the site.
//      Stays unlocked through the remaining text (absorption, climbing
//      back upward) until the sequence loops back around to LEAF, at
//      which point the camera re-locks.
//
// One scene, one THREE.Scene, one camera — the two states are two groups
// (leafRoot / cosmicRoot) toggled visible, and two camera configurations
// (position/fov/lighting/fog) swapped instantly at the cut, never eased,
// matching "hard cut, not a slow dissolve" in both directions.

const CYCLE_SECONDS = 30; // preview tiles only — see createLeaf's preview branch

// ─── Release physics: a real threshold, not a scroll cutoff ────────────────
// Carried forward unchanged from the 1.8.0 physics brief — Scott's own
// framing for this rebuild was that these ideas were never actually wrong,
// only the staging around them was, so they're not being redesigned here,
// just re-applied to a real droplet mesh instead of a 2D sprite.
//
// Two real forces compete for the drop: gravity's pull scales with how much
// water has coalesced (volume, ~r^3), while surface tension's grip at the
// leaf-tip neck scales with the neck's circumference (~r) — a wider neck
// isn't proportionally stronger the way a bigger drop is proportionally
// heavier. F_gravity(r) = K_GRAVITY*r^3, F_tension(r) = K_TENSION*r. Solving
// F_gravity(r) = F_tension(r) for r gives the radius where the two exactly
// balance: r = sqrt(K_TENSION / K_GRAVITY).
const K_GRAVITY = 1;
const K_TENSION = 1;
const R_CRITICAL = Math.sqrt(K_TENSION / K_GRAVITY); // = 1

// GROWTH_CEILING sits above R_CRITICAL (1.15, not 1.0) so the threshold
// genuinely interrupts the growth curve partway through rather than
// coinciding with its own endpoint. GROWTH_EXP=3 biases growth toward the
// LATE part of the hold phase, so the drop reads as genuinely still for
// most of the hold — point 2 of the brief, "real stillness, then a real
// break" — with the one visible swell concentrated in the final stretch.
const GROWTH_CEILING = 1.15;
const GROWTH_EXP = 3;
// Where release actually falls within the nominal hold window: solving
// GROWTH_CEILING * holdT^GROWTH_EXP = R_CRITICAL for holdT. Documented for
// the reader, same as the 1.8.0 version — release lands in the last ~5% of
// the hold window, not at its exact edge.
const RELEASE_HOLD_T = Math.pow(R_CRITICAL / GROWTH_CEILING, 1 / GROWTH_EXP);

function dropRadius(holdT) { return GROWTH_CEILING * Math.pow(Math.max(0, holdT), GROWTH_EXP); }
function gravityForce(r) { return K_GRAVITY * r * r * r; }
function tensionForce(r) { return K_TENSION * r; }

// ─── Fall pacing: a hard cut, not an eased ramp ─────────────────────────────
// FALL_KICK is the fraction of the fall's total distance covered at
// constant velocity from the very first instant, so the drop is already
// moving at a real pace the frame release fires — the remaining
// (1-FALL_KICK) still accelerates quadratically underneath it.
const FALL_KICK = 0.4;
function fallCurve(t) { return FALL_KICK * t + (1 - FALL_KICK) * t * t; }

// ─── Leaf recoil: a snap, then a real ring-down ─────────────────────────────
// cos(), not sin() — full deflection in the very first instant after
// release, decaying like a real branch settling, tracked on its own
// elapsed-real-seconds clock rather than scroll fraction.
const RECOIL_AMPLITUDE = 0.07;
const RECOIL_FREQ = 18;  // rad/sec
const RECOIL_DECAY = 5;  // 1/sec
function recoilAngle(elapsedSec) {
  return RECOIL_AMPLITUDE * Math.exp(-RECOIL_DECAY * elapsedSec) * Math.cos(RECOIL_FREQ * elapsedSec);
}

// ─── Droplet wobble: real post-pinch-off oscillation ────────────────────────
// New in this rebuild, same idiom as recoilAngle above. A real drop
// departing a surface isn't a static sphere or the cartoon teardrop it's
// usually drawn as — high-speed photography of real pinch-off shows the
// drop briefly oscillating between oblate and prolate before settling
// toward a slightly flattened spheroid for the rest of the fall. Applied as
// a differential between the drop's x/y scale (one grows while the other
// shrinks) — used below as a signed offset added to y-scale and subtracted
// from x-scale, so the pair stays roughly volume-neutral rather than the
// drop visibly swelling and shrinking as a whole.
const WOBBLE_AMPLITUDE = 0.16;
const WOBBLE_FREQ = 24;  // rad/sec
const WOBBLE_DECAY = 7;  // 1/sec
function dropWobble(elapsedSec) {
  return WOBBLE_AMPLITUDE * Math.exp(-WOBBLE_DECAY * elapsedSec) * Math.sin(WOBBLE_FREQ * elapsedSec);
}

// ─── Sympathetic ambient motion ─────────────────────────────────────────────
// Gravity's pull as a standing condition of the whole diorama, not just the
// one moment the drop falls. A data-driven list rather than named per-layer
// variables this time (more elements carry it now — grass blades, foliage
// clusters, dust, a palm crown) — each entry gets its OWN freq/phase drawn
// from a wide, deliberately non-round range so no two entries ever line up,
// and every amplitude here is a few thousandths of a world unit against a
// multi-unit-tall scene: if in doubt, round down, per the brief's own
// guardrail. Isolate one element and watch it for several seconds to
// confirm it's moving at all; a normal glance shouldn't register it.
function makeSwayer(obj, prop, axis, base, ampRange = [0.0025, 0.007]) {
  return {
    obj, prop, axis, base,
    freq: 0.028 + Math.random() * 0.07,
    phase: Math.random() * Math.PI * 2,
    amp: ampRange[0] + Math.random() * (ampRange[1] - ampRange[0]),
  };
}
function tickSwayer(s, tSec) {
  s.obj[s.prop][s.axis] = s.base + Math.sin(tSec * s.freq + s.phase) * s.amp;
}

// ─── Canvas textures ─────────────────────────────────────────────────────
function makeMoteTexture(hue = 'rgba(210,240,255,') {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  const grad = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, hue + '0.9)');
  grad.addColorStop(1, hue + '0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// A canvas texture standing in for the leaf's surface — mottled, uneven
// color rather than a flat fill, a browned/spotted patch near one edge, an
// overall soft grain. Ported unchanged from the prior version; still a
// deliberately wabi-sabi object under real lighting now, not a flat one.
function makeLeafTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  const grad = cx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0,   '#4a7248');
  grad.addColorStop(0.5, '#3a5c38');
  grad.addColorStop(1,   '#2c4a2a');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 10 + Math.random() * 26;
    const light = Math.random() > 0.5;
    cx.fillStyle = light ? 'rgba(150,170,110,0.1)' : 'rgba(20,34,20,0.14)';
    cx.beginPath();
    cx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    cx.fill();
  }

  const bx = 190, by = 70;
  const brownGrad = cx.createRadialGradient(bx, by, 2, bx, by, 60);
  brownGrad.addColorStop(0, 'rgba(150,96,40,0.55)');
  brownGrad.addColorStop(0.6, 'rgba(130,84,36,0.3)');
  brownGrad.addColorStop(1, 'rgba(130,84,36,0)');
  cx.fillStyle = brownGrad;
  cx.beginPath();
  cx.ellipse(bx, by, 60, 44, 0.4, 0, Math.PI * 2);
  cx.fill();

  [[70, 150, 5], [95, 175, 3.5], [40, 190, 4]].forEach(([sx, sy, sr]) => {
    cx.fillStyle = 'rgba(30,26,14,0.45)';
    cx.beginPath();
    cx.ellipse(sx, sy, sr, sr * 0.8, 0, 0, Math.PI * 2);
    cx.fill();
  });

  cx.globalAlpha = 0.5;
  for (let i = 0; i < 900; i++) {
    cx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
    cx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  cx.globalAlpha = 1;

  return new THREE.CanvasTexture(c);
}

function drawSky(cx, cw, ch) {
  const sky = cx.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0,    '#5f9bd6');
  sky.addColorStop(0.55, '#a0c6da');
  sky.addColorStop(1,    '#ecdfbd');
  cx.fillStyle = sky;
  cx.fillRect(0, 0, cw, ch);
  [[0.5, 0.14, 1], [0.16, 0.22, 0.6], [0.82, 0.1, 0.7]].forEach(([fx, fy, scale]) => {
    const x = cw * fx, y = ch * fy, r = cw * 0.09 * scale;
    for (let i = 0; i < 4; i++) {
      const ox = (i - 1.5) * r * 0.55, oy = Math.sin(i) * r * 0.15;
      const grad = cx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r * 0.7);
      grad.addColorStop(0, 'rgba(255,250,235,0.85)');
      grad.addColorStop(1, 'rgba(255,250,235,0)');
      cx.fillStyle = grad;
      cx.beginPath();
      cx.ellipse(x + ox, y + oy, r * 0.7, r * 0.42, 0, 0, Math.PI * 2);
      cx.fill();
    }
  });
}

function drawGarage(cx, cw, ch, horizonY) {
  const gw = cw * 0.16, gh = ch * 0.1;
  const gx = cw * 0.5 - gw / 2, gy = horizonY - gh;
  cx.fillStyle = 'rgba(176,168,146,0.9)';
  cx.fillRect(gx, gy, gw, gh);
  cx.strokeStyle = 'rgba(120,112,94,0.55)';
  cx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    const x = gx + (gw / 6) * i;
    cx.beginPath(); cx.moveTo(x, gy); cx.lineTo(x, gy + gh); cx.stroke();
  }
}

function drawBuildings(cx, cw, ch, horizonY) {
  const buildOne = (baseX, dir) => {
    const nearW = cw * 0.34, farW = cw * 0.16, bh = ch * 0.46;
    const topY = horizonY - bh;
    cx.fillStyle = '#e7e2d5';
    cx.beginPath();
    cx.moveTo(baseX, horizonY);
    cx.lineTo(baseX + dir * nearW, horizonY);
    cx.lineTo(baseX + dir * farW, topY);
    cx.lineTo(baseX, topY);
    cx.closePath();
    cx.fill();
    const rows = 6, cols = 5;
    for (let r = 0; r < rows; r++) {
      const rowY = topY + (bh / rows) * (r + 0.35);
      const rowW = nearW + (farW - nearW) * (r / rows);
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.12) continue;
        const wx = baseX + dir * (rowW / cols) * (c + 0.5);
        cx.fillStyle = 'rgba(46,58,58,0.7)';
        cx.fillRect(wx - dir * 6, rowY - 8, 11, 14);
      }
      if (r % 2 === 0) {
        cx.strokeStyle = 'rgba(60,58,50,0.4)';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.moveTo(baseX, rowY + 10); cx.lineTo(baseX + dir * rowW, rowY + 10); cx.stroke();
      }
    }
  };
  buildOne(cw * 0.02, 1);
  buildOne(cw * 0.98, -1);
}

// Mid-ground band: pavement, a tree-canopy hedge along the horizon, a loose
// row of palms and ornamental shrubs. Kept as a single lit, fogged plane
// (real MeshStandardMaterial + THREE.Fog now do the depth-cueing job the
// old dual sharp/blur bake used to) rather than real geometry — the
// foreground foliage that actually needs per-object independent sway (the
// brief's ask) is built as real 3D below instead; this band is far enough
// back that a picture of it, correctly lit and fogged, reads the same as
// modeling every palm frond individually would, at a fraction of the cost.
function drawPalmsLot(cx, cw, ch, horizonY, lotBottom) {
  const lot = cx.createLinearGradient(0, horizonY, 0, lotBottom);
  lot.addColorStop(0, 'rgba(168,164,150,0.9)');
  lot.addColorStop(1, 'rgba(148,144,132,0.75)');
  cx.fillStyle = lot;
  cx.fillRect(0, horizonY, cw, lotBottom - horizonY);

  const canopyY = horizonY + (lotBottom - horizonY) * 0.12;
  for (let i = 0; i < 22; i++) {
    const x = (cw / 22) * (i + 0.5) + (Math.random() - 0.5) * (cw / 22);
    const r = cw * (0.02 + Math.random() * 0.014);
    const grad = cx.createRadialGradient(x, canopyY, 0, x, canopyY, r);
    grad.addColorStop(0, 'rgba(52,74,44,0.8)');
    grad.addColorStop(1, 'rgba(52,74,44,0)');
    cx.fillStyle = grad;
    cx.beginPath(); cx.ellipse(x, canopyY, r, r * 0.8, 0, 0, Math.PI * 2); cx.fill();
  }

  const palm = (px, py, scale) => {
    cx.strokeStyle = 'rgba(58,72,48,0.85)';
    cx.lineWidth = 3 * scale;
    cx.beginPath();
    cx.moveTo(px, py);
    cx.quadraticCurveTo(px - 6 * scale, py - 30 * scale, px - 2 * scale, py - 58 * scale);
    cx.stroke();
    const crownX = px - 2 * scale, crownY = py - 58 * scale;
    for (let i = 0; i < 6; i++) {
      const a = (-0.95 + i * 0.38) * Math.PI;
      cx.beginPath();
      cx.moveTo(crownX, crownY);
      cx.quadraticCurveTo(
        crownX + Math.cos(a) * 18 * scale, crownY + Math.sin(a) * 11 * scale,
        crownX + Math.cos(a) * 32 * scale, crownY + Math.sin(a) * 17 * scale + 8 * scale
      );
      cx.stroke();
    }
  };
  [
    [0.05, 1], [0.14, 0.75], [0.24, 0.85], [0.34, 0.6],
    [0.5, 0.55], [0.63, 0.65], [0.72, 0.8], [0.78, 0.9],
    [0.86, 0.7], [0.93, 0.95], [0.98, 0.65],
  ].forEach(([fx, scale]) => palm(cw * fx, horizonY + (lotBottom - horizonY) * 0.3, (cw / 900) * scale));

  [[0.15, 0.5], [0.3, 0.6], [0.42, 0.55], [0.55, 0.4], [0.68, 0.5], [0.88, 0.45]]
    .forEach(([fx, scale]) => {
      const x = cw * fx, y = lotBottom - 4, r = cw * 0.022 * scale;
      cx.fillStyle = 'rgba(64,86,52,0.8)';
      cx.beginPath(); cx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); cx.fill();
    });
}

// ─── Real 3D leaf ───────────────────────────────────────────────────────
// Extruded now (real thickness, real face normals) instead of a flat
// ShapeGeometry — under real lighting a flat shape reads as a cutout, not
// an object; a few hundredths of a unit of depth is enough for it to catch
// a highlight along its edge.
function buildLeaf3D() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.15);
  shape.bezierCurveTo(0.58, 0.98, 0.8, 0.3, 0.56, -0.4);
  shape.bezierCurveTo(0.5, -0.46, 0.58, -0.52, 0.46, -0.56);
  shape.bezierCurveTo(0.4, -0.58, 0.34, -0.5, 0.4, -0.62);
  shape.bezierCurveTo(0.34, -0.92, 0.17, -1.18, 0, -1.4);
  shape.bezierCurveTo(-0.15, -1.16, -0.4, -0.9, -0.53, -0.5);
  shape.bezierCurveTo(-0.82, 0.32, -0.64, 1.0, 0, 1.15);

  const tex = makeLeafTexture();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: false, curveSegments: 24 });
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);

  const veinMat = new THREE.LineBasicMaterial({ color: 0x5a8a55, transparent: true, opacity: 0.5 });
  const veinPts = [new THREE.Vector3(0.02, 1.1, 0.05), new THREE.Vector3(0, -1.35, 0.05)];
  const vein = new THREE.Line(new THREE.BufferGeometry().setFromPoints(veinPts), veinMat);
  const sideVeins = [];
  for (let i = 0; i < 5; i++) {
    const y = 0.8 - i * 0.42;
    const spread = 0.5 - i * 0.06;
    const asym = (Math.random() - 0.5) * 0.08;
    const pts = [
      new THREE.Vector3(-spread + asym, y - 0.25 - Math.random() * 0.05, 0.05),
      new THREE.Vector3(0, y, 0.05),
      new THREE.Vector3(spread + asym, y - 0.25 + Math.random() * 0.05, 0.05),
    ];
    sideVeins.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), veinMat));
  }

  const group = new THREE.Group();
  group.add(mesh, vein, ...sideVeins);
  return { group, mesh, geo, mat, tex, vein, sideVeins, veinMat };
}

// ─── Real 3D balcony rail — closest thing to camera ─────────────────────
function buildRail(width) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.45, metalness: 0.8 });
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.035, 0.03), metal);
  const botRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, 0.025), metal);
  topRail.position.y = 0.62; botRail.position.y = 0;
  group.add(topRail, botRail);
  const balusterGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6);
  const count = Math.round(width / 0.16);
  for (let i = 0; i < count; i++) {
    const b = new THREE.Mesh(balusterGeo, metal);
    b.position.set(-width / 2 + (width / count) * (i + 0.5), 0.31, 0);
    group.add(b);
  }
  return { group, metal, balusterGeo, topRail, botRail };
}

// ─── Real 3D foreground foliage — the elements that need independent sway ──
// Deformed low-poly icosahedra rather than smooth spheres — nudging each
// vertex outward by a random amount breaks the platonic-solid regularity
// into something closer to an actual leaf cluster's silhouette, same
// found-object logic as the leaf's own asymmetric shape.
function buildFoliageClump(radius, color) {
  // detail=2 is Three.js's built-in geodesic subdivision (see sphere.js for
  // the full explanation of how IcosahedronGeometry's detail parameter
  // works) — enough vertices for the per-vertex jitter below to read as an
  // organic bumpy surface rather than a handful of flat facets.
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    // Because this is a sphere, the vertex position itself IS the outward
    // direction from the center — normalizing it gives the surface normal
    // `n` at that point without any separate calculation. Displacing the
    // vertex along its own normal by a random amount pushes points outward
    // (or slightly inward) while keeping the surface roughly sphere-shaped,
    // rather than moving them sideways into a lumpy/self-intersecting mess.
    // `(Math.random() - 0.3)` skews the random range to [-0.3, 0.7] instead
    // of [-0.5, 0.5] — biased toward pushing OUT more than pulling in, which
    // is what gives the clump its bulbous, cluster-of-berries silhouette
    // instead of a symmetric dented sphere. TUNABLE: the -0.3 skew (shift
    // toward more/less outward bulge) and the trailing * radius * 0.3
    // (overall jitter magnitude, as a fraction of the clump's radius).
    const n = v.clone().normalize();
    v.addScaledVector(n, (Math.random() - 0.3) * radius * 0.3);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  // Vertex normals must be recomputed after moving vertices — the original
  // normals (perfect-sphere directions) no longer match the new, jittered
  // surface, and stale normals would make the lighting look wrong (flat or
  // inside-out shading) even though the geometry itself moved correctly.
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  return { mesh: new THREE.Mesh(geo, mat), geo, mat };
}

// A single low-poly palm: a tapered trunk + a handful of frond blades
// fanned around a crown group, so the crown alone can carry the sway
// (a real palm's fronds move, its trunk barely does).
function buildPalm(scale) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3c28, roughness: 0.9 });
  const trunkGeo = new THREE.CylinderGeometry(0.02 * scale, 0.045 * scale, 1.1 * scale, 6);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.55 * scale;
  trunk.rotation.z = (Math.random() - 0.5) * 0.12;
  group.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 1.05 * scale;
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3a5c38, roughness: 0.8, side: THREE.DoubleSide });
  const frondGeo = new THREE.PlaneGeometry(0.09 * scale, 0.42 * scale);
  frondGeo.translate(0, 0.21 * scale, 0);
  const fronds = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(frondGeo, frondMat);
    const a = (i / n) * Math.PI * 2;
    f.rotation.z = a;
    f.rotation.x = -0.9 + Math.random() * 0.15;
    fronds.push(f);
    crown.add(f);
  }
  group.add(crown);
  return { group, crown, trunk, trunkGeo, trunkMat, frondGeo, frondMat };
}

// ─── Cosmic boundary shader ─────────────────────────────────────────────
// A shimmering surface that presses back rather than resolving — fresnel
// rim glow (real, view-dependent, physically motivated) plus an
// interference pattern from two overlapping wavefronts woven directly into
// the surface (the brief's own nice-to-have, tying it to the two-slit motif
// already established elsewhere on the site) plus a slow triple-sine
// flicker so the surface never settles into one static image — the visual
// argument for "doesn't fully resolve or dissipate cleanly," not just a
// caption saying so.
const BOUNDARY_VERT = `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const BOUNDARY_FRAG = `
  uniform float uTime;
  uniform float uAppear;
  uniform vec3 uColorCore;
  uniform vec3 uColorRim;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vPos);
    float fresnel = pow(1.0 - clamp(dot(normalize(vNormal), viewDir), 0.0, 1.0), 2.4);

    vec3 src1 = normalize(vec3(0.3, 1.0, 0.15)) * 15.0;
    vec3 src2 = normalize(vec3(-0.6, -0.4, 0.7)) * 15.0;
    float w1 = sin(length(vPos - src1) * 0.55 - uTime * 1.3);
    float w2 = sin(length(vPos - src2) * 0.55 - uTime * 1.05);
    float pattern = pow(abs((w1 + w2) * 0.5), 1.6);

    float flicker = sin(vPos.x * 0.9 + uTime * 0.6)
                   * sin(vPos.y * 1.3 - uTime * 0.45)
                   * sin(vPos.z * 0.7 + uTime * 0.37);
    flicker = flicker * 0.5 + 0.5;

    float glow = fresnel * 0.55 + pattern * 0.3 + flicker * 0.15;
    vec3 color = mix(uColorRim, uColorCore, fresnel);
    gl_FragColor = vec4(color, glow * uAppear);
  }
`;

function buildBoundary(radius) {
  const geo = new THREE.SphereGeometry(radius, 64, 48);
  const mat = new THREE.ShaderMaterial({
    vertexShader: BOUNDARY_VERT,
    fragmentShader: BOUNDARY_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uAppear: { value: 0 },
      uColorCore: { value: new THREE.Color(0xdfe8ff) },
      uColorRim: { value: new THREE.Color(0x8fb0ff) },
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  return { mesh: new THREE.Mesh(geo, mat), geo, mat };
}

// ─── Cosmic particle field ───────────────────────────────────────────────
// Each particle gets a random direction (rejection-free normalize of a
// signed random vector — not perfectly uniform on the sphere, entirely
// sufficient for a cloud this dense) and its own "reach": the radius,
// short of the true boundary, where it presses and settles rather than
// arriving cleanly. Distance from center follows an asymptotic ease
// (1 - e^-t) with a per-particle time constant, so the whole field
// approaches its edge without ever quite finishing — the same "doesn't
// fully resolve" idea as the boundary shader, expressed as motion instead
// of shading.
function buildParticleField(count, boundaryRadius, tex) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const dirs = new Float32Array(count * 3);
  const reach = new Float32Array(count);
  const tau = new Float32Array(count);
  const phase = new Float32Array(count);
  const jitterFreq = new Float32Array(count);

  const core = new THREE.Color(0xfff3d6);
  const mid = new THREE.Color(0xbfe0ff);
  const outer = new THREE.Color(0x6f8fff);

  for (let i = 0; i < count; i++) {
    let x, y, z, len;
    do {
      x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1;
      len = Math.sqrt(x * x + y * y + z * z);
    } while (len < 0.001);
    dirs[i * 3] = x / len; dirs[i * 3 + 1] = y / len; dirs[i * 3 + 2] = z / len;

    const r = 0.78 + Math.random() * 0.2;
    reach[i] = r * boundaryRadius;
    tau[i] = 1.6 + Math.random() * 1.6;
    phase[i] = Math.random() * Math.PI * 2;
    jitterFreq[i] = 0.4 + Math.random() * 0.9;

    const t = Math.random();
    const col = t < 0.5 ? core.clone().lerp(mid, t * 2) : mid.clone().lerp(outer, (t - 0.5) * 2);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    positions[i * 3] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.22, map: tex, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  return { points, geo, mat, dirs, reach, tau, phase, jitterFreq, count };
}

function buildStarfield(count, radius) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let x, y, z, len;
    do {
      x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1;
      len = Math.sqrt(x * x + y * y + z * z);
    } while (len < 0.001);
    const r = radius * (0.85 + Math.random() * 0.3);
    positions[i * 3] = (x / len) * r;
    positions[i * 3 + 1] = (y / len) * r;
    positions[i * 3 + 2] = (z / len) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.09, color: 0xffffff, transparent: true, opacity: 0.55,
    depthWrite: false, sizeAttenuation: true,
  });
  return { points: new THREE.Points(geo, mat), geo, mat };
}

export function createLeaf(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  const aspect = w / h;

  const scene = new THREE.Scene();
  const LEAF_FOV = 34;   // narrow/near-telephoto — keeps the locked diorama
                         // shot feeling composed and deliberate rather than
                         // wide-angle/exploratory.
  const COSMIC_FOV = 60; // wide, immersive — the FOV jump itself sells the
                         // scale change at the cut, on top of everything
                         // else that changes in the same instant.
  const camera = new THREE.PerspectiveCamera(LEAF_FOV, aspect, 0.05, 400);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const clippedPreview = preview ? mountClippedPreviewCanvas(container, renderer) : null;
  if (!preview) container.appendChild(renderer.domElement);

  const reduceMotion = prefersReducedMotion();

  // ─── Lighting + fog: swapped hard at the cut, never eased ────────────────
  const hemi = new THREE.HemisphereLight(0x9fc4e0, 0x3a3126, 0.85);
  const sun  = new THREE.DirectionalLight(0xfff3d8, 1.1);
  sun.position.set(3, 5, 4);
  const fill = new THREE.AmbientLight(0x445566, 0.3);
  scene.add(hemi, sun, fill);

  const LEAF_FOG_COLOR = 0xaecbe0, LEAF_FOG_NEAR = 4, LEAF_FOG_FAR = 15;
  const COSMIC_FOG_COLOR = 0x02030a, COSMIC_FOG_NEAR = 20, COSMIC_FOG_FAR = 70;
  function applyLeafLighting() {
    hemi.intensity = 0.85; sun.intensity = 1.1; fill.intensity = 0.3;
    scene.fog = new THREE.Fog(LEAF_FOG_COLOR, LEAF_FOG_NEAR, LEAF_FOG_FAR);
    scene.background = null;
  }
  function applyCosmicLighting() {
    hemi.intensity = 0.08; sun.intensity = 0.05; fill.intensity = 0.06;
    scene.fog = new THREE.Fog(COSMIC_FOG_COLOR, COSMIC_FOG_NEAR, COSMIC_FOG_FAR);
    scene.background = new THREE.Color(0x000103);
  }
  applyLeafLighting();

  // ═══════════════════════════════════════════════════════════════════════
  // STATE 1 — LEAF DIORAMA
  // ═══════════════════════════════════════════════════════════════════════
  const leafRoot = new THREE.Group();
  scene.add(leafRoot);
  const dioramaGroup = new THREE.Group();
  leafRoot.add(dioramaGroup);

  const cw = Math.round(Math.max(600, Math.min(1400, 900 * Math.max(aspect, 0.5))));
  const ch = Math.round(cw / Math.max(aspect, 0.5));
  const horizonY = ch * 0.42, lotBottom = ch * 0.66, railBandY = ch * 0.8;

  const PLANE_W = 30, PLANE_H = 18; // world-unit size for the flat backdrop
                                     // planes; big enough that their edges
                                     // never enter frame at any aspect ratio
                                     // this scene is laid out for.

  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = cw; skyCanvas.height = ch;
  drawSky(skyCanvas.getContext('2d'), cw, ch);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, fog: true });
  const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W * 1.4, PLANE_H * 1.4), skyMat);
  skyMesh.position.z = -13;
  dioramaGroup.add(skyMesh);

  let backdropMeshes = [], backdropGeo = null, backdropMats = [], backdropTexes = [];
  let palms = [], foliageClumps = [], grassSwayers = [], dustMotes = [], swayers = [];
  let rail = null;

  if (!preview) {
    backdropGeo = new THREE.PlaneGeometry(PLANE_W, PLANE_H);

    const garageCanvas = document.createElement('canvas');
    garageCanvas.width = cw; garageCanvas.height = ch;
    drawGarage(garageCanvas.getContext('2d'), cw, ch, horizonY);
    const garageTex = new THREE.CanvasTexture(garageCanvas);
    const garageMat = new THREE.MeshStandardMaterial({ map: garageTex, transparent: true, roughness: 0.9, depthWrite: false });
    const garageMesh = new THREE.Mesh(backdropGeo, garageMat);
    garageMesh.position.z = -10;
    dioramaGroup.add(garageMesh);

    const buildingsCanvas = document.createElement('canvas');
    buildingsCanvas.width = cw; buildingsCanvas.height = ch;
    drawBuildings(buildingsCanvas.getContext('2d'), cw, ch, horizonY);
    const buildingsTex = new THREE.CanvasTexture(buildingsCanvas);
    const buildingsMat = new THREE.MeshStandardMaterial({ map: buildingsTex, transparent: true, roughness: 0.85, depthWrite: false });
    const buildingsMesh = new THREE.Mesh(backdropGeo, buildingsMat);
    buildingsMesh.position.z = -8.5;
    dioramaGroup.add(buildingsMesh);

    const lotCanvas = document.createElement('canvas');
    lotCanvas.width = cw; lotCanvas.height = ch;
    drawPalmsLot(lotCanvas.getContext('2d'), cw, ch, horizonY, lotBottom);
    const lotTex = new THREE.CanvasTexture(lotCanvas);
    const lotMat = new THREE.MeshStandardMaterial({ map: lotTex, transparent: true, roughness: 0.9, depthWrite: false });
    const lotMesh = new THREE.Mesh(backdropGeo, lotMat);
    lotMesh.position.z = -6;
    dioramaGroup.add(lotMesh);

    backdropMeshes = [garageMesh, buildingsMesh, lotMesh];
    backdropMats = [garageMat, buildingsMat, lotMat];
    backdropTexes = [garageTex, buildingsTex, lotTex];

    // Real 3D palms in front of the backdrop plane, behind the rail — a
    // handful, varied scale, each contributing its own crown-sway swayer.
    [[-3.4, -3.8, 0.7], [-2.1, -4.2, 0.55], [3.0, -4.0, 0.62], [4.1, -4.6, 0.48]]
      .forEach(([x, z, scale]) => {
        const p = buildPalm(scale);
        p.group.position.set(x, -1.2, z);
        dioramaGroup.add(p.group);
        palms.push(p);
        swayers.push(makeSwayer(p.crown, 'rotation', 'z', 0, [0.006, 0.014]));
        swayers.push(makeSwayer(p.crown, 'rotation', 'x', -0.02, [0.003, 0.008]));
      });

    // Real 3D foreground foliage clusters, corner-anchored near the rail —
    // the elements closest to camera, where individual sway actually reads
    // as physically real rather than a texture trick.
    [[-2.4, -1.55, 0.9, 0.42, 0x2c4028], [2.6, -1.5, 0.7, 0.38, 0x27381f], [-1.5, -1.6, 1.0, 0.3, 0x30452a]]
      .forEach(([x, y, z, r, color]) => {
        const clump = buildFoliageClump(r, color);
        clump.mesh.position.set(x, y, z);
        dioramaGroup.add(clump.mesh);
        foliageClumps.push(clump);
        swayers.push(makeSwayer(clump.mesh, 'rotation', 'y', clump.mesh.rotation.y, [0.004, 0.009]));
        swayers.push(makeSwayer(clump.mesh, 'position', 'x', x, [0.002, 0.005]));
      });

    // Real grass blades, a loose cluster near the ground — each an
    // independent thin plane with its own sway swayer, per the brief's
    // explicit ask ("grass... responding to the same gravity field").
    const bladeGeo = new THREE.PlaneGeometry(0.02, 0.22);
    bladeGeo.translate(0, 0.11, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x3d5a34, roughness: 0.85, side: THREE.DoubleSide });
    const grassGroup = new THREE.Group();
    for (let i = 0; i < 46; i++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      const side = Math.random() < 0.5 ? -1 : 1;
      blade.position.set(side * (1.4 + Math.random() * 1.6), -1.62, 0.6 + Math.random() * 0.5);
      blade.rotation.y = Math.random() * Math.PI;
      blade.scale.setScalar(0.6 + Math.random() * 0.7);
      grassGroup.add(blade);
      swayers.push(makeSwayer(blade, 'rotation', 'z', 0, [0.006, 0.016]));
    }
    dioramaGroup.add(grassGroup);
    grassSwayers = [{ geo: bladeGeo, mat: bladeMat, group: grassGroup }];

    // Rail: closest thing to camera, real 3D bars, rigid on purpose — the
    // brief's own distinction (living/wind-responsive things sway, rigid
    // architecture stays perfectly still), same call the 1.8.0 version made.
    rail = buildRail(6.4);
    rail.group.position.set(0, -1.95, 0.9);
    dioramaGroup.add(rail.group);

    // A few dust motes drifting in the balcony air — near camera, low
    // amplitude, independent phases, part of the same ambient-motion ask.
    const dustTex = makeMoteTexture('rgba(230,230,220,');
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.SpriteMaterial({ map: dustTex, transparent: true, opacity: 0.18 + Math.random() * 0.15, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(0.03 + Math.random() * 0.03);
      const base = { x: (Math.random() - 0.5) * 3.2, y: -0.6 + Math.random() * 1.8, z: 1.2 + Math.random() * 1.6 };
      sprite.position.set(base.x, base.y, base.z);
      dioramaGroup.add(sprite);
      dustMotes.push({ sprite, mat, tex: dustTex, base,
        freq: 0.05 + Math.random() * 0.08, phase: Math.random() * Math.PI * 2, amp: 0.05 + Math.random() * 0.05 });
    }
  }

  // ─── Ground ────────────────────────────────────────────────────────────
  const groundY = -1.85;
  const groundGeo = new THREE.PlaneGeometry(PLANE_W, 4);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x8a7059, roughness: 0.95 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2.6;
  ground.position.set(0, groundY, 0.3);
  dioramaGroup.add(ground);

  // ─── Leaf + droplet ──────────────────────────────────────────────────────
  const leaf3D = buildLeaf3D();
  dioramaGroup.add(leaf3D.group);
  const LEAF_Y = 0.55;
  leaf3D.group.position.set(0, LEAF_Y, 0);
  leaf3D.group.rotation.z = -0.05;
  leaf3D.group.scale.setScalar(preview ? 1.05 : 0.95);
  const tipLocal = new THREE.Vector3(0, -1.4, 0.05);

  // A physically-transmissive material alone renders almost invisibly
  // against this diorama's flat sky/backdrop planes — real refraction
  // needs real background detail to bend, and a uniform-color plane gives
  // it none. A slight blue-white tint plus a strong clearcoat carries the
  // legibility a pure-glass material can't here; the small additive
  // catch-light sprite added below (a child of the drop, offset toward the
  // sun) is the actual reason a real water drop reads at all against open
  // sky — a bright point highlight, not its transmission.
  const dropGeo = new THREE.SphereGeometry(0.14, 24, 18);
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcebf5, transmission: 0.85, roughness: 0.04, thickness: 0.5,
    ior: 1.33, clearcoat: 1, clearcoatRoughness: 0.04,
  });
  const drop = new THREE.Mesh(dropGeo, dropMat);
  dioramaGroup.add(drop);

  const highlightTex = makeMoteTexture('rgba(255,255,255,');
  const highlightMat = new THREE.SpriteMaterial({
    map: highlightTex, transparent: true, opacity: 0.95, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dropHighlight = new THREE.Sprite(highlightMat);
  dropHighlight.scale.setScalar(0.09);
  dropHighlight.position.set(0.05, 0.05, 0.11);
  drop.add(dropHighlight);

  const moteTex = makeMoteTexture();
  const moteCount = preview ? 5 : 10;
  const motes = [];
  for (let i = 0; i < moteCount; i++) {
    const mat = new THREE.SpriteMaterial({ map: moteTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.05, 0.05, 1);
    dioramaGroup.add(sprite);
    motes.push({ sprite, mat, active: false });
  }

  function tipWorld() {
    const v = tipLocal.clone().applyMatrix4(leaf3D.group.matrixWorld);
    dioramaGroup.worldToLocal(v);
    return v;
  }

  // ─── Diorama layout: right-third framing, aspect-responsive ──────────────
  // Camera stays fixed (position + fov + lookAt never change once set for
  // this state) — the diorama content shifts in world space instead, same
  // structural idea as the orthographic version's layoutLeaf, just derived
  // from perspective trig now: visible width at the diorama's depth =
  // 2 * dist * tan(fov/2) * aspect, and the content sits centered in the
  // right third of that.
  const CAM_DIST = 7.2;
  function layoutDiorama() {
    const vFov = LEAF_FOV * Math.PI / 180;
    const visW = 2 * CAM_DIST * Math.tan(vFov / 2) * camera.aspect;
    dioramaGroup.position.x = Math.min(visW * 0.36, 2.3);
  }
  layoutDiorama();

  function setLeafCamera() {
    camera.fov = LEAF_FOV;
    camera.position.set(0, 0.25, CAM_DIST);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  setLeafCamera();

  // ═══════════════════════════════════════════════════════════════════════
  // STATE 2 — COSMIC FLASH / HOLOGRAPHIC BOUNDARY
  // ═══════════════════════════════════════════════════════════════════════
  const cosmicRoot = new THREE.Group();
  cosmicRoot.visible = false;
  scene.add(cosmicRoot);
  const starRoot = new THREE.Group();
  starRoot.visible = false;
  scene.add(starRoot);

  const BOUNDARY_RADIUS = 15;
  const COSMIC_CAM_HOME = BOUNDARY_RADIUS * 2.0;
  const ZOOM_MIN = BOUNDARY_RADIUS * 1.1, ZOOM_MAX = BOUNDARY_RADIUS * 3.6;

  let particleField = null, boundary = null, starfield = null, flash = null, flashTex = null;
  if (!preview) {
    const cosmicMoteTex = makeMoteTexture('rgba(255,250,235,');
    particleField = buildParticleField(3200, BOUNDARY_RADIUS, cosmicMoteTex);
    cosmicRoot.add(particleField.points);

    boundary = buildBoundary(BOUNDARY_RADIUS);
    cosmicRoot.add(boundary.mesh);

    starfield = buildStarfield(600, BOUNDARY_RADIUS * 2.6);
    starRoot.add(starfield.points);

    flashTex = makeMoteTexture('rgba(255,255,250,');
    const flashMat = new THREE.SpriteMaterial({ map: flashTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    flash = new THREE.Sprite(flashMat);
    flash.scale.setScalar(0.1);
    cosmicRoot.add(flash);
  }

  function setCosmicCamera() {
    camera.fov = COSMIC_FOV;
    camera.position.set(0, 0, cosmicDist);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  let cosmicDist = COSMIC_CAM_HOME;

  // ─── Drag-to-orbit + wheel-zoom — bound once, gated by cameraLocked ───────
  // Same sceneKit.js conventions every other full scene uses (rotate a root
  // group; dolly the camera distance on wheel). Bound unconditionally so
  // there's no listener churn across the cut/re-lock cycle; the gate is
  // purely `cameraLocked`, flipped exactly once per transition.
  let cameraLocked = true;
  let autoRotate = true;
  let orbitDrag = null, wheelZoom = null;
  if (!preview) {
    orbitDrag = bindOrbitDrag(container, {
      onDragStart: () => { if (!cameraLocked) autoRotate = false; },
      onDrag: (dx, dy) => {
        if (cameraLocked) return;
        cosmicRoot.rotation.y += dx;
        cosmicRoot.rotation.x += dy;
      },
      onDragEnd: () => { setTimeout(() => { autoRotate = true; }, 2500); },
    });
    wheelZoom = bindWheelZoom(container, {
      onZoom: deltaY => {
        if (cameraLocked) return;
        cosmicDist = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cosmicDist + deltaY * 0.02));
      },
    });
  }

  // ─── Caption / hint (full scene only) ───────────────────────────────────
  // Styles (#leaf-caption, #leaf-hint, #leaf-grain, and their .cosmic
  // variants) live in styles/scenes/leaf.css — no runtime injection needed
  // now that it's a real stylesheet.
  let caption = null, hint = null, grain = null;

  let targetScrollFrac = 0;
  const PHASE = { holdEnd: 0.16, cutStart: 0.62 };
  let autoScrolling = false;
  let lastUserActivity = performance.now();

  if (!preview) {
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    grain = document.createElement('div');
    grain.id = 'leaf-grain';
    grain.setAttribute('aria-hidden', 'true');
    container.appendChild(grain);

    caption = document.createElement('div');
    caption.id = 'leaf-caption';
    caption.setAttribute('role', 'region');
    caption.setAttribute('aria-label', "In The End It Falls Slowly Through The Aether — scroll to read");
    const stageEls = TEXT_STAGES.map(stage => {
      const p = document.createElement('p');
      p.textContent = stage.text;
      caption.appendChild(p);
      return p;
    });
    document.body.appendChild(caption);

    hint = document.createElement('p');
    hint.id = 'leaf-hint';
    hint.innerHTML = 'scroll to read &nbsp;·&nbsp; the drop follows';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    const updateTargetFromScroll = () => {
      const range = caption.scrollHeight - caption.clientHeight;
      targetScrollFrac = range > 0 ? Math.min(1, Math.max(0, caption.scrollTop / range)) : 0;
      if (!autoScrolling) lastUserActivity = performance.now();
    };
    caption.addEventListener('scroll', updateTargetFromScroll, { passive: true });
    window.addEventListener('resize', updateTargetFromScroll);
    caption._updateTargetFromScroll = updateTargetFromScroll;

    // Only two real boundaries needed now: hold->release, and the impact
    // instant that IS the hard cut (stage index 6, "the drop explodes on
    // the ground..."). Everything from there to the end (stage 6's back
    // half plus stage 7) plays during the cosmic state.
    const updatePhaseFractions = () => {
      const range = caption.scrollHeight - caption.clientHeight;
      if (range <= 0) return;
      const fracAt = el => Math.min(1, Math.max(0, el.offsetTop / range));
      const holdEnd = Math.min(0.4, Math.max(0.05, fracAt(stageEls[1])));
      const cutStart = Math.max(holdEnd + 0.3, Math.min(0.9, fracAt(stageEls[6])));
      PHASE.holdEnd = holdEnd;
      PHASE.cutStart = cutStart;
    };
    updatePhaseFractions();
    window.addEventListener('resize', updatePhaseFractions);
    caption._updatePhaseFractions = updatePhaseFractions;
  }

  function resetMotes() { motes.forEach(m => { m.active = false; m.mat.opacity = 0; }); }
  resetMotes();

  const REARM_MARGIN = 0.012;
  // The cut's own re-arm margin is deliberately wider than the escape-mote
  // margin above — this is the buffer the brief explicitly asks for. The
  // forward trigger itself (frac >= PHASE.cutStart, checked every animation
  // frame against the smoothed, spring-eased frac rather than raw scroll
  // deltas) can't be "missed" by a fast scroll the way an exact-equality
  // check could — once frac has crossed the line it stays crossed. What a
  // narrow margin COULD do is chatter: hovering right at the boundary and
  // re-triggering cut/uncut every frame. CUT_REARM_MARGIN is the width of
  // real scroll-position slack (about 3.5% of the whole piece) the reader
  // has to cross back through before the reverse (cosmic -> leaf) trigger
  // re-arms, so the transition reads as one deliberate event in either
  // direction, not a flicker at the seam.
  const CUT_REARM_MARGIN = 0.035;
  const ESCAPE_FIRE = PHASE.holdEnd + 0.42 * (PHASE.cutStart - PHASE.holdEnd);

  const LOOP_BAND = 0.015;   // "close enough to the end" to arm the auto-loop
  const LOOP_IDLE_SEC = 2.4; // how long the reader has to sit at the end,
                              // untouched, before the piece loops itself
  const AUTOSCROLL_SEC = 3.0;
  let autoScrollFrom = 0, autoScrollElapsed = 0;

  // ─── State transition: hard cut, both directions ─────────────────────────
  function cutToCosmic() {
    leafRoot.visible = false;
    cosmicRoot.visible = true;
    starRoot.visible = true;
    cameraLocked = false;
    cosmicRoot.rotation.set(0, 0, 0);
    cosmicElapsed = 0;
    cosmicDist = COSMIC_CAM_HOME;
    setCosmicCamera();
    applyCosmicLighting();
    if (boundary) boundary.mat.uniforms.uAppear.value = 0;
    if (flash) { flash.material.opacity = 1; flash.scale.setScalar(0.1); }
    if (hint) { hint.innerHTML = 'scroll to continue &nbsp;·&nbsp; drag to orbit &nbsp;·&nbsp; scroll wheel over the scene to zoom'; hint.classList.add('cosmic'); }
    if (caption) caption.classList.add('cosmic');
  }
  function cutToLeaf() {
    cosmicRoot.visible = false;
    starRoot.visible = false;
    leafRoot.visible = true;
    cameraLocked = true;
    cosmicRoot.rotation.set(0, 0, 0);
    setLeafCamera();
    applyLeafLighting();
    if (hint) { hint.innerHTML = 'scroll to read &nbsp;·&nbsp; the drop follows'; hint.classList.remove('cosmic'); }
    if (caption) caption.classList.remove('cosmic');
  }
  let inCosmic = false;
  let cosmicElapsed = 0;

  // ─── Animate ─────────────────────────────────────────────────────────────
  let animId, tSec = 0, currentFrac = 0, fallVelocity = 0;
  let escapeTriggered = false;
  let released = false, releasedAtFrac = null, releaseElapsed = 0;
  let lastFrameTime = performance.now();
  const SPRING_STIFFNESS = 130;
  const SPRING_DAMPING = 2 * Math.sqrt(SPRING_STIFFNESS) * 0.92;

  function animate() {
    animId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    tSec += dt;

    let frac;
    if (preview) {
      frac = (tSec % CYCLE_SECONDS) / CYCLE_SECONDS;
    } else {
      const accel = (targetScrollFrac - currentFrac) * SPRING_STIFFNESS - fallVelocity * SPRING_DAMPING;
      fallVelocity += accel * dt;
      currentFrac += fallVelocity * dt;
      if (currentFrac < 0 && fallVelocity < 0) { currentFrac = 0; fallVelocity = 0; }
      if (currentFrac > 1 && fallVelocity > 0) { currentFrac = 1; fallVelocity = 0; }
      frac = currentFrac;

      // Auto-loop: once the reader has sat at the very end, untouched, for
      // a real pause, the piece scrolls itself back to the top — "the
      // sequence loops back around," not just a dead stop at the bottom.
      if (frac > 1 - LOOP_BAND && !autoScrolling && (now - lastUserActivity) / 1000 > LOOP_IDLE_SEC) {
        autoScrolling = true; autoScrollElapsed = 0; autoScrollFrom = caption.scrollTop;
      }
      if (autoScrolling) {
        autoScrollElapsed += dt;
        const t = Math.min(1, autoScrollElapsed / AUTOSCROLL_SEC);
        const eased = 1 - Math.pow(1 - t, 3);
        caption.scrollTop = autoScrollFrom * (1 - eased);
        if (t >= 1) { autoScrolling = false; lastUserActivity = now; }
      }
    }

    if (frac < REARM_MARGIN) resetMotes();
    if (frac < ESCAPE_FIRE - REARM_MARGIN) escapeTriggered = false;

    // ─── The cut trigger ────────────────────────────────────────────────
    if (!inCosmic && frac >= PHASE.cutStart) {
      inCosmic = true;
      cutToCosmic();
    } else if (inCosmic && frac < PHASE.cutStart - CUT_REARM_MARGIN) {
      inCosmic = false;
      cutToLeaf();
    }

    if (!inCosmic) {
      // ─── Release: real force comparison, not a scroll cutoff ────────────
      if (!released) {
        const holdT = frac / PHASE.holdEnd;
        const r = dropRadius(holdT);
        if (gravityForce(r) > tensionForce(r)) { released = true; releasedAtFrac = frac; releaseElapsed = 0; }
      } else if (frac < releasedAtFrac - REARM_MARGIN) {
        released = false; releasedAtFrac = null;
      }

      if (released) {
        releaseElapsed += dt;
        leaf3D.group.rotation.z = -0.05 + recoilAngle(releaseElapsed);
      } else {
        leaf3D.group.rotation.z = -0.05;
      }

      const tip = tipWorld();

      if (!released) {
        const holdT = frac / PHASE.holdEnd;
        const r = dropRadius(holdT);
        const growVis = Math.min(1, r / R_CRITICAL);
        const tremble = Math.sin(tSec * 9) * 0.0015 * growVis;
        drop.position.set(tip.x + tremble, tip.y - 0.05 - growVis * 0.05, tip.z);
        const s = 0.05 + growVis * 0.15;
        // Pendant-drop asymmetry while held (physically real — a drop
        // hanging under gravity+tension genuinely narrows at the neck and
        // bulges below) rather than the falling-teardrop myth, which is
        // saved for nothing: real falling drops relax toward oblate, not
        // teardrop-shaped — see dropWobble below.
        drop.scale.set(s, s * (1 + growVis * 0.35), s);
        dropMat.transmission = 1; dropMat.opacity = 1;
        drop.visible = true;
      } else {
        const fallFrac = Math.max(0, Math.min(1, (frac - releasedAtFrac) / (PHASE.cutStart - releasedAtFrac)));
        const eased = fallCurve(fallFrac);
        const startY = tip.y - 0.08;
        const y = startY - eased * (startY - (groundY + 0.1));
        drop.position.set(tip.x + Math.sin(fallFrac * 6) * 0.012, y, tip.z);
        const wob = dropWobble(releaseElapsed);
        const base = 0.15;
        drop.scale.set(base + wob, base - wob * 0.7, base + wob);
        drop.visible = true;

        if (!escapeTriggered && fallFrac > 0.28) {
          escapeTriggered = true;
          motes.slice(0, Math.ceil(motes.length * 0.4)).forEach(m => {
            m.active = true; m.mat.opacity = 0.8;
            m.sprite.position.copy(drop.position);
            m.vx = (Math.random() - 0.5) * 1.1; m.vy = 0.12 + Math.random() * 0.3; m.life = 0;
          });
        }
      }

      motes.forEach(m => {
        if (!m.active) return;
        m.life += dt;
        m.sprite.position.x += m.vx * dt;
        m.sprite.position.y += m.vy * dt - 0.05 * dt * m.life;
        m.mat.opacity = Math.max(0, 0.6 * (1 - m.life / 3.2));
        if (m.life > 3.2) { m.active = false; m.mat.opacity = 0; }
      });

      if (!reduceMotion) dioramaGroup.position.z = Math.sin(tSec * 0.05) * 0.02 + (dioramaGroup.userData.baseZ ?? 0);
      if (!reduceMotion) swayers.forEach(s => tickSwayer(s, tSec));
      if (!reduceMotion) dustMotes.forEach(d => {
        d.sprite.position.x = d.base.x + Math.sin(tSec * d.freq + d.phase) * d.amp;
        d.sprite.position.y = d.base.y + Math.cos(tSec * d.freq * 1.4 + d.phase) * d.amp * 0.6;
      });
    } else {
      // ─── Cosmic: expansion + boundary shimmer + free camera ─────────────
      cosmicElapsed += dt;
      if (particleField) {
        const posAttr = particleField.geo.attributes.position;
        for (let i = 0; i < particleField.count; i++) {
          const t = cosmicElapsed;
          const approach = 1 - Math.exp(-t / particleField.tau[i]);
          const jitter = Math.sin(t * particleField.jitterFreq[i] + particleField.phase[i]) * 0.35 * approach;
          const dist = particleField.reach[i] * approach + jitter;
          const i3 = i * 3;
          posAttr.array[i3]     = particleField.dirs[i3] * dist;
          posAttr.array[i3 + 1] = particleField.dirs[i3 + 1] * dist;
          posAttr.array[i3 + 2] = particleField.dirs[i3 + 2] * dist;
        }
        posAttr.needsUpdate = true;
      }
      if (boundary) {
        boundary.mat.uniforms.uTime.value = cosmicElapsed;
        boundary.mat.uniforms.uAppear.value = Math.min(1, boundary.mat.uniforms.uAppear.value + dt * 0.8);
      }
      if (flash) {
        flash.material.opacity = Math.max(0, flash.material.opacity - dt * 1.6);
        flash.scale.setScalar(0.1 + Math.min(1, cosmicElapsed * 2.2) * 3.5);
      }
      if (!reduceMotion && starRoot.visible) starRoot.rotation.y += dt * 0.004;
      if (!reduceMotion && autoRotate && !(orbitDrag && orbitDrag.isDragging)) {
        cosmicRoot.rotation.y += dt * 0.02;
      }
    }

    camera.position.z = inCosmic ? cosmicDist : camera.position.z;
    if (inCosmic) camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    clippedPreview?.blit();
  }
  animate();

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    layoutDiorama();
  });

  return {
    dispose() {
      cancelAnimationFrame(animId);
      resize.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      renderer.dispose();
      clippedPreview?.dispose();

      skyMat.dispose(); skyTex.dispose();
      backdropGeo?.dispose();
      backdropMats.forEach(m => m.dispose());
      backdropTexes.forEach(t => t.dispose());
      groundGeo.dispose(); groundMat.dispose();

      leaf3D.geo.dispose(); leaf3D.mat.dispose(); leaf3D.tex.dispose(); leaf3D.veinMat.dispose();
      leaf3D.vein.geometry.dispose();
      leaf3D.sideVeins.forEach(l => l.geometry.dispose());

      dropGeo.dispose(); dropMat.dispose();
      highlightTex.dispose(); highlightMat.dispose();
      moteTex.dispose();
      motes.forEach(m => m.mat.dispose());

      palms.forEach(p => { p.trunkGeo.dispose(); p.trunkMat.dispose(); p.frondGeo.dispose(); p.frondMat.dispose(); });
      foliageClumps.forEach(c => { c.geo.dispose(); c.mat.dispose(); });
      grassSwayers.forEach(g => { g.geo.dispose(); g.mat.dispose(); });
      dustMotes.forEach(d => { d.mat.dispose(); d.tex.dispose(); });
      rail?.metal.dispose(); rail?.balusterGeo.dispose();

      particleField?.geo.dispose(); particleField?.mat.dispose();
      boundary?.geo.dispose(); boundary?.mat.dispose();
      starfield?.geo.dispose(); starfield?.mat.dispose();
      flashTex?.dispose(); flash?.material.dispose();

      if (caption && caption._updateTargetFromScroll) window.removeEventListener('resize', caption._updateTargetFromScroll);
      if (caption && caption._updatePhaseFractions) window.removeEventListener('resize', caption._updatePhaseFractions);
      caption?.remove();
      hint?.remove();
      grain?.remove();
      renderer.domElement.remove();
    },
  };
}
