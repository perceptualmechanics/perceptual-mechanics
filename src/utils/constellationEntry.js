// ─── Constellation entry points ─────────────────────────────────────────────
// Two ways into the ninth scene, both additive, neither a replacement for
// the other (Scott, 2026-08-16 brief): the ground glimpse (a rare, found
// moment on a scene with a real floor) and the thread-follow filament (an
// always-available doorway from any piece that happens to participate in
// an approved Layer 2 resonance). Grouped together here — not in
// sceneKit.js — because both genuinely depend on src/resonances.js and/or
// three.js, unlike every sceneKit.js helper, which is deliberately
// dependency-free.
//
// Both entry points navigate the same way: dispatch a `pm:navigate`
// CustomEvent on window, `detail: { scene: 'constellation', pieceId? }`.
// Neither helper reaches into main.js directly — main.js owns exactly one
// listener for this event (see its own comment there), the same
// expandScene() path every nav-icon click and preview-tile click already
// goes through, so a glimpse-click or thread-click gets identical
// history/hash/focus handling to a normal navigation, for free.

import * as THREE from 'three';
import { getResonancesForPiece } from '../resonances.js';

// Generic — any scene, any piece. main.js's own `pm:navigate` listener
// already resolves this against its SCENES map regardless of which scene
// is named, so this was never actually constellation-specific; exported
// now that the Constellation's own click payoff (round 2, 2026-08-16)
// needs to jump straight to either endpoint of a resonance, not just
// arrive AT the Constellation the way the two entry points below do.
export function navigateToPiece(scene, pieceId) {
  window.dispatchEvent(new CustomEvent('pm:navigate', {
    detail: { scene, pieceId: pieceId ?? null },
  }));
}

function navigateToConstellation(pieceId) {
  navigateToPiece('constellation', pieceId);
}

// ─── Ground glimpse ─────────────────────────────────────────────────────────
// The ground plane goes faintly translucent for well under a second, and
// what's briefly visible through it is a hint of the Constellation's own
// strands — the visitor looking down through the same boundary the
// Constellation's spider looks up through, in reverse. Only meaningful on
// a scene with a literal ground/floor mesh; per the Phase 3 architecture
// survey, that's beamline (terrain) and orrery (warehouse floor) only —
// every other scene is an object floating in a void, nothing to glimpse
// "through."
//
// Trigger is a flat, non-cyclic coin flip on a fixed check interval — NOT
// the resonator's layered-frequency treatment. Scott, 2026-08-16: "this
// doesn't need the same non-cyclic layered-frequency treatment as the
// resonator's timing ... simpler is probably more correct for this
// specific effect, not less." `checkIntervalSec`/`triggerProbability` are
// the two calibration knobs — see whichever scene constructs this for the
// actual values tested live, and NOTES.md's Phase 3 entry for the
// observed real-session trigger rate (not just the configured numbers).
//
// The fade envelope (fadeIn → hold → fadeOut → forgiveness) is real, not
// an instant on/off — Scott: "an abrupt cut would read as a glitch, not a
// glimpse." `forgivenessSec` extends the clickable window past the point
// the disc itself has fully faded out, so a visitor who reacts a beat
// late still catches it — leaning toward forgiving per the brief's own
// "leaning toward some brief forgiveness window rather than a hard,
// punishing timing requirement."
export function createGroundGlimpse({
  scene,
  pickPoint,               // () => { x, y, z } | null — world position for the patch center (y = surface height at that x/z). Scene-specific: beamline samples terrainHeight near the camera target, orrery samples a point on its flat floor.
  radius = 7,
  checkIntervalSec = 2.5,
  triggerProbability = 0.05,
  cooldownMinSec = 25,
  cooldownMaxSec = 70,
  fadeInSec = 0.18,
  holdSec = 0.16,
  fadeOutSec = 0.18,
  forgivenessSec = 0.55,
} = {}) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // A fresh little abstract doodle each glimpse — a handful of faint
  // strand-like strokes converging loosely on one point (a hint of the
  // spider's own body), not the real Constellation geometry rendered
  // in miniature. Redrawn per spawn purely for variety; the shape itself
  // carries no data.
  function makeGlimpseTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const cx = c.getContext('2d');
    const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0,   'rgba(4,7,16,0.88)');
    g.addColorStop(0.7, 'rgba(4,7,16,0.55)');
    g.addColorStop(1,   'rgba(4,7,16,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, 128, 128);
    const hubX = 64 + (Math.random() - 0.5) * 30, hubY = 64 + (Math.random() - 0.5) * 30;
    cx.strokeStyle = 'rgba(210,225,255,0.55)';
    cx.lineWidth = 1.1;
    const legCount = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < legCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const len = 26 + Math.random() * 40;
      cx.beginPath();
      cx.moveTo(hubX, hubY);
      cx.lineTo(hubX + Math.cos(a) * len, hubY + Math.sin(a) * len);
      cx.stroke();
    }
    cx.fillStyle = 'rgba(230,240,255,0.7)';
    cx.beginPath();
    cx.arc(hubX, hubY, 2.6, 0, Math.PI * 2);
    cx.fill();
    return new THREE.CanvasTexture(c);
  }

  const discGeo = new THREE.CircleGeometry(radius, 24);
  const discMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = -Math.PI / 2;
  group.add(disc);

  // Generous invisible hit target, separate from the (smaller-reading,
  // soft-edged) visible disc — same "visible body is small, hit target
  // isn't" idiom orbiter.js's satellites and nucleus already use.
  const hitGeo = new THREE.CircleGeometry(radius * 1.6, 12);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.rotation.x = -Math.PI / 2;
  group.add(hit);

  let currentTex = null;
  let state = 'idle'; // idle | fadeIn | hold | fadeOut | forgiveness
  let stateT = 0;
  let checkT = 0;
  // Don't fire in the first stretch of a fresh scene load — arriving to an
  // immediate glimpse would read as scripted, the opposite of the point.
  let cooldownT = cooldownMinSec;

  // Debug/testing hook — real rarity calibration needs an honest account
  // of observed trigger frequency over actual wall-clock time (see
  // NOTES.md's Phase 3 entry), not a description of intended behavior;
  // this exposes enough state for a live console/session check without
  // relying on catching the visual in a screenshot.
  const debugState = { triggerCount: 0, lastTriggerAt: null, state: 'idle' };

  function spawn() {
    const p = pickPoint();
    if (!p) return;
    group.position.set(p.x, p.y + 0.12, p.z);
    group.visible = true;
    disc.visible = true;
    state = 'fadeIn';
    stateT = 0;
    currentTex?.dispose();
    currentTex = makeGlimpseTexture();
    discMat.map = currentTex;
    discMat.needsUpdate = true;
    debugState.triggerCount++;
    debugState.lastTriggerAt = Date.now();
  }

  function endCycle() {
    group.visible = false;
    state = 'idle';
    stateT = 0;
    cooldownT = cooldownMinSec + Math.random() * (cooldownMaxSec - cooldownMinSec);
  }

  function update(dt) {
    debugState.state = state;
    if (state === 'idle') {
      if (cooldownT > 0) { cooldownT -= dt; return; }
      checkT += dt;
      if (checkT >= checkIntervalSec) {
        checkT = 0;
        if (Math.random() < triggerProbability) spawn();
      }
      return;
    }
    stateT += dt;
    if (state === 'fadeIn') {
      discMat.opacity = Math.min(1, stateT / fadeInSec);
      if (stateT >= fadeInSec) { state = 'hold'; stateT = 0; }
    } else if (state === 'hold') {
      discMat.opacity = 1;
      if (stateT >= holdSec) { state = 'fadeOut'; stateT = 0; }
    } else if (state === 'fadeOut') {
      discMat.opacity = Math.max(0, 1 - stateT / fadeOutSec);
      if (stateT >= fadeOutSec) { state = 'forgiveness'; stateT = 0; disc.visible = false; }
    } else if (state === 'forgiveness') {
      if (stateT >= forgivenessSec) endCycle();
    }
  }

  function isClickable() {
    return state !== 'idle';
  }

  // A scene's own click handler calls this with whatever its raycaster
  // already hit this frame — folds into an existing hit-test rather than
  // running a second independent raycast. Returns true if the click was
  // consumed (glimpse was clickable AND the hit list includes this
  // glimpse's own hit mesh), so the caller's normal click logic can bail
  // out early rather than also, say, dismissing a station label.
  function consumeIfHit(hitObjects) {
    if (!isClickable() || !hitObjects.includes(hit)) return false;
    endCycle();
    navigateToConstellation();
    return true;
  }

  return {
    update,
    isClickable,
    get hitMesh() { return isClickable() ? hit : null; },
    consumeIfHit,
    get debug() { return debugState; },
    // Bypasses the probability roll entirely — for live calibration/
    // testing only (a scene exposes this on `window` behind its own
    // debug hook, same precedent as orrery.js's existing
    // `window.__orreryTimeOverrideMs`), never called by production code.
    forceSpawn: spawn,
    dispose() {
      scene.remove(group);
      discGeo.dispose(); discMat.dispose(); currentTex?.dispose();
      hitGeo.dispose(); hitMat.dispose();
    },
  };
}

