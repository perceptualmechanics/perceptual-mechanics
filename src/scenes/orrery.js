import * as THREE from 'three';
import { bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, bindEscapeClose } from '../utils/sceneKit.js';

// ─── The Orrery of Los Feliz ───────────────────────────────────────────────
// A found short-short, full and unedited, undated. Investigators track a
// mysterious 30-foot orrery — a moving model of the solar system, a working
// radio telescope at its peak — to a warehouse in Los Feliz.
//
// Third pass on this scene (see NOTES.md, "nebula retired, orrery promoted"
// and the second-pass entry right after it). The first rebuild grounded it
// as junk-metal, Survival Research Labs-style construction instead of a
// free-floating sci-fi prop. This pass pushes that further, at Scott's
// direction: the whole mechanism now hangs from chains bolted to the roof
// trusses rather than standing on the floor (odder, more SRL — a machine
// installed by a crew who had a hoist and a warehouse ceiling, not a
// foundation crew), the walls carry a few taped-up early-90s show flyers
// (Nirvana, R.E.M., For Squirrels — dating the space itself, not just the
// machine), and the nine bodies are the actual planets: correct order,
// roughly-correct relative sizes and orbital spacing (compressed with a
// square root so Mercury and Pluto both fit on screen), their real notable
// moons, Saturn's rings, and the asteroid belt sitting where it actually
// does — between Mars and Jupiter, not stuck out past Pluto. The "few other
// unidentified cosmic objects" from the text now read as what's left after
// naming nine real planets: the odd stuff further out, past Pluto.

const ORRERY = {
  name: 'The Orrery of Los Feliz',
  era: 'found · undated',
  note: `We were tipped off by a news item coupled with the creditors’ lawsuits against Peter Hight, our synchronicity sensitives finding a common link between the two. The news item said that the FCC was investigating a pirate radio station somewhere in the Los Feliz area. It was buried in the local section of the Times. The creditors were a foundry, a warehouse and a sculpture studio, trying to get paid for some very large pieces they had made. We tracked the warehouse down and with a little persuasion convinced the landlord to let us in.

Inside was an orrery – a moving sculpture, a representation of the solar system. It was about 30 feet high, the peak poking out of the warehouse skylights. A gargantuan thing, but it moved without a sound. All nine planets and their moons, the asteroid belt, and a few other unidentified cosmic objects were represented. Great bronze balls swirled around the center spike of steel and wood, painted a most royal purple. The pinnacle was in fact a miniature radio telescope, pointed straight up, and it was still on, receiving information from the heavens. What is most interesting about the orrery – apart from it having been built in the first place – is that the orbits of the planets are precisely and mathematically laid out with an error tolerance approaching perfection.

Our investigation into Peter Hight is pending, but from all appearances he appears to be an unlikely candidate to construct such a thing. A dropout of community college.`,
};

// Real planets, in order. `au` (semi-major axis, real units) drives orbital
// spacing; `relDiameter` (Earth = 1) drives body size. Both are compressed
// with a square root before being mapped to screen units — used at real
// scale, Mercury and Pluto can't share a small scene at all.
// Colors match a print Scott owns — a minimalist "The Solar System" poster,
// flat bold color per planet against dark slate green. Applied here as a
// spray-paint job over the scrap-metal bodies (see makeSprayPaintTexture)
// rather than the poster's own clean flat fills — junk-metal orrery, not a
// print.
const PLANET_DATA = [
  { name: 'Mercury', color: 0xe0447a, au: 0.39, relDiameter: 0.38, moons: [] },
  { name: 'Venus',   color: 0x9974c9, au: 0.72, relDiameter: 0.95, moons: [] },
  { name: 'Earth',   color: 0x35c4d4, au: 1.00, relDiameter: 1.00, moons: [{ relSize: 0.27 }] },
  { name: 'Mars',    color: 0xe35440, au: 1.52, relDiameter: 0.53, moons: [{ relSize: 0.06 }, { relSize: 0.04 }] },
  { name: 'Jupiter', color: 0xf0821f, au: 5.20, relDiameter: 11.2, moons: [{ relSize: 0.09 }, { relSize: 0.08 }, { relSize: 0.13 }, { relSize: 0.12 }] },
  { name: 'Saturn',  color: 0xf0c020, au: 9.54, relDiameter: 9.45, moons: [{ relSize: 0.12 }], ring: true },
  { name: 'Uranus',  color: 0xa8cc32, au: 19.2, relDiameter: 4.0,  moons: [{ relSize: 0.03 }] },
  { name: 'Neptune', color: 0xa8a284, au: 30.1, relDiameter: 3.88, moons: [{ relSize: 0.03 }] },
  { name: 'Pluto',   color: 0xd9d0ba, au: 39.5, relDiameter: 0.18, moons: [{ relSize: 0.5 }] },
];

// ─── Weathered-metal textures — canvas, not image assets, same rule as
// every other texture on this site. Base steel/rust, an optional pass of
// chipped royal-purple paint (the mast only — "painted a most royal
// purple"), and a bronze variant for the planets ("great bronze balls").
function makeMetalTexture({ base, rust, highlight, paint }) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = base;
  cx.fillRect(0, 0, 128, 128);

  cx.globalAlpha = 0.18;
  cx.strokeStyle = highlight;
  for (let i = 0; i < 14; i++) {
    cx.lineWidth = 0.6 + Math.random() * 1.6;
    const x = Math.random() * 128;
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x + (Math.random() - 0.5) * 18, 128);
    cx.stroke();
  }

  cx.globalAlpha = 0.4;
  cx.fillStyle = rust;
  for (let i = 0; i < 16; i++) {
    const bx = Math.random() * 128, by = Math.random() * 128, br = 3 + Math.random() * 9;
    cx.beginPath();
    cx.arc(bx, by, br, 0, Math.PI * 2);
    cx.fill();
  }

  if (paint) {
    cx.globalAlpha = 0.75;
    cx.fillStyle = paint;
    for (let i = 0; i < 9; i++) {
      const bx = Math.random() * 128, by = Math.random() * 128;
      const bw = 6 + Math.random() * 22, bh = 4 + Math.random() * 12;
      cx.beginPath();
      cx.ellipse(bx, by, bw, bh, Math.random() * Math.PI, 0, Math.PI * 2);
      cx.fill();
    }
  }

  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function steelMaterial(preview, repeat = 2) {
  const tex = makeMetalTexture({ base: '#39322b', rust: '#241e18', highlight: '#6d5c48' });
  tex.repeat.set(repeat, repeat);
  return new THREE.MeshStandardMaterial({ map: preview ? null : tex, color: preview ? 0x39322b : 0xffffff, roughness: 0.75, metalness: 0.55 });
}
function paintedMastMaterial(preview) {
  const tex = makeMetalTexture({ base: '#39322b', rust: '#241e18', highlight: '#6d5c48', paint: '#5b3a72' });
  tex.repeat.set(1, 3);
  return new THREE.MeshStandardMaterial({ map: preview ? null : tex, color: preview ? 0x4d3a5c : 0xffffff, roughness: 0.7, metalness: 0.5 });
}
function bronzeMaterial() {
  const tex = makeMetalTexture({ base: '#8a6438', rust: '#5a4022', highlight: '#d9ab6c' });
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.85 });
}

