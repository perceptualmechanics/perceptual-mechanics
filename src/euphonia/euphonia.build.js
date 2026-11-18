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
export const builderLink = state => `/euphonia/?${PARAM}=${encode(state)}#builder`;
