// The sigils as drawings, in the nav's own line: a 24-unit box, a 1.3 stroke,
// round ends. Each was drawn against the reference glyph in Unicode's code
// charts (U2600.pdf, U1F700.pdf) for the code point bench.text.js gives it.
// Drawn rather than set as text so no font is needed and no platform turns a
// planet into an emoji.
export const SIGIL_PATHS = {
  sun: `
        <circle cx="12" cy="12" r="8.5"/>
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>`,
  moon: `
        <path d="M9.4 3.4A9 9 0 1 1 9.4 20.6A7.2 7.2 0 1 0 9.4 3.4Z"/>`,
  mercury: `
        <path d="M8.6 3A3.4 3.4 0 0 0 15.4 3"/>
        <circle cx="12" cy="10.4" r="3.9"/>
        <path d="M12 14.3V21.5M8.8 18.1H15.2"/>`,
  venus: `
        <circle cx="12" cy="8.6" r="5.2"/>
        <path d="M12 13.8V21.5M8.6 17.8H15.4"/>`,
  mars: `
        <circle cx="9.6" cy="14.4" r="5.4"/>
        <path d="M13.4 10.6L19.8 4.2M14.6 4.2H19.8V9.4"/>`,
  jupiter: `
        <path d="M5.8 6.6C6.6 3.9 11.2 3.4 11.2 7.1C11.2 10.3 8.4 13 5.6 15.2H19.2"/>
        <path d="M15.4 8.6V21"/>`,
  saturn: `
        <path d="M6.2 6.2H12.6M9.4 3V15.6"/>
        <path d="M9.4 15.6C9.4 12.2 11.2 10.8 13.2 10.8C15.6 10.8 16.6 13 15.6 15.4C14.8 17.4 14.2 18.8 16.8 20.6"/>`,
  quintessence: `
        <path d="M12.8 4.8C7.6 3.6 3.8 6.6 3.8 12C3.8 17.4 7.6 20.4 12.8 19.2"/>
        <path d="M12.8 4.6V19.4M12.8 4.6H19.6M12.8 12H18.4M12.8 19.4H19.6"/>
        <path d="M8.4 16.4L5.6 21"/>`,
  air: `
        <path d="M12 3.6L20.6 19.2H3.4Z"/>
        <path d="M2.8 13.2H21.2"/>`,
  fire: `
        <path d="M12 3.6L20.6 19.2H3.4Z"/>`,
  earth: `
        <path d="M12 20.4L20.6 4.8H3.4Z"/>
        <path d="M2.8 10.8H21.2"/>`,
  water: `
        <path d="M12 20.4L20.6 4.8H3.4Z"/>`,
  sulfur: `
        <path d="M12 2.8L16.8 11H7.2Z"/>
        <path d="M12 11V21.6M8.2 16.4H15.8"/>`,
  salt: `
        <circle cx="12" cy="12" r="8.5"/>
        <path d="M3.5 12H20.5"/>`,
};

// The <svg> element the nav and the registry carry, in the indentation the
// prerendered markup has always used.
export function sigilSvg(key) {
  const paths = SIGIL_PATHS[key];
  if (!paths) throw new Error(`sigilSvg: no drawing for "${key}"`);
  return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${paths}
      </svg>`;
}