// A rattle-can paint job over a rust primer — not a clean flat fill, built
// from hundreds of tiny semi-transparent dabs so coverage is uneven (denser
// center, thinner and speckled toward the edge, same way a real spray can
// lays down color), plus a couple of gravity-drip streaks and a scatter of
// fine dark grit on top. Used for the planets — the print Scott's palette
// comes from uses flat vector fills; this is the same colors, but as if
// someone actually painted scrap-metal balls with them.
function makeSprayPaintTexture(hex) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  const col = new THREE.Color(hex);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const light = `${Math.min(255, Math.round(col.r * 255 + 60))},${Math.min(255, Math.round(col.g * 255 + 60))},${Math.min(255, Math.round(col.b * 255 + 60))}`;

  // Rust primer showing through at the very edges only — the base coat
  // below covers most of the ball, this just gives the rim something to
  // peek through.
  cx.fillStyle = '#332a22';
  cx.fillRect(0, 0, 128, 128);

  // Solid-ish base coat first, so the planet's actual color reads clearly
  // even from a distance — then the speckle passes on top add the
  // hand-sprayed unevenness without erasing the color itself.
  cx.fillStyle = `rgba(${rgb},0.92)`;
  cx.fillRect(0, 0, 128, 128);

  // Layered dabs, weighted toward the center of each "spray pass" so
  // coverage builds up unevenly — some lighter (thinner-coat) patches,
  // some darker/primer patches — rather than a flat, uniform fill.
  const passes = 6;
  for (let p = 0; p < passes; p++) {
    const cx0 = 20 + Math.random() * 88, cy0 = 20 + Math.random() * 88;
    const passRadius = 40 + Math.random() * 45;
    const lighten = Math.random() > 0.45;
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 1.4) * passRadius;
      const x = cx0 + Math.cos(a) * r, y = cy0 + Math.sin(a) * r;
      const alpha = (1 - r / passRadius) * (0.22 + Math.random() * 0.3);
      cx.fillStyle = lighten
        ? `rgba(${light},${Math.max(0, alpha) * 0.8})`
        : `rgba(${rgb},${Math.max(0, alpha)})`;
      cx.beginPath();
      cx.arc(x, y, 0.8 + Math.random() * 2.2, 0, Math.PI * 2);
      cx.fill();
    }
  }

  // A couple of gravity drips.
  cx.strokeStyle = `rgba(${rgb},0.6)`;
  for (let i = 0; i < 3; i++) {
    const x = 20 + Math.random() * 88;
    const y0 = 20 + Math.random() * 50;
    const len = 15 + Math.random() * 35;
    cx.lineWidth = 0.8 + Math.random() * 1.2;
    cx.beginPath();
    cx.moveTo(x, y0);
    cx.lineTo(x + (Math.random() - 0.5) * 4, y0 + len);
    cx.stroke();
  }

  // Fine grit, dark speckle on top — kept light so it reads as texture,
  // not as a haze that dulls the color back down.
  cx.globalAlpha = 0.18;
  for (let i = 0; i < 70; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#000000' : '#1a1a1a';
    cx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  cx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

const BOLT_TONE = 0x18140f;

function addBolts(parent, radius, count, ringGeoRadius) {
  const boltGeo = new THREE.SphereGeometry(radius, 6, 6);
  const boltMat = new THREE.MeshStandardMaterial({ color: BOLT_TONE, roughness: 0.6, metalness: 0.6 });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(Math.cos(a) * ringGeoRadius, Math.sin(a) * ringGeoRadius, 0);
    parent.add(bolt);
  }
}

