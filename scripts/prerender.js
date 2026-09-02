// ─── Prerender: the written work as real, crawlable pages ──────────────────
// Added 2026-07-29. Every scene on this site renders its text client-side,
// and only after a click — main.js's expandScene() is what builds the DOM,
// so nothing but the nav labels and the meta description existed in the
// served HTML. Crawlers execute JavaScript but don't click, which meant none
// of Scott's actual writing — the scroll, the poems, the fragments, the
// scripts, the found pieces — was indexed anywhere. Someone searching a line
// they remembered would never find it here.
//
// This emits a plain HTML page per body of work, built at deploy time from
// the same modules the scenes import (src/text/*), so a page can't drift
// from what the site shows. No client JS, no WebGL, no fonts required to
// read it: the text is in the markup.
//
// Framing is deliberate and consistent: each page leads with a link into the
// scene the writing belongs to, and says plainly that the piece is the real
// way to encounter it. The page is the archive; the scene is the work.
//
// Third-party text is excluded by policy — see buildLibrary() below.

import fs from 'fs';
import path from 'path';

import { scrollPieces } from '../src/scenes/scroll/scroll.text.js';
import { poems } from '../src/scenes/orbiter/orbiter.text.js';
import { fragments } from '../src/scenes/sphere/sphere.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';
import { PIECES as theaterPieces } from '../src/scenes/theater/theater.text.js';
import { ORRERY } from '../src/scenes/orrery/orrery.text.js';
import { EPIGRAPH_PRIMARY, EPIGRAPH_SECONDARY, BOUNCES } from '../src/scenes/beamline/beamline.text.js';
import {
  ELEMENTS, ELEMENT_BY_KEY, ALL_LINES, BALMER_LIMIT, RYDBERG_H, AUDIO_DIVISOR,
  SOURCES as APOLLO_SOURCES, SOLAR_MIXTURE, FRAUNHOFER,
  VISIBLE_MIN, VISIBLE_MAX, wavelengthToHz, visibleLines, balmerSeries, fraunhoferFor,
} from '../src/scenes/apollo/apollo.text.js';
import { SCENES, TEXT_EXEMPT } from '../src/scenes/registry.js';
import { getOutboundLinks } from '../src/links.js';

