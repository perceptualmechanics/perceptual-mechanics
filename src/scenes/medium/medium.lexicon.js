
import { BODY, RANKS } from './medium.words.js';

const ZIPF = 0.55;

const FLOOR = 0.02;

const MAX_CONTEXT = 12;

const A = 97;

let words = null;      // the lexicon, sorted, decoded once on first use
let weight = null;     // Float64Array, parallel: Zipf weight of each word

function ensure() {
  if (words) return;
  const body = BODY.replace(/\n/g, '');
  const ranks = RANKS.replace(/\n/g, '');
  words = new Array(ranks.length);
  weight = new Float64Array(ranks.length);
  const byBucket = new Float64Array(64);
  for (let b = 0; b < 64; b++) byBucket[b] = Math.pow(Math.pow(2, b / 1.5), -ZIPF);
  let prev = '', n = 0;
  for (let i = 0; i < body.length;) {
    const k = body.charCodeAt(i++) - 48;
    let j = i;
    while (j < body.length && body.charCodeAt(j) >= A) j++;
    const w = prev.slice(0, k) + body.slice(i, j);
    words[n] = w;
    weight[n] = byBucket[ranks.charCodeAt(n) - 48];
    n++; prev = w; i = j;
  }
}

function lower(p) {
  let lo = 0, hi = words.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (words[m] < p) lo = m + 1; else hi = m; }
  return lo;
}

function span(p) {
  if (!p) return [0, words.length];
  const lo = lower(p);
  const hi = lower(p.slice(0, -1) + String.fromCharCode(p.charCodeAt(p.length - 1) + 1));
  return [lo, hi];
}

export function letterWeights(context) {
  ensure();
  const out = new Float32Array(26);
  const [lo, hi] = span(context);
  const n = context.length;
  let total = 0;
  for (let i = lo; i < hi; i++) {
    const w = words[i];
    if (w.length <= n) continue;             // the context is itself this word
    const c = w.charCodeAt(n) - A;
    out[c] += weight[i]; total += weight[i];
  }
  if (total <= 0) { out.fill(1); return out; }
  const floor = (total * FLOOR) / 26;
  let max = 0;
  for (let c = 0; c < 26; c++) { out[c] += floor; if (out[c] > max) max = out[c]; }
  for (let c = 0; c < 26; c++) out[c] /= max;
  return out;
}

export function createContext() {
  return { text: '', live: '' };
}

export function advance(ctx, ch) {
  ensure();
  const c = ch.toLowerCase();
  if (c < 'a' || c > 'z') { ctx.text += ch; ctx.live = ''; return ctx.live; }
  ctx.text += ch;
  let p = (ctx.live + c).slice(-MAX_CONTEXT);
  while (p) {
    const [lo, hi] = span(p);
    let live = false;
    for (let i = lo; i < hi; i++) if (words[i].length > p.length) { live = true; break; }
    if (live) break;
    p = p.slice(1);
  }
  ctx.live = p;
  return p;
}

export function isWord(context) {
  ensure();
  if (!context) return false;
  const i = lower(context);
  return i < words.length && words[i] === context;
}

const FATIGUE_DEPTH = 0.6;
const FATIGUE_HALFLIFE = 30;
const FATIGUE_FLOOR = 0.02;

const GAMMA_COLD = 0.20;
const GAMMA_HOT = 0.85;
const GAMMA_FULL = 5;      // characters of context at which it is fully committed

function gammaFor(context) {
  const t = Math.min(1, context.length / GAMMA_FULL);
  return GAMMA_COLD + (GAMMA_HOT - GAMMA_COLD) * t;
}
const FLAT = { digit: 0.06, word: 0.04, goodbye: 0.02 };

const PUNCT_WARM = 0.62;
const PUNCT_COLD = 0.03;

export function createReader() {
  return { ctx: createContext(), row: letterWeights(''), tired: new Map() };
}

export function decayReader(r, dt) {
  if (!r.tired.size) return;
  const k = Math.pow(0.5, dt / FATIGUE_HALFLIFE);
  for (const [ch, v] of r.tired) {
    const next = v * k;
    if (next < FATIGUE_FLOOR) r.tired.delete(ch); else r.tired.set(ch, next);
  }
}

export function weightOf(r, mark) {
  let w;
  if (mark.kind === 'letter') {
    w = Math.pow(r.row[mark.ch.charCodeAt(0) - 65], gammaFor(r.ctx.live));
  } else if (mark.kind === 'punct') {
    w = (mark.w ?? 0.5) * (isWord(r.ctx.live) && r.ctx.live.length >= 2 ? PUNCT_WARM : PUNCT_COLD);
  } else {
    w = mark.ch === 'GOODBYE' ? FLAT.goodbye : FLAT[mark.kind] ?? 0.05;
  }
  const t = r.tired.get(mark.ch);
  if (t) w *= 1 - FATIGUE_DEPTH * t;
  return Math.max(0.002, w);
}

export function takeMark(r, mark) {
  r.tired.set(mark.ch, 1);
  if (mark.ch === 'GOODBYE') { r.ctx = createContext(); r.row = letterWeights(''); return ''; }
  if (mark.kind === 'letter') { advance(r.ctx, mark.ch); r.row = letterWeights(r.ctx.live); return mark.ch; }
  r.ctx = createContext();
  r.row = letterWeights('');
  if (mark.kind === 'punct') return `${mark.ch} `;
  return mark.kind === 'digit' ? mark.ch : ` ${mark.ch} `;
}

export function readerHasWord(r) { return isWord(r.ctx.live) && r.ctx.live.length >= 3; }

export function readerWord(r) { return r.ctx.live; }

export function lexiconSize() { ensure(); return words.length; }
