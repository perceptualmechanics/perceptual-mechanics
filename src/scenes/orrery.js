import * as THREE from 'three';

// ─── The Orrery of Los Feliz ───────────────────────────────────────────────
// A found short-short, full and unedited, undated. Investigators track a
// mysterious 30-foot orrery — a moving model of the solar system, a working
// radio telescope at its peak — to a warehouse in Los Feliz.
//
// This used to be one small clickable object tucked inside a larger scene
// called "Nebula" (see NOTES.md, "nebula retired, orrery promoted"). It's
// since been promoted to its own scene, and rebuilt twice: first as a
// bigger version of the same free-floating, glowing sci-fi object, then —
// at Scott's direction — grounded in the source material instead. The text
// says a foundry, a warehouse, and a sculpture studio were owed money for
// "some very large pieces"; the builder, Peter Hight, is called "an
// unlikely candidate to construct such a thing." That reads like someone's
// scrap-metal, backyard-engineered obsession, closer to Survival Research
// Labs than to a planetarium model — junk steel, welded joints, bolted
// flanges, bronze balls riding on tracks braced back to a central mast, all
// of it standing on a warehouse floor with its peak actually poking through
// a hole in the roof, same as the text says. The one line that made the
// tighter, more regular orbit geometry an easy call: "the orbits of the
// planets are precisely and mathematically laid out with an error
// tolerance approaching perfection" — however scrap the construction, the
// motion itself is exact, so the rings here are close to coplanar, not a
// tangle of independently-tilted ellipses.

const ORRERY = {
  name: 'The Orrery of Los Feliz',
  era: 'found · undated',
  note: `We were tipped off by a news item coupled with the creditors’ lawsuits against Peter Hight, our synchronicity sensitives finding a common link between the two. The news item said that the FCC was investigating a pirate radio station somewhere in the Los Feliz area. It was buried in the local section of the Times. The creditors were a foundry, a warehouse and a sculpture studio, trying to get paid for some very large pieces they had made. We tracked the warehouse down and with a little persuasion convinced the landlord to let us in.

Inside was an orrery – a moving sculpture, a representation of the solar system. It was about 30 feet high, the peak poking out of the warehouse skylights. A gargantuan thing, but it moved without a sound. All nine planets and their moons, the asteroid belt, and a few other unidentified cosmic objects were represented. Great bronze balls swirled around the center spike of steel and wood, painted a most royal purple. The pinnacle was in fact a miniature radio telescope, pointed straight up, and it was still on, receiving information from the heavens. What is most interesting about the orrery – apart from it having been built in the first place – is that the orbits of the planets are precisely and mathematically laid out with an error tolerance approaching perfection.

Our investigation into Peter Hight is pending, but from all appearances he appears to be an unlikely candidate to construct such a thing. A dropout of community college.`,
};

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
  return { boltGeo, boltMat };
}

// A welded brace from a point on the mast out to a point on a ring —
// what keeps every ring reading as bolted to the same structure instead
// of floating independently.
function addStrut(parent, fromY, toRadius, toY, angle, mat) {
  const from = new THREE.Vector3(0, fromY, 0);
  const to = new THREE.Vector3(Math.cos(angle) * toRadius, toY, Math.sin(angle) * toRadius);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dist = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(dist * 0.012, dist * 0.012, dist, 6);
  const strut = new THREE.Mesh(geo, mat);
  strut.position.copy(mid);
  strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  parent.add(strut);
  return strut;
}