const ORIGIN = 'https://perceptualmechanics.com';
const AUTHOR = 'Scott Jason Cohen';

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function slug(s) {
  return String(s).toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// A small "open this exact piece in the live scene" link, placed right
// under a piece's own heading. Added 2026-08-16 alongside the live
// experience's own #scene/id deep-linking (main.js) — before that, this
// page's per-piece slug anchors (id="${slug(title)}" below) had nothing on
// the live-scene side to resolve to; a reader following one from outside
// the site could get to this page's own section but never into the actual
// scene at that specific piece, only its default state. No new CSS class:
// this inherits the page's own `a { color: #d9b13f }` rule already
// defined in page()'s <style>, same as every other link on the page.
function pieceLink(sceneKey, id, sceneName) {
  return `<p class="meta"><a href="/#${sceneKey}/${id}">Open in ${esc(sceneName)} →</a></p>`;
}

// Poems and prose arrive as raw strings with real newlines inside them.
// Paragraph breaks are already the array boundary; a newline *within* an
// entry is a deliberate line break (verse especially), so it survives as
// <br> rather than being collapsed the way HTML would collapse it.
function lines(text) {
  return esc(text).replace(/\n/g, '<br>\n');
}

// ─── Page styles ───────────────────────────────────────────────────────────
// Hoisted out of page() into its own constant for one reason: public/
// .htaccess's CSP allowlists this exact block by SHA-256 hash, and a hash is
// a derived artifact — precisely the kind this project's standing rules say
// not to maintain by hand. Keeping the style text and its hash adjacent, and
// exporting both, lets vite.config.js's pm-prerender-text plugin re-derive
// the hash from the page it actually emitted and fail the build on drift.
//
// It failed the other way once, silently: from v3.12.1 (CSP switched from
// Report-Only to enforcing) until v4.0, style-src was 'self' with no hash
// and no nonce, so the browser dropped the only stylesheet all eight /text/
// pages have. document.styleSheets.length === 0 in production the entire
// time — black-on-white Times at full window width, the archive unstyled,
// nothing in any log. The Report-Only pass that cleared the policy was a
// thorough audit of the SPA at / and never opened a page outside it. The
// enforcing policy also had no report-uri/report-to, so there was no channel
// for the violation to arrive on either; both halves of that are fixed in
// 4.0 (see .htaccess's CSP comment).
//
// The bytes hashed are exactly what sits between <style> and </style> in
// page() — which is exactly this template literal, leading and trailing
// newline included. One space changed in here changes the hash. That is the
// point: the next CSS tweak fails the build instead of unstyling the
// archive. Keep the shipped comments in here short for the same reason
// every other byte of this block is deliberate — it is duplicated verbatim
// into all eight pages, so the long-form reasoning lives up here, where it
// costs the reader of the archive nothing.
//
// The @font-face is new in 4.0 and fixes a second, quieter version of the
// same class of bug: these pages have declared `font-family: 'Arapey'`
// since they shipped (2026-07-29) while loading no font and linking no
// stylesheet, so every one of them silently rendered in the Georgia
// fallback — declared intent and actual result disagreeing with nothing
// anywhere to notice. The face is already self-hosted under /fonts/ (see
// styles/main.css's "Self-hosted fonts" block) and font-src 'self' already
// allows it, so matching the intent costs no policy change and one 8.8 kB
// request. Roman only, deliberately: the italic face is another 9.5 kB to
// serve two quiet elements (.note, ul.catalog .n), and a synthesized
// oblique is the right trade on a page whose whole promise is that it
// loads instantly and renders even if every other asset on the domain is
// unreachable. font-display: swap so the text is readable before the font
// arrives, matching main.css.
export const PAGE_STYLE = `
  :root { color-scheme: dark; }
  /* Self-hosted, the same face styles/main.css loads; font-src 'self'
     already allows it. Roman only — see this constant's own comment
     above for why, and for what this block was missing until 4.0. */
  @font-face { font-family: 'Arapey'; font-style: normal; font-weight: 400;
    font-display: swap; src: url('/fonts/arapey-400.woff2') format('woff2'); }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #0a0a0a; color: #ded9d0;
    font-family: 'Arapey', Georgia, 'Iowan Old Style', serif;
    font-size: 1.06rem; line-height: 1.72;
    -webkit-text-size-adjust: 100%;
  }
  .skip-link {
    position: absolute; left: -9999px; top: 0; background: #c9a227; color: #0a0a0a;
    padding: 0.6rem 1rem; z-index: 10; text-decoration: none;
  }
  .skip-link:focus { left: 0; }
  .wrap { max-width: 40rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  a { color: #d9b13f; }
  a:hover, a:focus { color: #f0cf6a; }
  header.masthead { border-bottom: 1px solid #2a2620; padding-bottom: 1.4rem; margin-bottom: 2rem; }
  header.masthead a.home {
    font-family: 'Arapey', serif; letter-spacing: 0.34em; text-transform: uppercase;
    font-size: 0.66rem; color: #8c8377; text-decoration: none;
  }
  header.masthead a.home:hover, header.masthead a.home:focus { color: #d9b13f; }
  h1 { font-size: 1.9rem; line-height: 1.25; margin: 1.1rem 0 0.3rem; font-weight: 600; }
  .kicker { color: #8c8377; font-size: 0.86rem; margin: 0; }
  .lede {
    border-left: 2px solid #4a4034; padding: 0.9rem 0 0.9rem 1.1rem; margin: 2rem 0 2.6rem;
    color: #b8b0a4; font-size: 0.98rem;
  }
  .lede p { margin: 0 0 0.7rem; }
  .lede p:last-child { margin-bottom: 0; }
  .enter {
    display: inline-block; margin-top: 0.4rem; font-size: 0.82rem;
    letter-spacing: 0.16em; text-transform: uppercase; text-decoration: none;
    border: 1px solid #6b5a37; padding: 0.55rem 1rem; color: #d9b13f;
  }
  .enter:hover, .enter:focus { background: #1a160f; border-color: #d9b13f; }
  article.piece { margin: 0 0 4rem; }
  article.piece > h2 {
    font-size: 1.34rem; margin: 0 0 0.15rem; font-weight: 600; line-height: 1.3;
    scroll-margin-top: 1rem;
  }
  .meta { color: #8c8377; font-size: 0.8rem; letter-spacing: 0.08em; margin: 0 0 1.3rem; }
  .note {
    color: #9c9384; font-size: 0.88rem; font-style: italic;
    border-left: 1px solid #3a342b; padding-left: 0.9rem; margin: 0 0 1.4rem;
  }
  p { margin: 0 0 1.15rem; }
  .script { margin: 1.6rem 0; font-family: 'Courier New', Courier, monospace; font-size: 0.92rem; line-height: 1.6; }
  .script .slug { text-transform: uppercase; letter-spacing: 0.06em; color: #c4bcae; margin-bottom: 1rem; }
  .script .action { margin-bottom: 0.9rem; }
  .script .cue { margin: 0 0 0.15rem; padding-left: 5.5rem; text-transform: uppercase; letter-spacing: 0.08em; color: #c4bcae; }
  .script .paren { margin: 0 0 0.1rem; padding-left: 4.5rem; color: #9c9384; }
  .script .line { margin: 0 0 0.9rem; padding-left: 3rem; }
  ul.catalog { list-style: none; padding: 0; margin: 0 0 2.4rem; }
  ul.catalog li { border-bottom: 1px solid #1e1b17; padding: 0.85rem 0; }
  ul.catalog .t { font-weight: 600; }
  ul.catalog .c { color: #a89f92; }
  /* #837c70, not the #7d766b this started as: at 0.8rem this is normal-size
     text for WCAG purposes, and #7d766b measured 4.41:1 against the ground —
     under AA's 4.5:1. Raised just far enough to clear it (4.79:1) while
     staying the quietest line in the entry. Same call as the orrery panel's
     era line in 1.6.0. */
  ul.catalog .e { display: block; color: #837c70; font-size: 0.8rem; margin-top: 0.15rem; }
  ul.catalog .n { display: block; color: #9c9384; font-size: 0.88rem; font-style: italic; margin-top: 0.4rem; }
  nav.index ul { list-style: none; padding: 0; }
  nav.index li { border-bottom: 1px solid #1e1b17; padding: 1rem 0; }
  nav.index a { font-size: 1.15rem; text-decoration: none; }
  nav.index a:hover, nav.index a:focus { text-decoration: underline; }
  nav.index .d { display: block; color: #8c8377; font-size: 0.9rem; margin-top: 0.25rem; }
  footer { border-top: 1px solid #2a2620; margin-top: 3rem; padding-top: 1.4rem; color: #837c70; font-size: 0.85rem; }
  footer a { text-decoration: none; }
  @media (max-width: 600px) { .wrap { padding: 1.75rem 1.05rem 4rem; } h1 { font-size: 1.6rem; } }
`;

// SHA-256 of PAGE_STYLE, base64-encoded, in the exact form CSP's style-src
// wants. This same string must appear in style-src in public/.htaccess.
// Don't compute it by hand: change the CSS, run `npx vite build`, and the
// pm-prerender-text plugin's error prints the value to paste here and there
// (it checks the emitted page and .htaccess, not just this constant, so a
// stale copy in either place fails the build rather than the site).
export const PAGE_STYLE_SHA256 = 'sha256-d0twYSj0NZ/Ct7lC+jDlJkrOgWCQWNuFC2UoM+NHawU=';

// ─── Page shell ─────────────────────────────────────────────────────────────
// One self-contained template. Styles are inlined rather than shipped as a
// shared stylesheet: these pages are meant to survive on their own, load
// instantly, and render fully even if every other asset on the domain is
// unreachable. Colors are the site's own — near-black ground, warm bone text,
// the colophon's gold for links — checked against WCAG AA at these sizes.
function page({ slugPath, title, description, sceneKey, sceneName, lede, bodyHtml, jsonLd }) {
  const url = `${ORIGIN}/text/${slugPath ? slugPath + '/' : ''}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(title)} — perceptual mechanics</title>
<meta name="description" content="${esc(description)}"/>
<meta name="author" content="${AUTHOR}"/>
<link rel="canonical" href="${url}"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="${url}"/>
<meta property="og:title" content="${esc(title)} — perceptual mechanics"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:image" content="${ORIGIN}/social-card.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)} — perceptual mechanics"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${ORIGIN}/social-card.png"/>
<meta name="theme-color" content="#000000"/>
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>
<style>${PAGE_STYLE}</style>
</head>
<body>
<a href="#main" class="skip-link">Skip to the text</a>
<div class="wrap">
<header class="masthead">
  <a class="home" href="/">perceptual mechanics</a>
  <h1>${esc(title)}</h1>
  <p class="kicker">${esc(description)}</p>
</header>
<main id="main">
${lede ? `<div class="lede">
${lede}
${sceneKey ? `<a class="enter" href="/#${sceneKey}">Open ${esc(sceneName)} →</a>` : ''}
</div>` : ''}
${bodyHtml}
</main>
<footer>
  <p><a href="/text/">All the writing</a> · <a href="/">The site itself</a></p>
  <p>© 2026 ${AUTHOR}. All rights reserved.</p>
</footer>
</div>
</body>
</html>
`;
}

function creativeWork(title, description, slugPath, partTitles = []) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: title,
    description,
    url: `${ORIGIN}/text/${slugPath ? slugPath + '/' : ''}`,
    author: { '@type': 'Person', name: AUTHOR },
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'perceptual mechanics', url: `${ORIGIN}/` },
  };
  if (partTitles.length) {
    ld.hasPart = partTitles.map(t => ({ '@type': 'CreativeWork', name: t, author: { '@type': 'Person', name: AUTHOR } }));
  }
  return ld;
}

