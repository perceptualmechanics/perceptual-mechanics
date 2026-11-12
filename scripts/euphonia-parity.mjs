// Reference parity for the themes: the page in its reference theme against a
// build of the page before it (a commit's), state by state. Every element's
// computed look is compared in nine states (the globe, Contents, This
// moment, The ribbons, a chapter, the builder blank and full, print, a
// phone), and both canvases block by block, all under reduced motion so the
// Wheel's ambient frame holds still, each build captured in turn in the same
// minute (the planets are placed for the minute). It needs a browser, so it
// runs by hand, not in the build:
//
//   Chrome --headless=new --remote-debugging-port=9333 --use-angle=swiftshader --enable-unsafe-swiftshader
//   node scripts/euphonia-parity.mjs http://localhost:4174 http://localhost:4173 [--theme letters]
//
// The first address serves the reference build, the second the candidate.
// It prints every difference, grouped, and exits non-zero on any.

const PORT = process.env.CDP_PORT ?? 9333;
const [refBase, candBase] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const theme = process.argv.includes('--theme') ? process.argv[process.argv.indexOf('--theme') + 1] : null;
if (!refBase || !candBase) { console.error('usage: node scripts/euphonia-parity.mjs <reference address> <candidate address> [--theme id]'); process.exit(2); }

const PROPS = ['color', 'background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-width', 'border-left-width', 'outline-color', 'outline-style', 'outline-width', 'text-decoration-color', 'fill', 'stroke', 'box-shadow',
  'text-shadow', 'caret-color', 'accent-color', 'scrollbar-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-caps',
  'letter-spacing', 'line-height', 'text-transform', 'opacity', 'mask-image', 'display', 'visibility'];
const wait = ms => new Promise(r => setTimeout(r, ms));
// Elements keyed by their path through the document, so two builds of the
// same markup line up.
const GRAB = `(() => { const props = ${JSON.stringify(PROPS)}, rows = {};
  const path = el => { const p = []; for (let e = el; e && e.nodeType === 1 && e !== document.documentElement; e = e.parentElement) { let i = 0; for (let s = e; (s = s.previousElementSibling);) if (s.tagName === e.tagName) i++; p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '[' + i + ']'); } return p.join('>'); };
  for (const el of document.querySelectorAll('body, body *')) { if (el.closest('script, style, template')) continue; const cs = getComputedStyle(el); rows[path(el)] = props.map(p => cs.getPropertyValue(p)).join('|'); }
  for (const pseudo of ['::before', '::after']) { const el = document.querySelector('.ribbon-words li'); if (el) { const cs = getComputedStyle(el, pseudo); rows[path(el) + pseudo] = props.map(p => cs.getPropertyValue(p)).join('|'); } }
  return rows; })()`;
// Each canvas as sums over 8×8 blocks: small enough to carry, fine enough to
// place a difference.
const BLOCKS = `[...document.querySelectorAll('.map-disc canvas')].map(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height, out = [];
  for (let by = 0; by < H; by += 8) for (let bx = 0; bx < W; bx += 8) { let s = 0; for (let y = by; y < Math.min(H, by + 8); y++) for (let x = bx; x < Math.min(W, bx + 8); x++) { const i = (y * W + x) * 4; s += d[i] + d[i + 1] + d[i + 2] + d[i + 3]; } out.push(s); }
  return { size: W + 'x' + H, W, blocks: out }; })`;

async function capture(base) {
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const still = [{ name: 'prefers-reduced-motion', value: 'reduce' }];
  const go = async (w, h, ms) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 }); await send('Page.navigate', { url: `${base}/euphonia/${theme ? `?theme=${theme}` : ''}` }); await wait(ms); };
  const click = async (sel, ms = 300) => { await ev(`document.querySelector(${JSON.stringify(sel)})?.click()`); await wait(ms); };
  const snap = {};
  await send('Emulation.setEmulatedMedia', { features: still });
  await go(1440, 900, 9000);
  snap.globe = await ev(GRAB); const canvases = await ev(BLOCKS);
  await click('.map-contents-open', 400); snap.contents = await ev(GRAB);
  await click('[data-page="moment"]'); snap.moment = await ev(GRAB); await click('.map-panel-back button', 200);
  await click('[data-page="ribbons"]'); snap.ribbons = await ev(GRAB); await click('.map-panel-back button', 200);
  await click('.map-panel-contents [data-region]', 400); await click('.map-panel-places button', 600); snap.chapter = await ev(GRAB);
  await click('.map-panel-close', 400); await click('#tab-builder', 800);
  await ev(`[...document.querySelectorAll('.b-button')].find(x => /Start again/.test(x.textContent))?.click()`); await wait(500); snap['builder blank'] = await ev(GRAB);
  for (let r = 0; r < 4; r++) { await ev(`(() => { for (const s of document.querySelectorAll('.builder-form select')) if (!s.value && s.options.length > 1) { s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); } })()`); await wait(300); }
  snap['builder full'] = await ev(GRAB);
  await send('Emulation.setEmulatedMedia', { media: 'print', features: still }); await wait(300); snap.print = await ev(GRAB);
  await send('Emulation.setEmulatedMedia', { features: still }); await go(390, 844, 8000); snap.phone = await ev(GRAB);
  ws.close();
  return { snap, canvases };
}

const ref = await capture(refBase), cand = await capture(candBase);
let differ = 0;
const grouped = new Map();
for (const [state, rows] of Object.entries(ref.snap)) {
  for (const [key, value] of Object.entries(rows)) {
    const other = cand.snap[state]?.[key];
    if (other === value) continue;
    differ++;
    if (other === undefined) { grouped.set(`missing in the candidate: ${key}`, [state]); continue; }
    const a = value.split('|'), b = other.split('|');
    a.forEach((v, i) => { if (v !== b[i]) { const g = `${PROPS[i]}: ${v} → ${b[i]}`; grouped.set(g, (grouped.get(g) ?? []).concat(`${state}: ${key.split('>').slice(-2).join('>')}`)); } });
  }
}
ref.canvases.forEach((r, i) => {
  const c = cand.canvases[i], changed = r.blocks.filter((v, j) => v !== c?.blocks[j]).length;
  if (!c || c.size !== r.size || changed) { differ++; grouped.set(`canvas ${i} (${r.size} vs ${c?.size}): ${changed} of ${r.blocks.length} blocks differ`, ['—']); }
});
const states = Object.values(ref.snap).reduce((n, rows) => n + Object.keys(rows).length, 0);
console.log(`${states} element states and ${ref.canvases.length} canvases compared: ${differ} differ`);
for (const [g, where] of grouped) console.log(`  ${where.length}× ${g}   e.g. ${where[0]}`);
process.exit(differ ? 1 : 0);
