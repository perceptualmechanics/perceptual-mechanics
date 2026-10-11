// The browser's side of bench.place.js: the permission, the position and the
// time-zone table. Coordinates stay in memory; nothing here touches the network
// or storage, and the zone table loads only when it is needed.
import { parseZoneTab, parseLinks, zonePlace } from './bench.place.js';

let zoneData = null;
async function loadZones() {
  zoneData ??= Promise.all([import('./zone.tab?raw'), import('./backward?raw')])
    .then(([tab, back]) => ({ zones: parseZoneTab(tab.default), links: parseLinks(back.default) }));
  return zoneData;
}

export async function zoneFallback() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) return { kind: 'equal' };
  const { zones, links } = await loadZones();
  const place = zonePlace(zone, zones, links);
  return place ? { kind: 'zone', ...place } : { kind: 'equal' };
}

export async function geolocationState() {
  if (!('geolocation' in navigator)) return 'unsupported';
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return 'prompt';
  }
}

// Resolves to a place or null. Only ever called after the visitor asked for it,
// or when the browser already holds their permission.
export function requestPosition() {
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ kind: 'sky', lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 6 * 3600000, timeout: 15000 },
    );
  });
}