// ─── Sections ───────────────────────────────────────────────────────────────

function renderScript(scriptLines) {
  const out = scriptLines.map(l => {
    if (l.type === 'slug') return `<p class="slug">${esc(l.text)}</p>`;
    if (l.type === 'action') return `<p class="action">${esc(l.text)}</p>`;
    if (l.type === 'dialogue') {
      return `<p class="cue">${esc(l.character)}</p>`
        + (l.parenthetical ? `<p class="paren">${esc(l.parenthetical)}</p>` : '')
        + `<p class="line">${lines(l.text)}</p>`;
    }
    return `<p>${esc(l.text ?? '')}</p>`;
  }).join('\n');
  return `<div class="script">\n${out}\n</div>`;
}

function buildScroll() {
  const body = scrollPieces.map(p => {
    const paras = p.body.map((para, i) => {
      let out = `<p>${lines(para)}</p>`;
      if (p.script && p.script.after === i) out += '\n' + renderScript(p.script.lines);
      return out;
    }).join('\n');
    return `<article class="piece" id="${slug(p.title)}">
<h2>${esc(p.title)}</h2>
<p class="meta">${esc(p.date)}</p>
${pieceLink('scroll', p.id, 'the Scroll')}
${p.excerpt ? `<p class="note">${esc(p.excerpt)}</p>` : ''}
${paras}
</article>`;
  }).join('\n\n');

  return {
    slugPath: 'scroll',
    title: 'A Scroll of Found Writing',
    description: 'Twelve prose pieces, 2000 to the 2010s — the complete texts carried on the Scroll.',
    sceneKey: 'scroll', sceneName: 'the Scroll',
    lede: `<p>These twelve pieces live on <strong>the Scroll</strong> — a hide-and-bark scroll you unroll, patch lashed to patch, oldest and most soot-stained at the top. That is where they are meant to be read.</p>
<p>The Scroll shows them bare, with no titles or dates, on purpose. This page is the archive rather than the work: same words, in the same order, with enough information to tell you what you are looking at.</p>`,
    bodyHtml: body,
    jsonLd: creativeWork('A Scroll of Found Writing', 'Twelve prose pieces, 2000 to the 2010s.', 'scroll', scrollPieces.map(p => p.title)),
  };
}

function buildPoems() {
  const body = poems.map(p => `<article class="piece" id="${slug(p.title)}">
<h2>${esc(p.title)}</h2>
${pieceLink('orbiter', p.id, 'Orbiter')}
${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
${p.stanzas.map(s => `<p>${lines(s)}</p>`).join('\n')}
</article>`).join('\n\n');

  return {
    slugPath: 'poems',
    title: 'Poems',
    description: `${poems.length} poems by Scott Jason Cohen — the verse carried by the satellites in Orbiter.`,
    sceneKey: 'orbiter', sceneName: 'Orbiter',
    lede: `<p>Each of these is carried by one of the satellites orbiting the p-orbital cloud in <strong>Orbiter</strong>; you read them by clicking a satellite as it comes around.</p>
<p>Collected here as plain text so they can be found and read directly.</p>`,
    bodyHtml: body,
    jsonLd: creativeWork('Poems', 'Collected poems by Scott Jason Cohen.', 'poems', poems.map(p => p.title)),
  };
}

