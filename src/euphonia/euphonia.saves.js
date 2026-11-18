// The characters kept on this device: each one's build, as the address carries
// it, and apart from it what happens to them in play, so a shared link never
// carries someone's wounds. Storage can be missing or refuse (a private
// window), and then this lasts as long as the page and says so through `ok`.
const LIST = 'pm-euphonia-saved', OLD = 'pm-euphonia-character', PLAY = 'pm-euphonia-play:';

function memory() {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
}
function usable(store) {
  try { store.setItem(`${LIST}:test`, '1'); store.removeItem(`${LIST}:test`); return true; } catch { return false; }
}

export function openSaves(given) {
  let store = given;
  try { store ??= localStorage; } catch { store = null; }
  const ok = Boolean(store) && usable(store);
  if (!ok) store = memory();
  const read = () => { try { return { list: [], open: null, ...JSON.parse(store.getItem(LIST) ?? '{}') }; } catch { return { list: [], open: null }; } };
  const write = v => store.setItem(LIST, JSON.stringify(v));
  // The one character the builder used to keep becomes the first of the list.
  const old = store.getItem(OLD);
  if (old) {
    const v = read();
    if (!v.list.some(c => c.code === old)) { v.list.push({ id: 'first', name: '', code: old }); v.open ??= 'first'; write(v); }
    store.removeItem(OLD);
  }
  return {
    ok,
    list: () => read().list,
    current: () => { const v = read(); return v.list.find(c => c.id === v.open) ?? null; },
    select(id) { write({ ...read(), open: id }); },
    put(id, name, code) {
      const v = read(), key = id ?? `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const at = v.list.findIndex(c => c.id === key), entry = { id: key, name, code };
      if (at >= 0) v.list[at] = entry; else v.list.push(entry);
      write({ ...v, open: key });
      return key;
    },
    remove(id) {
      const v = read();
      write({ list: v.list.filter(c => c.id !== id), open: v.open === id ? null : v.open });
      store.removeItem(PLAY + id);
    },
    play(id) { try { return JSON.parse(store.getItem(PLAY + id) ?? 'null'); } catch { return null; } },
    setPlay(id, play) { store.setItem(PLAY + id, JSON.stringify(play)); },
  };
}