// A welded brace (or a chain link) between two arbitrary points — used both
// for the ring-to-mast braces and the ceiling-to-mast suspension chains.
function addStrut(parent, from, to, thickness, mat) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dist = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(thickness, thickness, dist, 6);
  const strut = new THREE.Mesh(geo, mat);
  strut.position.copy(mid);
  strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  parent.add(strut);
  return strut;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function buildOrrery(preview, suspendTopY, rafterY) {
  const group = new THREE.Group();
  const steelMat = steelMaterial(preview);
  const mastMat = paintedMastMaterial(preview);
  const bronzeMat = bronzeMaterial();

  // Size pass, 2026-07-17 — Scott asked for the orrery itself substantially
  // bigger without growing the warehouse around it. HW thickens the mast
  // and hardware; SR widens the orbit rings (capped just inside the side
  // walls — wallDist is 6.5/5 in buildWarehouse); SS grows the planet
  // bodies themselves, no wall constraint so closer to the full ask.
  // Mast height and every vertical anchor (baseY, suspendTopY, rafterY,
  // riserTopY) are untouched — the room stays exactly the size it was.
  const HW = 1.4, SR = 1.45, SS = 2.2;

  // ─── The mast — steel and wood, painted royal purple, hanging from the
  // suspension collar at the top rather than rooted in a floor: a core
  // shaft plus riveted collar flanges with diagonal cross-braces. ────────
  const mastHeight = preview ? 3.2 : 4.4;
  const baseY = suspendTopY - mastHeight;
  const coreGeo = new THREE.CylinderGeometry((preview ? 0.05 : 0.06) * HW, (preview ? 0.09 : 0.11) * HW, mastHeight, 8);
  const core = new THREE.Mesh(coreGeo, mastMat);
  core.position.y = baseY + mastHeight / 2;
  group.add(core);

  const collarCount = preview ? 3 : 5;
  const collarGeo = new THREE.TorusGeometry((preview ? 0.1 : 0.13) * HW, 0.012 * HW, 5, 6);
  let prevCollarY = null;
  for (let i = 0; i < collarCount; i++) {
    const y = baseY + (i / (collarCount - 1)) * mastHeight;
    const collar = new THREE.Mesh(collarGeo, steelMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = y;
    group.add(collar);
    if (!preview && prevCollarY !== null) {
      const braceGeo = new THREE.CylinderGeometry(0.008 * HW, 0.008 * HW, Math.hypot(mastHeight / (collarCount - 1), 0.1) * 1.3, 5);
      [0, Math.PI].forEach(rot => {
        const brace = new THREE.Mesh(braceGeo, steelMat);
        brace.position.y = (y + prevCollarY) / 2;
        brace.rotation.z = 0.55;
        brace.rotation.y = rot;
        group.add(brace);
      });
    }
    prevCollarY = y;
  }

  // ─── Suspension — four chains fanning from the top collar up to anchor
  // points near the roof trusses. What actually holds the thing up. ───────
  const anchorSpread = preview ? 0.75 : 1.0;
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
    const from = new THREE.Vector3(dx * (preview ? 0.11 : 0.14) * HW, suspendTopY, dz * (preview ? 0.11 : 0.14) * HW);
    const to = new THREE.Vector3(dx * anchorSpread, rafterY, dz * anchorSpread);
    addStrut(group, from, to, (preview ? 0.012 : 0.015) * HW, steelMat);
  });

  // A bolted control box near the bottom of the mast — the actual
  // click/hover target, with one small amber indicator lamp lit, the kind
  // of after-the-fact gauge box a scrap-built machine would have bolted on.
  const hubHalf = (preview ? 0.16 : 0.2) * HW;
  const hubGeo = new THREE.BoxGeometry((preview ? 0.22 : 0.28) * HW, (preview ? 0.16 : 0.2) * HW, (preview ? 0.16 : 0.2) * HW);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.7, metalness: 0.4 });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.position.set(hubHalf, baseY + 0.3, 0);
  group.add(hub);
  const lampGeo = new THREE.SphereGeometry((preview ? 0.035 : 0.045) * HW, 8, 8);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xffaa33, emissiveIntensity: 1, roughness: 0.4 });
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(0, hubHalf * 0.6, hubHalf * 0.6);
  hub.add(lamp);

  // ─── The radio telescope — "still on, receiving information from the
  // heavens." A riser from the suspension collar continues the mast upward,
  // through the roof, to a rough sheet-metal dish and a pulsing signal bulb.
  // Riser height tuned so this whole assembly clears the ceiling by a wide,
  // unmistakable margin (was clearing it by as little as 0.05-0.1 units
  // before — technically "poking out," but not legibly so): the found
  // story's own text says it plainly ("about 30 feet high, the peak poking
  // out of the warehouse skylights"), so the peak should read as clearly
  // above the roofline, surrounded by the sky/star field beyond it, not
  // just barely grazing the hole.
  const riserTopY = suspendTopY + (preview ? 1.0 : 1.35);
  addStrut(group, new THREE.Vector3(0, suspendTopY, 0), new THREE.Vector3(0, riserTopY, 0), (preview ? 0.03 : 0.04) * HW, mastMat);
  const dishGroup = new THREE.Group();
  dishGroup.position.y = riserTopY;
  const dishGeo = new THREE.ConeGeometry((preview ? 0.2 : 0.26) * HW, (preview ? 0.16 : 0.22) * HW, 8, 1, true);
  const dish = new THREE.Mesh(dishGeo, steelMat);
  dish.rotation.x = Math.PI;
  dishGroup.add(dish);
  const antennaGeo = new THREE.CylinderGeometry(0.008 * HW, 0.008 * HW, (preview ? 0.16 : 0.22) * HW, 5);
  const antenna = new THREE.Mesh(antennaGeo, steelMat);
  antenna.position.y = (preview ? 0.14 : 0.18) * HW;
  dishGroup.add(antenna);
  const signalMat = new THREE.MeshStandardMaterial({ color: 0xffe8bb, emissive: 0xffcc77, emissiveIntensity: 1, transparent: true, opacity: 0.8 });
  const signal = new THREE.Mesh(new THREE.SphereGeometry((preview ? 0.03 : 0.04) * HW, 8, 8), signalMat);
  signal.position.y = (preview ? 0.24 : 0.32) * HW;
  dishGroup.add(signal);
  group.add(dishGroup);

  // ─── The nine real planets — order, relative size, and orbital spacing
  // all pulled from the actual solar system (compressed with a square root
  // so Mercury and Pluto both fit), close to coplanar and braced back to
  // the mast so it reads as one welded machine, not nine floating rings. ──
  const planets = preview ? PLANET_DATA.slice(0, 5) : PLANET_DATA;
  const sqrtAU = planets.map(p => Math.sqrt(p.au));
  const auMin = Math.min(...sqrtAU), auMax = Math.max(...sqrtAU);
  const sqrtDia = planets.map(p => Math.sqrt(p.relDiameter));
  const diaMin = Math.min(...sqrtDia), diaMax = Math.max(...sqrtDia);
  const innerR = (preview ? 0.55 : 0.6) * SR, outerR = (preview ? 2.1 : 3.7) * SR;
  const minSize = (preview ? 0.018 : 0.024) * SS, maxSize = (preview ? 0.065 : 0.09) * SS;

  const orbits = [];
  const TILT_BASE = 0.52;
  const TILT_JITTER = 0.03;
  const ringYBase = baseY + mastHeight * 0.3;
  const radii = [];

  planets.forEach((planet, i) => {
    const radius = lerp(innerR, outerR, (sqrtAU[i] - auMin) / (auMax - auMin));
    radii.push(radius);
    const size = lerp(minSize, maxSize, (sqrtDia[i] - diaMin) / (diaMax - diaMin));
    const tilt = TILT_BASE + (Math.random() - 0.5) * TILT_JITTER;
    const yOffset = ringYBase + i * (preview ? 0.06 : 0.05);

    const ringGeo = new THREE.TorusGeometry(radius, (preview ? 0.008 : 0.01) * HW, 6, 20);
    const ring = new THREE.Mesh(ringGeo, steelMat);
    ring.rotation.x = Math.PI / 2 + tilt;
    ring.position.y = yOffset;
    group.add(ring);
    addBolts(ring, (preview ? 0.012 : 0.015) * HW, 16, radius);

    // Two struts per ring, bracing it back to the mast.
    [0, Math.PI].forEach(angle => {
      const from = new THREE.Vector3(0, yOffset, 0);
      const to = new THREE.Vector3(Math.cos(angle) * radius * 0.94, yOffset, Math.sin(angle) * radius * 0.94);
      addStrut(group, from, to, (preview ? 0.007 : 0.009) * HW, steelMat);
    });

    const pivot = new THREE.Object3D();
    pivot.rotation.x = tilt;
    pivot.position.y = yOffset;
    group.add(pivot);

    const bodyGroup = new THREE.Group();
    bodyGroup.position.x = radius;
    pivot.add(bodyGroup);
    const bodyGeo = new THREE.SphereGeometry(size, 16, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: makeSprayPaintTexture(planet.color),
      emissive: planet.color, emissiveIntensity: 0.22,
      roughness: 0.68, metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    bodyGroup.add(body);

    // A short mounting arm — the ball rides a bracket on the ring.
    const armGeo = new THREE.CylinderGeometry(0.006 * HW, 0.006 * HW, (preview ? 0.03 : 0.04) * HW, 5);
    const arm = new THREE.Mesh(armGeo, steelMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = -(preview ? 0.015 : 0.02) * HW;
    bodyGroup.add(arm);

    if (planet.ring) {
      const satRingGeo = new THREE.RingGeometry(size * 1.4, size * 2.2, 24);
      const satRingMat = new THREE.MeshStandardMaterial({
        color: 0xd8c48a, roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
      });
      const satRing = new THREE.Mesh(satRingGeo, satRingMat);
      satRing.rotation.x = Math.PI / 2 - 0.45;
      bodyGroup.add(satRing);
    }

    const moons = planet.moons.map((moon, mi) => {
      const moonPivot = new THREE.Object3D();
      bodyGroup.add(moonPivot);
      const moonSize = Math.max(0.006 * HW, size * moon.relSize * (preview ? 0.8 : 1));
      const moonGeo = new THREE.SphereGeometry(moonSize, 8, 8);
      const moonMesh = new THREE.Mesh(moonGeo, bronzeMat);
      moonMesh.position.x = size * 1.8 + mi * (size * 0.9 + 0.012 * HW);
      moonPivot.add(moonMesh);
      return { pivot: moonPivot, speed: 0.6 + Math.random() * 0.4 + mi * 0.1 };
    });

    orbits.push({
      pivot, moons,
      speed: 0.16 - i * (0.16 / planets.length) * 0.7 + Math.random() * 0.012,
      direction: 1, // real planets all orbit the same way — no alternating
    });
  });

  // ─── The asteroid belt — scrap and debris, sitting where it actually
  // does: between Mars and Jupiter, not out past everything else. ─────────
  const marsIdx = planets.findIndex(p => p.name === 'Mars');
  const jupiterIdx = planets.findIndex(p => p.name === 'Jupiter');
  if (marsIdx !== -1 && jupiterIdx !== -1) {
    const beltRadius = (radii[marsIdx] + radii[jupiterIdx]) / 2;
    const beltY = ringYBase + ((marsIdx + jupiterIdx) / 2) * (preview ? 0.06 : 0.05);
    const beltGroup = new THREE.Group();
    beltGroup.position.y = beltY;
    group.add(beltGroup);
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.85, metalness: 0.3 });
    const debrisGeo = new THREE.IcosahedronGeometry(1, 0);
    const beltCount = preview ? 14 : 34;
    const beltSpread = (radii[jupiterIdx] - radii[marsIdx]) * 0.35;
    for (let i = 0; i < beltCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = beltRadius + (Math.random() - 0.5) * beltSpread;
      const chunk = new THREE.Mesh(debrisGeo, debrisMat);
      const s = ((preview ? 0.01 : 0.014) + Math.random() * (preview ? 0.01 : 0.013)) * HW;
      chunk.scale.setScalar(s);
      chunk.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.06, Math.sin(a) * r);
      chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      beltGroup.add(chunk);
    }
    [0, Math.PI / 2].forEach(angle => {
      const from = new THREE.Vector3(0, beltY, 0);
      const to = new THREE.Vector3(Math.cos(angle) * beltRadius * 0.96, beltY, Math.sin(angle) * beltRadius * 0.96);
      addStrut(group, from, to, (preview ? 0.006 : 0.008) * HW, steelMat);
    });
  }

  // ─── "A few other unidentified cosmic objects" — past Pluto, welded on
  // cantilevered booms, each tumbling on its own slow spin. ────────────────
  const unknowns = [];
  const lastRadius = radii[radii.length - 1];
  const lastY = ringYBase + (planets.length - 1) * (preview ? 0.06 : 0.05);
  const unknownGeos = [new THREE.IcosahedronGeometry((preview ? 0.05 : 0.07) * HW, 0), new THREE.OctahedronGeometry((preview ? 0.045 : 0.06) * HW, 0)];
  const unknownMat = new THREE.MeshStandardMaterial({ color: 0x5a4d3a, roughness: 0.7, metalness: 0.5 });
  const unknownCount = preview ? 1 : 2;
  for (let i = 0; i < unknownCount; i++) {
    const radius = lastRadius + ((preview ? 0.25 : 0.34) + i * (preview ? 0.18 : 0.24)) * SR;
    const y = lastY + (i + 1) * (preview ? 0.05 : 0.06);
    const angle = i * (Math.PI * 0.7);
    const pivot = new THREE.Object3D();
    pivot.position.y = y;
    group.add(pivot);
    const mesh = new THREE.Mesh(unknownGeos[i % unknownGeos.length], unknownMat);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    pivot.add(mesh);
    const from = new THREE.Vector3(0, y, 0);
    const to = new THREE.Vector3(Math.cos(angle) * radius * 0.9, y, Math.sin(angle) * radius * 0.9);
    addStrut(group, from, to, (preview ? 0.006 : 0.008) * HW, steelMat);
    unknowns.push({ pivot, mesh, speed: 0.05 + Math.random() * 0.03, direction: 1, spin: 0.3 + Math.random() * 0.4 });
  }

  return { group, hitTarget: hub, lampMat, orbits, unknowns, signal, signalMat, baseY, mastHeight };
}