function buildFragments() {
  // The fragments' cross-links used to be hand-typed straight into the
  // fragment's own HTML (`<a class="fragment-link" data-target="Wingspan">`),
  // so this function used to just rewrite that attribute into an ordinary
  // in-page anchor. Since the 2026-08-16 linking pass those links live in
  // src/links.js instead (getOutboundLinks), same as every other scene's —
  // this now wires them the same way sphere.js does at runtime, just
  // targeting an in-page `#slug` anchor instead of a live-panel data
  // attribute, since every fragment is on this one page.
  const body = fragments.map(f => {
    let html = f.text;
    getOutboundLinks('sphere', f.id, 'text').forEach(l => {
      const target = fragments.find(fr => fr.id === l.to.id);
      if (!target) return;
      html = html.replace(l.phrase, `<a href="#${slug(target.title)}">${l.phrase}</a>`);
    });
    return `<article class="piece" id="${slug(f.title)}">
<h2>${esc(f.title)}</h2>
${pieceLink('sphere', f.id, 'the Sphere')}
${html}
</article>`;
  }).join('\n\n');

  return {
    slugPath: 'fragments',
    title: 'Fragments',
    description: `${fragments.length} interlinked text fragments — the writing carried on the faces of the Sphere.`,
    sceneKey: 'sphere', sceneName: 'the Sphere',
    lede: `<p>These fragments sit on the faces of <strong>the Sphere</strong>, which you turn in space; phrases inside them link through to other faces, so reading it is a matter of following the connections around the object.</p>
<p>The links below still work — they point to the same fragments, further down this page.</p>`,
    bodyHtml: body,
    jsonLd: creativeWork('Fragments', 'Interlinked prose fragments by Scott Jason Cohen.', 'fragments', fragments.map(f => f.title)),
  };
}

function buildTheater() {
  // theater.text.js organizes its three plays as separate pieces (2026-08-08)
  // — grouped here the same way library.js groups books/films/decks: an
  // <h2> per piece (its title and date), with each scene inside it still
  // getting its own <article class="piece"> (now headed <h3>, since the
  // piece itself now owns the <h2> level).
  const body = theaterPieces.map(piece => {
    const scenesHtml = piece.scenes.map(sc => {
      const beats = sc.beats.map(b => {
        if (b.a) return `<p class="action">${esc(b.a)}</p>`;
        if (b.c) {
          const name = piece.characters[b.c]?.name ?? b.c;
          return `<p class="cue">${esc(name)}${b.voice ? ' (offstage)' : ''}</p>`
            + `<p class="line">${lines(b.t ?? '')}</p>`;
        }
        return '';
      }).filter(Boolean).join('\n');
      return `<article class="piece" id="${slug(sc.slug)}">
<h3>${esc(sc.slug)}</h3>
<div class="script">
${beats}
</div>
</article>`;
    }).join('\n\n');

    return `<section class="piece-group">
<h2>${esc(piece.title)}</h2>
<p class="meta">${esc(piece.date)}</p>
${scenesHtml}
</section>`;
  }).join('\n\n');

  const allScenes = theaterPieces.flatMap(p => p.scenes);

  return {
    slugPath: 'theater',
    title: 'Scenes from Three Scripts',
    description: 'Verbatim scenes from Truth and Beauty (2001), Paul Revere (c. 2009), and You’ve Got a Friend in Satan (1996).',
    sceneKey: 'theater', sceneName: 'the Theater',
    lede: `<p>In <strong>the Theater</strong> these are performed by ASCII actors in a little repertory house, reshuffled into a different program every time you walk in.</p>
<p>Printed here as script, grouped by which of the three plays each scene belongs to. All dialogue is verbatim; the selection is curated, not the complete plays.</p>`,
    bodyHtml: body,
    jsonLd: creativeWork('Scenes from Three Scripts', 'Verbatim scenes from three scripts by Scott Jason Cohen.', 'theater', allScenes.map(s => s.slug)),
  };
}

function buildOrrery() {
  const body = `<article class="piece">
<p class="meta">${esc(ORRERY.era)}</p>
${ORRERY.note.split(/\n\s*\n/).map(p => `<p>${lines(p.trim())}</p>`).join('\n')}
</article>`;
  return {
    slugPath: 'orrery',
    title: ORRERY.name,
    description: 'A found account of a thirty-foot orrery discovered in a Los Feliz warehouse.',
    sceneKey: 'orrery', sceneName: 'the Orrery',
    lede: `<p>The account below is the placard inside <strong>the Orrery of Los Feliz</strong> — a warehouse you can walk around, with the machine it describes built at full scale in the middle of it.</p>`,
    bodyHtml: body,
    jsonLd: creativeWork(ORRERY.name, 'A found account of a thirty-foot orrery in a Los Feliz warehouse.', 'orrery'),
  };
}

function buildBeamline() {
  // Each bounce gets its own id="p<id>" + live deep-link now (added
  // 2026-08-16) — it had neither before, since BOUNCES had no id field at
  // all until this pass gave every scene's pieces one (see NOTES.md's
  // "Linking & addressing" entry). "p" prefix, not the bare number: HTML5
  // technically allows an id to start with a digit, but it isn't a valid
  // CSS identifier that way (`#7 { ... }` doesn't parse without escaping)
  // and reads oddly as a URL fragment on its own — unlike sphere/orbiter/
  // scroll above, which already had title-derived slug ids before this
  // pass and keep them unchanged, beamline never had per-piece ids on this
  // page at all, so there's no existing convention here to stay
  // consistent with; "p<id>" is the new one, used here and in
  // buildLibrary below.
  const body = `<article class="piece">
<p class="note">${esc(EPIGRAPH_PRIMARY)}</p>
<p class="note">${esc(EPIGRAPH_SECONDARY)}</p>
${BOUNCES.map((b, i) => `<h2 id="p${b.id}">Bounce ${i + 1}</h2>\n${pieceLink('beamline', b.id, 'Beamline')}\n<p>${lines(b.text)}</p>`).join('\n')}
</article>`;
  return {
    slugPath: 'beamline',
    title: 'Beamline',
    description: 'A staged sequence of mirrors, bouncing light and found text together — the piece staged in Beamline.',
    sceneKey: 'beamline', sceneName: 'Beamline',
    lede: `<p>In <strong>Beamline</strong> a beam of light travels a staged path between curved mirrors, real reflection geometry bouncing it from one to the next; this text surfaces at each bounce point in turn.</p>
<p>Here it is as one continuous piece, epigraph first.</p>`,
    bodyHtml: body,
    jsonLd: creativeWork('Beamline', 'Found text staged across a mirror bounce sequence.', 'beamline'),
  };
}


