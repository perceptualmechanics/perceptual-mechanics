// The exported text keeps the master's inline markdown, so the page and the
// builder set what the book prints: **bold**, *italic*, and bare https links.

const esc = s => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function inline(md) {
  return esc(md)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // A sentence's closing punctuation isn't part of the address.
    .replace(/https:\/\/[^\s<]*[^\s<.,;:)]/g, url => `<a href="${url}">${url}</a>`);
}

// What a reader sees of the same text: the words without the markup.
export function plain(md) {
  return md.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
}
