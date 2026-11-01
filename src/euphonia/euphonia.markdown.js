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

// A chapter's blocks, as the export keeps them: paragraphs, "- " lists nested
// by two spaces, and "> " quotes, each with its inline markdown.
export function blocks(md) {
  return md.split(/\n{2,}/).map(chunk => {
    const lines = chunk.split('\n');
    if (lines.every(l => l.startsWith('>'))) return `<blockquote>${blocks(lines.map(l => l.replace(/^> ?/, '')).join('\n'))}</blockquote>`;
    if (/^\s*- /.test(lines[0])) return list(lines);
    return `<p>${inline(chunk.replace(/\n/g, ' '))}</p>`;
  }).join('\n');
}

function list(lines) {
  // Each item with its depth; a line that isn't an item continues the last.
  const items = [];
  for (const line of lines) {
    const m = line.match(/^(\s*)- (.*)$/);
    if (m) items.push({ depth: m[1].length / 2, text: m[2] });
    else items.at(-1).text += ` ${line.trim()}`;
  }
  let html = '', depth = -1;
  for (const { depth: d, text } of items) {
    if (d > depth) html += '<ul><li>'.repeat(d - depth);
    else html += '</li>' + '</ul></li>'.repeat(depth - d) + '<li>';
    html += inline(text);
    depth = d;
  }
  return html + '</li></ul>'.repeat(depth + 1);
}
