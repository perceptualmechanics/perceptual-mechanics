// Where the bare /euphonia/ opens. A first visit, or a browser that can't
// remember one, meets the Reading; a return goes back where the visitor was.
// Any other address names what it wants and is left alone.
export const LAST = 'pm-euphonia-last';
const READING = '#reading', TONIGHT = '#reading-tonight';

export function landing({ hash, search, last, hasReading }) {
  if (hash || search || !hasReading) return null;
  if (last === null) return READING;
  // A reading under way resumes from its first screen, which offers the way
  // back in; one that reached its character opens on that character.
  if (last.startsWith(READING) && last !== TONIGHT) return READING;
  return last || null;
}