// ─── Apollo ─────────────────────────────────────────────────────────────────
// The eleventh scene's page, and the first one whose content is a table of
// measurements rather than a body of writing. It is still required, and the
// scenes-sum assertion below is what makes that non-optional: Apollo publishes
// real content — the element table, the wavelengths, the physics — and a scene
// carrying real content with no crawlable page ships unfindable.
//
// Every number here is generated from apollo.text.js, the same module the
// instrument imports. Not a copy of it: hydrogen's wavelengths are computed by
// calling the same function the scene calls, and the pitch beside each line is
// the same division. If the physics changes, this page changes with it or the
// build fails; there is no third place holding a stale duplicate.
function buildApollo() {
  const hz = nm => wavelengthToHz(nm).toFixed(1);
  const balmer = balmerSeries({ nMax: 16 });
  const greek = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];

  const balmerList = `<ul class="catalog">
${balmer.map((l, i) => `<li><span class="t">${l.nm.toFixed(3)} nm</span>
<span class="c">n = ${l.n} to 2${i < greek.length ? ` · H-${greek[i]}` : ''} · ${hz(l.nm)} Hz</span></li>`).join('\n')}
</ul>`;

  const solarList = `<ul class="catalog">
${Object.entries(SOLAR_MIXTURE).sort((a, b) => b[1] - a[1]).map(([key, d]) => {
    const el = ELEMENT_BY_KEY[key];
    const letters = visibleLines(el).map(([nm]) => [nm, fraunhoferFor(nm, key)]).filter(([, L]) => L);
    return `<li><span class="t">${esc(el.name)}</span>
<span class="c">${Math.round(d * 100)}% in the light${letters.length ? ' · Fraunhofer ' + letters.map(([nm, L]) => `${esc(L)} ${nm.toFixed(1)}nm`).join(', ') : ''}</span>
<span class="n">${esc(el.character)}</span></li>`;
  }).join('\n')}
</ul>`;

  const elementList = `<ul class="catalog">
${ELEMENTS.map(el => {
    const ls = visibleLines(el);
    const strongest = ls.slice().sort((a, b) => b[1] - a[1])[0];
    return `<li><span class="t">${esc(el.name)} (${esc(el.symbol)})</span>
