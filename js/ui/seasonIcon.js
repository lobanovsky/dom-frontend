import { el } from '../lib/dom.js';

// Значок времени года для строк с датой. SVG собираем через разметку (html:), иначе браузер его не нарисует.
const ICONS = {
  // осень: жёлтый кленовый лист
  autumn: '<path fill="#e0a100" stroke="#c98400" stroke-width="0.5" stroke-linejoin="round" d="M12 1.5l-2.300 4.500-2.800-1.300.9 5.300-4.300-1.800 1.100 3.400-3.100.8 4.700 3.400-.8 2 5.600-1 .1 5.200h2l.1-5.200 5.600 1-.8-2 4.700-3.400-3.100-.8 1.100-3.400-4.300 1.800.9-5.300-2.800 1.300z"/>',
  // зима: снежинка
  winter: '<g stroke="#4aa3df" stroke-width="2" stroke-linecap="round" fill="none"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.8L12 6.3l2.5-2.5M9.5 20.2L12 17.7l2.5 2.5M3 10.4l3.4.9-.9 3.4M21 10.4l-3.4.9.9 3.4M3 13.6l3.4-.9-.9-3.4M21 13.6l-3.4-.9.9-3.4" stroke-width="1.4"/></g>',
  // весна: зелёный листик
  spring: '<path fill="#3fa34d" d="M20.5 3.5C11 3.5 4.5 8 4.5 14.5c0 1.2.3 2.3.8 3.2C3.9 19 3.3 20 3 21l1.7.6c.3-.8.9-1.6 1.8-2.4 1 .5 2.1.8 3.3.8 6.6 0 11.200-6 10.700-16.500z"/>',
  // лето: солнышко
  summer: '<g fill="#f5a000" stroke="#f5a000" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.3 5.3l2 2M16.7 16.7l2 2M5.3 18.7l2-2M16.7 7.3l2-2" fill="none"/></g>',
};

export const SEASON_LABELS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', autumn: 'Осень' };

export function seasonIcon(season) {
  if (!ICONS[season]) return null;
  return el('span', {
    class: 'season-icon',
    role: 'img',
    'aria-label': SEASON_LABELS[season],
    title: SEASON_LABELS[season],
    html: `<svg viewBox="0 0 24 24" width="20" height="20">${ICONS[season]}</svg>`,
  });
}
