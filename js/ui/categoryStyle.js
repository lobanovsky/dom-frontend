import { el } from '../lib/dom.js';

// Оформление категории платежа: цвет (#rrggbb) и значок (эмодзи) выбираются из готовых наборов.

export const CATEGORY_COLORS = [
  '#c0392b', '#d35400', '#b9770e', '#2e8b57', '#16807a', '#2471a3', '#5b3fa8', '#a03a8c', '#7f8c8d', '#34495e',
];

export const CATEGORY_ICONS = [
  '🏠', '🏢', '🔧', '🛠️', '💡', '🔥', '💧', '🧹', '🚗', '🅿️', '🛗', '🔒',
  '📡', '🌳', '🗑️', '🧾', '💰', '🏦', '📄', '👷', '🎉', '⚖️', '📦', '🔔',
];

// Компонент для поля формы (type: 'picker'): ряд кнопок, повторный клик по выбранной снимает выбор.
function swatchPicker(items, render, ariaPrefix) {
  return function create({ id, value, onChange }) {
    let current = value || null;
    const root = el('div', { class: 'style-picker', id, role: 'group' });
    function draw() {
      root.replaceChildren(...items.map((item) => {
        const btn = el('button', {
          type: 'button',
          class: `style-picker-item${item === current ? ' is-selected' : ''}`,
          'aria-label': `${ariaPrefix} ${item}`,
          'aria-pressed': item === current ? 'true' : 'false',
        }, render(item));
        btn.addEventListener('click', () => {
          current = current === item ? null : item;
          onChange(current);
          draw();
        });
        return btn;
      }));
    }
    draw();
    return root;
  };
}

export const categoryColorPicker = swatchPicker(
  CATEGORY_COLORS,
  (c) => el('span', { class: 'style-swatch', style: `background:${c}` }),
  'Цвет',
);

export const categoryIconPicker = swatchPicker(CATEGORY_ICONS, (i) => i, 'Значок');

// Метка категории в таблицах: значок + название, окрашенные в цвет категории.
export function categoryBadge(category) {
  const color = /^#[0-9a-fA-F]{6}$/.test(category.color || '') ? category.color : null;
  return el('span', {
    class: `category-badge${color ? ' category-badge--colored' : ''}`,
    style: color ? `--category-color:${color}` : undefined,
  }, [category.icon ? el('span', { class: 'category-icon', 'aria-hidden': 'true' }, category.icon) : null, category.name]);
}
