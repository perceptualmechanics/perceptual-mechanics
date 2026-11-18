// The note on every chapter still in draft, and its invitation (Scott, 18
// November 2026; the books' "Before You Read" carries the same line and link).
// The link is the Patreon page the Euphonia header already names, read from
// there so the two can't part.
import { readFileSync } from 'node:fs';

export const DRAFT_NOTE = 'Placeholder text, written by Claude, waiting for you to rewrite it.';
export const HELP_LINE = 'Want to help build Euphonia? Get in touch.';
export const HELP_URL = readFileSync(new URL('../euphonia/index.html', import.meta.url), 'utf8').match(/<a class="elsewhere" href="(https:[^"]+)"[^>]*>Patreon<\/a>/)?.[1];
if (!HELP_URL) throw new Error('euphonia/index.html has no Patreon link for the draft note to use');
export const DRAFT_NOTE_HTML = `<p class="map-panel-note">${DRAFT_NOTE} <a href="${HELP_URL}" target="_blank" rel="noopener noreferrer">${HELP_LINE}</a></p>`;
