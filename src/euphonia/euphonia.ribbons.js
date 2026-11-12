// The ribbons carry one line of words, like a belt round a wheel at the
// window's left edge: a word drifts left across the top ribbon and, as it
// leaves, comes in on the left of the bottom one and drifts right. The bottom
// carries the line in reverse and runs the same loop backwards, so the two
// stay in step with no offset (euphonia.css). Both drift at one pace whatever
// the line's length: each loop carries a ribbon by one copy of the line, so it
// lasts that copy's width over the pace. They pause together under the
// pointer, on focus or with the button, which pauses the Wheel's ambient life
// too (euphonia.ambient.js). For a reader who asks for less motion
// they stand still: the top scrolls by hand, the bottom turns with it as the
// belt would, and the button has nothing to do.
//
// The rules sit at the capitals' tops and feet. Words in scripts without
// capitals reach above or below them, so each ribbon is padded by the
// farthest any word's ink reaches, measured in its faces once they load.

const PACE = 24; // CSS pixels a second: a word passes in about four.

const top = document.querySelector('.euphonia-top');
const button = top?.querySelector('.motion-pause');
const upper = top?.querySelector('.ribbon-top');
const lower = top?.querySelector('.ribbon-bottom');
const still = matchMedia('(prefers-reduced-motion: reduce)');

if (button && upper && lower) {
  const line = upper.querySelector('.ribbon-words');
  // The belt: the top scrolled by s leaves the bottom scrolled by a line less s.
  // Drifting again, both start from the loop's beginning: a top left where a
  // reader scrolled it would no longer hand its words to the bottom.
  const follow = () => {
    if (still.matches) lower.scrollLeft = line.offsetWidth - upper.scrollLeft;
    else upper.scrollLeft = lower.scrollLeft = 0;
  };
  const pace = new ResizeObserver(() => {
    const length = line.offsetWidth;
    if (!length) return;
    for (const r of [upper, lower]) r.style.setProperty('--ribbon-seconds', `${length / PACE}s`);
    follow();
  });
  pace.observe(line);
  const { fontSize, fontFamily } = getComputedStyle(upper);
  const reach = () => {
    const ink = document.createElement('canvas').getContext('2d');
    ink.font = `${fontSize} ${fontFamily}`;
    const cap = ink.measureText('H').actualBoundingBoxAscent;
    let above = 0, below = 0;
    for (const word of line.querySelectorAll('[lang]')) {
      const m = ink.measureText(word.textContent.toLocaleUpperCase(word.lang));
      above = Math.max(above, m.actualBoundingBoxAscent - cap);
      below = Math.max(below, m.actualBoundingBoxDescent);
    }
    top.style.setProperty('--ribbon-above', `${Math.ceil(above)}px`);
    top.style.setProperty('--ribbon-below', `${Math.ceil(below)}px`);
  };
  document.fonts.load(`${fontSize} ${fontFamily}`, line.textContent.toUpperCase()).then(reach);
  upper.addEventListener('scroll', follow, { passive: true });
  const offer = () => { button.hidden = still.matches; follow(); };
  still.addEventListener('change', offer);
  offer();
  button.addEventListener('click', () => {
    const paused = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(paused));
    top.classList.toggle('motion-paused', paused);
  });
}
