import { el } from '../lib/dom.js';
import { label, meterResources } from '../lib/labels.js';

// Значок вида счётчика: ХВС — синяя капля, ГВС — красная капля, электричество — молния.
// Цвета — токены --color-meter-* (см. css/tokens.css); смысл дублирует подсказка и aria-label.
const DROP = '<path d="M12 2.6C10.2 5 5.6 10.2 5.6 14.4a6.4 6.4 0 0 0 12.8 0C18.4 10.2 13.8 5 12 2.6z"/>';
const BOLT = '<path d="M13.4 2.2 5 13.4h5.6l-1 8.4 8.4-11.4h-5.6l1-8.2z"/>';
const SHAPES = { cold_water: DROP, hot_water: DROP, electricity: BOLT };

export function meterIcon(resource) {
  const shape = SHAPES[resource];
  if (!shape) return null;
  const name = label(meterResources, resource);
  return el('span', {
    class: `meter-icon meter-icon--${resource}`,
    role: 'img',
    title: name,
    'aria-label': name,
    html: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">${shape}</svg>`,
  });
}