<span class="c">${ls.length} line${ls.length === 1 ? '' : 's'} between ${VISIBLE_MIN} and ${VISIBLE_MAX} nm · strongest at ${strongest[0].toFixed(3)} nm, ${hz(strongest[0])} Hz${el.computed ? ' · computed, not tabulated' : ''}</span>
<span class="n">${esc(el.character)}</span>
<span class="e">${esc(el.note)}</span>
<span class="e">${ls.map(([nm]) => nm.toFixed(3)).join(' · ')}</span></li>`;
  }).join('\n')}
</ul>`;

  const body = `<article class="piece">
<h2 id="the-mechanism">The mechanism</h2>
<p>A star is hotter inside than out. The light leaving it starts as a continuous band — every wavelength at once, brightest in the yellow-green where the eye happens to be most sensitive — and then it has to cross the star's own outer atmosphere on the way out. Every element up there absorbs at its own exact set of wavelengths and at no others. So the light that arrives has holes in it, and the holes say what the star is made of.</p>
<p>Joseph von Fraunhofer found them in sunlight in 1814 and labelled the strongest with letters. Some of those letters are still the names: the sodium <em>D</em> lines, calcium <em>H</em> and <em>K</em>, the magnesium <em>b</em> triplet. He did not know what any of them were. Nobody did for another forty-five years.</p>
<p>Apollo is that mechanism with the controls exposed. Ten elements sit on faders; moving one puts that element in the light's path, and its lines appear in the band because it is now absorbing. Two or three together is how a star is actually read. Clicking a dark line sounds its wavelength as a pitch, which means the thing you play is the absence.</p>

<h2 id="hydrogen">Hydrogen, computed</h2>
<p>Hydrogen has one electron, and one electron is the case that has a closed-form answer. The Rydberg formula gives every line in the series exactly:</p>
<p class="note">1/&lambda; = R (1/2&sup2; &minus; 1/n&sup2;), for n = 3, 4, 5, &hellip;</p>
<p>with R = ${RYDBERG_H.toExponential(6)} per metre — the Rydberg constant with the correction for a proton that is heavy but not infinitely heavy, which is the difference between landing on the published wavelengths and missing them in the third figure. The formula gives a vacuum wavelength; every table of visible lines gives an air wavelength, because that is what a spectrograph on the ground measures, so the result is passed through the standard refraction formula. These are computed on page load, not typed in:</p>
${balmerList}
<p>The lines crowd tighter as n rises and converge on the series limit at ${BALMER_LIMIT.toFixed(3)} nm, just past the violet edge of the band. They do not stop there because anything runs out — infinitely many of them pile up in the last fraction of a nanometre, and past the limit the spectrum goes continuous. That convergence is the best thing the scene has to show, which is why it is calculated rather than listed.</p>
<p>Everything else is looked up, and has to be. Sodium's doublet, iron's forest and helium's scatter come out of many-body quantum mechanics that nobody solves in closed form, in a browser or anywhere else. Deriving them would be work that does not show and would produce wrong numbers.</p>

<h2 id="pitch">Wavelength as pitch</h2>
<p>A wavelength has a real frequency: the speed of light divided by it. For the sodium D line that is about 509 trillion cycles a second, which is not a sound. Dividing by ${AUDIO_DIVISOR.toExponential(0)} is the entire mapping — no scale, no rounding to the nearest note, no tuning per element — so the intervals you hear are the intervals you see.</p>
<p>That puts the whole visible band between ${wavelengthToHz(VISIBLE_MAX).toFixed(0)} Hz at the deep red end and ${wavelengthToHz(VISIBLE_MIN).toFixed(0)} Hz at the violet. Which is a fact about light rather than a choice: ${VISIBLE_MAX} divided by ${VISIBLE_MIN} is 1.97, so the visible spectrum is almost exactly one octave wide. The instrument has one octave and cannot have more.</p>
<p>Shorter wavelength is higher frequency, so violet is treble and red is bass. Sodium is the case worth listening to: its two lines are 0.597 nm apart, which after the division is ${(wavelengthToHz(588.995) - wavelengthToHz(589.592)).toFixed(2)} Hz apart — and two tones half a hertz apart are not two notes, they are one note that swells and fades about every two seconds. The visible spacing is the harmonic relationship. Iron, at the other end, has fifty lines here and sounds like a wall.</p>

<h2 id="sunlight">The sun, playing itself</h2>
<p>Apollo has an idle state, which nothing else on this site has: every other scene sits still until it is touched. Turn on <strong>Sunlight</strong> and the instrument puts the sun's own composition in the light and lets its lines sound on their own — irregular, unsynchronised, each one weighted by how deep it actually is.</p>
<p>The composition is not an even mix and not a taste. Once the three atmospheric oxygen bands are set aside — those are absorbed by Earth's air on the way in, not by the sun — five elements own every remaining labelled line in the standard Fraunhofer table:</p>
${solarList}
<p>The other five elements in the instrument sit at zero, which is a fact about the sun rather than an omission. <strong>Helium is the one worth naming.</strong> It was found <em>in the sun</em> in 1868, twenty-seven years before anyone found it on Earth, and it is still not part of the sun's visible fingerprint: its D3 line at 587.6nm belongs to the chromosphere and to prominences, not to the photospheric absorption spectrum this band draws. The element named after the sun is not in the sun's visible signature.</p>
<p class="note">A note on how much of each, because a number in a table reads as measured. The ordering above is sourced — it is the Fraunhofer table. The fader positions are not: what a fader controls is column density in this particular model, with Gaussian line profiles and NIST intensities standing in for strength, and no published quantity maps onto that. Solar equivalent widths would be the right physical input and no machine-readable table of them was within reach. Photospheric abundances are available and would be actively wrong here, since they would put helium second and calcium near nothing, when calcium's H and K are the deepest features in the visible solar spectrum. Abundance is not line strength. So the values were set to reproduce the sourced ordering and each was checked by computing the optical depth it produces, rather than by looking at the result.</p>
<p class="note">And one place where it does not come out right, said plainly because it is measurable. Magnesium's b triplet is comparable in depth to sodium's D lines in the real solar spectrum. Here it cannot be: NIST's <em>emission</em> intensity for b1 is 70 against sodium D2's 1000, so at the maximum fader position magnesium's strongest line still transmits about a third of the light passing through it. That is the emission-versus-absorption caveat further down this page turning into a specific number. Inventing a per-element correction to make one line look right would be worse — it would be taste wearing the costume of data.</p>

<h2 id="elements">The ten elements</h2>
<p>Curated for what they do to the band and to the sound, not for coverage. Most of the periodic table is inert here — the transition metals are indistinguishable forests and most of everything else has nothing in the visible range at all — so an element earns a fader by producing a distinct look or a distinct sound, and preferably both. ${ALL_LINES.length} lines in total.</p>
${elementList}

<h2 id="sources">Where the numbers come from</h2>
<p class="note">${esc(APOLLO_SOURCES.nist)}</p>
<p class="note">${esc(APOLLO_SOURCES.codata)}</p>
<p class="note">${esc(APOLLO_SOURCES.edlen)}</p>
<p class="note">${esc(APOLLO_SOURCES.cmf)}</p>
<p>One honest note about the relative intensities. NIST publishes <em>emission</em> intensities — how bright a line is when the element is made to glow — and this scene draws absorption, how deep a line cuts when the element sits in front of something hotter. The two track each other closely, because both follow the same transition probabilities, but they are not the same quantity: a real absorption depth also depends on temperature, on ionization state, and on how much of the element is in the path. The intensities here are used as a line-strength proxy for an instrument, not as a photometric claim.</p>
</article>`;

  return {
    slugPath: 'apollo',
    title: 'Apollo',
    description: 'An absorption spectrum you can play — the physics, the ten elements, and every wavelength with the pitch it sounds.',
    sceneKey: 'apollo', sceneName: 'Apollo',
    lede: `<p><strong>Apollo</strong> is a solar absorption spectrum you can play: a band of starlight with the lines missing from it, a corona streaming past, and ten elements on faders that put their own lines into the light. Clicking a dark line sounds its wavelength as a pitch.</p>
<p>This page is the table underneath it — the physics, the ten elements, and every line with the frequency it plays.</p>`,
    bodyHtml: body,
    jsonLd: creativeWork('Apollo', 'An absorption spectrum you can play: the physics, the curated element set, and every wavelength with its pitch.', 'apollo'),
  };
}

