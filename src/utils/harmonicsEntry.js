
export function navigateToPiece(scene, pieceId) {
  window.dispatchEvent(new CustomEvent('pm:navigate', {
    detail: { scene, pieceId: pieceId ?? null },
  }));
}
