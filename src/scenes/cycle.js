// ─── Cycle: the five-element live stream ──────────────────────────────────────
// The elements/live-stream concept fully spec'd out in NOTES.md's "pending
// decisions" this whole time, finally built. Five real, currently-live
// streams — one per classical element — embedded via the YouTube iframe API,
// switched between with a small ring of controls. No canvas, no WebGL,
// same reasoning as theater.js: this is documentary footage of the actual
// world, not something to render — DOM and iframes are the honest choice.
//
// Roster (see NOTES.md for the full research trail and backups):
//   Earth — GlobalQuake, 24/7 live seismic plot, auto-detects quakes worldwide
//   Water — the Explore.org Smith River / redwoods cam
//   Air   — YallBot, Ryan Hall Y'all's 24/7 AI weather broadcast
//   Fire  — USGS Kilauea Cam A
//   Wood  — Chattahoochee National Forest live cam
//
// Fire is the only element with a dedicated text-overlay source: Fire.doc's
// word-association litany (2003, author: Scott Cohen) — reserved for exactly
// this since it was first found. It plays over the fire stream only, one
// phrase fading in at a time, warm and additive, like embers.
//
// Every stream can go offline (seasonal, maintenance, the channel's own
// choices) — YouTube gives no reliable cross-origin signal for that from
// inside an iframe, so rather than fake a "stream down" detector, each
// element carries a real backup link the visitor can open by hand.
//
// Reworked 2026-07-17 — Scott: four of the five embeds had gone dark.
// Root cause, on inspection: three of the five (water/fire/wood) were
// pinned to one specific YouTube video ID each. That's the wrong pattern
// for something meant to be permanently live — a "24/7 live" broadcast on
// YouTube still periodically ends and restarts under a brand new video
// ID (the channel doesn't change, the ID does), so a hardcoded ID is
// only ever temporarily correct and this was always going to recur.
// Earth and Air were already using the self-updating pattern
// (embed/live_stream?channel=<channel ID>, which always redirects to
// whatever that channel currently has live, no ID to go stale) and it's
// possible one or both still broke anyway if the channel itself stopped
// streaming or moved platforms (GlobalQuake, for one, also streams to
// Twitch and isn't necessarily live on YouTube at every moment).
//
// This pass: every element that has a real, verifiable 24/7-streaming
// YouTube channel now uses the self-updating channel pattern instead of
// a pinned ID, which removes the "stale video ID" failure mode for good.
// Where that wasn't available, kept a specific ID but swapped weak
// backups (a couple were literally raw YouTube search-results URLs,
// which aren't a real fallback) for concrete, durable, non-YouTube
// destinations that don't share YouTube's own outage/ID-churn risk.
// Also made the primary-source link a visible button (see .cyc-primary
// below) rather than a footnote, since no embed of this kind can ever be
// fully failure-proof against the source's own churn — the visitor
// should always have an obvious, immediate way to the real thing.
//
// Caveat, in the interest of honesty: this sandbox has no working
// browser tool this session, so these were researched via web search,
// not confirmed live in a browser one by one. Worth a quick spot-check.
const ELEMENTS = [
  {
    key: 'earth',
    label: 'Earth',
    note: 'GlobalQuake — live seismic plot, auto-detects earthquakes worldwide as they happen.',
    embed: 'https://www.youtube.com/embed/live_stream?channel=UCZmcd4cQ2H_ELWAuUdOMgRQ&autoplay=0',
    primaryUrl: 'https://www.youtube.com/@GlobalQuake/live',
    backupLabel: 'USGS real-time earthquake map',
    backupUrl: 'https://earthquake.usgs.gov/earthquakes/map/',
    color: '#7a6a4f',
    icon: `<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="4"/><line x1="12" y1="3" x2="12" y2="21"/><path d="M3 9h18M3 15h18"/>`,
  },
  {
    key: 'water',
    label: 'Water',
    note: 'The Smith River, Jedediah Smith Redwoods State Park — old-growth forest, no development in frame.',
    embed: 'https://www.youtube.com/embed/WUqQdNAUC1c?autoplay=0',
    primaryUrl: 'https://www.explore.org/livecams/zen-den/live-redwood-cam-1',
    backupLabel: 'All of Explore.org’s live cams',
    backupUrl: 'https://explore.org/livecams',
    color: '#3d6fa5',
    icon: `<path d="M2 9c2 -2 4 -2 6 0s4 2 6 0 4 -2 6 0"/><path d="M2 15c2 -2 4 -2 6 0s4 2 6 0 4 -2 6 0"/>`,
  },
  {
    key: 'air',
    label: 'Air',
    note: "YallBot — Ryan Hall, Y'all's 24/7 AI weather broadcast, radar and storm analysis.",
    embed: 'https://www.youtube.com/embed/live_stream?channel=UCJHAT3Uvv-g3I8H3GhHWV7w&autoplay=0',
    primaryUrl: 'https://ryanhallyall.com/yallbot',
    backupLabel: 'Windy — live weather radar',
    backupUrl: 'https://www.windy.com/',
    color: '#4f7a8c',
    icon: `<path d="M3 8h11a3 3 0 1 0 -3 -3"/><path d="M3 12h15a3 3 0 1 1 -3 3"/><path d="M3 16h9a3 3 0 1 1 -3 3"/>`,
  },
  {
    key: 'fire',
    label: 'Fire',
    note: 'USGS Kilauea, Cam A — thermal-capable, covers no-glow nights.',
    embed: 'https://www.youtube.com/embed/iws3rh5vLAQ?autoplay=0',
    primaryUrl: 'https://www.usgs.gov/volcanoes/kilauea/multimedia/webcams',
    backupLabel: 'VolcanoDiscovery — Stromboli webcams',
    backupUrl: 'https://www.volcanodiscovery.com/stromboli-webcams.html',
    color: '#b8341f',
    icon: `<path d="M12 2c1 3 -3 4 -3 8a3 3 0 0 0 6 0c0 -1 -1 -2 -1 -3c1 1 2 3 2 5a4 4 0 0 1 -8 0c0 -5 4 -6 4 -10z"/>`,
  },
  {
    key: 'wood',
    label: 'Wood',
    note: 'Chattahoochee National Forest — real-time, no music, North Georgia mountains.',
    embed: 'https://www.youtube.com/embed/mFB6KZnjhy0?autoplay=0',
    primaryUrl: 'https://www.youtube.com/watch?v=mFB6KZnjhy0',
    backupLabel: 'Explore.org’s live cams',
    backupUrl: 'https://explore.org/livecams',
    color: '#1f7a4d',
    icon: `<path d="M12 3v18"/><path d="M12 7 L7 11 M12 7 L17 11 M12 12 L8 16 M12 12 L16 16"/>`,
  },
];

