import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { fragments } from '../text/fragments.js';
import { bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, bindEscapeClose } from '../utils/sceneKit.js';

export function createSphere(container, { preview = false } = {}) {
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
  const detail = 2;
  const geo = new THREE.IcosahedronGeometry(1.4, detail).toNonIndexed();
  const faceCount = geo.attributes.position.count / 3;

  const palette = [
    new THREE.Color(0x4a7fb5), new THREE.Color(0x5d9bc7),
    new THREE.Color(0x3a6a9a), new THREE.Color(0x6aadd4),
    new THREE.Color(0x4e8ab8), new THREE.Color(0x7ab8d8),
  ];

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
  if (!preview && labelRenderer) {
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

    // Add label styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes wisp {
        0%   { opacity: var(--base-opacity, 0); }
        30%  { opacity: calc(var(--base-opacity, 0.12) * 0.3); }
        60%  { opacity: calc(var(--base-opacity, 0.12)); }
        80%  { opacity: calc(var(--base-opacity, 0.12) * 0.6); }
        100% { opacity: var(--base-opacity, 0); }
      }
      .face-label {
        color: rgba(255,255,255,1.0);
        font-family: 'Electrolize', sans-serif;
        font-size: 7px;
        line-height: 1.4;
        width: 60px;
        height: 52px;
        text-align: center;
        pointer-events: none;
        user-select: none;
        word-wrap: break-word;
        overflow: hidden;
        white-space: normal;
        animation: wisp var(--duration, 6s) ease-in-out infinite;
        animation-delay: var(--delay, 0s);
        transform-origin: center center;
      }
    `;
    document.head.appendChild(style);

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
  let wheelZoom = null, escapeClose = null;
  // Named so dispose() can remove them — container is the shared
  // #experience-container element every scene reuses (main.js only clears
  // its innerHTML between scenes, never replaces the node), so a listener
  // bound directly to it and never removed keeps firing after this scene
  // is gone, reading stale closures against a disposed scene.
  let onContainerMouseMove = null, onContainerTouchMove = null,
      onContainerTouchStart = null, onContainerClick = null;
  if (!preview) {
    // Design pass, 2026-07-17: every other scene shows a small instructional
    // hint (drag/click) — sphere never got one, which left it the one scene
    // a first-time visitor has to guess at. Same treatment as egg/leaf/
    // orrery's hint text: fixed top-right, z-index 310 (must clear
    // #experience-overlay — see styles/main.css's z-index-scale comment),
    // Times New Roman regardless of the scene's own body font, since hints
    // are chrome, not scene content, and read as one consistent voice
    // across the whole site.
    hint = document.createElement('p');
    hint.id = 'sphere-hint';
    hint.innerHTML = 'drag to rotate &nbsp;·&nbsp; click a facet';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    panel = document.createElement('aside');
    panel.id = 'sphere-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'sphere-panel-title');
    panel.innerHTML = `
      <button type="button" id="sphere-panel-close" aria-label="Close fragment panel">✕</button>
      <div id="sphere-panel-title" tabindex="-1">Fragment</div>
      <div id="sphere-panel-content"></div>
      <div id="sphere-facet-id"></div>
    `;
    const panelStyle = document.createElement('style');
    panelStyle.textContent = `
      /* Design pass, 2026-07-17: this panel was the one outlier on the whole
         site — a flat, opaque, fully-saturated cyan slab (#7ad) with a solid
         navy border, sitting next to egg/orrery/leaf's dark, translucent,
         moody panels (near-black background, a faint radial tint keyed to
         the scene's own palette, thin low-alpha colored border). Brought in
         line with that language: same near-black-plus-tint recipe, blue kept
         only as a low-alpha accent (border, scrollbar, facet-id) rather than
         the whole surface. Electrolize kept — unlike the poem/prose-heavy
         panels elsewhere, these fragments read as hypertext/interconnected-
         prose, and the geometric sans fits that better than serif would.
         The silk-glimmer gold link animation and clicked-side slide-in stay
         exactly as they were — both already distinct, worth keeping. */
      #sphere-hint {
        position: fixed; top: 4.5rem; right: 1.2rem;
        color: rgba(255,255,255,0.3);
        font-size: 0.55rem; letter-spacing: 0.2em;
        text-transform: uppercase; pointer-events: none;
        text-align: right; z-index: 310; line-height: 1.8;
        font-family: 'Times New Roman', serif;
      }
      #sphere-panel {
        position:absolute;top:0;right:0;width:33%;height:100%;
        background:
          radial-gradient(ellipse at 30% 0%, rgba(70,110,180,0.25), transparent 60%),
          #05070d;
        border-left:1px solid rgba(120,170,255,0.18);
        padding:3rem 2.5rem;transform:translateX(100%);
        transition:transform .5s cubic-bezier(.16,1,.3,1);
        overflow-y:scroll;z-index:10;
        scrollbar-color:rgba(120,170,255,0.3) #05070d;scrollbar-width:thin;
        font-family:'Electrolize',sans-serif;
      }
      /* Enters from whichever side of the screen was actually clicked —
         .from-left is toggled in JS right before opening. no-transition
         is applied for one frame while the side flips, so the flip itself
         (an instant layout change, not something transform can animate)
         happens while the panel is still off-screen, not visibly. */
      #sphere-panel.from-left {
        left:0; right:auto;
        border-left:none; border-right:1px solid rgba(120,170,255,0.18);
        transform:translateX(-100%);
      }
      #sphere-panel.no-transition{transition:none!important;}
      @media(max-width:700px){
        #sphere-panel{width:85%;padding:4rem 1.5rem 2rem;}
        #sphere-panel-title{font-size:1.05rem;letter-spacing:.15em;}
        #sphere-panel-content{font-size:0.9rem;line-height:1.7;}
      }
      #sphere-panel.open{transform:translateX(0);}
      #sphere-panel-title{
        font-size:1.15rem;letter-spacing:.22em;text-transform:uppercase;
        color:rgba(210,225,255,.85);margin-bottom:1.4rem;
        border-bottom:1px solid rgba(120,170,255,0.18);padding-bottom:1.4rem;
      }
      #sphere-panel-content{color:rgba(220,228,245,.78);font-size:1rem;line-height:1.8;}
      #sphere-panel-content p{padding:0 0 1rem;}
      #sphere-panel-close{position:absolute;top:1.5rem;right:1.5rem;background:none;border:none;color:rgba(255,255,255,0.4);font-size:1.2rem;cursor:pointer;padding:.5rem;}
      #sphere-panel-close:hover{color:rgba(255,255,255,.9);}
      #sphere-facet-id{font-size:.6rem;letter-spacing:.3em;color:rgba(180,200,255,.3);margin-top:2rem;text-transform:uppercase;}
      @keyframes silk-glimmer{
        0%,85%,100%{color:inherit;text-shadow:none;}
        92%{color:rgba(180,210,255,.28);text-shadow:0 0 6px rgba(180,210,255,.12);}
      }
      .fragment-link{color:inherit;text-decoration:none;border-bottom:none;cursor:default;transition:color .2s;animation:silk-glimmer 12s ease-in-out infinite;}
      .fragment-link:hover{color:rgba(255,220,120,.95);cursor:pointer;animation:none;text-shadow:0 0 12px rgba(255,220,120,.3);}
      @media(prefers-reduced-motion:reduce){.fragment-link{animation:none;}}
    `;
    document.head.appendChild(panelStyle);
    container.style.position="relative";container.style.overflow="hidden";container.appendChild(panel);
    panelTitle   = panel.querySelector('#sphere-panel-title');
    panelContent = panel.querySelector('#sphere-panel-content');
    facetIdEl    = panel.querySelector('#sphere-facet-id');

    panel.addEventListener('click', e => e.stopPropagation());
    panel.querySelector('#sphere-panel-close').addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.remove('open');
      if (selectedFace !== -1) { restoreFaceColor(selectedFace); selectedFace = -1; }
    });

    // Fragment link navigation — follow the threads (click + keyboard)
    function navigateToFragment(link) {
      const targetTitle = link.dataset.target;
      const targetIdx = fragments.findIndex(f => f.title === targetTitle);
      if (targetIdx === -1) return;
      panelContent.style.transition = 'opacity .18s';
      panelTitle.style.transition = 'opacity .18s';
      panelContent.style.opacity = '0';
      panelTitle.style.opacity = '0';
      setTimeout(() => {
        panelTitle.textContent = fragments[targetIdx].title;
        panelContent.innerHTML = fragments[targetIdx].text;
        facetIdEl.textContent = `Fragment ${targetIdx + 1} of ${fragments.length} · ${fragments[targetIdx].title}`;
        panelContent.scrollTop = 0;
        panelContent.style.opacity = '1';
        panelTitle.style.opacity = '1';
        // Stagger glimmer delays + a11y attributes
        panelContent.querySelectorAll('.fragment-link').forEach(link => {
          const delay = (Math.random() * 12).toFixed(1);
          const duration = (9 + Math.random() * 7).toFixed(1);
          link.style.animationDelay = `-${delay}s`;
          link.style.animationDuration = `${duration}s`;
          link.setAttribute('role', 'button');
          link.setAttribute('tabindex', '0');
          link.setAttribute('aria-label', `Navigate to fragment: ${link.dataset.target}`);
        });
      }, 180);
    }

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

    let touchMoved = false;
    onContainerTouchMove = () => { touchMoved = true; };
    container.addEventListener('touchmove', onContainerTouchMove, { passive: true });
    onContainerTouchStart = () => { touchMoved = false; };
    container.addEventListener('touchstart', onContainerTouchStart, { passive: true });
    onContainerClick = e => {
      if (touchMoved) { touchMoved = false; return; }
      if (panel.classList.contains('open') && !panel.contains(e.target)) {
        panel.classList.remove('open');
        if (selectedFace !== -1) { restoreFaceColor(selectedFace); selectedFace = -1; }
        return;
      }
      if (hoveredFace === -1) return;
      if (selectedFace !== -1 && selectedFace !== hoveredFace) restoreFaceColor(selectedFace);
      selectedFace = hoveredFace;
      setFaceColor(selectedFace, selectedColor);
      const fi = selectedFace % fragments.length;
      panelTitle.textContent  = fragments[fi].title;
      panelContent.innerHTML  = fragments[fi].text;
      facetIdEl.textContent   = `Facet ${selectedFace} · Fragment ${fi + 1} of ${fragments.length}`;

      // Enter from whichever side of the screen was actually clicked. The
      // panel is guaranteed closed here (the block above already returns
      // early for an open-panel click), so flipping the anchor is invisible —
      // no-transition forces that instant flip to land before the slide-in
      // transition re-enables and .open starts animating it into view.
      const rect = container.getBoundingClientRect();
      const clickedLeft = (e.clientX - rect.left) < rect.width / 2;
      if (panel.classList.contains('from-left') !== clickedLeft) {
        panel.classList.add('no-transition');
        panel.classList.toggle('from-left', clickedLeft);
        void panel.offsetWidth; // force reflow before re-enabling the transition
        panel.classList.remove('no-transition');
      }

      panel.classList.add('open');
      // Move focus to panel for screen readers
      setTimeout(() => panelTitle.focus(), 50);
      // Stagger glimmer delays + a11y on first open
      panelContent.querySelectorAll('.fragment-link').forEach(link => {
        const delay = (Math.random() * 12).toFixed(1);
        const duration = (9 + Math.random() * 7).toFixed(1);
        link.style.animationDelay = `-${delay}s`;
        link.style.animationDuration = `${duration}s`;
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
        link.setAttribute('aria-label', `Navigate to fragment: ${link.dataset.target}`);
      });
    };
    container.addEventListener('click', onContainerClick);

    wheelZoom = bindWheelZoom(container, {
      isBlocked: e => panel && panel.contains(e.target),
      onZoom: deltaY => {
        camera.position.z = Math.max(1.8, Math.min(6, camera.position.z + deltaY * 0.005));
      },
    });

    // Escape closes the fragment panel from anywhere, matching standard
    // modal-dialog expectation (previously only the close button or a
    // click outside the panel would do it).
    escapeClose = bindEscapeClose(() => {
      if (panel.classList.contains('open')) {
        panel.classList.remove('open');
        if (selectedFace !== -1) { restoreFaceColor(selectedFace); selectedFace = -1; }
      }
    });
  }

  // ─── Drag to rotate (mouse + touch, via sceneKit) ──────────────────────────
  // Previously mouse-only despite touch listeners already existing above for
  // tap-vs-drag detection — rotating the sphere silently didn't work on
  // phones/tablets. bindOrbitDrag unifies both input paths.
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
      camera.getWorldDirection(cameraDir);
      normalMatrix.getNormalMatrix(sphere.matrixWorld);
      const camDist = camera.position.z;
      const scale = Math.max(0.5, Math.min(3.0, 3.8 / camDist));

      for (const { label, normal, upVec, div } of labelData) {
        worldNormal.copy(normal).applyMatrix3(normalMatrix).normalize();
        const dot = worldNormal.dot(cameraDir);
        if (dot < -0.1) {
          const opacity = Math.min(0.25, (-dot - 0.1) * 0.35);
          div.style.setProperty('--base-opacity', opacity.toFixed(3));
          div.style.visibility = 'visible';
          label.visible = true;
          div.style.fontSize = `${(7 * scale).toFixed(1)}px`;
          div.style.width    = `${(60 * scale).toFixed(0)}px`;
          div.style.height   = `${(52 * scale).toFixed(0)}px`;
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
    dispose() {
      cancelAnimationFrame(animId);
      orbitDrag.dispose();
      wheelZoom?.dispose();
      escapeClose?.dispose();
      if (onContainerMouseMove) container.removeEventListener('mousemove', onContainerMouseMove);
      if (onContainerTouchMove) container.removeEventListener('touchmove', onContainerTouchMove);
      if (onContainerTouchStart) container.removeEventListener('touchstart', onContainerTouchStart);
      if (onContainerClick) container.removeEventListener('click', onContainerClick);
      resize.dispose();
      renderer.dispose();
      if (labelRenderer) labelRenderer.domElement.remove();
      if (panel) panel.remove();
      if (hint) hint.remove();
      renderer.domElement.remove();
    }
  };
}
