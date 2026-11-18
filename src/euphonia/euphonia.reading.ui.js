// The Reading's three acts: the crossroads, who is waiting, and tonight. Each
// step has its own address (#reading-s1, #reading-reveal…), so the Back button
// walks them. The reading loads only its own file; the rules wait for tonight.
import map from 'virtual:euphonia-reading-map';
import { h } from './euphonia.dom.js';
import { blank, builderLink, encode } from './euphonia.build.js';
import { openSaves } from './euphonia.saves.js';
import { checkReading, steps, ranked, pages, why, freshPlay, act, tonight } from './euphonia.reading.js';
import { SYMBOLS, symbolSvg, sigilSvg, crossroadsSvg } from './euphonia.reading.symbols.js';

const files = import.meta.glob('./euphonia.reading.json', { query: '?url', import: 'default' });
const KEPT = 'pm-euphonia-reading', ROUTE = '#reading';
const signed = n => (n < 0 ? `−${-n}` : `+${n}`);
const roll = sides => 1 + Math.floor(Math.random() * sides);

export async function initReading(panel) {
  const stage = panel.querySelector('.r-stage'), door = panel.querySelector('.r-door'), label = panel.querySelector('.r-act'), road = panel.querySelector('.r-road');
  let d;
  try {
    d = (await (await fetch(await files['./euphonia.reading.json']())).json()).data;
    const wrong = checkReading(d, { drawn: Object.keys(SYMBOLS) });
    if (wrong.length) throw new Error(wrong[0]);
  } catch (err) {
    stage.replaceChildren(h('p', { role: 'status' }, `The reading didn’t load (${err.message}); reload the page to try again.`));
    return;
  }
  const saves = openSaves(), order = steps(d), pinOf = region => map.pins.find(p => p.name === region);
  let kept = {};
  try { kept = JSON.parse(sessionStorage.getItem(KEPT) ?? '{}'); } catch { /* it lasts as long as the page */ }
  let answers = kept.answers ?? {}, framed = kept.framed !== false, page = kept.page ?? 0, chosen = kept.chosen ?? null, rules = null;
  const keep = () => { try { sessionStorage.setItem(KEPT, JSON.stringify({ answers, framed, page, chosen })); } catch { /* as above */ } };
  const person = () => d.roster.find(p => p.id === chosen) ?? null;
  const go = step => { keep(); const hash = step === 'start' ? ROUTE : `${ROUTE}-${step}`; if (location.hash === hash) draw(); else location.hash = hash; };
  const sigil = p => h('span', { class: 'r-sigil', html: sigilSvg(p, d.traits, pinOf(p.region)?.x ?? 0) });
  function show(act, ...children) {
    label.textContent = act;
    const at = order.indexOf(location.hash.slice(ROUTE.length + 1) || 'start');
    road.replaceChildren(...order.slice(1).map((_, i) => h('li', { class: i + 1 < at ? 'is-past' : i + 1 === at ? 'is-here' : null })));
    stage.replaceChildren(...children.flat().filter(Boolean));
    stage.classList.toggle('is-question', at > 0 && at < order.indexOf('map'));
    door.href = person() ? builderLink(person().build) : answers.map ? builderLink({ ...blank(), homeland: answers.map.region }) : '#builder';
    const title = stage.querySelector('h2');
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'start' });
  }
  const FIRST = 'At the crossroads', SECOND = 'Who is waiting', THIRD = 'Tonight';
  const say = r => (framed ? `“${r.prompt}”` : r.plain_prompt);

  function start() {
    const f = framed ? d.frame.intro : d.frame.plain;
    show(FIRST, framed ? h('div', { class: 'r-open', html: crossroadsSvg }) : null, h('h2', {}, f.title), h('p', { class: 'r-lede' }, f.text), h('div', { class: 'r-row' },
      h('button', { type: 'button', class: 'b-button r-go', onclick: () => { answers = {}; page = 0; chosen = null; go(order[1]); } }, d.frame.begin),
      h('button', { type: 'button', class: 'b-button', onclick: () => { framed = !framed; keep(); draw(); } }, framed ? d.frame.skip : d.frame.restore)));
  }
  function symbols(i, step) {
    const r = d.symbols[i];
    show(FIRST, h('p', { class: 'r-count' }, `${i + 1} of ${d.symbols.length}`), h('h2', {}, say(r)), h('div', { class: 'r-symbols' }, r.options.map(o =>
      h('button', { type: 'button', class: 'r-symbol', 'aria-label': `${o.name}: ${o.description}`, title: o.name, html: symbolSvg(o.id), onclick: () => { answers[step] = { id: o.id, weights: o.weights }; go(order[order.indexOf(step) + 1]); } }))));
  }
  function dilemma(i, step) {
    const q = d.dilemmas[i];
    show(FIRST, h('p', { class: 'r-count' }, `${i + 1} of ${d.dilemmas.length}`), h('h2', {}, q.scene), h('div', { class: 'r-picks' }, q.options.map(o =>
      h('button', { type: 'button', class: 'r-pick', onclick: () => { answers[step] = { said: o.said, weights: o.weights }; go(order[order.indexOf(step) + 1]); } }, o.label))));
  }
  function where() {
    const choose = region => { answers.map = { region }; page = 0; go('reveal'); };
    const name = h('p', { class: 'r-mapname', 'aria-hidden': 'true' }, '\u00a0');
    const art = h('div', { class: 'r-map', html: `<svg viewBox="${map.viewBox}" role="img" aria-label="The world in 1668, with a mark on each region"><path class="grid" d="${map.grid}"/><path class="land" d="${map.land}"/>${map.pins.map(p => `<circle cx="${p.x}" cy="${p.y}" r="11" data-region="${p.name.replace(/"/g, '&quot;')}"><title>${p.name}</title></circle>`).join('')}</svg>` });
    art.addEventListener('click', e => { const r = e.target.dataset?.region; if (r) choose(r); });
    art.addEventListener('pointerover', e => { name.textContent = e.target.dataset?.region ?? '\u00a0'; });
    const light = (region, on) => { art.querySelector(`[data-region="${CSS.escape(region)}"]`)?.classList.toggle('is-here', on); name.textContent = on ? region : '\u00a0'; };
    show(FIRST, h('h2', {}, framed ? `“${d.map.prompt}”` : d.map.plain_prompt), art, name, h('div', { class: 'r-regions' }, map.pins.map(p => h('button', { type: 'button', onclick: () => choose(p.name), onpointerenter: () => light(p.name, true), onpointerleave: () => light(p.name, false), onfocus: () => light(p.name, true), onblur: () => light(p.name, false) }, p.name))));
  }
  function reveal() {
    const all = pages(ranked(d, answers)), shown = all[page % all.length];
    show(SECOND, h('h2', {}, page ? d.reveal.more : d.reveal.title), h('div', { class: 'r-cards' }, shown.map(p => {
      const because = why(d, p, answers);
      return h('article', { class: 'r-card' }, h('div', { class: 'r-head' }, sigil(p), h('div', {}, h('h3', {}, p.name), h('p', { class: 'r-from' }, p.region))), h('p', {}, p.line), h('p', { class: 'r-scene' }, p.scene),
        because.length ? h('p', {}, h('span', { class: 'r-label' }, 'Why you'), because.join('; ')) : null, h('p', {}, h('span', { class: 'r-label' }, 'To play'), p.play), h('p', { class: 'r-from' }, `${p.class}. ${p.class_note}`),
        h('div', { class: 'r-row' }, h('button', { type: 'button', class: 'b-button r-go', onclick: () => { chosen = p.id; go('tonight'); } }, 'This is me'), h('a', { href: builderLink(p.build) }, 'Change one thing')));
    })), all.length > 1 ? h('p', {}, h('button', { type: 'button', class: 'b-button', onclick: () => { page = (page + 1) % all.length; keep(); draw(); } }, 'Show me others')) : null);
  }
  async function sheet() {
    const p = person();
    show(THIRD, h('h2', {}, p.name), h('p', { role: 'status' }, 'Opening the sheet…'));
    try {
      if (!rules) { const [{ loadBook }, engine] = await Promise.all([import('./euphonia.book.js'), import('./euphonia.character.js')]); rules = { book: (await loadBook()).book, character: engine.character }; }
    } catch (err) { stage.replaceChildren(h('h2', {}, p.name), h('p', { role: 'status' }, `The rules didn’t load (${err.message}); reload the page to try again.`)); return; }
    if (location.hash !== `${ROUTE}-tonight`) return;
    const n = tonight(rules.character(rules.book, p.build)), id = `reading-${p.id}`;
    if (!saves.list().some(c => c.id === id)) saves.put(id, p.name, encode(p.build));
    let play = saves.play(id) ?? freshPlay(p, n.hp);
    const taught = new Set(), result = h('div', { class: 'r-result', 'aria-live': 'polite' }, h('p', {}, p.signature.line));
    const hp = h('output', {}), uses = h('small', {}), trick = h('button', { type: 'button', onclick: () => { update('signature'); tell(p.signature.line, 'signature'); } }, p.signature.name, uses);
    const paint = () => { hp.textContent = `${play.hp} / ${n.hp}`; uses.textContent = `${'●'.repeat(play.uses)}${'○'.repeat(p.signature.uses - play.uses)} until a ${p.signature.per} rest`; trick.disabled = !play.uses; };
    const update = what => { play = act(play, p, n.hp, what); saves.setPlay(id, play); paint(); };
    const tell = (text, lesson, strong) => { result.replaceChildren(...[h('p', {}, strong ? h('strong', {}, strong) : null, strong ? ' ' : null, text), lesson && !taught.has(lesson) ? h('p', { class: 'r-from' }, d.teach[lesson]) : null].filter(Boolean)); if (lesson) taught.add(lesson); };
    const attack = () => { const r = roll(20), total = r + n.attack.bonus; tell(`to hit, ${n.attack.damage} if it lands.`, null, String(total)); if (!taught.has('attack')) { result.append(h('p', { class: 'r-from' }, d.teach.attack.replace('{roll}', r).replace('{bonus}', signed(n.attack.bonus)))); taught.add('attack'); } };
    const attempt = t => { const r = roll(20); tell('', null, String(r + t.bonus)); if (!taught.has('try')) { result.append(h('p', { class: 'r-from' }, d.teach.try.replace('{roll}', r).replace('{bonus}', signed(t.bonus)))); taught.add('try'); } };
    const small = (text, onclick, name) => h('button', { type: 'button', class: 'b-button', 'aria-label': name, onclick }, text);
    stage.replaceChildren(h('article', { class: 'r-sheet' }, h('div', { class: 'r-side' },
      h('div', { class: 'r-top' }, sigil(p), h('div', {}, h('h2', { tabindex: '-1' }, p.name), h('p', { class: 'r-from' }, p.line))),
      h('div', {}, h('span', { class: 'r-label' }, 'Hit Points'), h('div', { class: 'r-hp' }, small('−', () => update('hurt'), 'Lose 1 Hit Point'), hp, small('+', () => update('heal'), 'Regain 1 Hit Point'),
        p.signature.per === 'short' ? small('Short rest', () => { update('short'); tell(d.teach.short ?? 'You catch your breath.'); }) : null, small('Long rest', () => { update('long'); tell(d.teach.long ?? 'You wake with everything back.'); }))),
      result), h('div', { class: 'r-side' },
      h('div', {}, h('span', { class: 'r-label' }, 'On your turn'), h('div', { class: 'r-acts' }, h('button', { type: 'button', onclick: attack }, 'Attack', h('small', {}, n.attack.name)), trick,
        h('button', { type: 'button', onclick: () => tell(`You can go up to ${n.speed} feet.`) }, 'Move', h('small', {}, `${n.speed} feet`)), h('button', { type: 'button', onclick: () => tell(d.teach.help) }, 'Help someone', h('small', {}, d.teach.help_short ?? '')))),
      h('div', {}, h('span', { class: 'r-label' }, 'If you try'), h('div', { class: 'r-acts' }, n.tries.map(t => h('button', { type: 'button', onclick: () => attempt(t) }, d.tries[t.ability], h('small', {}, signed(t.bonus))))))),
      h('details', {}, h('summary', {}, 'The full sheet'), h('p', {}, `Armor Class ${n.ac} · Initiative ${signed(n.initiative)} · ${Object.entries(n.mods).map(([a, m]) => `${a.slice(0, 3)} ${signed(m)}`).join(' · ')}`), h('p', {}, h('a', { href: p.sheet }, 'Who you could become'), ' · ', h('a', { href: builderLink(p.build) }, 'Open in the builder'))),
      h('p', { class: 'r-from' }, saves.ok ? 'Saved on this device.' : 'This browser can’t save, so this sheet resets when you close it.')));
    paint();
    stage.querySelector('h2').focus({ preventScroll: true });
  }
  function draw() {
    if (!location.hash.startsWith(ROUTE)) return;
    const step = location.hash.slice(ROUTE.length + 1) || 'start', at = order.indexOf(step);
    const missing = order.slice(1, Math.max(at, 1)).filter(s => /^[sd]\d/.test(s) && !answers[s]);
    if (at < 0 || missing.length || (at > order.indexOf('map') && !answers.map) || (step === 'tonight' && !person())) { go('start'); return; }
    if (step === 'start') start();
    else if (step[0] === 's') symbols(+step.slice(1) - 1, step);
    else if (step[0] === 'd') dilemma(+step.slice(1) - 1, step);
    else if (step === 'map') where();
    else if (step === 'reveal') reveal();
    else sheet();
  }
  addEventListener('hashchange', draw);
  draw();
}