function buildLibrary() {
  // TWO fields are deliberately withheld here. Both were learned the hard
  // way; don't reinstate either without checking with Scott first.
  //
  // `excerpt` holds opening passages from published books in copyrighted
  // translations — Heaney's Beowulf, the Penguin Classics editions, and so
  // on. Those stay inside the scene, where they're shown one at a time to a
  // reader who went looking; a crawlable page is a different act, because it
  // publishes, caches, and attributes that text on this domain.
  //
  // `note` was withheld here because the scene withheld it. THAT PREMISE
  // CHANGED on 2026-09-02 (v4.0.2) and this page has deliberately not
  // followed yet — read on before assuming it is simply out of date.
  //
  // The history first, because it is the reason the caution exists. The
  // first version of this page (1.7.0, fixed same day in 1.7.1) published
  // all 97 notes on the reasoning that they were the most genuinely
  // original writing in the file — true, and beside the point. They also
  // carried live editorial asides ("flag for Scott", "edition uncertain")
  // and, in one case, a dated verbatim quote of Scott to Claude. The rule
  // it cost: a field the scene doesn't display was withheld on purpose, and
  // "is it good writing?" is the wrong question to ask about it.
  //
  // What is true now: library.js renders a note for the 54 items whose note
  // is load-bearing in the link graph (see LIBRARY_NOTE_VISIBLE in
  // src/links.js), and those notes were rewritten so the catalogue chatter
  // moved to a private `catalog` field. So "the scene withholds it" is no
  // longer a reason, and the honest position is that this page now shows
  // LESS than the scene does.
  //
  // SETTLED 2026-09-02, Scott: the archive stays a strict subset of the
  // scene, and these notes stay off it. Two reasons, and neither is
  // "we haven't decided yet":
  //
  //   The link-graph problem that drove 4.0.2 does not exist here. A note
  //   became visible in the scene because hiding it broke a live link —
  //   the phrase had nothing to click, or a backlink pointed at nothing.
  //   These pages carry no cross-links at all, so there is no half-link to
  //   repair and no reason the scene's rule should follow across.
  //
  //   And the `excerpt` argument above applies unchanged: a crawlable page
  //   publishes, caches and attributes text on this domain in a way an
  //   in-scene panel does not. The notes are Scott's own critical writing
  //   and are not wanted public regardless of what the scene does with
  //   them.
  //
  // So this is a decision, not a lag. Don't "fix" the inconsistency.
  //
  // What's left is the plain bibliographic fact of the shelf, which is
  // exactly what the piece itself shows.
  // Type strings must match src/scenes/library/library.text.js exactly. 'divination_box' was
  // written here as 'box' in 1.7.0, which silently dropped both decks from the
  // page for a day while the lede went on advertising them — a filter that
  // matches nothing looks identical to a category that's empty. Asserted below
  // rather than trusted: every item must land in exactly one section.
  const byType = [
    ['Books', libraryItems.filter(i => i.type === 'book')],
    ['Films', libraryItems.filter(i => i.type === 'dvd' || i.type === 'bluray')],
    ['Divination decks', libraryItems.filter(i => i.type === 'divination_box')],
  ];

  const placed = byType.reduce((n, [, items]) => n + items.length, 0);
  if (placed !== libraryItems.length) {
    throw new Error(
      `prerender: library section filters cover ${placed} of ${libraryItems.length} items — ` +
      `unrouted types: ${[...new Set(libraryItems.map(i => i.type))]
        .filter(t => !['book', 'dvd', 'bluray', 'divination_box'].includes(t)).join(', ')}`
    );
  }

  const sections = byType.filter(([, items]) => items.length).map(([label, items]) => `
<h2>${esc(label)}</h2>
<ul class="catalog">
${items.map(i => {
    const ed = [i.publisher, i.publish_year, i.translator ? `trans. ${i.translator}` : null]
      .filter(Boolean).join(' · ');
    // Five entries have no creator at all — anonymous or compiled works
    // (Gilgamesh, the Bhagavad Gita, Buddhist Scriptures, the Homeric Hymns,
    // the Maya Deren collection). The em-dash is part of the title-creator
    // join, so it only belongs here when there's something on the other side
    // of it; otherwise the line ends on a dangling dash.
    // id="p<id>" + a live deep-link (added 2026-08-16, same as every other
    // scene — see buildBeamline's comment above for the "p" prefix). Not
    // added to the Music/cds list below: cdRackItems' own ids reuse the
    // same 1..N range as libraryItems' ids (they're separate arrays,
    // always kept apart at runtime by library.js's "cd-<n>" string-id
    // convention — see that file's populatePanel comment), so a bare
    // numeric id here would be ambiguous between a book/film/deck and a
    // CD. Nothing in src/links.js or the live #library/<id> hash addresses
    // a CD today, so this only wires the space that's actually unambiguous.
    return `  <li id="p${i.id}">
    <span class="t">${esc(i.title)}</span>${i.creator ? ` — <span class="c">${esc(i.creator)}</span>` : ''}
    ${ed ? `<span class="e">${esc(ed)}</span>` : ''}
    ${pieceLink('library', i.id, 'the Library')}
  </li>`;
  }).join('\n')}
</ul>`).join('\n');

  const cds = `
<h2>Music</h2>
<ul class="catalog">
${cdRackItems.map(c => `  <li>
    <span class="t">${esc(c.album)}</span> — <span class="c">${esc(c.artist)}</span>
    ${c.video ? `<span class="e">${esc(c.video)}</span>` : ''}
  </li>`).join('\n')}
</ul>`;

  return {
    slugPath: 'library',
    title: 'The Library',
    // Counts derived, not typed: the site's older copy says "107 books", which
    // is the shelf's own long-standing figure and doesn't match this catalogue
    // (101 books, 44 films, 2 decks, 114 albums). Rather than restate a number
    // that can go stale or contradict the data, let the data say it.
    description: `A real bookshelf, catalogued — ${libraryItems.filter(i => i.type === 'book').length} books, `
      + `${libraryItems.filter(i => i.type === 'dvd' || i.type === 'bluray').length} films, `
      + `${cdRackItems.length} albums and ${libraryItems.filter(i => i.type === 'divination_box').length} divination decks.`,
    sceneKey: 'library', sceneName: 'the Library',
    lede: `<p><strong>The Library</strong> is a real shelf, photographed and rebuilt as an object you can turn in space and pull a spine from.</p>
<p>This is its catalogue. The passages quoted from the books themselves aren’t reproduced here — they belong to their authors and translators, and stay inside the piece.</p>`,
    bodyHtml: sections + cds,
    jsonLd: creativeWork('The Library', 'A catalogued bookshelf: books, films, music and divination decks.', 'library'),
  };
}

// ─── Index ──────────────────────────────────────────────────────────────────