// ─── The warehouse — floor, a ceiling with a skylight cut into it, roof
// trusses to hang the orrery from, a couple of corrugated walls with a few
// taped-up show flyers, and a shaft of light falling through the hole the
// orrery's peak actually pokes through. ───────────────────────────────────
function makeConcreteTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#232321';
  cx.fillRect(0, 0, 128, 128);
  cx.globalAlpha = 0.3;
  for (let i = 0; i < 20; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#1a1a18' : '#2c2c29';
    const bx = Math.random() * 128, by = Math.random() * 128, br = 6 + Math.random() * 20;
    cx.beginPath();
    cx.arc(bx, by, br, 0, Math.PI * 2);
    cx.fill();
  }
  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function makeCorrugatedTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  cx.fillStyle = '#17150f';
  cx.fillRect(0, 0, 32, 32);
  cx.strokeStyle = '#2c2820';
  cx.lineWidth = 2;
  for (let x = 0; x < 32; x += 5) {
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x, 32);
    cx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 4);
  return tex;
}

function makeCardboardTexture() {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const cx = c.getContext('2d');
  cx.fillStyle = '#a9884f';
  cx.fillRect(0, 0, 96, 96);
  cx.globalAlpha = 0.25;
  for (let i = 0; i < 10; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#8a6f3f' : '#c2a366';
    cx.fillRect(Math.random() * 96, Math.random() * 96, 20 + Math.random() * 30, 3 + Math.random() * 6);
  }
  cx.globalAlpha = 0.5;
  cx.fillStyle = '#d9c99a';
  cx.fillRect(0, 40, 96, 10);
  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// A pegboard with a few tool silhouettes — a wrench, a hammer, a saw —
// hung the way anyone's garage wall actually looks.
function makePegboardTexture() {
  const c = document.createElement('canvas');
  c.width = 200; c.height = 260;
  const cx = c.getContext('2d');
  cx.fillStyle = '#8a7856';
  cx.fillRect(0, 0, 200, 260);
  cx.fillStyle = '#5f5138';
  for (let y = 12; y < 260; y += 16) {
    for (let x = 12; x < 200; x += 16) {
      cx.beginPath();
      cx.arc(x, y, 1.6, 0, Math.PI * 2);
      cx.fill();
    }
  }
  cx.strokeStyle = '#1c1a16';
  cx.fillStyle = '#232019';

  // Wrench.
  cx.save();
  cx.translate(50, 70);
  cx.rotate(-0.4);
  cx.lineWidth = 6;
  cx.beginPath(); cx.moveTo(-30, 0); cx.lineTo(30, 0); cx.stroke();
  cx.beginPath(); cx.arc(-32, 0, 9, 0.6, Math.PI * 2 - 0.6); cx.stroke();
  cx.beginPath(); cx.arc(32, 0, 7, 0, Math.PI * 2); cx.fill();
  cx.restore();

  // Hammer.
  cx.save();
  cx.translate(140, 90);
  cx.rotate(0.3);
  cx.fillRect(-4, -10, 8, 55);
  cx.fillRect(-20, -22, 40, 16);
  cx.restore();

  // Hand saw.
  cx.save();
  cx.translate(90, 175);
  cx.rotate(-0.15);
  cx.beginPath();
  cx.moveTo(-45, 10); cx.lineTo(35, -20); cx.lineTo(35, 4); cx.lineTo(-45, 22); cx.closePath();
  cx.fill();
  cx.fillRect(30, -24, 22, 30);
  cx.restore();

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// A taped-up early-90s show flyer — xeroxed, high-contrast, a little
// water-stained. Band names only (no logos/artwork reproduced) — enough to
// date the room without borrowing anyone's actual design.
function makePosterTexture(band, sub) {
  const c = document.createElement('canvas');
  c.width = 200; c.height = 280;
  const cx = c.getContext('2d');
  cx.fillStyle = '#cfc9b4';
  cx.fillRect(0, 0, 200, 280);

  // Xerox speckle.
  cx.globalAlpha = 0.5;
  for (let i = 0; i < 260; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#00000022' : '#ffffff22';
    cx.fillRect(Math.random() * 200, Math.random() * 280, 1, 1);
  }
  cx.globalAlpha = 1;

  cx.strokeStyle = '#161412';
  cx.lineWidth = 6;
  cx.strokeRect(10, 10, 180, 260);

  cx.fillStyle = '#141210';
  cx.textAlign = 'center';
  cx.font = `bold ${band.length > 8 ? 26 : 34}px Impact, "Arial Narrow", sans-serif`;
  cx.save();
  cx.translate(100, 130);
  cx.rotate(-0.03);
  cx.fillText(band.toUpperCase(), 0, 0);
  cx.restore();

  cx.beginPath();
  cx.moveTo(30, 155); cx.lineTo(170, 155);
  cx.lineWidth = 3;
  cx.stroke();

  cx.font = '14px Georgia, serif';
  cx.fillText(sub, 100, 185);
  cx.font = '11px Georgia, serif';
  cx.fillText('$5 AT THE DOOR', 100, 210);

  // A faint water stain.
  const grad = cx.createRadialGradient(160, 230, 4, 160, 230, 50);
  grad.addColorStop(0, 'rgba(90,70,40,0.28)');
  grad.addColorStop(1, 'rgba(90,70,40,0)');
  cx.fillStyle = grad;
  cx.beginPath();
  cx.arc(160, 230, 50, 0, Math.PI * 2);
  cx.fill();

  // Tape marks at the top corners.
  cx.fillStyle = 'rgba(220,215,200,0.55)';
  cx.fillRect(6, 2, 34, 14);
  cx.fillRect(160, 2, 34, 14);

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ─── Poster audio ───────────────────────────────────────────────────────────
// Scott asked for "MIDI versions of some of the artists' songs on the
// posters," played back like a staticy radio. Actual transcriptions of real
// Nirvana/R.E.M./Beastie Boys/For Squirrels recordings — even rendered as
// MIDI — would still be reproducing those bands' copyrighted compositions,
// so that's not something to build here. What's below instead: short,
// original note sequences only evocative of each poster's genre/era (a
// grunge-ish power-chord vamp, a jangly arpeggio, a syncopated bassline, an
// alt-rock progression), synthesized live with oscillators and run through
// a bandpass filter plus a hiss layer so it reads as "caught on a cheap
// radio." It also happens to fit the found story better than a real
// recording would — that story is *about* a pirate radio investigation, so
// clicking a flyer to "tune in" a ghost signal is the same idea, just
// interactive. Playback only ever starts from a click (never autoplay),
// which also keeps it inside browser autoplay-gesture rules.
const POSTER_RIFFS = {
  'Nirvana': { wave: 'square', notes: [
    [110, 0.22], [110, 0.22], [130.8, 0.22], [110, 0.22],
    [98, 0.22], [98, 0.22], [110, 0.22], [87.3, 0.42],
  ]},
  'R.E.M.': { wave: 'triangle', notes: [
    [196, 0.16], [247, 0.16], [294, 0.16], [247, 0.16],
    [220, 0.16], [262, 0.16], [330, 0.16], [294, 0.34],
  ]},
  'Beastie Boys': { wave: 'sawtooth', notes: [
    [82, 0.14], [82, 0.1], [110, 0.12], [82, 0.14],
    [73, 0.1], [98, 0.12], [82, 0.14], [65, 0.3],
  ]},
  'For Squirrels': { wave: 'triangle', notes: [
    [164, 0.2], [196, 0.2], [220, 0.2], [196, 0.2],
    [174, 0.2], [196, 0.2], [220, 0.2], [246, 0.4],
  ]},
};

function makeStaticBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function buildWarehouse(preview, floorY, ceilingY, rafterY) {
  const group = new THREE.Group();
  const span = preview ? 14 : 20;
  const wallDist = preview ? 5 : 6.5;

  const floorMat = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(), roughness: 0.95, metalness: 0.05 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, span * 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  group.add(floor);

  // Ceiling with a rectangular skylight hole, sized to what the mast
  // actually pokes through.
  const holeW = preview ? 0.7 : 0.9, holeH = preview ? 0.7 : 0.9;
  const shape = new THREE.Shape();
  shape.moveTo(-span, -span);
  shape.lineTo(span, -span);
  shape.lineTo(span, span);
  shape.lineTo(-span, span);
  shape.lineTo(-span, -span);
  const hole = new THREE.Path();
  hole.moveTo(-holeW, -holeH);
  hole.lineTo(holeW, -holeH);
  hole.lineTo(holeW, holeH);
  hole.lineTo(-holeW, holeH);
  hole.lineTo(-holeW, -holeH);
  shape.holes.push(hole);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide });
  const ceiling = new THREE.Mesh(new THREE.ShapeGeometry(shape), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ceilingY;
  group.add(ceiling);

  // Roof trusses — a crossed pair spanning near the skylight, offset so
  // they don't cover the hole. What the suspension chains actually bolt to.
  const trussMat = new THREE.MeshStandardMaterial({ map: makeMetalTexture({ base: '#2a2620', rust: '#191510', highlight: '#544838' }), roughness: 0.85, metalness: 0.5 });
  const trussLen = preview ? 6 : 8;
  const trussA = new THREE.Mesh(new THREE.BoxGeometry(trussLen, preview ? 0.07 : 0.09, preview ? 0.07 : 0.09), trussMat);
  trussA.position.set(0, rafterY, 0);
  group.add(trussA);
  const trussB = new THREE.Mesh(new THREE.BoxGeometry(preview ? 0.07 : 0.09, preview ? 0.07 : 0.09, trussLen), trussMat);
  trussB.position.set(0, rafterY, 0);
  group.add(trussB);
  // Cross-braces down to the walls, just for texture — a truss doesn't
  // float on its own.
  [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dz]) => {
    const from = new THREE.Vector3(dx * trussLen / 2, rafterY, dz * trussLen / 2);
    const to = new THREE.Vector3(dx * trussLen / 2, ceilingY - (preview ? 0.5 : 0.7), dz * trussLen / 2);
    addStrut(group, from, to, preview ? 0.02 : 0.026, trussMat);
  });

  // A soft shaft of light falling through the hole.
  const beamGeo = new THREE.CylinderGeometry(holeW * 0.4, holeW * 2.4, ceilingY - floorY, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xcfe0ff, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = (ceilingY + floorY) / 2;
  group.add(beam);

  // A couple of dark corrugated walls, back and to one side, pulled in
  // closer than the floor/ceiling extent so the flyers taped to them
  // actually read at a legible size.
  const wallMat = new THREE.MeshStandardMaterial({ map: makeCorrugatedTexture(), roughness: 0.9, metalness: 0.2 });
  const wallHeight = ceilingY - floorY;
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, wallHeight), wallMat);
  backWall.position.set(0, (ceilingY + floorY) / 2, -wallDist);
  group.add(backWall);
  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, wallHeight), wallMat);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-wallDist, (ceilingY + floorY) / 2, 0);
  group.add(sideWall);

  let bulbPosition = null;

  // ─── A ramshackle garage's worth of clutter, plus a few taped-up early-
  // '90s show flyers spaced the way a real wall of flyers actually looks —
  // overlapping, crooked, different sizes, added over time, not evenly
  // gridded. Skipped in preview for performance. ──────────────────────────
  const posterMeshes = [];
  if (!preview) {
    const baseY = floorY + wallHeight * 0.34;
    const posters = [
      { band: 'Nirvana', sub: 'Live — All Ages', x: -2.3, y: baseY + 0.18, rot: -0.09, scale: 1.08, z: -wallDist + 0.03 },
      { band: 'R.E.M.', sub: 'Live — Doors 8pm', x: -0.55, y: baseY - 0.32, rot: 0.05, scale: 0.86, z: -wallDist + 0.025 },
      { band: 'Beastie Boys', sub: 'Live — 18+', x: 0.35, y: baseY + 0.4, rot: -0.05, scale: 1.0, z: -wallDist + 0.035 },
      { band: 'For Squirrels', sub: 'Live — This Fri.', x: 1.9, y: baseY - 0.1, rot: 0.09, scale: 0.78, z: -wallDist + 0.02 },
    ];
    posters.forEach(p => {
      const posterMat = new THREE.MeshStandardMaterial({
        map: makePosterTexture(p.band, p.sub), roughness: 0.85, metalness: 0,
        emissive: 0x0c0a08, emissiveIntensity: 0.5,
      });
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.95 * p.scale, 1.33 * p.scale), posterMat);
      poster.position.set(p.x, p.y, p.z);
      poster.rotation.z = p.rot;
      group.add(poster);
      // Tracked so the scene can raycast these separately from the hub —
      // clicking one "tunes in" a few bars of static-laden radio (see
      // playPosterRiff in createOrrery). Fits the found story's own
      // premise (a pirate radio investigation) better than a silent wall.
      posterMeshes.push({ mesh: poster, band: p.band, baseEmissive: 0.5 });
    });

    // Pegboard with tools, on the side wall.
    const pegboardMat = new THREE.MeshStandardMaterial({ map: makePegboardTexture(), roughness: 0.9, metalness: 0 });
    const pegboard = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), pegboardMat);
    pegboard.rotation.y = Math.PI / 2;
    pegboard.position.set(-wallDist + 0.03, floorY + wallHeight * 0.5, 2.6);
    group.add(pegboard);

    // A stack of cardboard boxes, in the back corner.
    const cardboardMat = new THREE.MeshStandardMaterial({ map: makeCardboardTexture(), roughness: 0.95, metalness: 0 });
    const boxSizes = [[0.55, 0.4, 0.45], [0.42, 0.35, 0.4], [0.48, 0.3, 0.3]];
    let stackY = floorY;
    boxSizes.forEach((size, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(...size), cardboardMat);
      stackY += size[1] / 2;
      box.position.set(-wallDist + 1.2 + i * 0.05, stackY, -wallDist + 0.9 - i * 0.08);
      box.rotation.y = (Math.random() - 0.5) * 0.5;
      stackY += size[1] / 2;
      group.add(box);
    });

    // An old tire, leaning against the back wall.
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18161a, roughness: 0.85, metalness: 0.1 });
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.11, 10, 20), tireMat);
    tire.rotation.x = Math.PI / 2 + 0.28;
    tire.position.set(2.9, floorY + 0.34, -wallDist + 0.35);
    group.add(tire);

    // A workbench along the side wall, a little clutter on top, and a bare
    // bulb hanging over it on a cord from the roof truss.
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4530, roughness: 0.85, metalness: 0 });
    const benchHeight = floorY + 0.55;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 1.6), woodMat);
    bench.position.set(-wallDist + 0.4, benchHeight, -1.5);
    group.add(bench);
    [[-0.6, -2.1], [-0.6, -0.9], [0.6, -2.1], [0.6, -0.9]].forEach(([dx, dz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, benchHeight - floorY, 6), woodMat);
      leg.position.set(-wallDist + 0.4 + dx * 0.15, floorY + (benchHeight - floorY) / 2, dz + 0.6);
      group.add(leg);
    });
    const clutterMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.3 });
    [[-0.05, -1.7, 0.12], [0.08, -1.3, 0.09]].forEach(([dx, dz, s]) => {
      const clutter = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), clutterMat);
      clutter.position.set(-wallDist + 0.4 + dx, benchHeight + 0.025 + s * 0.4, dz);
      clutter.rotation.y = Math.random();
      group.add(clutter);
    });

    bulbPosition = new THREE.Vector3(-wallDist + 0.6, benchHeight + 0.9, -1.5);
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    addStrut(group, new THREE.Vector3(bulbPosition.x, rafterY - 0.05, bulbPosition.z), bulbPosition, 0.006, cordMat);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe8b0, emissive: 0xffcc77, emissiveIntensity: 1.6, roughness: 0.4 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), bulbMat);
    bulb.position.copy(bulbPosition);
    group.add(bulb);
  }

  return { group, bulbPosition, posters: posterMeshes };
}

