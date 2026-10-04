import { el } from '../lib/dom.js';

// Список «подпись — значение»; пустые значения пропускаются.
export function definitionList(pairs) {
  return el('dl', { class: 'def-list' }, pairs
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([term, value]) => el('div', { class: 'def-list-row' }, [el('dt', {}, term), el('dd', {}, String(value))])));
}

export function notFoundView(message, backHref, backLabel) {
  return el('div', { class: 'page' }, [
    el('div', { class: 'card empty-state' }, [
      el('p', {}, message),
      el('a', { href: backHref }, backLabel),
    ]),
  ]);
}
