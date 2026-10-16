import { el } from '../lib/dom.js';

// Выбор нескольких значений флажками (состав составной услуги). items: [{value, label}] — числовые значения.
// Возвращает компонент для form.js (type: 'picker'): ({id, value, onChange}) -> Node; значение — массив выбранных value.
export function checkboxGroup(items, { emptyText = 'Нечего выбирать' } = {}) {
  return function create({ id, value, onChange }) {
    const selected = new Set(Array.isArray(value) ? value : []);
    const root = el('div', { class: 'checkbox-group', id, role: 'group' });
    if (items.length === 0) {
      root.append(el('div', { class: 'text-muted' }, emptyText));
      return root;
    }
    for (const item of items) {
      const box = el('input', { type: 'checkbox' });
      box.checked = selected.has(item.value);
      box.addEventListener('change', () => {
        if (box.checked) selected.add(item.value);
        else selected.delete(item.value);
        onChange(items.map((i) => i.value).filter((v) => selected.has(v)));
      });
      root.append(el('label', { class: 'field-checkbox-label' }, [box, item.label]));
    }
    return root;
  };
}
