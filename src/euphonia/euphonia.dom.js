// A small element builder: h('p', { class: 'x' }, 'text', child).
// A part of the page comes as nodes, lists of them nested however deep the
// sheet builds them, and nulls where it leaves something out.
export const present = children => children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false);
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...present(children));
  return el;
}