function buildOrrery(preview) {
  const group = new THREE.Group();
  const steelMat = steelMaterial(preview);
  const mastMat = paintedMastMaterial(preview);
  const bronzeMat = bronzeMaterial();

  // ─── The mast — steel and wood, painted royal purple, built as a welded
  // lattice tower rather than a smooth pole: a core shaft plus a handful of
  // riveted collar flanges with diagonal cross-braces between them. ───────
  const mastHeight = preview ? 3.2 : 4.4;
  const baseY = preview ? -1.1 : -1.5;
  const coreGeo = new THREE.CylinderGeometry(preview ? 0.05 : 0.06, preview ? 0.09 : 0.11, mastHeight, 8);
  const core = new THREE.Mesh(coreGeo, mastMat);
  core.position.y = baseY + mastHeight / 2;
  group.add(core);

  const collarCount = preview ? 3 : 5;
  const collarGeo = new THREE.TorusGeometry(preview ? 0.1 : 0.13, 0.012, 5, 6);
  let prevCollarY = null;
  for (let i = 0; i < collarCount; i++) {
    const y = baseY + (i / (collarCount - 1)) * mastHeight;
    const collar = new THREE.Mesh(collarGeo, steelMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = y;
    group.add(collar);
    if (!preview && prevCollarY !== null) {
      const braceGeo = new THREE.CylinderGeometry(0.008, 0.008, Math.hypot(mastHeight / (collarCount - 1), 0.1) * 1.3, 5);
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

  // A bolted control box near the base — the actual click/hover target,
  // with one small amber indicator lamp lit, the kind of after-the-fact
  // gauge box a scrap-built machine like this would have bolted on.
  const hubGeo = new THREE.BoxGeometry(preview ? 0.22 : 0.28, preview ? 0.16 : 0.2, preview ? 0.16 : 0.2);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.7, metalness: 0.4 });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.position.set(preview ? 0.16 : 0.2, baseY + 0.3, 0);
  group.add(hub);
  const lampGeo = new THREE.SphereGeometry(preview ? 0.035 : 0.045, 8, 8);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xffaa33, emissiveIntensity: 1, roughness: 0.4 });
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(0, (preview ? 0.16 : 0.2) * 0.6, (preview ? 0.16 : 0.2) * 0.6);
  hub.add(lamp);

  // ─── The radio telescope — "still on, receiving information from the
  // heavens." A rough sheet-metal dish, a thin antenna rod, a pulsing bulb
  // standing in for the received signal. ───────────────────────────────────
  const dishGroup = new THREE.Group();
  dishGroup.position.y = baseY + mastHeight;
  const dishGeo = new THREE.ConeGeometry(preview ? 0.2 : 0.26, preview ? 0.16 : 0.22, 8, 1, true);
  const dish = new THREE.Mesh(dishGeo, steelMat);
  dish.rotation.x = Math.PI;
  dishGroup.add(dish);
  const antennaGeo = new THREE.CylinderGeometry(0.008, 0.008, preview ? 0.16 : 0.22, 5);
  const antenna = new THREE.Mesh(antennaGeo, steelMat);
  antenna.position.y = preview ? 0.14 : 0.18;
  dishGroup.add(antenna);
  const signalMat = new THREE.MeshStandardMaterial({ color: 0xffe8bb, emissive: 0xffcc77, emissiveIntensity: 1, transparent: true, opacity: 0.8 });
  const signal = new THREE.Mesh(new THREE.SphereGeometry(preview ? 0.03 : 0.04, 8, 8), signalMat);
  signal.position.y = preview ? 0.24 : 0.32;
  dishGroup.add(signal);
  group.add(dishGroup);

  // ─── Nine planets and their moons — close to coplanar, precisely spaced,
  // each ring braced back to the mast so it reads as one welded machine. ──
  const orbits = [];
  const bodyCount = preview ? 5 : 9;
  const moonIndices = new Set(preview ? [1, 3] : [1, 3, 5, 7]);
  const TILT_BASE = 0.52;
  const TILT_JITTER = 0.03;
  const ringYBase = baseY + mastHeight * 0.32;

  for (let i = 0; i < bodyCount; i++) {
    const radius = (preview ? 0.55 : 0.68) + i * (preview ? 0.3 : 0.4);
    const tilt = TILT_BASE + (Math.random() - 0.5) * TILT_JITTER;
    const yOffset = ringYBase + i * (preview ? 0.06 : 0.05);

    const ringGeo = new THREE.TorusGeometry(radius, preview ? 0.008 : 0.01, 6, 16);
    const ring = new THREE.Mesh(ringGeo, steelMat);
    ring.rotation.x = Math.PI / 2 + tilt;
    ring.position.y = yOffset;
    group.add(ring);
    addBolts(ring, preview ? 0.012 : 0.015, 16, radius);

    // Two struts per ring, bracing it back to the mast — visible welded
    // supports, not an independently floating hoop.
    [0, Math.PI].forEach(angle => addStrut(group, yOffset, radius * 0.94, yOffset, angle, steelMat));

    const pivot = new THREE.Object3D();
    pivot.rotation.x = tilt;
    pivot.position.y = yOffset;
    group.add(pivot);

    const bodyGeo = new THREE.SphereGeometry((preview ? 0.032 : 0.042) + (i % 3) * 0.007, 12, 12);
    const body = new THREE.Mesh(bodyGeo, bronzeMat);
    body.position.x = radius;
    pivot.add(body);
    // A short mounting arm — the ball rides a bracket on the ring, not
    // floats free above it.
    const armGeo = new THREE.CylinderGeometry(0.006, 0.006, preview ? 0.03 : 0.04, 5);
    const arm = new THREE.Mesh(armGeo, steelMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = radius - (preview ? 0.015 : 0.02);
    pivot.add(arm);

    const orbit = { pivot, speed: 0.16 - i * 0.011 + Math.random() * 0.015, direction: i % 2 === 0 ? 1 : -1, moon: null };

    if (moonIndices.has(i)) {
      const moonPivot = new THREE.Object3D();
      body.add(moonPivot);
      const moonGeo = new THREE.SphereGeometry(preview ? 0.01 : 0.013, 8, 8);
      const moon = new THREE.Mesh(moonGeo, bronzeMat);
      moon.position.x = preview ? 0.065 : 0.085;
      moonPivot.add(moon);
      orbit.moon = { pivot: moonPivot, speed: 0.7 + Math.random() * 0.3 };
    }

    orbits.push(orbit);
  }

  const lastRadius = (preview ? 0.55 : 0.68) + (bodyCount - 1) * (preview ? 0.3 : 0.4);
  const lastY = ringYBase + (bodyCount - 1) * (preview ? 0.06 : 0.05);

  // ─── The asteroid belt — scrap and debris, not a glowing line: small
  // angular chunks scattered in a band just past the last planet ring. ────
  const beltRadius = lastRadius + (preview ? 0.24 : 0.32);
  const beltY = lastY + (preview ? 0.05 : 0.06);
  const beltGroup = new THREE.Group();
  beltGroup.position.y = beltY;
  group.add(beltGroup);
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.85, metalness: 0.3 });
  const debrisGeo = new THREE.IcosahedronGeometry(1, 0);
  const beltCount = preview ? 14 : 30;
  for (let i = 0; i < beltCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = beltRadius + (Math.random() - 0.5) * (preview ? 0.1 : 0.14);
    const chunk = new THREE.Mesh(debrisGeo, debrisMat);
    const s = (preview ? 0.012 : 0.016) + Math.random() * (preview ? 0.01 : 0.014);
    chunk.scale.setScalar(s);
    chunk.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.05, Math.sin(a) * r);
    chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    beltGroup.add(chunk);
  }
  [0, Math.PI / 2].forEach(angle => addStrut(group, lastY, beltRadius * 0.96, beltY, angle, steelMat));

  // ─── "A few other unidentified cosmic objects" — welded on cantilevered
  // booms just past the belt, close enough to read as part of the same
  // machine, each one tumbling on its own slow spin. ──────────────────────
  const unknowns = [];
  const unknownGeos = [new THREE.IcosahedronGeometry(preview ? 0.05 : 0.07, 0), new THREE.OctahedronGeometry(preview ? 0.045 : 0.06, 0)];
  const unknownMat = new THREE.MeshStandardMaterial({ color: 0x5a4d3a, roughness: 0.7, metalness: 0.5 });
  const unknownCount = preview ? 1 : 2;
  for (let i = 0; i < unknownCount; i++) {
    const radius = beltRadius + (preview ? 0.22 : 0.3) + i * (preview ? 0.16 : 0.22);
    const y = beltY + (i + 1) * (preview ? 0.05 : 0.06);
    const angle = i * (Math.PI * 0.7);
    const pivot = new THREE.Object3D();
    pivot.position.y = y;
    group.add(pivot);
    const mesh = new THREE.Mesh(unknownGeos[i % unknownGeos.length], unknownMat);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    pivot.add(mesh);
    addStrut(group, y, radius * 0.9, y, angle, steelMat);
    unknowns.push({ pivot, mesh, speed: 0.05 + Math.random() * 0.03, direction: i % 2 === 0 ? 1 : -1, spin: 0.3 + Math.random() * 0.4 });
  }

  return { group, hitTarget: hub, hubMat, lampMat, orbits, unknowns, signal, signalMat, baseY, mastHeight };
}