// Fire.doc's opening word-association litany (2003, Barnes & Noble in the
// Valley) — the piece's exact designated use, per NOTES.md, since the day it
// was found. Kept as short standalone phrases, one per line as originally
// written; the longer two-part dialogue scene from the same document is used
// elsewhere (the scroll, as fireVigil/fireCalamity) and deliberately not
// repeated here.
const FIRE_LITANY = [
  'Fire.', 'Burn.', 'Sun.', 'Light.', 'Everything is illuminated.', 'Stars and bars.',
  'Firewater.', 'Apocalypse.', 'Genocide.', "I've never given it any thought.",
  'Seemingly uncaring.', 'The ash.', 'Ash Wednesday.', 'Eating ashes.',
  'The ashes in the alchemical work.', 'Satori, plucked from the fireplace.',
  'Fireplace. Place for fire.', 'Fahrenheit 451.', 'Under God.', 'Flag burning.',
  'Tearing up from the smoke.', 'Blanking out the sun.', 'Stellar fusion.',
  'The heart of the reactor.', 'The heart.', 'Blood.', 'Red blood cells.',
  'Energy production.', 'ATP, ADP.', 'Chemistry.', 'Ignition.', 'Without a thought.',
  'The Fire of the Lord.', 'A pure and noble flame.', 'Firefight.',
  'Keep the home fires burning.', 'Waiting for the soldiers to come home.',
  'Candlelight in the window.', 'Pushing back the darkness.',
  'The smell of a fire. The smell of chemistry.', 'Bunsen burner.', 'Bonfire.',
  'Gathering.', 'Beach bonfire.', 'Burning Man.', 'Set your creations afire.',
  'Sexual passion.', 'A motivating force.',
  'Wordless. Beyond words. Beyond thought. Not a thought. No time to think.',
];

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || document.getElementById('cycle-styles')) { stylesInjected = true; return; }
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'cycle-styles';
  style.textContent = `
    .cyc-preview {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: radial-gradient(circle at 50% 45%, #0c1410 0%, #000 72%);
    }
    .cyc-preview-ring { position: relative; width: 62%; height: 62%; }
    .cyc-preview-dot {
      position: absolute; width: 13%; height: 13%; border-radius: 50%;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(var(--a)) translate(2.6em) rotate(calc(-1 * var(--a)));
      background: var(--c);
      opacity: 0.55;
      animation: cyc-pulse 4.5s ease-in-out infinite;
      animation-delay: var(--d);
    }
    @keyframes cyc-pulse {
      0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) rotate(var(--a)) translate(2.6em) rotate(calc(-1 * var(--a))) scale(0.85); }
      50% { opacity: 0.95; transform: translate(-50%, -50%) rotate(var(--a)) translate(2.6em) rotate(calc(-1 * var(--a))) scale(1.15); }
    }

    .cyc-root {
      width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 1.4rem; padding: 5rem 1.5rem 2rem;
      font-family: 'Electrolize', sans-serif;
      color: #fff;
    }
    .cyc-screen-wrap {
      position: relative;
      width: min(78vw, 900px);
      aspect-ratio: 16 / 9;
      background: #000;
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      overflow: hidden;
    }
    .cyc-screen-wrap iframe { width: 100%; height: 100%; border: 0; display: block; }
    .cyc-litany {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      text-align: center; padding: 2rem;
      pointer-events: none;
      mix-blend-mode: screen;
      font-family: 'Times New Roman', serif;
      font-style: italic;
      font-size: clamp(1.1rem, 3.4vw, 2.1rem);
      color: rgba(255, 170, 90, 0.88);
      text-shadow: 0 0 22px rgba(255, 120, 40, 0.7), 0 0 50px rgba(255, 80, 0, 0.35);
      opacity: 0;
      transition: opacity 1.1s ease;
    }
    .cyc-litany.visible { opacity: 1; }

    .cyc-info {
      max-width: min(78vw, 900px);
      text-align: center;
      font-size: 0.8rem;
      line-height: 1.6;
      color: rgba(255,255,255,0.55);
    }
    .cyc-info .cyc-note { color: rgba(255,255,255,0.7); margin-bottom: 0.6rem; }
    .cyc-info a { color: rgba(255,220,170,0.75); }
    .cyc-info a:hover { color: rgba(255,220,170,1); }
    /* A visible, always-present way to the real source — no embed of this
       kind (iframe pointed at someone else's stream) can be fully
       failure-proof against the source's own churn, so this shouldn't be
       a footnote the visitor has to hunt for. */
    .cyc-primary {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.5rem 1.1rem; margin-bottom: 0.5rem;
      border: 1px solid var(--c, rgba(255,220,170,0.5));
      border-radius: 999px;
      color: var(--c, #ffdca8) !important;
      font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase;
      text-decoration: none;
      transition: background 0.2s;
    }
    .cyc-primary:hover { background: color-mix(in srgb, var(--c, #fff) 16%, transparent); }
    .cyc-backup { display: block; font-size: 0.72rem; }

    .cyc-ring {
      display: flex; gap: 0.8rem; flex-wrap: wrap; justify-content: center;
    }
    .cyc-btn {
      display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 0.6rem 1rem;
      cursor: pointer; color: rgba(255,255,255,0.55);
      transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s;
      font-family: 'Electrolize', sans-serif;
      font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase;
    }
    .cyc-btn svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
    .cyc-btn:hover { transform: translateY(-2px); color: #fff; border-color: rgba(255,255,255,0.3); }
    .cyc-btn.active {
      color: var(--c, #fff);
      border-color: var(--c, rgba(255,255,255,0.5));
      background: color-mix(in srgb, var(--c, #fff) 14%, transparent);
    }
    .cyc-btn:focus-visible { outline: 2px solid rgba(255,255,255,0.6); outline-offset: 2px; }

    @media (max-width: 640px) {
      .cyc-root { padding: 5.5rem 1rem 1.5rem; gap: 1rem; }
      .cyc-screen-wrap { width: 92vw; }
      .cyc-btn { padding: 0.5rem 0.7rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      .cyc-preview-dot { animation: none; opacity: 0.7; }
      .cyc-litany { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

export function createCycle(container, { preview = false } = {}) {
  injectStyles();

  if (preview) {
    const root = document.createElement('div');
    root.className = 'cyc-preview';
    root.setAttribute('aria-hidden', 'true');
    const ring = document.createElement('div');
    ring.className = 'cyc-preview-ring';
    ELEMENTS.forEach((el, i) => {
      const dot = document.createElement('div');
      dot.className = 'cyc-preview-dot';
      dot.style.setProperty('--a', `${(i / ELEMENTS.length) * 360}deg`);
      dot.style.setProperty('--c', el.color);
      dot.style.setProperty('--d', `${i * 0.6}s`);
      ring.appendChild(dot);
    });
    root.appendChild(ring);
    container.appendChild(root);
    return { dispose() { root.remove(); } };
  }

  const root = document.createElement('div');
  root.className = 'cyc-root';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Cycle — five live streams, one per classical element.');

  const screenWrap = document.createElement('div');
  screenWrap.className = 'cyc-screen-wrap';

  const iframe = document.createElement('iframe');
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.title = 'Live stream';
  screenWrap.appendChild(iframe);

  const litany = document.createElement('div');
  litany.className = 'cyc-litany';
  litany.setAttribute('aria-hidden', 'true');
  screenWrap.appendChild(litany);

  const info = document.createElement('div');
  info.className = 'cyc-info';
  const noteEl = document.createElement('div');
  noteEl.className = 'cyc-note';
  const linksEl = document.createElement('div');
  info.appendChild(noteEl);
  info.appendChild(linksEl);

  const ring = document.createElement('div');
  ring.className = 'cyc-ring';
  ring.setAttribute('role', 'group');
  ring.setAttribute('aria-label', 'Choose an element');

  const buttons = {};
  ELEMENTS.forEach(el => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cyc-btn';
    btn.style.setProperty('--c', el.color);
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `<svg viewBox="0 0 24 24">${el.icon}</svg><span>${el.label}</span>`;
    btn.addEventListener('click', () => selectElement(el.key));
    ring.appendChild(btn);
    buttons[el.key] = btn;
  });

  root.appendChild(screenWrap);
  root.appendChild(info);
  root.appendChild(ring);
  container.appendChild(root);
  container.style.position = 'relative';
  container.style.overflow = 'auto';

  // ─── Fire litany cycling ───────────────────────────────────────────────
  let litanyTimer = null;
  let litanyIdx = 0;
  function stopLitany() {
    if (litanyTimer) { clearInterval(litanyTimer); litanyTimer = null; }
    litany.classList.remove('visible');
  }
  function startLitany() {
    stopLitany();
    litanyIdx = Math.floor(Math.random() * FIRE_LITANY.length);
    const show = () => {
      litany.classList.remove('visible');
      setTimeout(() => {
        litany.textContent = FIRE_LITANY[litanyIdx % FIRE_LITANY.length];
        litanyIdx++;
        requestAnimationFrame(() => litany.classList.add('visible'));
      }, 400);
    };
    show();
    litanyTimer = setInterval(show, 4200);
  }

  let current = null;
  function selectElement(key) {
    if (current === key) return;
    current = key;
    const el = ELEMENTS.find(e => e.key === key);
    if (!el) return;

    Object.entries(buttons).forEach(([k, b]) => {
      const on = k === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    iframe.src = el.embed;
    iframe.title = `${el.label} — ${el.note}`;
    noteEl.textContent = el.note;
    info.style.setProperty('--c', el.color);
    linksEl.innerHTML = `<a class="cyc-primary" href="${el.primaryUrl}" target="_blank" rel="noopener noreferrer">watch at the source ↗</a>` +
      `<span class="cyc-backup">stream look stopped? ` +
      `<a href="${el.backupUrl}" target="_blank" rel="noopener noreferrer">${el.backupLabel} ↗</a></span>`;

    if (key === 'fire') startLitany();
    else stopLitany();
  }

  selectElement('fire'); // opens on fire — the litany is the strongest hook

  return {
    dispose() {
      stopLitany();
      iframe.src = 'about:blank';
      root.remove();
    }
  };
}
