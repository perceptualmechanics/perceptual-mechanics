// The Reading's symbols, drawn here: stroke paths on a 24-unit square, by the
// id euphonia.reading.json gives each, from the book's "drawn as". The gate
// fails on a symbol the file names and this doesn't draw.
export const SYMBOLS = {
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>',
  lantern: '<path d="M9 5h6M12 2v3M8 8h8l1 10H7zM8 8l1-3M16 8l-1-3M6 21h12"/><path d="M12 11c2 2 1 4 0 5-1-1-2-3 0-5z"/>',
  blade: '<path d="M19 3l2 2L9 17l-3-3zM5 13l6 6M4 20l3-3"/>',
  seed: '<path d="M12 21c-5-4-6-10 0-16 6 6 5 12 0 16zM12 21V10"/>',
  book: '<path d="M12 6c-2-2-5-2-8-1v14c3-1 6-1 8 1 2-2 5-2 8-1V5c-3-1-6-1-8 1zM12 6v14"/>',
  bell: '<path d="M6 17c1-2 1-4 1-7a5 5 0 0110 0c0 3 0 5 1 7zM4 17h16M10 20a2 2 0 004 0M12 3v2"/>',
  hammer: '<path d="M13 5l6 6-3 2-6-6zM11 9L4 20"/>',
  cup: '<path d="M6 4h12l-1 7a5 5 0 01-10 0zM12 16v4M8 20h8"/>',
  mask: '<path d="M3 8c3-2 6-1 9 1 3-2 6-3 9-1 0 6-3 9-6 8-1-1-2-2-3-2s-2 1-3 2C6 17 3 14 3 8z"/><path d="M7 10.5h2M15 10.5h2"/>',
  door: '<path d="M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16M3 21h18M14 12h.01"/>',
  flame: '<path d="M12 3c1 4 6 6 6 12a6 6 0 01-12 0c0-3 2-4 3-7 1 2 2 3 3 3 1-2 0-5 0-8z"/>',
  river: '<path d="M3 8c3-3 6 3 9 0s6 3 9 0M3 13c3-3 6 3 9 0s6 3 9 0M3 18c3-3 6 3 9 0s6 3 9 0"/>',
  mountain: '<path d="M2 20L9 6l4 7 2-3 7 10zM7 10l2 2 2-2"/>',
  gate: '<path d="M4 21V4M20 21V4M2.5 4h3M18.5 4h3M4 7h16M4 18h16M8 7v11M12 7v11M16 7v11M4 16L20 9"/>',
  thunder: '<path d="M14 2L6 13h5l-2 8 9-12h-5l3-7zM11 21l2-3M9 21l-2 1"/>',
  lullaby: '<path d="M5 11h14l-1.5 6h-11zM5 11c0-3.5 3-6 7-6v6M3 19c5 3 13 3 18 0"/>',
  loom: '<path d="M4 3v18M20 3v18M2.5 5h19M2.5 19h19M8 5v14M12 5v14M16 5v14M4 12h16M4 14.5h16M4 17h16"/>',
  dog: '<path d="M4 19c-.5-4 2-7 7-7h3l2-3 1-3 2 3 2 2-.5 2H18l-1 3 1 3zM4 17c-1.5-.5-2-2-1.5-3.5M19 10h.01M9 19v-3M13 19v-3"/>',
  spear: '<path d="M3 21l12-12M15 9l.5-5L21 3l-1 5.5zM12.5 7.5l4 4"/>',
  bird: '<path d="M3 13c3-3 6-3 8-1 1-4 5-7 10-7-1 2-2 3-3 4 0 5-4 9-9 8l-4 3 1-4c-1-1-2-2-3-3zM15 9h.01"/>',
};
export const symbolSvg = id => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SYMBOLS[id]}</svg>`;

// A person's sigil, built from their traits until there is art. Each of the
// nine Ways is a figure of 3 to 11 sides, the first drawn large and the second
// small within it; each Heart is a mark at its own ninth of the ring; a stroke
// on the rim is where on the map they're from.
export function sigilSvg(p, traits, mapX) {
  const kind = a => Object.keys(traits).filter(t => traits[t].axis === a), ways = kind('way'), hearts = kind('heart'), turn = 2 * Math.PI;
  const mine = a => p.traits.filter(t => traits[t].axis === a), at = (r, a) => [50 + r * Math.cos(a), 50 + r * Math.sin(a)].map(n => n.toFixed(1));
  const figure = (way, r, spin) => { const sides = 3 + ways.indexOf(way); return `M${Array.from({ length: sides }, (_, i) => at(r, spin + i * turn / sides).join(' ')).join(' L')}Z`; };
  const rim = mapX / 1000 * turn - Math.PI / 2, [first, second] = mine('way');
  const marks = mine('heart').map((t, i) => { const [x, y] = at(36, hearts.indexOf(t) / hearts.length * turn - Math.PI / 2); return `<circle cx="${x}" cy="${y}" r="3"${i ? ' fill="none"' : ' fill="currentColor" stroke="none"'}/>`; }).join('');
  const label = `${p.name}’s sigil: ${p.traits.map(t => traits[t].name).join(', ')}`.replace(/"/g, '&quot;');
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${label}" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="50" cy="50" r="45"/><path d="${figure(first, 25, -Math.PI / 2)}"/><path d="${figure(second, 12, Math.PI / 2)}" stroke-width="1.2"/><path d="M${at(40, rim).join(' ')} L${at(49, rim).join(' ')}" stroke-width="3"/>${marks}</svg>`;
}

// The first screen: two roads meeting under a low sun, and someone already
// waiting at the crossing with a light. Its colours are the theme's (the r-*
// classes in euphonia.css).
export const crossroadsSvg = `<svg viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false"><defs><linearGradient id="r-sky" x1="0" y1="0" x2="0" y2="1"><stop class="r-sky-top" offset="0"/><stop class="r-sky-low" offset="1"/></linearGradient><radialGradient id="r-glow"><stop class="r-glow-in" offset="0"/><stop class="r-glow-out" offset="1"/></radialGradient></defs><rect class="r-sky" width="1000" height="176"/>${[[90, 44], [190, 92], [268, 36], [372, 72], [470, 32], [604, 54], [688, 102], [784, 40], [902, 80], [952, 34]].map(([x, y], i) => `<circle class="r-star" cx="${x}" cy="${y}" r="${i % 3 ? 0.9 : 1.4}"/>`).join('')}<circle class="r-sun" cx="742" cy="168" r="30"/><path class="r-earth" d="M0 172 C160 150 300 166 430 160 S700 150 1000 170 V300 H0Z"/><path class="r-way" d="M486 176 L512 176 L920 300 L800 300 L500 192 L200 300 L80 300Z"/><path class="r-way" d="M0 214 C180 205 340 196 500 190 C660 196 820 205 1000 214 V220 C820 212 660 204 500 198 C340 204 180 212 0 220Z"/><circle class="r-glow" cx="535" cy="151" r="58"/><path class="r-figure" d="M478 198 L482 178 Q497 172 512 178 L516 198Z"/><path class="r-figure" d="M486 176 C486 160 490 150 496 146 C490 141 491 130 499 129 C507 130 508 141 502 146 C509 150 512 158 513 166 L532 169 L536 192 L529 193 L526 176 L506 178 L503 180Z"/><path class="r-figure" d="M503 153 L532 146 L533 149 L506 160Z"/><path class="r-flame" d="M535 145 C540 150 540 156 535 158 C530 156 530 150 535 145Z"/></svg>`;