export function createOrrery(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(54, w / h, 0.1, 500);
  // Camera pulled back to keep the larger orrery framed on load, and
  // brought closer to head-on (less side offset, lookAt raised toward the
  // rings' actual vertical center) so the machine sits centered in the
  // room by default rather than off to one side — this only really
  // matters now that there's no auto-rotate drifting it through other
  // angles on its own (see the drag-to-orbit section below).
  camera.position.set(preview ? 1.1 : 1.5, preview ? 0.3 : 0.35, preview ? 13.3 : 16.8);
  camera.lookAt(0, preview ? -0.15 : -0.2, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x030303, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  // Fog matched to the clear color so only genuinely distant geometry
  // (far wall corners, stars beyond the skylight) softens into haze — the
  // soft render-distance falloff of early-90s CD-ROM adventure games
  // (Myst, Return to Zork, The 7th Guest), not a modern crisp render.
  // Far distance kept well beyond the camera-to-orrery range (camera now
  // sits at z 13.3/16.8) so the machine itself never fogs out — it had
  // been eating into the enlarged orrery and washing out the preview tile
  // almost entirely.
  scene.fog = new THREE.Fog(0x030303, preview ? 9 : 12, preview ? 30 : 42);

  // ─── Lighting — dim industrial ambience, brightened a step (Scott: it
  // was starting too dark), a cool wash falling through the skylight, a
  // warm accent low down near the machine itself. ────────────────────────
  scene.add(new THREE.HemisphereLight(0x64778a, 0x14100c, 0.8));
  const skyLight = new THREE.DirectionalLight(0xcfe0ff, 1.15);
  skyLight.position.set(0.4, 6, 0.3);
  scene.add(skyLight);
  scene.add(new THREE.AmbientLight(0x554a3c, 0.35));

  // ─── Warehouse vertical layout — decided here, then handed down: the
  // ceiling and roof truss height are fixed first, and the orrery hangs
  // from a suspension point below the truss, with clear air beneath it
  // before the floor. ───────────────────────────────────────────────────
  const ceilingY  = preview ? 2.5 : 3.3;
  const rafterY   = ceilingY - (preview ? 0.35 : 0.45);
  const suspendTopY = rafterY - (preview ? 0.3 : 0.4);
  const orrery = buildOrrery(preview, suspendTopY, rafterY);
  const floorY = orrery.baseY - (preview ? 0.9 : 1.3);
  const warehouse = buildWarehouse(preview, floorY, ceilingY, rafterY);

  // The work light lives at the hanging bulb prop if the garage clutter
  // pass built one (full mode only); otherwise a plain accent near the
  // machine, same as before.
  const workLight = new THREE.PointLight(0xffaa55, 0.9, preview ? 9 : 13);
  if (warehouse.bulbPosition) workLight.position.copy(warehouse.bulbPosition);
  else workLight.position.set(1.2, -0.6, 1.4);
  scene.add(workLight);

  // Sparse sky beyond the skylight — only really visible through the hole
  // and at the frame edges, not an all-encompassing backdrop.
  const starCount = preview ? 140 : 320;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * (preview ? 18 : 28);
    positions[i * 3 + 1] = ceilingY + Math.random() * (preview ? 4 : 6);
    positions[i * 3 + 2] = (Math.random() - 0.5) * (preview ? 18 : 28);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xddeeff, size: preview ? 0.03 : 0.045, transparent: true, opacity: 0.55, sizeAttenuation: true,
  });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  const root = new THREE.Group();
  scene.add(root);
  root.add(orrery.group);
  root.add(warehouse.group);

  // ─── Panel + window-chrome styling ───────────────────────────────────────
  if (!preview && !document.getElementById('orrery-styles')) {
    const style = document.createElement('style');
    style.id = 'orrery-styles';
    style.textContent = `
      #orrery-panel {
        position: absolute; top: 0; right: 0; width: 38%; height: 100%;
        background:
          radial-gradient(ellipse at 30% 0%, rgba(60,48,32,0.25), transparent 60%),
          #0d0a07;
        border-left: 1px solid rgba(220,200,180,0.15);
        padding: 3rem 2rem; transform: translateX(100%);
        transition: transform .5s cubic-bezier(.16,1,.3,1);
        overflow-y: scroll; z-index: 10;
        scrollbar-color: rgba(220,200,180,0.3) #0a0908; scrollbar-width: thin;
        font-family: 'Times New Roman', serif;
      }
      #orrery-panel.open { transform: translateX(0); }
      #orrery-panel-title {
        font-size: 0.95rem; letter-spacing: 0.24em; text-transform: uppercase;
        color: rgba(238,225,205,0.75); margin-bottom: 0.5rem;
      }
      #orrery-panel-era {
        font-size: 0.75rem; letter-spacing: 0.05em; color: rgba(225,215,195,0.35);
        margin-bottom: 1.4rem; font-style: italic;
        border-bottom: 1px solid rgba(220,200,180,0.15); padding-bottom: 1.4rem;
      }
      #orrery-panel-note {
        font-size: 0.98rem; line-height: 1.85; color: rgba(225,218,205,0.7);
        white-space: pre-line;
      }
      #orrery-panel-close {
        position: absolute; top: 1.5rem; right: 1.5rem; background: none;
        border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
        cursor: pointer; padding: .5rem; z-index: 2;
      }
      #orrery-panel-close:hover { color: rgba(255,255,255,0.9); }

      @media (max-width: 700px) {
        #orrery-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
      }
      #orrery-hint, #orrery-caption {
        /* z-index must clear #experience-overlay (styles/main.css: fixed,
           z-index:300) — these are appended to document.body, outside the
           overlay, same as butterfly's own label/hint in main.js. Below
           300 they're only visible during the overlay's ~0.6s fade-in,
           then gone once it's fully opaque. */
        position: fixed; color: rgba(255,255,255,0.3);
        text-transform: uppercase; pointer-events: none; text-align: center;
        z-index: 310; font-family: 'Times New Roman', serif;
      }
      #orrery-hint {
        top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
        line-height: 1.8; text-align: right;
      }
      #orrery-caption {
        bottom: 2.5rem; left: 50%; transform: translateX(-50%);
        font-size: clamp(0.7rem, 1.6vw, 0.95rem); letter-spacing: 0.08em;
        white-space: nowrap; font-style: italic; text-transform: none;
        color: rgba(255,255,255,0.4);
      }
      @media (max-width: 600px) {
        #orrery-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
      }

      /* ─── Very early compressed video (Scott, 2026-07-17: reworked from
         a "CD-ROM adventure game grain" read toward an actual low-bitrate
         mid-90s digital-video read — visible macroblocks, posterized/
         banded color, chroma smear, irregular judder rather than a
         steady flicker) — a soft vignette plus this overlay sitting over
         the render, and a title card in the same spirit. ─────────────── */
      #orrery-vignette {
        position: absolute; inset: 0; pointer-events: none; z-index: 5;
        background: radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(3,2,1,0.6) 100%);
      }
      #orrery-grain {
        /* Five stacked layers. The macroblock grid is the one thing pure
           turbulence noise can never fake on its own — block-based
           compression leaves actual straight seams, not organic blobs —
           so it's drawn explicitly as CSS grid lines rather than implied
           by coarser noise. The banding layer is a hard-STEPPED gradient
           (real color stops, no smooth interpolation) standing in for
           8-bit quantization: the visible "shelves" a codec leaves across
           a gradient or a dark scene. The "posterized" noise layer uses
           feComponentTransfer type="discrete" — genuine quantization of
           the turbulence's alpha into a handful of bands, not just a
           coarser blur — for per-block luma variance. Fine noise
           underneath is the base video-noise floor, same idea as before,
           just no longer carrying the whole effect on its own. */
        position: absolute; inset: 0; pointer-events: none; z-index: 6;
        opacity: 0.85; mix-blend-mode: overlay;
        background-image:
          repeating-linear-gradient(0deg, rgba(255,255,255,0.09) 0px, rgba(255,255,255,0.09) 1px, transparent 1px, transparent 8px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 1px, transparent 1px, transparent 8px),
          repeating-linear-gradient(115deg,
            rgba(0,0,0,0) 0px, rgba(0,0,0,0) 18px,
            rgba(255,255,255,0.45) 18px, rgba(255,255,255,0.45) 19px,
            rgba(0,0,0,0) 19px, rgba(0,0,0,0) 37px,
            rgba(0,0,0,0.35) 37px, rgba(0,0,0,0.35) 38px),
          url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><filter id='q'><feTurbulence type='fractalNoise' baseFrequency='0.09' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='discrete' tableValues='0 0.15 0.35 0.55 0.8'/></feComponentTransfer></filter><rect width='100%25' height='100%25' filter='url(%23q)'/></svg>"),
          url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/></svg>");
        background-size: 100% 100%, 100% 100%, 100% 100%, 120px 120px, 160px 160px;
        animation: orrery-grain-drift 2.6s linear infinite;
      }
      /* Grid and banding stay locked in place (real compression seams
         don't wander) — only the two noise layers drift, and unevenly:
         near-duplicate keyframes a fraction of a percent apart hold each
         position for a variable stretch before snapping to the next,
         rather than the old perfectly metronomic 2-step pulse. Reads as
         a stream stuttering on uneven packet timing, not a breathing
         texture. */
      @keyframes orrery-grain-drift {
        0%, 6%      { background-position: 0 0, 0 0, 0 0, 0 0, 0 0; }
        6.5%, 22%   { background-position: 0 0, 0 0, 0 0, 3px -2px, -2px 1px; }
        22.5%, 30%  { background-position: 0 0, 0 0, 0 0, -1px 3px, 2px -1px; }
        30.5%, 61%  { background-position: 0 0, 0 0, 0 0, 2px 1px, -3px 2px; }
        61.5%, 68%  { background-position: 0 0, 0 0, 0 0, -2px -3px, 1px 3px; }
        68.5%, 100% { background-position: 0 0, 0 0, 0 0, 1px 2px, -1px -2px; }
      }
      /* Chroma smear — early codecs store color at a fraction of luma's
         resolution, so color bleeds/lags past its own edges rather than
         staying crisp. Two tinted layers offset in opposite directions
         (mix-blend-mode:screen, so they only ever brighten, never muddy
         the render), concentrated toward the frame edges where that
         softness reads most in real compressed video. */
      #orrery-chroma {
        position: absolute; inset: 0; pointer-events: none; z-index: 7;
        mix-blend-mode: screen;
      }
      #orrery-chroma::before, #orrery-chroma::after {
        content: ''; position: absolute; inset: -2px;
      }
      #orrery-chroma::before {
        background: radial-gradient(ellipse at center, transparent 48%, rgba(255,40,60,0.14) 100%);
        transform: translateX(-3px);
      }
      #orrery-chroma::after {
        background: radial-gradient(ellipse at center, transparent 48%, rgba(40,220,255,0.14) 100%);
        transform: translateX(3px);
      }
      @media (prefers-reduced-motion: reduce) {
        #orrery-grain { animation: none; }
      }
      #orrery-title {
        /* #pm-nav (site.css) is a fixed, 3.5rem-tall, z-index:500 bar —
           sit clear below it. #experience-overlay (also site.css) is
           z-index:300 and fades to fully opaque over 0.6s - this is
           appended to document.body outside that overlay, so it needs to
           clear 300 too, or it only shows during the fade-in and then
           gets covered once the overlay settles (this was the "appears
           for a second then disappears" bug). 310 matches butterfly's
           own body-level label/hint in main.js, same issue there. */
        position: fixed; top: 4.4rem; left: 50%; transform: translateX(-50%);
        text-align: center; pointer-events: none; z-index: 310;
        font-family: 'Times New Roman', serif; color: rgba(238,225,205,0.82);
      }
      #orrery-title-main {
        display: block; font-size: clamp(1rem, 3vw, 1.7rem);
        letter-spacing: 0.32em; text-transform: uppercase;
        text-shadow: 0 0 18px rgba(0,0,0,0.85), 0 1px 0 rgba(0,0,0,0.6);
      }
      #orrery-title-sub {
        display: block; margin-top: 0.55rem;
        font-size: clamp(0.62rem, 1.3vw, 0.8rem); font-style: italic;
        letter-spacing: 0.03em; color: rgba(225,215,195,0.5);
        text-transform: none;
      }
      @media (max-width: 600px) {
        #orrery-title { top: 3.9rem; width: 90vw; }
        #orrery-title-sub { padding: 0 3vw; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Panel (full only) ────────────────────────────────────────────────────
  let panel = null, panelTitle = null, panelEra = null, panelNote = null;
  let hint = null, caption = null, vignette = null, grain = null, chroma = null, title = null;
  if (!preview) {
    vignette = document.createElement('div');
    vignette.id = 'orrery-vignette';
    vignette.setAttribute('aria-hidden', 'true');
    container.appendChild(vignette);

    grain = document.createElement('div');
    grain.id = 'orrery-grain';
    grain.setAttribute('aria-hidden', 'true');
    container.appendChild(grain);

    chroma = document.createElement('div');
    chroma.id = 'orrery-chroma';
    chroma.setAttribute('aria-hidden', 'true');
    container.appendChild(chroma);

    title = document.createElement('div');
    title.id = 'orrery-title';
    title.innerHTML = `
      <span id="orrery-title-main">${ORRERY.name}</span>
      <span id="orrery-title-sub">About thirty feet high, the peak poking out of the warehouse skylights.</span>
    `;
    title.setAttribute('aria-hidden', 'true');
    document.body.appendChild(title);

    panel = document.createElement('aside');
    panel.id = 'orrery-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'orrery-panel-title');
    panel.innerHTML = `
      <button id="orrery-panel-close" aria-label="Close panel">✕</button>
      <div id="orrery-panel-title" tabindex="-1">✦ ${ORRERY.name}</div>
      <div id="orrery-panel-era">${ORRERY.era}</div>
      <div id="orrery-panel-note">${ORRERY.note}</div>
    `;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(panel);
    panelTitle = panel.querySelector('#orrery-panel-title');
    panelEra   = panel.querySelector('#orrery-panel-era');
    panelNote  = panel.querySelector('#orrery-panel-note');

    panel.addEventListener('click', e => e.stopPropagation());
    panel.querySelector('#orrery-panel-close').addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.remove('open');
      setEmphasis(false);
    });

    hint = document.createElement('p');
    hint.id = 'orrery-hint';
    hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; click the control box &nbsp;·&nbsp; click a flyer to tune in';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    caption = document.createElement('p');
    caption.id = 'orrery-caption';
    caption.textContent = 'still on, receiving information from the heavens';
    caption.setAttribute('aria-hidden', 'true');
    document.body.appendChild(caption);
  }

  // ─── Interaction ─────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = false, selected = false;

  function setEmphasis(on) {
    orrery.lampMat.emissiveIntensity = on ? 2.2 : 1;
    orrery.hitTarget.scale.setScalar(on ? 1.4 : 1.0);
  }

  function openPanel() {
    panel.classList.add('open');
    setTimeout(() => panelTitle.focus(), 50);
  }

  // ─── Poster audio ─────────────────────────────────────────────────────
  // Lazily created on first click, per instance, so preview + full-scene
  // audio contexts never fight each other and dispose() has a clean
  // context of its own to close. See POSTER_RIFFS/makeStaticBuffer above
  // for what this plays and why it's original material, not a real track.
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playPosterRiff(band) {
    const riff = POSTER_RIFFS[band];
    if (!riff) return;
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const totalDur = riff.notes.reduce((s, [, d]) => s + d, 0) + 0.6;

    // "Tuning in": a quick swell up, a hold, then a fade — rather than a
    // hard on/off — so it reads as catching a signal, not a sound effect.
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.5, now + 0.15);
    master.gain.setValueAtTime(0.5, now + Math.max(0.15, totalDur - 0.45));
    master.gain.linearRampToValueAtTime(0, now + totalDur);
    master.connect(ctx.destination);

    // Bandpass stands in for a cheap speaker's narrow frequency response —
    // everything (notes and static both) gets routed through this.
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1400;
    bandpass.Q.value = 0.7;
    bandpass.connect(master);

    // Static/hiss bed underneath the notes.
    const staticSrc = ctx.createBufferSource();
    staticSrc.buffer = makeStaticBuffer(ctx, totalDur);
    const staticGain = ctx.createGain();
    staticGain.gain.value = 0.07;
    staticSrc.connect(staticGain).connect(bandpass);
    staticSrc.start(now);
    staticSrc.stop(now + totalDur);

    // The original, genre-evocative note sequence itself.
    let t = now + 0.15;
    riff.notes.forEach(([freq, dur]) => {
      const osc = ctx.createOscillator();
      osc.type = riff.wave;
      osc.frequency.value = freq;
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.9, t);
      noteGain.gain.setValueAtTime(0.9, t + dur * 0.7);
      noteGain.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(noteGain).connect(bandpass);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    });
  }

  let hoveredPoster = null;

  if (!preview) {
    container.addEventListener('mousemove', e => {
      const rect = container.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(orrery.hitTarget);
      const newHover = hits.length > 0;
      if (newHover !== hovered) {
        hovered = newHover;
        if (!selected) setEmphasis(hovered);
      }

      if (warehouse.posters.length) {
        const posterHits = raycaster.intersectObjects(warehouse.posters.map(p => p.mesh));
        const newPosterHover = posterHits.length
          ? warehouse.posters.find(p => p.mesh === posterHits[0].object)
          : null;
        if (newPosterHover !== hoveredPoster) {
          if (hoveredPoster) hoveredPoster.mesh.material.emissiveIntensity = hoveredPoster.baseEmissive;
          hoveredPoster = newPosterHover;
          if (hoveredPoster) hoveredPoster.mesh.material.emissiveIntensity = hoveredPoster.baseEmissive * 2.4;
        }
      }

      container.style.cursor = (hovered || hoveredPoster) ? 'pointer' : 'default';
    });

    let touchMoved = false;
    container.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });
    container.addEventListener('touchstart', () => { touchMoved = false; }, { passive: true });
    container.addEventListener('click', e => {
      if (touchMoved) { touchMoved = false; return; }
      if (panel.classList.contains('open') && !panel.contains(e.target)) {
        panel.classList.remove('open');
        selected = false;
        setEmphasis(hovered);
        return;
      }
      if (hoveredPoster) { playPosterRiff(hoveredPoster.band); return; }
      if (!hovered) return;
      selected = true;
      setEmphasis(true);
      openPanel();
    });
  }

  // ─── Drag to orbit (mouse + touch) ──────────────────────────────────────
  // No auto-rotate (Scott, 2026-07-17: it never settled into a composed,
  // centered view — always caught mid-spin) — it holds still until dragged.
  const orbitDrag = bindOrbitDrag(container, {
    onDrag: dx => { root.rotation.y += dx; },
  });
  const wheelZoom = bindWheelZoom(container, {
    isBlocked: e => panel && panel.contains(e.target),
    onZoom: deltaY => {
      camera.position.z = Math.max(1.4, Math.min(38, camera.position.z + deltaY * 0.01));
    },
  });

  // Reduced motion: the continuous orbital rotation below is exactly the
  // kind of autonomous, never-stopping motion prefers-reduced-motion is
  // for — drag-to-orbit stays available regardless, since that's motion
  // the visitor asks for, not motion imposed on them.
  const reduceMotion = prefersReducedMotion();

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.001;

    if (!reduceMotion) {
      orrery.orbits.forEach(o => {
        o.pivot.rotation.y += o.speed * o.direction * 0.01;
        o.moons.forEach(m => { m.pivot.rotation.y += m.speed * 0.02; });
      });
      orrery.unknowns.forEach(u => {
        u.pivot.rotation.y += u.speed * u.direction * 0.01;
        u.mesh.rotation.x += u.spin * 0.01;
        u.mesh.rotation.y += u.spin * 0.007;
      });
    }

    // The radio telescope's received-signal pulse.
    orrery.signalMat.emissiveIntensity = 0.6 + Math.abs(Math.sin(t * 4)) * 1.2;

    if (!hovered && !selected) {
      orrery.hitTarget.scale.setScalar(1.0 + Math.sin(t * 8) * 0.03);
    }

    renderer.render(scene, camera);
  }
  animate();

  const resize = bindGuardedResize(container, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // Escape closes the read-more panel from anywhere, matching standard
  // modal-dialog expectation (previously only the close button or a
  // click outside the panel would do it).
  const escapeClose = !preview ? bindEscapeClose(() => {
    if (panel && panel.classList.contains('open')) {
      panel.classList.remove('open');
      selected = false;
      setEmphasis(hovered);
    }
  }) : null;

  return {
    dispose() {
      cancelAnimationFrame(animId);
      orbitDrag.dispose();
      wheelZoom.dispose();
      resize.dispose();
      escapeClose?.dispose();
      if (audioCtx) { audioCtx.close(); audioCtx = null; }
      renderer.dispose();
      starGeo.dispose();
      starMat.dispose();
      warehouse.group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { obj.material.map?.dispose(); obj.material.dispose(); }
      });
      orrery.group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { obj.material.map?.dispose(); obj.material.dispose(); }
      });
      if (panel) panel.remove();
      if (hint) hint.remove();
      if (caption) caption.remove();
      if (vignette) vignette.remove();
      if (grain) grain.remove();
      if (chroma) chroma.remove();
      if (title) title.remove();
      renderer.domElement.remove();
    }
  };
}
