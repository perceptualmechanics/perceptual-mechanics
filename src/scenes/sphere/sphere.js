import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getOutboundLinks, getInboundLinks } from '../../links.js';
import { bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, createPanelCloser, createJumpList, bindTapVsDrag, parseHTML, wireCrossLinks, formatInboundNote, setPanelSide, clickedLeftHalf } from '../../utils/sceneKit.js';
import sphereHtml from './sphere.html?raw';
import './sphere.css';

export function createSphere(container, { preview = false, initialPieceId = null, onPieceChange = null } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  // ─── Scene ───────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.z = preview ? 5.5 : 3.8;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.domElement.setAttribute('aria-hidden', 'true'); // visual only
  container.appendChild(renderer.domElement);

  // Programmatically focusable so closing the panel (✕, outside click, or
  // Escape) has somewhere real to send focus back to, rather than leaving
  // it on a now-hidden close button or nowhere at all.
  if (!preview) container.tabIndex = -1;

  // CSS2D only for full experience
  let labelRenderer = null;
  if (!preview) {
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w, h);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelRenderer.domElement.style.zIndex = '1';
    container.appendChild(labelRenderer.domElement);
  }

  // ─── Lighting ─────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xc8d8ff, 1.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(4, 3, 4);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x88aaff, 0.8);
  rimLight.position.set(-4, 1, -3);
  scene.add(rimLight);
  const fillLight = new THREE.DirectionalLight(0xffd8aa, 0.4);
  fillLight.position.set(1, -3, 2);
  scene.add(fillLight);

  // ─── Geometry ─────────────────────────────────────────────────────────────
  // Geodesic sphere subdivision: this is genuine geodesic geometry, but the
  // subdivision math itself is Three.js's built-in, not custom code here.
  // IcosahedronGeometry starts from the 20 equilateral-triangle faces of a
  // regular icosahedron (the most sphere-like Platonic solid) and recursively
  // splits each triangle into 4 smaller ones `detail` times, then pushes
  // every new vertex out to the target radius — the classic way to build a
  // near-uniform triangular mesh over a sphere (also how geodesic domes are
  // built). `detail` is TUNABLE: 0 = the bare 20-face icosahedron facets
  // visibly, 2 (current) = 20 * 4^2 = 320 faces, smooth enough to read as a
  // sphere while still showing individual flat facets up close; each +1 in
  // detail quadruples the face count and rendering cost. The radius (1.4) is
  // also freely TUNABLE — it only scales the sphere, no downstream coupling.
  // `.toNonIndexed()` duplicates shared vertices per-face so each triangle
  // can be colored independently below (an indexed geometry would force
  // every face touching a shared vertex to share that vertex's color).
  const detail = 2;
  const geo = new THREE.IcosahedronGeometry(1.4, detail).toNonIndexed();
  const faceCount = geo.attributes.position.count / 3;

  const palette = [
    new THREE.Color(0x4a7fb5), new THREE.Color(0x5d9bc7),
    new THREE.Color(0x3a6a9a), new THREE.Color(0x6aadd4),
    new THREE.Color(0x4e8ab8), new THREE.Color(0x7ab8d8),
  ];

  // Per-face color assignment: not random, but not a simple repeat either.
  // Base color cycles through the 6-color palette by face index (i %
  // palette.length), so neighboring faces get different but non-random
  // colors. `nudge` is a small deterministic "dither" added on top —
  // (i * 13) % 7 walks through the 7 residues {0..6} in a fixed but
  // non-sequential order as i increases (13 and 7 share no common factor,
  // so this cycles through all 7 values before repeating, avoiding the
  // banding a simple i % 7 would show against the 6-color palette cycle).
  // Dividing by 40 keeps the nudge subtle (small brightness variation, not
  // a color change). r/g/b are nudged by different fractions of it
  // (nudge, nudge*0.5, -nudge*0.2) purely so the dither reads as a warm/cool
  // shift rather than a flat brightness change. TUNABLE: the palette colors
  // themselves, and the 40 divisor (smaller = more visible per-face
  // variegation, larger = flatter/more uniform faces).
  const colors = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < faceCount; i++) {
    const base = palette[i % palette.length].clone();
    const nudge = ((i * 13) % 7) / 40;
    base.r = Math.min(1, base.r + nudge);
    base.g = Math.min(1, base.g + nudge * 0.5);
    base.b = Math.min(1, base.b - nudge * 0.2);
    for (let v = 0; v < 3; v++) {
      const vi = (i * 3 + v) * 3;
      colors[vi] = base.r; colors[vi+1] = base.g; colors[vi+2] = base.b;
    }
  }
  const baseColors = colors.slice();
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshPhongMaterial({
    vertexColors: true, shininess: 40, specular: new THREE.Color(0x334466),
  });
  const sphere = new THREE.Mesh(geo, mat);
  scene.add(sphere);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.403, detail),
    new THREE.MeshBasicMaterial({ color: 0x4466aa, wireframe: true, transparent: true, opacity: 0.5 })
  );
  scene.add(wire);

  // ─── Labels (full only) ───────────────────────────────────────────────────
  const labelData = [];

  // ─── Interaction (full only) ───────────────────────────────────────────────
  const hoverColor    = new THREE.Color(0xf0c060);
  const selectedColor = new THREE.Color(0xf5a020);
  let hoveredFace = -1, selectedFace = -1;

  function setFaceColor(fi, color) {
    for (let v = 0; v < 3; v++) {
      const vi = (fi * 3 + v) * 3;
      colors[vi] = color.r; colors[vi+1] = color.g; colors[vi+2] = color.b;
    }
    geo.attributes.color.needsUpdate = true;
  }
  function restoreFaceColor(fi) {
    for (let v = 0; v < 3; v++) {
      const vi = (fi * 3 + v) * 3;
      colors[vi] = baseColors[vi]; colors[vi+1] = baseColors[vi+1]; colors[vi+2] = baseColors[vi+2];
    }
    geo.attributes.color.needsUpdate = true;
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Panel (full only)
  let panel = null, panelContent = null, panelTitle = null, facetIdEl = null, hint = null;
  let wheelZoom = null, panelCloser = null, jumpList = null;
  // Named so dispose() can remove them — container is the shared
  // #experience-container element every scene reuses (main.js only clears
  // its innerHTML between scenes, never replaces the node), so a listener
  // bound directly to it and never removed keeps firing after this scene
  // is gone, reading stale closures against a disposed scene.
  let onContainerMouseMove = null, onContainerClick = null, touchGuard = null;
  // Set inside the deferred full-mode block below, once openFragment
  // actually exists — kept at this outer scope so the returned
  // openPieceById() (deep-link support, main.js) can reach it without
  // openFragment itself needing to be anything other than a plain
  // block-scoped function.
  let openFragmentRef = null;
  // Fragment content (sphere.text.js) is dynamically imported below, only
  // in full mode — a preview thumbnail never renders labels or opens the
  // fragment panel, so it never needs this text (v3.10.3, same shape as
  // harmonics.js's v3.10.1 fix). fragmentsRef is set once the import
  // resolves; openPieceById() below guards on it being non-null.
  // `disposed` lets the async continuation no-op if the scene is torn
  // down before the import finishes (a fast scene switch).
  let fragmentsRef = null;
  let disposed = false;

  if (!preview) {
    import('./sphere.text.js').then(({ fragments }) => {
      if (disposed) return;
      fragmentsRef = fragments;

      // ─── Labels ─────────────────────────────────────────────────────────
      if (labelRenderer) {
        function stripHtml(html) {
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
        }
        function randomExcerpt(fi) {
          const plain = stripHtml(fragments[fi].text);
          if (plain.length <= 40) return plain;
          const maxStart = Math.max(0, plain.length - 60);
          const start = Math.floor(Math.random() * maxStart);
          const wordStart = plain.indexOf(' ', start);
          const from = wordStart === -1 ? start : wordStart + 1;
          return plain.slice(from, from + 55);
        }

        // Label styles live in styles/scenes/sphere.css (.face-label, @keyframes
        // wisp) — no runtime injection needed now that it's a real stylesheet.
        const pos = geo.attributes.position;
        for (let i = 0; i < faceCount; i++) {
          const fi = i % fragments.length;
          const a = new THREE.Vector3().fromBufferAttribute(pos, i * 3);
          const b = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 1);
          const c = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 2);
          const center = new THREE.Vector3().addVectors(a, b).add(c).divideScalar(3);
          const edge1 = new THREE.Vector3().subVectors(b, a);
          const edge2 = new THREE.Vector3().subVectors(c, a);
          const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
          const toA = new THREE.Vector3().subVectors(a, center).normalize();
          const upVec = toA.clone().addScaledVector(normal, -toA.dot(normal)).normalize();
          const div = document.createElement('div');
          div.className = 'face-label';
          div.textContent = randomExcerpt(fi);
          div.style.setProperty('--duration', `${4 + Math.random() * 6}s`);
          div.style.setProperty('--delay', `${-Math.random() * 8}s`);
          const label = new CSS2DObject(div);
          label.position.copy(center.clone().multiplyScalar(1.01));
          sphere.add(label);
          labelData.push({ label, normal, upVec, div });
        }
      }

      // ─── Panel ──────────────────────────────────────────────────────────
      // Shell markup (hint paragraph + panel skeleton) lives in
      // sphere.html — see that file's own header comment for why it's
      // several top-level pieces with different mount points. The hint
      // matches orbiter/orrery's treatment: fixed top-right, z-index 310
      // (must clear #experience-overlay — see styles/main.css's z-index-scale
      // comment), Arapey regardless of the scene's own body font, since
      // hints are chrome, not scene content, and read as one consistent
      // voice across the whole site. This scene briefly gained a bottom-
      // center title in the 2026-08-25 site-wide title consistency pass;
      // removed again same day per Scott's call — no title chrome here.
      const frag = parseHTML(sphereHtml);
      hint = frag.querySelector('.sphere-hint');
      document.body.appendChild(hint);

      panel = frag.querySelector('.sphere-panel');
      container.style.position="relative";container.style.overflow="hidden";container.appendChild(panel);
      panelTitle   = panel.querySelector('.sphere-panel-title');
      panelContent = panel.querySelector('.sphere-panel-content');
      facetIdEl    = panel.querySelector('.sphere-facet-id');

      panelCloser = createPanelCloser(panel, container, {
        closeBtn: panel.querySelector('.sphere-panel-close'),
        onClose: () => { if (selectedFace !== -1) { restoreFaceColor(selectedFace); selectedFace = -1; } },
      });

      // Wires a fragment's `text` (already-authored, trusted HTML — real <p>
      // tags, not escaped-then-rendered plain text the way library/orbiter/
      // scroll's linkable fields are) with whatever links.js's
      // getOutboundLinks() has for it. Until 2026-08-16 these anchors were
      // hand-typed straight into sphere.text.js's `text` strings
      // (`<a class="fragment-link" data-target="Wingspan">...`); they're
      // wired at render time now, same beat as every other scene, so the
      // links live in one place (src/links.js) instead of half of them
      // sitting inline in prose and the other half in per-scene tables.
      function renderFragmentHtml(fragment) {
        const links = getOutboundLinks('sphere', fragment.id, 'text');
        return wireCrossLinks(fragment.text, links, 'fragment-link');
      }

      // The inbound half of a links.js relationship — "Referenced from X" —
      // appended to the same facetIdEl line every fragment already shows
      // ("Fragment N of 25"), rather than a separate element, so a piece
      // that's only ever a target still visibly carries the connection
      // instead of the link only being discoverable by clicking through from
      // the source. Plain text, not a link: there's no phrase here to jump
      // from, only the fact of being referenced (see sceneKit.js's
      // formatInboundNote for why this doesn't try to construct one).
      function withInboundNote(fragmentId, base) {
        const note = formatInboundNote(
          getInboundLinks('sphere', fragmentId).map(l => fragments.find(f => f.id === l.from.id)?.title)
        );
        return note ? `${base} · ${note}` : base;
      }

      // Fragment link navigation — follow the threads (click + keyboard)
      function navigateToFragment(link) {
        // Same not-yet-cross-scene note as the other three linked scenes:
        // every link in the shared store currently targets 'sphere' itself.
        if (link.dataset.targetScene !== 'sphere') return;
        const targetIdx = fragments.findIndex(f => f.id === Number(link.dataset.targetId));
        if (targetIdx === -1) return;
        onPieceChange?.(fragments[targetIdx].id);
        panelContent.style.transition = 'opacity .18s';
        panelTitle.style.transition = 'opacity .18s';
        panelContent.style.opacity = '0';
        panelTitle.style.opacity = '0';
        setTimeout(() => {
          panelTitle.textContent = fragments[targetIdx].title;
          panelContent.innerHTML = renderFragmentHtml(fragments[targetIdx]);
          facetIdEl.textContent = withInboundNote(fragments[targetIdx].id, `Fragment ${targetIdx + 1} of ${fragments.length} · ${fragments[targetIdx].title}`);
          panelContent.scrollTop = 0;
          panelContent.style.opacity = '1';
          panelTitle.style.opacity = '1';
          // Stagger glimmer delays + a11y attributes
          panelContent.querySelectorAll('.fragment-link').forEach(link => {
            const delay = (Math.random() * 12).toFixed(1);
            const duration = (9 + Math.random() * 7).toFixed(1);
            link.style.animationDelay = `-${delay}s`;
            link.style.animationDuration = `${duration}s`;
            // role="link", not "button" -- this navigates to different
            // content within the panel, same as library.js's .library-link.
            link.setAttribute('role', 'link');
            link.setAttribute('tabindex', '0');
            const targetFrag = link.dataset.targetScene === 'sphere'
              ? fragments.find(f => f.id === Number(link.dataset.targetId))
              : null;
            link.setAttribute('aria-label', `Navigate to fragment: ${targetFrag ? targetFrag.title : 'related fragment'}`);
          });
        }, 180);
      }

      // Populate the panel with fragment `fi` and open it — shared by the
      // facet click handler below and the keyboard jump list (createJumpList,
      // sceneKit.js), which has no click position of its own to derive a
      // slide-in side from, hence `fromLeft` being optional.
      function openFragment(fi, { facetLabel, fromLeft } = {}) {
        onPieceChange?.(fragments[fi].id);
        const populate = () => {
          panelTitle.textContent = fragments[fi].title;
          panelContent.innerHTML = renderFragmentHtml(fragments[fi]);
          facetIdEl.textContent  = withInboundNote(fragments[fi].id, facetLabel ?? `Fragment ${fi + 1} of ${fragments.length}`);
          // Stagger glimmer delays + a11y
          panelContent.querySelectorAll('.fragment-link').forEach(link => {
            const delay = (Math.random() * 12).toFixed(1);
            const duration = (9 + Math.random() * 7).toFixed(1);
            link.style.animationDelay = `-${delay}s`;
            link.style.animationDuration = `${duration}s`;
            // role="link" -- see the matching comment in navigateToFragment()
            // above.
            link.setAttribute('role', 'link');
            link.setAttribute('tabindex', '0');
            const targetFrag = link.dataset.targetScene === 'sphere'
              ? fragments.find(f => f.id === Number(link.dataset.targetId))
              : null;
            link.setAttribute('aria-label', `Navigate to fragment: ${targetFrag ? targetFrag.title : 'related fragment'}`);
          });
        };

        const wasOpen = panel.classList.contains('open');
        const sideMismatch = fromLeft !== undefined && panel.classList.contains('from-left') !== fromLeft;

        if (wasOpen && sideMismatch) {
          // Crossing to the other side of an already-open panel: close first,
          // then reopen anchored to the new side once the close transition
          // finishes. Flipping from-left instantly while open would teleport
          // the fully-visible panel sideways instead of visibly relocating it
          // the way a fresh open does. Same pattern as library.js's panel.
          panel.classList.remove('open');
          setTimeout(() => {
            setPanelSide(panel, fromLeft);
            populate();
            panelContent.scrollTop = 0;
            panelContent.style.opacity = '1'; // guard against a same-side fade still in flight
            panelTitle.style.opacity = '1';
            panel.classList.add('open');
            setTimeout(() => panelTitle.focus(), 50);
          }, 500); // matches .sphere-panel's own close transition (transform .5s, sphere.css)
          return;
        }

        if (!wasOpen && sideMismatch) setPanelSide(panel, fromLeft);

        populate();
        panel.classList.add('open');
        // Move focus to panel for screen readers
        setTimeout(() => panelTitle.focus(), 50);
      }

      // Keyboard equivalent for "point at a facet" — facets themselves are
      // otherwise raycast-only. One button per fragment (not per facet —
      // several facets can map to the same fragment via the
      // `% fragments.length` below, so a facet isn't a meaningful unit for a
      // visitor who can't see the geometry). Doesn't attempt to also
      // highlight a facet in the 3D view; that's a decorative affordance for
      // the mouse/touch path, not essential to reading the fragment.
      jumpList = createJumpList(container, {
        label: 'Read a fragment from the sphere',
        items: fragments,
        getLabel: f => f.title,
        onSelect: (f, fi) => openFragment(fi, { fromLeft: false }),
      });

      openFragmentRef = openFragment;

      panelContent.addEventListener('click', e => {
        const link = e.target.closest('.fragment-link');
        if (!link) return;
        e.stopPropagation();
        navigateToFragment(link);
      });

      panelContent.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const link = e.target.closest('.fragment-link');
        if (!link) return;
        e.preventDefault();
        e.stopPropagation();
        navigateToFragment(link);
      });

      onContainerMouseMove = e => {
        const rect = container.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObject(sphere);
        const newHover = hits.length ? hits[0].faceIndex : -1;
        if (newHover !== hoveredFace) {
          if (hoveredFace !== -1 && hoveredFace !== selectedFace) restoreFaceColor(hoveredFace);
          hoveredFace = newHover;
          if (hoveredFace !== -1 && hoveredFace !== selectedFace) setFaceColor(hoveredFace, hoverColor);
        }
        container.style.cursor = hoveredFace !== -1 ? 'pointer' : 'default';
      };
      container.addEventListener('mousemove', onContainerMouseMove);

      touchGuard = bindTapVsDrag(container);
      onContainerClick = e => {
        if (touchGuard.consume()) return;
        // Only close on an actual empty-space click — a click that hits a
        // facet should swap the panel's content in place instead of closing
        // it. hoveredFace is tracked live by mousemove above regardless of
        // panel state, so it's already known here.
        if (panel.classList.contains('open') && hoveredFace === -1) {
          panelCloser.close();
          return;
        }
        if (hoveredFace === -1) return;
        if (selectedFace !== -1 && selectedFace !== hoveredFace) restoreFaceColor(selectedFace);
        selectedFace = hoveredFace;
        setFaceColor(selectedFace, selectedColor);
        const fi = selectedFace % fragments.length;
        const rect = container.getBoundingClientRect();
        openFragment(fi, {
          facetLabel: `Facet ${selectedFace} · Fragment ${fi + 1} of ${fragments.length}`,
          fromLeft: clickedLeftHalf(e, rect),
        });
      };
      container.addEventListener('click', onContainerClick);

      wheelZoom = bindWheelZoom(container, {
        isBlocked: e => panel && panel.contains(e.target),
        onZoom: deltaY => {
          camera.position.z = Math.max(1.8, Math.min(6, camera.position.z + deltaY * 0.005));
        },
      });

      // Deep-link entry — a fresh load of #sphere/<id> opens straight to
      // that fragment instead of the sphere's plain default (nothing
      // selected). An id that doesn't resolve is silently ignored, same
      // defensive stance sceneFromHash/parseHash take in main.js for a
      // scene name that doesn't exist.
      if (initialPieceId !== null) {
        const initialIdx = fragments.findIndex(f => f.id === initialPieceId);
        if (initialIdx !== -1) openFragment(initialIdx, { fromLeft: false });
      }
    });
  }

  // ─── Drag to rotate (mouse + touch, via sceneKit) ──────────────────────────
  // bindOrbitDrag unifies mouse and touch input for rotating the sphere.
  let autoRotate = true;
  const orbitDrag = bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      sphere.rotation.y += dx;
      sphere.rotation.x += dy;
      wire.rotation.copy(sphere.rotation);
    },
    onDragEnd: () => { setTimeout(() => { autoRotate = true; }, 2000); },
  });

  // Reduced motion: gates the sphere's autonomous auto-rotate. Drag-to-
  // rotate stays available regardless — that's visitor-initiated motion,
  // not motion imposed on them.
  const reduceMotion = prefersReducedMotion();

  // ─── Resize ───────────────────────────────────────────────────────────────
  const resize = bindGuardedResize(container, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (labelRenderer) labelRenderer.setSize(w, h);
  });

  // ─── Animate ──────────────────────────────────────────────────────────────
  const cameraDir = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  const worldUp = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  function projectToScreen(vec3) {
    const v = vec3.clone().project(camera);
    return {
      x: ( v.x * 0.5 + 0.5) * container.clientWidth,
      y: (-v.y * 0.5 + 0.5) * container.clientHeight,
    };
  }

  let lightAngle = 0;
  let animId;

  function animate() {
    animId = requestAnimationFrame(animate);
    lightAngle += 0.003;

    if (autoRotate && !reduceMotion) {
      sphere.rotation.y += 0.0015;
      sphere.rotation.x += 0.0003;
      wire.rotation.copy(sphere.rotation);
    }

    keyLight.position.set(Math.cos(lightAngle)*5, 3, Math.sin(lightAngle)*5);
    rimLight.position.set(Math.cos(lightAngle+Math.PI)*4, Math.sin(lightAngle*.7)*2, Math.sin(lightAngle+Math.PI)*4);
    fillLight.position.set(Math.sin(lightAngle*.5)*3, -3, Math.cos(lightAngle*.5)*3);

    if (!preview && labelData.length) {
      // Label distance-scaling: real inverse relationship (scale ∝ 1/camDist)
      // so labels keep a roughly constant apparent size as the camera zooms,
      // clamped to [0.5, 3.0] so they don't vanish or balloon at the zoom
      // extremes. 3.8 (chosen to match the default camera.position.z, i.e.
      // scale = 1 at the starting distance) is TUNABLE as an overall
      // label-size dial; the clamp bounds are TUNABLE for how much they're
      // allowed to grow/shrink before hitting a floor/ceiling.
      camera.getWorldDirection(cameraDir);
      normalMatrix.getNormalMatrix(sphere.matrixWorld);
      const camDist = camera.position.z;
      const scale = Math.max(0.5, Math.min(3.0, 3.8 / camDist));

      for (const { label, normal, upVec, div } of labelData) {
        // Backface visibility test: a label should only show on the side of
        // the sphere facing the camera. worldNormal is the face's outward
        // normal transformed into world space by the sphere's current
        // rotation; cameraDir is the direction the camera is looking. Their
        // dot product is the cosine of the angle between them — it's -1
        // when the normal points straight at the camera (face fully facing
        // us) and +1 when it points straight away (face on the far side).
        // `dot < -0.1` (rather than < 0) gives a small buffer past the true
        // silhouette edge so labels don't flicker in and out right at the
        // horizon of the sphere as it rotates. TUNABLE: -0.1 trades label
        // visibility duration (less negative = labels appear/disappear
        // closer to face-on, more negative = they linger further round the
        // curve before hiding).
        worldNormal.copy(normal).applyMatrix3(normalMatrix).normalize();
        const dot = worldNormal.dot(cameraDir);
        if (dot < -0.1) {
          // Opacity ramps from 0 (right at the -0.1 visibility threshold)
          // up to a cap of 0.25 as the face turns more fully toward the
          // camera — so labels fade in near the silhouette edge instead of
          // snapping on at full strength. TUNABLE: 0.25 (max label opacity)
          // and 0.35 (how fast it ramps up) both reshape this fade.
          const opacity = Math.min(0.25, (-dot - 0.1) * 0.35);
          div.style.setProperty('--base-opacity', opacity.toFixed(3));
          div.style.visibility = 'visible';
          label.visible = true;
          div.style.fontSize = `${(7 * scale).toFixed(1)}px`;
          div.style.width    = `${(60 * scale).toFixed(0)}px`;
          div.style.height   = `${(52 * scale).toFixed(0)}px`;
          // Label rotation: to keep each label's text upright relative to
          // the sphere's surface (not the screen) as the sphere spins, we
          // project two nearby 3D points onto the 2D screen — the label's
          // center, and a point offset slightly along its local "up"
          // direction (upVec, the face's own tangent-plane up) — then use
          // atan2 on the screen-space delta between them to recover the
          // angle that direction makes on screen. atan2(dx, -dy) rather
          // than atan2(dy, dx) is just this codebase's convention for
          // measuring angle from screen-up instead of screen-right; the
          // 180/Math.PI converts the result from radians to the degrees
          // CSS rotate() expects.
          const centerWorld = label.position.clone().applyMatrix4(sphere.matrixWorld);
          worldUp.copy(upVec).applyMatrix3(normalMatrix).normalize();
          const tipWorld = centerWorld.clone().addScaledVector(worldUp, 0.15);
          const cs = projectToScreen(centerWorld);
          const ts = projectToScreen(tipWorld);
          const angle = Math.atan2(ts.x - cs.x, -(ts.y - cs.y)) * (180/Math.PI);
          div.style.transform = `rotate(${angle.toFixed(1)}deg)`;
        } else {
          div.style.visibility = 'hidden';
          label.visible = false;
        }
      }
    }

    renderer.render(scene, camera);
    if (labelRenderer) labelRenderer.render(scene, camera);
  }
  animate();

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  return {
    // Same-scene deep link support (main.js's expandScene, when the sphere
    // is already open and a new #sphere/<id> hash arrives) — opens a
    // fragment by id without tearing the scene down. No-op in preview mode
    // or if the id doesn't resolve.
    openPieceById(id) {
      // fragmentsRef is null until the dynamic import above resolves — a
      // same-scene hash change arriving in that narrow window (sub-second,
      // full mode only) is silently ignored, same defensive stance as an
      // id that doesn't resolve at all.
      if (!fragmentsRef) return;
      const idx = fragmentsRef.findIndex(f => f.id === id);
      if (idx !== -1) openFragmentRef?.(idx, { fromLeft: false });
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animId);
      orbitDrag.dispose();
      wheelZoom?.dispose();
      panelCloser?.dispose();
      jumpList?.dispose();
      touchGuard?.dispose();
      if (onContainerMouseMove) container.removeEventListener('mousemove', onContainerMouseMove);
      if (onContainerClick) container.removeEventListener('click', onContainerClick);
      resize.dispose();
      geo.dispose();
      mat.dispose();
      wire.geometry.dispose();
      wire.material.dispose();
      renderer.dispose();
      if (labelRenderer) labelRenderer.domElement.remove();
      if (panel) panel.remove();
      if (hint) hint.remove();
      renderer.domElement.remove();
    }
  };
}
