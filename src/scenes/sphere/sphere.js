import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getOutboundLinks, getInboundLinks } from '../../links.js';
import { bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, onReducedMotionChange, createPanelCloser, createJumpList, bindTapVsDrag, parseHTML, wireCrossLinks, formatInboundNote, setPanelSide, clickedLeftHalf, claimContainer, manageRenderer, trackTimers, createFrameClock } from '../../utils/sceneKit.js';
import { stripHtml } from '../../utils/resonanceExcerpts.js';
import sphereHtml from './sphere.html?raw';
import './sphere.css';

export function createSphere(container, { preview = false, initialPieceId = null, onPieceChange = null } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.z = preview ? 5.5 : 3.8;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const managedRenderer = manageRenderer(renderer, {
    onLost: () => { cancelAnimationFrame(animId); animId = 0; },
  });
  renderer.setSize(w, h);
  renderer.domElement.setAttribute('aria-hidden', 'true'); // visual only
  container.appendChild(renderer.domElement);

  const claim = preview ? null : claimContainer(container, { tabIndex: -1 });

  const timers = trackTimers();

  let labelRenderer = null;
  if (!preview) {
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w, h);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelRenderer.domElement.style.zIndex = '1';
    labelRenderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(labelRenderer.domElement);
  }

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

  const detail = 2;
  const geo = new THREE.IcosahedronGeometry(1.4, detail);
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

  const labelData = [];

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

  let panel = null, panelContent = null, panelTitle = null, facetIdEl = null, hint = null;
  let wheelZoom = null, panelCloser = null, jumpList = null;
  let onContainerMouseMove = null, onContainerClick = null, touchGuard = null;
  let openFragmentRef = null;
  let fragmentsRef = null;
  let disposed = false;

  if (!preview) {
    import('./sphere.text.js').then(({ fragments }) => {
      if (disposed) return;
      fragmentsRef = fragments;

      if (labelRenderer) {
        function randomExcerpt(fi) {
          const plain = stripHtml(fragments[fi].text);
          if (plain.length <= 40) return plain;
          const maxStart = Math.max(0, plain.length - 60);
          const start = Math.floor(Math.random() * maxStart);
          const wordStart = plain.indexOf(' ', start);
          const from = wordStart === -1 ? start : wordStart + 1;
          return plain.slice(from, from + 55);
        }

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
          const div = document.createElement('div');
          div.className = 'face-label';
          div.textContent = randomExcerpt(fi);
          div.style.setProperty('--duration', `${4 + Math.random() * 6}s`);
          div.style.setProperty('--delay', `${-Math.random() * 8}s`);
          const label = new CSS2DObject(div);
          label.position.copy(center.clone().multiplyScalar(1.01));
          sphere.add(label);
          labelData.push({ label, normal, div, sizedAt: -1 });
        }
      }

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

      function renderFragmentHtml(fragment) {
        const links = getOutboundLinks('sphere', fragment.id, 'text');
        return wireCrossLinks(fragment.text, links, 'fragment-link');
      }

      function withInboundNote(fragmentId, base) {
        const note = formatInboundNote(
          getInboundLinks('sphere', fragmentId).map(l => fragments.find(f => f.id === l.from.id)?.title)
        );
        return note ? `${base} · ${note}` : base;
      }

      function navigateToFragment(link) {
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
          panel.scrollTop = 0; // .sphere-panel is the scroll container (overflow-y), not its content div
          panelContent.style.opacity = '1';
          panelTitle.style.opacity = '1';
          panelContent.querySelectorAll('.fragment-link').forEach(link => {
            const delay = (Math.random() * 12).toFixed(1);
            const duration = (9 + Math.random() * 7).toFixed(1);
            link.style.animationDelay = `-${delay}s`;
            link.style.animationDuration = `${duration}s`;
            const targetFrag = link.dataset.targetScene === 'sphere'
              ? fragments.find(f => f.id === Number(link.dataset.targetId))
              : null;
            link.setAttribute('aria-label', `Navigate to fragment: ${targetFrag ? targetFrag.title : 'related fragment'}`);
          });
        });
      }

      function openFragment(fi, { facetLabel, fromLeft } = {}) {
        onPieceChange?.(fragments[fi].id);
        const populate = () => {
          panelTitle.textContent = fragments[fi].title;
          panelContent.innerHTML = renderFragmentHtml(fragments[fi]);
          facetIdEl.textContent  = withInboundNote(fragments[fi].id, facetLabel ?? `Fragment ${fi + 1} of ${fragments.length}`);
          panelContent.querySelectorAll('.fragment-link').forEach(link => {
            const delay = (Math.random() * 12).toFixed(1);
            const duration = (9 + Math.random() * 7).toFixed(1);
            link.style.animationDelay = `-${delay}s`;
            link.style.animationDuration = `${duration}s`;
            const targetFrag = link.dataset.targetScene === 'sphere'
              ? fragments.find(f => f.id === Number(link.dataset.targetId))
              : null;
            link.setAttribute('aria-label', `Navigate to fragment: ${targetFrag ? targetFrag.title : 'related fragment'}`);
          });
        };

        const wasOpen = panel.classList.contains('open');
        const sideMismatch = fromLeft !== undefined && panel.classList.contains('from-left') !== fromLeft;

        if (wasOpen && sideMismatch) {
          panel.classList.remove('open');
          timers.after(500, () => {
            setPanelSide(panel, fromLeft);
            populate();
            panel.scrollTop = 0;
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
        timers.after(50, () => panelTitle.focus());
      }

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

      onContainerMouseMove = e => {
        const rect = container.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
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
        const rect = container.getBoundingClientRect();
        mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const clickHits = raycaster.intersectObject(sphere, false);
        const clickedFace = clickHits.length ? clickHits[0].faceIndex : -1;

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

      if (initialPieceId !== null) {
        const initialIdx = fragments.findIndex(f => f.id === initialPieceId);
        if (initialIdx !== -1) openFragment(initialIdx, { fromLeft: false });
      }
    });
  }

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

  let reduceMotion = prefersReducedMotion();
  const reduceMotionWatch = onReducedMotionChange(m => { reduceMotion = m; });

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    managedRenderer.applyPixelRatio();
    if (labelRenderer) labelRenderer.setSize(nw, nh);
  });
  resize.trigger();

  const cameraDir = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  function updateLabels() {
    camera.getWorldDirection(cameraDir);
    normalMatrix.getNormalMatrix(sphere.matrixWorld);
    const camDist = camera.position.z;
    const scale = Math.max(0.5, Math.min(3.0, 3.8 / camDist));

    for (const entry of labelData) {
      const { label, normal, div } = entry;
      worldNormal.copy(normal).applyMatrix3(normalMatrix).normalize();
      const dot = worldNormal.dot(cameraDir);
      if (dot < -0.1) {
        const opacity = Math.min(0.25, (-dot - 0.1) * 0.35);
        div.style.setProperty('--base-opacity', opacity.toFixed(3));
        if (!label.visible) {
          div.style.visibility = 'visible';
          label.visible = true;
        }
        if (entry.sizedAt !== scale) {
          div.style.fontSize = `${(7 * scale).toFixed(1)}px`;
          div.style.width    = `${(60 * scale).toFixed(0)}px`;
          div.style.height   = `${(52 * scale).toFixed(0)}px`;
          entry.sizedAt = scale;
        }
      } else if (label.visible) {
        div.style.visibility = 'hidden';
        label.visible = false;
      }
    }
  }


  let lightAngle = 0;
  let animId = 0;
  let paused = false;
  const clock = createFrameClock();

  function animate() {
    animId = requestAnimationFrame(animate);
    const f = clock.tick() * 60;
    if (autoRotate && !reduceMotion) {
      sphere.rotation.y += 0.0015 * f;
      sphere.rotation.x += 0.0003 * f;
      wire.rotation.copy(sphere.rotation);
    }

    if (!reduceMotion) {
      lightAngle += 0.003 * f;
      keyLight.position.set(Math.cos(lightAngle)*5, 3, Math.sin(lightAngle)*5);
      rimLight.position.set(Math.cos(lightAngle+Math.PI)*4, Math.sin(lightAngle*.7)*2, Math.sin(lightAngle+Math.PI)*4);
      fillLight.position.set(Math.sin(lightAngle*.5)*3, -3, Math.cos(lightAngle*.5)*3);
    }

    if (!preview && labelData.length) updateLabels();

    renderer.render(scene, camera);
    if (labelRenderer) labelRenderer.render(scene, camera);
  }
  animate();

  return {
    setPaused(nextPaused) {
      if (nextPaused === paused) return;
      paused = nextPaused;
      if (paused) { cancelAnimationFrame(animId); animId = 0; }
      else animate();
    },
    openPieceById(id) {
      if (!fragmentsRef) return;
      const idx = fragmentsRef.findIndex(f => f.id === id);
      if (idx !== -1) openFragmentRef?.(idx, { fromLeft: false });
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animId);
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
      managedRenderer.dispose();
      claim?.restore();
    }
  };
}