// ─── Thread-follow filament ─────────────────────────────────────────────────
// The original brainstorm's always-available doorway (constellation-brief.
// md, "Follow a thread from where you already are"): if the piece
// currently open in a scene's own read-more panel participates in an
// approved Layer 2 resonance, a small found filament appears at the
// panel's edge. Deliberately NOT wireCrossLinks (sceneKit.js) — that's
// Layer 1, a specific verbatim phrase inside the piece's own text
// becoming a same-scene jump; this is Layer 2, atmospheric rather than
// curated, may cross scenes, and doesn't say in advance which piece it
// leads to — the visitor finds out only once they're in the Constellation,
// already oriented at the strand that brought them (the strand's other
// endpoint, not named here).
//
// `panel`: the scene's own panel element. `scene`/`id`/`beatId`: the piece
// now showing in it — pass the same values every time the panel's content
// changes (a fresh open, or a same-scene cross-link navigation), since
// this owns no state of its own; it just decides fresh, on every call,
// whether a filament belongs on THIS piece right now, and removes any
// filament left over from whatever was showing before.
export function wireResonanceThread(panel, scene, id, beatId) {
  panel.querySelector('.pm-thread')?.remove();
  const rows = getResonancesForPiece(scene, id, beatId);
  if (!rows.length) return null;

  const thread = document.createElement('button');
  thread.type = 'button';
  thread.className = 'pm-thread';
  thread.setAttribute('aria-label', 'Follow a thread');
  thread.title = 'Follow a thread';
  panel.appendChild(thread);

  const onClick = e => {
    e.stopPropagation();
    // Which specific strand to arrive oriented at is picked now, at click
    // time, not when the filament first appeared — if a piece happens to
    // sit in more than one approved resonance, no single one of them is
    // "the" reason the filament is there.
    const row = rows[Math.floor(Math.random() * rows.length)];
    navigateToConstellation(row.id);
  };
  thread.addEventListener('click', onClick);

  return {
    dispose() {
      thread.removeEventListener('click', onClick);
      thread.remove();
    },
  };
}
