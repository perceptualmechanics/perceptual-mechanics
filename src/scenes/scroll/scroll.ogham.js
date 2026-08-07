// ─── Ogham transliteration ─────────────────────────────────────────────────
// A letter-for-letter cipher from the Latin alphabet into Ogham Unicode
// (U+1680–U+169A), not a claim of scholarly Old Irish orthography. The 20
// core letters (A B C D E F G H I L M N O P Q R S T U Z) use their real,
// well-attested traditional sound values. The historical Ogham alphabet has
// no letters for J K V W X Y — English simply has six more letters than Old
// Irish did — so those six are assigned to Ogham's five "forfeda" (the
// later-added supplementary letters, originally diphthongs/rare sounds) plus
// Ngeadal, as a stylized modern adaptation. X→Eamhancholl is itself a fairly
// common convention; the other five are this project's own reasonable
// choice, not a documented historical mapping.

const OGHAM_MAP = {
  A: 'ᚐ', // Ailm
  B: 'ᚁ', // Beith
  C: 'ᚉ', // Coll
  D: 'ᚇ', // Dair
  E: 'ᚓ', // Eadhadh
  F: 'ᚃ', // Fearn
  G: 'ᚌ', // Gort
  H: 'ᚆ', // Uath
  I: 'ᚔ', // Iodhadh
  J: 'ᚍ', // Ngeadal (stylized)
  K: 'ᚕ', // Eabhadh, forfeda (stylized)
  L: 'ᚂ', // Luis
  M: 'ᚋ', // Muin
  N: 'ᚅ', // Nion
  O: 'ᚑ', // Onn
  P: 'ᚚ', // Peith
  Q: 'ᚊ', // Ceirt
  R: 'ᚏ', // Ruis
  S: 'ᚄ', // Sail
  T: 'ᚈ', // Tinne
  U: 'ᚒ', // Ur
  V: 'ᚖ', // Or, forfeda (stylized)
  W: 'ᚗ', // Uilleand, forfeda (stylized)
  X: 'ᚙ', // Eamhancholl, forfeda (X is a fairly common convention)
  Y: 'ᚘ', // Ifín, forfeda (stylized)
  Z: 'ᚎ', // Straif
};

const SPACE_MARK = ' '; // OGHAM SPACE MARK — traditional word-divider

// Letters map, whitespace collapses to a single word-space mark, everything
// else (punctuation, digits, quote marks) is silently dropped — Ogham
// inscriptions didn't carry Latin punctuation, so this reads as an honest
// transliteration rather than a broken one full of missing-glyph gaps.
export function toOgham(str) {
  let out = '';
  let lastWasSpace = true; // suppress a leading space mark
  for (const ch of str) {
    if (/[a-zA-Z]/.test(ch)) {
      out += OGHAM_MAP[ch.toUpperCase()];
      lastWasSpace = false;
    } else if (/\s/.test(ch)) {
      if (!lastWasSpace) {
        out += SPACE_MARK;
        lastWasSpace = true;
      }
    }
  }
  return out.replace(new RegExp(SPACE_MARK + '$'), '');
}
