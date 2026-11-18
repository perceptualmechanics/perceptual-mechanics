// The rules the builder and the tracker share, fetched when one first needs
// them.
import srdUrl from './euphonia.srd.json?url';
import classesUrl from './euphonia.classes.json?url';
import subclassesUrl from './euphonia.subclasses.json?url';
import itemsUrl from './euphonia.items.json?url';
import legalUrl from './euphonia.legal.json?url';
import charactersUrl from './euphonia.characters.json?url';
import languagesUrl from './euphonia.languages.json?url';
import tonguesUrl from './euphonia.tongues.json?url';
import { rulebook } from './euphonia.character.js';

export async function loadBook() {
  const [srd, classes, characters, languages, tongues, subclasses, items, legal] = await Promise.all([srdUrl, classesUrl, charactersUrl, languagesUrl, tonguesUrl, subclassesUrl, itemsUrl, legalUrl].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })));
  return { srd, book: rulebook(srd, classes, characters, subclasses, items.data), languages: languages.data, tongues, legal: legal.data };
}
