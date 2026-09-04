import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getOutboundLinks, getInboundLinks } from '../../links.js';
import { bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, onReducedMotionChange, createPanelCloser, createJumpList, bindTapVsDrag, parseHTML, wireCrossLinks, formatInboundNote, setPanelSide, clickedLeftHalf, claimContainer, manageRenderer, trackTimers, createFrameClock } from '../../utils/sceneKit.js';
// The excerpt windowing module's stripHtml, not a second one of this scene's
// own — see randomExcerpt() below for why the DOM-based copy that used to
// live there had to go.
import { stripHtml } from '../../utils/resonanceExcerpts.js';
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
  // Was a bare setPixelRatio(window.devicePixelRatio) — uncapped, so a DPR-3
  // phone rendered nine times the fragments for no visible gain. Routed
  // through manageRenderer (sceneKit) instead, which caps it at 2 and adds
  // the two things this scene never had: a real forceContextLoss() on
  // dispose (WebGLRenderer.dispose() tears down caches but leaves the GL
  // context alive, and the browser force-loses the OLDEST contexts when it
  // runs out — which are the landing tiles), and a webglcontextlost handler
  // so a lost context stops the loop instead of burning CPU against a
  // permanently black canvas.
  const managedRenderer = manageRenderer(renderer, {
    onLost: () => { cancelAnimationFrame(animId); animId = 0; },
  });
  renderer.setSize(w, h);
  renderer.domElement.setAttribute('aria-hidden', 'true'); // visual only
  container.appendChild(renderer.domElement);

  // `container` is the one shared #experience-container main.js only ever
  // empties, never replaces, so every inline style written here outlives
  // this scene unless something puts it back. claimContainer records the
  // previous values and hands back the restore() half (dispose(), below).
  // position/overflow used to be set much later, inside the dynamic
  // import's callback — which meant the CSS2D label overlay appended just
  // below was absolutely positioned against a container that wasn't yet a
  // containing block. tabIndex: -1 makes the container programmatically
  // focusable so closing the panel (✕, outside click, or Escape) has
  // somewhere real to send focus back to, rather than leaving it on a
  // now-hidden close button or nowhere at all.
  const claim = preview ? null : claimContainer(container, { tabIndex: -1 });

  // Every deferred beat in this scene goes through here — the panel's
  // side-flip reopen, the two focus hand-offs, the post-drag auto-rotate
  // resume — so dispose() drops all of them in one call. The 500ms one is
  // the consequential one: mid-flight it re-added .open to a panel that had
  // already been detached and called panelTitle.focus(), stealing focus from
  // whatever scene had just replaced this one.
  const timers = trackTimers();

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
    // The CSS2D layer holds 320 real text nodes, one per face, and each is a
    // RANDOM 60-character window cut out of a fragment — mid-word at both ends,
    // by design, because they are texture rather than reading. Unhidden, that
    // is 320 truncated sentence fragments a screen reader walks through before
    // reaching anything the scene actually offers. The WebGL canvas beside it
    // was hidden from the start; this layer was not, only because it is created
    // by three.js rather than by this file.
    labelRenderer.domElement.setAttribute('aria-hidden', 'true');
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
  // built). `detail` is TUNABLE: 0 = the bare 20-face
  // icosahedron, facets visibly; 2 (current) = 180 faces, smooth enough to read
  // as a sphere while still showing individual flat facets up close. The radius
  // (1.4) is also freely TUNABLE — it only scales the sphere, no downstream
  // coupling.
  //
  // TWO CORRECTIONS HERE, 2026-09-02, both found from a console warning.
  //
  // The arithmetic was wrong. This said "20 * 4^2 = 320 faces" and "each +1 in
  // detail quadruples the face count", and neither is true of this geometry.
  // PolyhedronGeometry splits each of the 20 base faces into (detail+1)^2
  // triangles, not 4^detail — so detail 2 is 20 * 9 = 180 faces, and the step
  // from 2 to 3 is 1.78x rather than 4x. The wrong formula happens to agree at
  // detail 0 and detail 1, which is how it survived: the two cases anyone would
  // check by hand are the two it gets right. Counted from
  // geo.attributes.position.count / 3 at three.js 185, not re-derived.
  //
  // And `.toNonIndexed()` is gone. Its stated reason is correct and is still
  // the requirement — per-face colouring needs each triangle to own its
  // vertices, since an indexed geometry would force every face touching a
  // shared vertex to share that vertex's colour. But IcosahedronGeometry is
  // ALREADY non-indexed (geo.index === null, verified at 185), so the call did
  // nothing except emit "THREE.BufferGeometry.toNonIndexed(): BufferGeometry is
  // already non-indexed" into the console on every visit. Same lesson as the
  // theater mask in STANDARDS.md: checking that a call is well-formed and
  // checking that it does anything are different checks. The requirement stays
  // written down here so a future change to the geometry knows it has to hold.
  const detail = 2;
  const geo = new THREE.IcosahedronGeometry(1.4, detail);
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
        // stripHtml is imported (src/utils/resonanceExcerpts.js), not
        // redeclared here. This scene used to carry its own DOM-based copy
        // — a live `div.innerHTML = fragment.text` per fragment, purely to
        // read the text back out — which is both a second implementation of
        // an already-shared function and the one place authored fragment
        // HTML got parsed by the browser for no rendering reason. The shared
        // one is regex-based and DOM-free (harmonicsPieces.js and
        // build-resonances-doc.mjs already use it); the one behavioral
        // difference is that it doesn't decode HTML entities, so a `&copy;`
        // in a fragment reaches a label as those six characters. These
        // labels are 7px, ≤0.25 opacity, randomly-windowed decoration —
        // worth a note, not a second stripHtml.
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
          // sizedAt: the label-scale this div's fontSize/width/height were
          // last written at. -1 is a value `scale` can never take (it is
          // clamped to [0.5, 3.0]), so the first pass always writes.
          labelData.push({ label, normal, upVec, div, sizedAt: -1, angle: 0 });
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
      container.appendChild(panel);
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
        timers.after(180, () => {
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
            // No role="link" / tabindex="0" here any more. Both were needed
            // when wireCrossLinks emitted an href-less <a>, which is neither
            // a link nor focusable to anything reading the page; as of v4.0
            // it emits a real href, so a role naming what the element
            // already is and a tabindex matching what it already has are
            // just two attributes to keep in sync with nothing.
            const targetFrag = link.dataset.targetScene === 'sphere'
              ? fragments.find(f => f.id === Number(link.dataset.targetId))
              : null;
            link.setAttribute('aria-label', `Navigate to fragment: ${targetFrag ? targetFrag.title : 'related fragment'}`);
          });
        });
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
            // No role/tabindex -- see the matching comment in
            // navigateToFragment() above.
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
          // 500ms matches .sphere-panel's own close transition (transform .5s,
          // sphere.css).
          timers.after(500, () => {
            setPanelSide(panel, fromLeft);
            populate();
            panelContent.scrollTop = 0;
            panelContent.style.opacity = '1'; // guard against a same-side fade still in flight
            panelTitle.style.opacity = '1';
            panel.classList.add('open');
            timers.after(50, () => panelTitle.focus());
          });
          return;
        }

        if (!wasOpen && sideMismatch) setPanelSide(panel, fromLeft);

        populate();
        panel.classList.add('open');
        // Move focus to panel for screen readers
        timers.after(50, () => panelTitle.focus());
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

      // stopPropagation, not preventDefault: the click must not fall through
      // to the canvas's own click-to-select handler underneath the panel, but
      // the anchor's own navigation is wanted. navigateToFragment reports the
      // new piece through onPieceChange first, which is what writes
      // #sphere/<id> into the URL, so by the time the browser follows the
      // href it is already the current URL and nothing further happens.
      //
      // There is no keydown twin of this any more. wireCrossLinks emits a
      // real <a href="#scene/id"> as of v4.0, and that URL shape is exactly
      // what main.js's hash router parses — so Enter is handled natively, by
      // the anchor, and the hash round-trip lands in openPieceById() below.
      // The hand-rolled Enter/Space handler that used to sit here existed
      // only because an href-less <a> isn't activatable; keeping it now would
      // mean re-implementing (and, for Space, contradicting) what a link
      // already does.
      panelContent.addEventListener('click', e => {
        const link = e.target.closest('.fragment-link');
        if (!link) return;
        e.stopPropagation();
        navigateToFragment(link);
      });

      onContainerMouseMove = e => {
        const rect = container.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        // `false` — Raycaster.intersectObject's `recursive` argument defaults
        // to true, and every one of the 320 CSS2DObject labels is a child of
        // `sphere` (sphere.add(label), in the label loop above). Their
        // raycast() is a no-op, but walking 320 children of a mesh whose own
        // geometry is the only thing that can ever be hit isn't free on an
        // unthrottled mousemove.
        const hits = raycaster.intersectObject(sphere, false);
        const newHover = hits.length ? hits[0].faceIndex : -1;
        if (newHover !== hoveredFace) {
          if (hoveredFace !== -1 && hoveredFace !== selectedFace) restoreFaceColor(hoveredFace);
          hoveredFace = newHover;
          if (hoveredFace !== -1 && hoveredFace !== selectedFace) setFaceColor(hoveredFace, hoverColor);
        }
        claim.setCursor(hoveredFace !== -1 ? 'pointer' : 'default');
      };
      container.addEventListener('mousemove', onContainerMouseMove);

      touchGuard = bindTapVsDrag(container);
      onContainerClick = e => {
        if (touchGuard.consume()) return;
        // Raycast from THIS event's own coordinates rather than reading
        // `hoveredFace`. hoveredFace is only ever produced by the mousemove
        // handler above, so anything that clicks without having moved a
        // mouse across the canvas first read as an empty-space click on a
        // facet: a touch tap, a synthetic click, a pointer entering over a
        // facet from outside the window. The rect is fetched here anyway for
        // clickedLeftHalf, so this costs one extra raycast on click, not a
        // second layout read.
        const rect = container.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const clickHits = raycaster.intersectObject(sphere, false);
        const clickedFace = clickHits.length ? clickHits[0].faceIndex : -1;

        // Only close on an actual empty-space click — a click that hits a
        // facet should swap the panel's content in place instead of closing
        // it.
        if (panel.classList.contains('open') && clickedFace === -1) {
          panelCloser.close();
          return;
        }
        if (clickedFace === -1) return;
        if (selectedFace !== -1 && selectedFace !== clickedFace) restoreFaceColor(selectedFace);
        selectedFace = clickedFace;
        setFaceColor(selectedFace, selectedColor);
        const fi = selectedFace % fragments.length;
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
    onDragEnd: () => { timers.after(2000, () => { autoRotate = true; }); },
  });

  // Reduced motion: gates the sphere's autonomous auto-rotate. Drag-to-
  // rotate stays available regardless — that's visitor-initiated motion,
  // not motion imposed on them. Sampled once at mount AND subscribed to,
  // so a visitor who turns the OS setting on while the sphere is already
  // open stops the spin then rather than on the next scene change.
  let reduceMotion = prefersReducedMotion();
  const reduceMotionWatch = onReducedMotionChange(m => { reduceMotion = m; });

  // ─── Resize ───────────────────────────────────────────────────────────────
  // viewW/viewH are the container's own dimensions, cached here rather than
  // read per label in projectToScreen() below. They only change on resize,
  // and reading them 320 times a frame from inside a loop that is also
  // WRITING styles is what made this scene expensive: a style write on label
  // N followed by a layout read for label N+1 leaves the browser no choice
  // but to flush a synchronous layout, once per label, every frame. Same
  // pattern beamline.js already uses for its own `viewportH`.
  let viewW = w, viewH = h;
  const resize = bindGuardedResize(container, (nw, nh) => {
    viewW = nw; viewH = nh;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    // devicePixelRatio can change with no signal other than a resize — a
    // window dragged between a Retina and a non-Retina display.
    managedRenderer.applyPixelRatio();
    if (labelRenderer) labelRenderer.setSize(nw, nh);
  });
  // The w/h this scene was constructed with fall back to window.innerWidth
  // when the container measured 0 (a hidden ancestor at mount). That was
  // self-correcting while projectToScreen read the live size every frame;
  // now that it doesn't, run the guarded handler once so viewW/viewH start
  // from a real measurement. bindGuardedResize's own 0-guard makes this a
  // no-op if the container still isn't laid out.
  resize.trigger();

  // ─── Animate ──────────────────────────────────────────────────────────────
  const cameraDir = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  const worldUp = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  // Two more of the same kind — the per-label center/tip the rotation math
  // below needs in world space. Both used to be `.clone()`d fresh inside the
  // loop, once per visible label per frame.
  const centerWorld = new THREE.Vector3();
  const tipWorld = new THREE.Vector3();

  // Writes into `out` and reuses one scratch Vector3, rather than
  // `vec3.clone().project(camera)` returning a fresh {x, y}: this is called
  // twice per visible label per frame, so the old shape allocated a Vector3
  // and an object literal ~1,600 times a second for values discarded in the
  // same iteration.
  const projVec = new THREE.Vector3();
  const projCenter = { x: 0, y: 0 };
  const projTip = { x: 0, y: 0 };
  function projectToScreen(vec3, out) {
    projVec.copy(vec3).project(camera);
    out.x = ( projVec.x * 0.5 + 0.5) * viewW;
    out.y = (-projVec.y * 0.5 + 0.5) * viewH;
    return out;
  }

  // One per-frame pass over every label: backface test, opacity ramp,
  // size, and the screen-space rotation that keeps text upright against
  // the sphere's own surface. Its own function rather than inline in
  // animate() so the cost of this pass can be timed on its own — it is by
  // far the most expensive thing this scene does per frame (320 labels).
  function updateLabels() {
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

    for (const entry of labelData) {
      const { label, normal, upVec, div } = entry;
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
        if (!label.visible) {
          div.style.visibility = 'visible';
          label.visible = true;
        }
        // fontSize/width/height are a function of `scale`, which is a
        // function of camera distance alone — they cannot change except on
        // zoom, so writing all three on every label on every frame was 960
        // wasted string builds and CSS value parses a frame. Tracked
        // per-label rather than with a single "did scale change" flag so a
        // label that was hidden through a zoom still gets resized the moment
        // it comes back round into view.
        if (entry.sizedAt !== scale) {
          div.style.fontSize = `${(7 * scale).toFixed(1)}px`;
          div.style.width    = `${(60 * scale).toFixed(0)}px`;
          div.style.height   = `${(52 * scale).toFixed(0)}px`;
          entry.sizedAt = scale;
        }
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
        //
        // This math ran every frame from the day it was written and never
        // reached the screen. CSS2DRenderer sets `element.style.transform`
        // by plain assignment on every visible object every frame
        // (CSS2DRenderer.js:238), and it runs AFTER updateLabels() in
        // animate() — so writing a rotate() here was overwritten by the
        // renderer's own translate a few microseconds later, every frame,
        // for years. Measured before the fix: 0 of 167 labels carried a
        // rotate(); all 167 carried only the translate.
        //
        // The fix is ordering, not maths. The angle is stashed on the entry
        // here and applied in applyLabelRotations() below, immediately after
        // labelRenderer.render(), by APPENDING to what the renderer just
        // wrote rather than replacing it — transform functions compose left
        // to right, so `translate(-50%,-50%) translate(x,y) rotate(a)`
        // positions the label and then spins it about its own centre, which
        // is what was wanted. Appending is safe against accumulation
        // precisely because the renderer assigns rather than appends.
        centerWorld.copy(label.position).applyMatrix4(sphere.matrixWorld);
        worldUp.copy(upVec).applyMatrix3(normalMatrix).normalize();
        tipWorld.copy(centerWorld).addScaledVector(worldUp, 0.15);
        const cs = projectToScreen(centerWorld, projCenter);
        const ts = projectToScreen(tipWorld, projTip);
        //
        // Two corrections, both found by looking at this on a real sphere
        // rather than reasoning about it — which is the only way either one
        // was ever going to surface.
        //
        // First: the facet's tangent-plane "up" points wherever the geometry
        // sends it, so the raw angle covers the full -180..180 and roughly
        // half the labels rendered upside down. Measured live: -178 to +167.
        // Adding 180 to anything past a quarter-turn folds those back.
        //
        // Second, and the reason this isn't just a clamp: folding at a hard
        // +-90 boundary means a label sitting near vertical SNAPS through 180
        // degrees the instant the sphere carries it across the line. In four
        // seconds of ordinary auto-rotation that fired 24 times, 18 of them
        // on labels visible at real opacity — about six flicks a second,
        // which reads as a fault in the page rather than an effect.
        //
        // So the tilt is tapered by cos(angle) instead of applied flat. That
        // is zero exactly at +-90, which removes the discontinuity rather
        // than hiding it — a label approaching vertical eases to horizontal
        // and can no longer cross anything. It also puts the effect where it
        // is worth having: facets turned toward the viewer, whose text is at
        // full opacity and actually readable, keep most of their tilt, while
        // facets near the silhouette — already fading out on the backface
        // ramp, already unreadable — sit flat. Peak tilt lands near 32
        // degrees, around a raw 49.
        const raw = Math.atan2(ts.x - cs.x, -(ts.y - cs.y)) * (180/Math.PI);
        const folded = raw > 90 ? raw - 180 : raw < -90 ? raw + 180 : raw;
        entry.angle = folded * Math.cos(folded * Math.PI / 180);
      } else if (label.visible) {
        div.style.visibility = 'hidden';
        label.visible = false;
      }
    }
  }

  // The second half of the label-rotation pass. Separate from updateLabels()
  // only because it has to run on the other side of labelRenderer.render();
  // it does no maths, just applies the angle that pass already computed.
  // Appending keeps the renderer's own positioning intact.
  function applyLabelRotations() {
    for (const entry of labelData) {
      if (!entry.label.visible) continue;
      entry.div.style.transform += ` rotate(${entry.angle.toFixed(1)}deg)`;
    }
  }

  let lightAngle = 0;
  let animId = 0;
  let paused = false;
  // This file had no frame clock at all until 4.1.2, which is most of why its
  // three per-frame constants outlived the 4.0 pass: there was nothing here
  // running on a wall clock for them to visibly disagree with, so a key light
  // and a sphere turning at double speed on a 120Hz panel just looked like a
  // key light and a sphere turning. Rates below are the tuned 60fps values,
  // converted rather than re-derived — see STANDARDS.md.
  const clock = createFrameClock();

  function animate() {
    animId = requestAnimationFrame(animate);
    const f = clock.tick() * 60;
    lightAngle += 0.003 * f;

    if (autoRotate && !reduceMotion) {
      sphere.rotation.y += 0.0015 * f;
      sphere.rotation.x += 0.0003 * f;
      wire.rotation.copy(sphere.rotation);
    }

    keyLight.position.set(Math.cos(lightAngle)*5, 3, Math.sin(lightAngle)*5);
    rimLight.position.set(Math.cos(lightAngle+Math.PI)*4, Math.sin(lightAngle*.7)*2, Math.sin(lightAngle+Math.PI)*4);
    fillLight.position.set(Math.sin(lightAngle*.5)*3, -3, Math.cos(lightAngle*.5)*3);

    if (!preview && labelData.length) updateLabels();

    renderer.render(scene, camera);
    if (labelRenderer) {
      labelRenderer.render(scene, camera);
      // Must follow the render — see the ordering note in updateLabels().
      if (!preview && labelData.length) applyLabelRotations();
    }
  }
  animate();

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  return {
    // main.js pauses a scene it isn't showing — every preview tile while a
    // full scene is open, and everything on `visibilitychange`. display:none
    // does not stop a requestAnimationFrame loop: the callbacks keep being
    // scheduled and the WebGL draws keep being issued into a subtree nobody
    // can see. Idempotent, because main.js calls it on every sync rather
    // than tracking which scenes it has already told.
    setPaused(nextPaused) {
      if (nextPaused === paused) return;
      paused = nextPaused;
      if (paused) { cancelAnimationFrame(animId); animId = 0; }
      else animate();
    },
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
      // Everything still pending — the 180ms content crossfade, the 500ms
      // side-flip reopen, the two 50ms focus hand-offs, the 2s auto-rotate
      // resume — in one call.
      timers.dispose();
      orbitDrag.dispose();
      wheelZoom?.dispose();
      panelCloser?.dispose();
      jumpList?.dispose();
      touchGuard?.dispose();
      reduceMotionWatch.dispose();
      if (onContainerMouseMove) container.removeEventListener('mousemove', onContainerMouseMove);
      if (onContainerClick) container.removeEventListener('click', onContainerClick);
      resize.dispose();
      geo.dispose();
      mat.dispose();
      wire.geometry.dispose();
      wire.material.dispose();
      if (labelRenderer) labelRenderer.domElement.remove();
      if (panel) panel.remove();
      if (hint) hint.remove();
      // Disposes the renderer, force-loses its GL context and removes the
      // canvas — the last of which this used to do by hand.
      managedRenderer.dispose();
      // Puts back whatever position/overflow/cursor/tabindex the shared
      // container had before this scene claimed it.
      claim?.restore();
    }
  };
}