// ─── The warehouse — floor, a ceiling with a skylight cut into it, a
// couple of corrugated walls, and a shaft of light falling through the
// hole the orrery's peak actually pokes through. ─────────────────────────
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

function buildWarehouse(preview, floorY, ceilingY) {
  const group = new THREE.Group();
  const span = preview ? 14 : 20;

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

  // A soft shaft of light falling through the hole.
  const beamGeo = new THREE.CylinderGeometry(holeW * 0.4, holeW * 2.2, ceilingY - floorY, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xcfe0ff, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = (ceilingY + floorY) / 2;
  group.add(beam);

  // A couple of dark corrugated walls, back and to one side — just enough
  // to frame the space without boxing the camera in.
  const wallMat = new THREE.MeshStandardMaterial({ map: makeCorrugatedTexture(), roughness: 0.9, metalness: 0.2 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, ceilingY - floorY), wallMat);
  backWall.position.set(0, (ceilingY + floorY) / 2, -span);
  group.add(backWall);
  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, ceilingY - floorY), wallMat);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-span, (ceilingY + floorY) / 2, 0);
  group.add(sideWall);

  return { group, floorMat, ceilingMat, beamMat, wallMat };
}

export function createOrrery(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(52, w / h, 0.1, 500);
  camera.position.set(preview ? 1.6 : 2.2, preview ? 0.4 : 0.5, preview ? 8.5 : 10.5);
  camera.lookAt(0, preview ? -0.2 : -0.3, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x030303, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  // ─── Lighting — a dim industrial ambience, a cool wash falling through
  // the skylight, a warm accent low down near the machine itself. ────────
  scene.add(new THREE.HemisphereLight(0x556677, 0x0a0806, 0.55));
  const skyLight = new THREE.DirectionalLight(0xcfe0ff, 0.9);
  skyLight.position.set(0.4, 6, 0.3);
  scene.add(skyLight);
  const workLight = new THREE.PointLight(0xffaa55, 0.6, preview ? 6 : 9);
  workLight.position.set(1.2, -0.6, 1.4);
  scene.add(workLight);

  const orrery = buildOrrery(preview);
  const floorY = orrery.baseY - 0.05;
  const ceilingY = orrery.baseY + orrery.mastHeight + (preview ? 0.35 : 0.5);
  const warehouse = buildWarehouse(preview, floorY, ceilingY);

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
        background: #0a0908; border-left: 1px solid rgba(220,200,180,0.15);
        padding: 3rem 2rem; transform: translateX(100%);
        transition: transform .5s cubic-bezier(.16,1,.3,1);
        overflow-y: scroll; z-index: 10;
        scrollbar-color: rgba(220,200,180,0.3) #0a0908; scrollbar-width: thin;
        font-family: 'Electrolize', sans-serif;
      }
      #orrery-panel.open { transform: translateX(0); }
      #orrery-panel-title {
        font-size: 0.65rem; letter-spacing: 0.3em; text-transform: uppercase;
        color: rgba(255,255,255,0.5); margin-bottom: 0.4rem;
      }
      #orrery-panel-era {
        font-size: 0.7rem; letter-spacing: 0.05em; color: rgba(255,255,255,0.3);
        margin-bottom: 1.6rem; font-style: italic;
      }
      #orrery-panel-note {
        font-size: 0.92rem; line-height: 1.85; color: rgba(225,218,205,0.68);
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
        position: fixed; color: rgba(255,255,255,0.3);
        text-transform: uppercase; pointer-events: none; text-align: center;
        z-index: 202; font-family: 'Times New Roman', serif;
      }
      #orrery-hint {
        top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
        line-height: 1.8; text-align: right;
      }
      #orrery-caption {
        bottom: 2rem; left: 50%; transform: translateX(-50%);
        font-size: clamp(0.7rem, 1.6vw, 0.95rem); letter-spacing: 0.08em;
        white-space: nowrap; font-style: italic; text-transform: none;
        color: rgba(255,255,255,0.4);
      }
      @media (max-width: 600px) {
        #orrery-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Panel (full only) ────────────────────────────────────────────────────
  let panel = null, panelTitle = null, panelEra = null, panelNote = null;
  let hint = null, caption = null;
  if (!preview) {
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
    hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; click the control box';
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
      container.style.cursor = hovered ? 'pointer' : 'default';
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
      if (!hovered) return;
      selected = true;
      setEmphasis(true);
      openPanel();
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
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  container.addEventListener('wheel', e => {
    if (panel && panel.contains(e.target)) return;
    camera.position.z = Math.max(7, Math.min(24, camera.position.z + e.deltaY * 0.01));
  });

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.001;

    orrery.orbits.forEach(o => {
      o.pivot.rotation.y += o.speed * o.direction * 0.01;
      if (o.moon) o.moon.pivot.rotation.y += o.moon.speed * 0.02;
    });
    orrery.unknowns.forEach(u => {
      u.pivot.rotation.y += u.speed * u.direction * 0.01;
      u.mesh.rotation.x += u.spin * 0.01;
      u.mesh.rotation.y += u.spin * 0.007;
    });

    // The radio telescope's received-signal pulse.
    orrery.signalMat.emissiveIntensity = 0.6 + Math.abs(Math.sin(t * 4)) * 1.2;

    if (autoRotate && !isDragging) {
      root.rotation.y += preview ? 0.0009 : 0.0006;
    }

    if (!hovered && !selected) {
      orrery.hitTarget.scale.setScalar(1.0 + Math.sin(t * 8) * 0.03);
    }

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
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
      renderer.domElement.remove();
    }
  };
}
