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
  // `note` is withheld because the scene itself withholds it. library.js
  // renders the note element empty and keeps the assignment commented out
  // one line above, with the reason attached: Scott, 2026-07-23, "I'm not
  // sure I want it there yet." The first version of this page (shipped in
  // 1.7.0, fixed same day in 1.7.1) published all 97 of them anyway, on the
  // reasoning that they were the most genuinely original writing in the
  // file — which was true and beside the point. They also contain live
  // editorial TODOs ("flag for Scott" ×9, "edition uncertain" ×17). The
  // rule this cost: a field the scene doesn't display is a field that was
  // withheld on purpose, and "is it good writing?" is the wrong question to
  // ask about it. Check what the scene actually renders, not what the data
  // module happens to contain.
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
  ];
  const all = [buildIndex(pages), ...pages];

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
