// A character as the builder holds it, and as the address carries it.
export const PARAM = 'c';
export const blank = () => ({ name: '', species: '', option: '', size: '', background: '', increases: {}, method: 'standard', base: {}, classes: [{ class: '', level: 1, subclass: '' }], skills: {}, improvements: {}, originFeats: {}, featLists: {}, spells: {}, homeland: '', market: '', styles: {}, expertise: {}, options: {}, optionArts: {}, languages: {} });

// Its choices as JSON, base64url.
export const encode = state => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(state)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function decode(code) {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const state = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    return state && typeof state === 'object' && Array.isArray(state.classes) ? { ...blank(), ...state } : null;
  } catch { return null; }
}
// A choice's options: every one it offers, each marked held where the
// character has it from elsewhere and didn't take it here.
export const choiceOptions = (from, chosen, held) => from.map(value => ({ value, held: !chosen.includes(value) && held(value) }));
// Where in the books a class or subclass of Euphonia's stands, as the export
// marks it (`place`): the main chapters, Life on the Border, A Player's
// Companion or the appendix. The menus group by it, in that order, each group
// labelled; until every one carries a place, they stay as one group, unsorted.
export const PLACES = [
  ['chapter', noun => `Euphonia’s core ${noun}`],
  ['border', noun => `${noun[0].toUpperCase()}${noun.slice(1)} from Life on the Border`],
  ['font', noun => `${noun[0].toUpperCase()}${noun.slice(1)} from A Player’s Companion`],
  ['appendix', noun => `Euphonia’s additional ${noun}`],
];
export const placeGroups = (list, noun) => (list.every(x => PLACES.some(([p]) => p === x.place))
  ? PLACES.map(([p, label]) => [label(noun), list.filter(x => x.place === p)]).filter(([, l]) => l.length)
  : list.length ? [[`Euphonia’s ${noun}`, list]] : []);
export const builderLink = state => `/euphonia/?${PARAM}=${encode(state)}#builder`;
