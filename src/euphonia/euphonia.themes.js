// The page's themes (euphonia.themes.json) as the stylesheet reads them: each
// theme's tokens as custom properties, the first theme's on the root, every
// theme's under its own data-theme. Pure, so the build serves it to the page
// and the gates hold it to its data.
import themes from './euphonia.themes.json' with { type: 'json' };

export const THEMES = themes.themes;
// How every theme's globe stands in its mount; a theme only turns it.
export const GLOBE = themes.globe;
// Where a reader's chosen theme is kept, and the address's word for it
// (?theme=…, so a link carries it, as ?c= carries a character).
export const THEME_KEY = 'pm-euphonia-theme', THEME_PARAM = 'theme';

const declarations = t => [...Object.entries(t.tokens).map(([k, v]) => `--${k}: ${v};`), `--type: ${t.type};`].join(' ');
export const themeCss = (list = THEMES) =>
  [`:root { ${declarations(list[0])} }`, ...list.map(t => `:root[data-theme="${t.id}"] { ${declarations(t)} }`)].join('\n');

// Which roles the page sets on which, for the contrast gate: text needs 4.5
// to 1 (WCAG 2.2 AA, 1.4.3), and the marks that show a control's state or
// focus need 3 (1.4.11). Left out on purpose: a disabled control's text
// (1.4.3 exempts inactive components), and rules and dividers, which mark
// no control. The globe's lettering sits on its sea under a halo of the
// ground; it is held to the sea, the lighter of the two.
export const CONTRAST = [
  ...[['text', 'ground'], ['text', 'surface-deep'], ['text', 'surface'], ['text-soft', 'ground'], ['text-soft', 'surface-deep'],
    ['text-quiet', 'ground'], ['text-quiet', 'surface-deep'], ['text-quiet', 'surface'], ['text-muted', 'ground'], ['text-muted', 'surface-deep'],
    ['text-muted', 'surface-tab'], ['text-faint', 'ground'], ['text-faint', 'surface-deep'], ['text-dim', 'ground'], ['text-dim', 'surface-deep'],
    ['text-cite', 'surface-deep'], ['accent', 'ground'], ['accent', 'surface-deep'], ['accent', 'surface'], ['accent', 'surface-tab'],
    ['accent-bright', 'ground'], ['accent-bright', 'surface-deep'], ['accent-bright', 'surface-tab'], ['paper', 'case'], ['paper', 'ground'],
    ['ink', 'paper'], ['sheet-muted', 'paper'], ['sheet-mark', 'paper'], ['case', 'paper'], ['signal-text', 'ground'], ['signal-text', 'surface-deep'],
    ['mention-text', 'mention'], ['ground', 'skip'], ['text', 'map-sea'], ['text', 'map-land'], ['text', 'map-relief-lit'],
    ['accent-bright', 'map-sea'], ['map-lettering', 'map-sea'], ['map-sun', 'map-sea'], ['print-ink', 'print-paper']].map(([fg, bg]) => ({ fg, bg, need: 4.5 })),
  ...[['focus', 'ground'], ['focus', 'surface-deep'], ['focus', 'surface'], ['signal', 'ground'], ['frame', 'surface'], ['frame', 'ground']].map(([fg, bg]) => ({ fg, bg, need: 3 })),
];
