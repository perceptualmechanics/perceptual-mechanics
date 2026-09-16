
import { bindEscapeClose, parseHTML } from '../../utils/sceneKit.js';
import './colophon.css';
import colophonHtml from './colophon.html?raw';
import { BIBLIOGRAPHY } from './colophon.text.js';

function buildBibliographyHTML() {
  return BIBLIOGRAPHY.map(group => `
    <dt>${group.scene}</dt>
    ${group.entries.map(entry => `<dd>${entry}</dd>`).join('')}
  `).join('');
}

export function initColophon() {
  const landing = document.getElementById('landing');
  if (!landing) return;

  const shell = parseHTML(colophonHtml);
  const mark = shell.querySelector('.colophon-mark');
  const backdrop = shell.querySelector('.colophon-backdrop');
  const panel = backdrop.querySelector('.colophon-panel');
  landing.appendChild(mark);
  document.body.appendChild(backdrop);

  panel.querySelector('.colophon-bib').innerHTML = buildBibliographyHTML();

  const title = panel.querySelector('#colophon-title');
  const closeBtn = panel.querySelector('.colophon-close');

  function focusableEls() {
    return Array.from(panel.querySelectorAll('button, a[href], [tabindex]'))
      .filter(el => el.tabIndex !== -1 || el === title);
  }
  function onKeydown(e) {
    if (e.key !== 'Tab') return;
    const els = focusableEls();
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  backdrop.inert = true;

  function open() {
    backdrop.inert = false;
    backdrop.classList.add('open');
    setTimeout(() => title.focus(), 50);
    backdrop.addEventListener('keydown', onKeydown);
  }
  function close() {
    backdrop.classList.remove('open');
    backdrop.inert = true;
    backdrop.removeEventListener('keydown', onKeydown);
    mark.focus();
  }

  mark.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  bindEscapeClose(() => { if (backdrop.classList.contains('open')) close(); });
}