function buildIndex(pages) {
  const body = `<nav class="index" aria-label="The writing">
<ul>
${pages.map(p => `  <li><a href="/text/${p.slugPath}/">${esc(p.title)}</a><span class="d">${esc(p.description)}</span></li>`).join('\n')}
</ul>
</nav>`;
  return {
    slugPath: '',
    title: 'The Writing',
    description: 'Everything written on this site, collected as plain text: prose, poems, scripts and found pieces.',
    sceneKey: null, sceneName: null,
    lede: `<p>Every piece of writing on this site lives inside something you move through — a scroll, a sphere, a shelf, a theater. That is the work, and it is worth encountering that way first.</p>
<p>This is the same writing set down plainly, so it can be read directly, linked to, and found by anyone looking for a line of it.</p>`,
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'The Writing — perceptual mechanics',
      description: 'Collected writing by Scott Jason Cohen.',
      url: `${ORIGIN}/text/`,
      author: { '@type': 'Person', name: AUTHOR },
      inLanguage: 'en',
      hasPart: pages.map(p => ({ '@type': 'CreativeWork', name: p.title, url: `${ORIGIN}/text/${p.slugPath}/` })),
    },
  };
}

// ─── Emit ───────────────────────────────────────────────────────────────────

export function prerender(outDir) {
  const pages = [
    buildScroll(), buildPoems(), buildFragments(),
    buildTheater(), buildOrrery(), buildBeamline(), buildLibrary(),
    buildApollo(),
  ];
  const all = [buildIndex(pages), ...pages];

  // ─── The scenes-sum assertion ─────────────────────────────────────────────
  // Proposed in the 2026-09-01 punch list and unimplemented until an eleventh
  // scene made it concrete. Every scene in the registry must either build a
  // page here or be named in TEXT_EXEMPT with a reason. Both directions are
  // checked, because both have failed in this project's history: a scene
  // shipping with no crawlable page is how a scene ships unfindable, and a page
  // for a scene that no longer exists is how the /text/ index grows a dead
  // entry nobody notices.
  //
  // This is the one place prerender.js's own good pattern — derive the list,
  // don't maintain it — was applied once and not generalised. It is generalised
  // now, and it fails the build rather than warning, because a warning in a
  // build that prints thirty lines of green is a warning nobody reads.
  {
    const built = new Set(pages.map(p => p.sceneKey).filter(Boolean));
    const registry = Object.keys(SCENES);
    const missing = registry.filter(k => !built.has(k) && !(k in TEXT_EXEMPT));
    const orphaned = [...built].filter(k => !registry.includes(k));
    const staleExempt = Object.keys(TEXT_EXEMPT).filter(k => !registry.includes(k));
    const problems = [
      missing.length && `no /text/ page and no exemption: ${missing.join(', ')} — add a build function above, or add an entry to TEXT_EXEMPT in src/scenes/registry.js saying why the scene publishes nothing crawlable`,
      orphaned.length && `page built for a scene that is not in the registry: ${orphaned.join(', ')}`,
      staleExempt.length && `TEXT_EXEMPT names a scene that no longer exists: ${staleExempt.join(', ')}`,
    ].filter(Boolean);
    // ─── The markup half of the same rule ───────────────────────────────────
    // 4.4.0. The nav row's sizing and the landing grid's column count are both
    // computed from the registry now (main.js's applyDerivedLayout), which
    // means those formulas are only correct while index.html carries exactly
    // one nav icon and exactly one tile per registered scene. That used to be
    // maintained by hand in three places — a `--nav-count` in the stylesheet, a
    // `.preview-row-break` positioned by counting tiles, and the markup itself
    // — and the nav row was clipped off both edges of every phone four separate
    // times because one of them was missed.
    //
    // Two of the three are gone. This is what keeps the third honest: the page
    // is read as text and the icons and tiles are counted, so a scene added to
    // the registry without its icon fails the build rather than shipping a nav
    // row whose arithmetic is quietly one out.
    {
      const html = fs.readFileSync(path.join(import.meta.dirname, '..', 'index.html'), 'utf8');
      const icons = (html.match(/class="nav-icon"/g) || []).length;
      const iconScenes = [...html.matchAll(/class="nav-icon"[^>]*data-scene="([^"]+)"/g)].map(m => m[1]);
      const tileScenes = [...html.matchAll(/id="preview-([a-z0-9-]+)"/g)].map(m => m[1]);
      const reg = Object.keys(SCENES);
      const missingIcon = reg.filter(k => !iconScenes.includes(k));
      const missingTile = reg.filter(k => !tileScenes.includes(k));
      const strayIcon = iconScenes.filter(k => !reg.includes(k));
      const strayTile = tileScenes.filter(k => !reg.includes(k));
      if (icons !== iconScenes.length) problems.push(`index.html has ${icons} .nav-icon buttons but only ${iconScenes.length} carry a data-scene — the derived nav sizing counts scenes, not buttons`);
      if (missingIcon.length) problems.push(`registered but has no nav icon in index.html: ${missingIcon.join(', ')}`);
      if (missingTile.length) problems.push(`registered but has no landing tile in index.html: ${missingTile.join(', ')}`);
      if (strayIcon.length) problems.push(`nav icon in index.html for a scene that is not registered: ${strayIcon.join(', ')}`);
      if (strayTile.length) problems.push(`landing tile in index.html for a scene that is not registered: ${strayTile.join(', ')}`);
    }

    if (problems.length) {
      throw new Error(`prerender: scene/page mismatch —\n  ${problems.join('\n  ')}`);
    }
    console.log(`ok: scenes vs pages: ${registry.length} scenes, ${built.size} with a /text/ page, ${Object.keys(TEXT_EXEMPT).length} exempt with a stated reason`);
  }

  for (const p of all) {
    const dir = path.join(outDir, 'text', p.slugPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), page(p));
  }

  // Sitemap is generated from the same list, not maintained by hand — the
  // old one listed a single URL and would have gone stale the moment a page
  // was added or renamed here.
  const urls = [
    { loc: `${ORIGIN}/`, priority: '1.0', changefreq: 'weekly' },
    ...all.map(p => ({
      loc: `${ORIGIN}/text/${p.slugPath ? p.slugPath + '/' : ''}`,
      priority: p.slugPath ? '0.8' : '0.9',
      changefreq: 'monthly',
    })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap);

  return all.length;
}
