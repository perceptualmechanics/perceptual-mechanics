// ─── Cross-scene navigation ─────────────────────────────────────────────────
// Originally "Constellation entry points" (2026-08-16): ground-glimpse (a
// rare, found translucent patch on beamline's terrain / orrery's floor) and
// the thread-follow filament (a small always-available doorway on any panel
// whose piece participates in an approved Layer 2 resonance) — both retired
// entirely 2026-08-18 alongside restoring Harmonics' own nav icon and
// landing preview tile (see index.html/main.js), which now cover discovery
// the way every other scene's tile always has. `navigateToPiece` below is
// the one piece of this file that outlived both: Harmonics' own payoff
// panel (src/scenes/constellation/constellation.js) still uses it to jump
// straight to either side of a resonance a visitor clicks through to, and
// it was never actually Constellation-specific to begin with (see its own
// comment) — kept in this file rather than moved into sceneKit.js only
// because nothing else currently needs it from there.
//
// Traded away by this retirement, named plainly rather than left implicit:
// thread-follow let someone jump straight from a piece they were reading
// into that piece's specific resonance, already selected and oriented.
// Reaching Harmonics via nav now lands generally, not on a specific
// connection — finding a particular node again means navigating there
// directly inside the scene. Not a reason to reconsider, just what's
// actually different now.

// Generic — any scene, any piece. main.js's own `pm:navigate` listener
// resolves this against its SCENES map regardless of which scene is named.
export function navigateToPiece(scene, pieceId) {
  window.dispatchEvent(new CustomEvent('pm:navigate', {
    detail: { scene, pieceId: pieceId ?? null },
  }));
}
