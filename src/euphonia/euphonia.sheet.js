// A person's character sheet, opened over the page in the site's own dress.
// The sheets are the book's (public/euphonia/sheets, held script-free and
// self-contained by verify-euphonia), each a page of its own with the sheet
// generator's styles. Here a sheet's content is read from that page and set
// in the builder's sheet, the generator's styles left behind: its classes
// (stat, abil, feat …) are styled by euphonia.css from the site's themes.
// Without script, the link opens the page itself.

const dialog = document.createElement('dialog');
dialog.className = 'sheet-dialog';
dialog.setAttribute('aria-labelledby', 'sheet-dialog-title');
dialog.innerHTML = `<article class="sheet sheet-person">
<p class="sheet-dialog-bar"><button type="button" class="b-button sheet-dialog-close">Close</button></p>
<div class="sheet-dialog-body" aria-live="polite"></div>
</article>`;
const body = dialog.querySelector('.sheet-dialog-body');
const article = dialog.querySelector('.sheet-person');
dialog.querySelector('.sheet-dialog-close').addEventListener('click', () => dialog.close());
// A click on the backdrop, outside the sheet, closes it as Escape does.
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
let opener = null;
dialog.addEventListener('close', () => { opener?.focus(); opener = null; });

const pages = new Map();
// The sheet's own content, as the site shows it: its header, vignette,
// scores and sections, without the way back to the gallery (the dialog
// closes instead), the generator's inline styles, or anything that could
// run. Its headings step down a level, under the page's.
async function sheetOf(href) {
  if (!pages.has(href)) {
    pages.set(href, fetch(href).then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).catch(err => { pages.delete(href); throw err; }));
  }
  // The generator's styles go before parsing as well as after: a parsed
  // document keeps this page's Content-Security-Policy, which reports the
  // <style> and each style attribute it meets (five per sheet, in the console)
  // though none would ever be applied. The sheets are the export's own pages,
  // held to plain markup by verify-euphonia, so their style markup is regular.
  const html = (await pages.get(href)).replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/\sstyle=(?:"[^"]*"|'[^']*')/gi, '');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const wrap = doc.querySelector('main.wrap');
  if (!wrap) throw new Error('not a sheet');
  wrap.querySelectorAll('nav.back, script, style, link').forEach(n => n.remove());
  for (const el of wrap.querySelectorAll('*')) {
    for (const a of [...el.attributes]) if (a.name === 'style' || a.name.startsWith('on')) el.removeAttribute(a.name);
  }
  for (const h of wrap.querySelectorAll('h2')) h.replaceWith(Object.assign(document.createElement('h3'), { innerHTML: h.innerHTML }));
  const title = wrap.querySelector('h1');
  if (title) title.replaceWith(Object.assign(document.createElement('h2'), { id: 'sheet-dialog-title', innerHTML: title.innerHTML }));
  return [...wrap.childNodes].map(n => document.importNode(n, true));
}

async function open(link) {
  opener = link;
  body.replaceChildren(Object.assign(document.createElement('p'), { className: 'sheet-level', textContent: 'Opening the sheet…' }));
  if (!dialog.isConnected) document.body.append(dialog);
  dialog.showModal();
  article.scrollTop = 0;
  try {
    body.replaceChildren(...await sheetOf(link.href));
    dialog.querySelector('#sheet-dialog-title')?.setAttribute('tabindex', '-1');
    dialog.querySelector('#sheet-dialog-title')?.focus();
  } catch {
    // The page itself, then, as without script.
    dialog.close();
    location.href = link.href;
  }
}

// In the capture phase: the globe's panel keeps its own clicks from reaching
// the page (so a click outside it can close it), and most sheet links are in
// that panel.
document.addEventListener('click', e => {
  const link = e.target.closest('a.sheet-link');
  if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  open(link);
}, true);
