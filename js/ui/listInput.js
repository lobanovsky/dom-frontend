import { el } from '../lib/dom.js';

// Поле-список строк (телефоны, email): по одной строке ввода на значение,
// кнопка «+ Добавить» и крестик у каждой строки. Первое значение основное.
// Возвращает компонент для form.js (type: 'list'): ({id, value, onChange}) -> Node.
// format(значение) -> строка: как показывать сохранённое значение в поле (например, телефон из цифр с форматированием).
export function listInput({ inputType = 'text', inputmode, placeholder, addLabel = '+ Добавить', autocomplete, format = (s) => s, primaryLabel = '' } = {}) {
  return function createListInput({ id, value, onChange }) {
    // Пустой список — одна пустая строка ввода; пустые строки в API не уходят (lib/payload.js).
    let items = Array.isArray(value) && value.length ? value.map(format) : [''];

    let selectedIndex = 0;
    const rows = el('div', { class: 'list-input-rows' });
    const addButton = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => add() }, addLabel);
    const root = el('div', { class: 'list-input', id }, [rows, addButton]);

    function emit() {
      onChange(primaryLabel ? [items[selectedIndex], ...items.filter((_, i) => i !== selectedIndex)] : [...items]);
    }

    function render(focusIndex = -1) {
      rows.replaceChildren(...items.map((item, index) => {
        const input = el('input', {
          type: inputType, inputmode, placeholder, autocomplete,
          'aria-label': `${placeholder || 'Значение'} ${index + 1}`,
        });
        input.value = item;
        input.addEventListener('input', () => {
          items[index] = input.value;
          const radio = rows.children[index]?.querySelector('input[type="radio"]');
          if (radio) radio.disabled = !input.value.trim();
          emit();
        });
        // Enter внутри списка добавляет строку, а не отправляет всю форму.
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (input.value.trim() !== '') add();
          }
        });
        const primary = primaryLabel ? el('input', { type: 'radio', name: `${id}-primary`, checked: index === selectedIndex, disabled: !item.trim(), title: primaryLabel, 'aria-label': `${primaryLabel}: ${item || index + 1}`, onchange: () => {
          selectedIndex = index;
          for (const [i, row] of [...rows.children].entries()) row.querySelector('input[type="radio"]').checked = i === selectedIndex;
          emit();
        } }) : null;
        const remove = el('button', {
          type: 'button', class: 'btn btn-ghost btn-sm list-input-remove', 'aria-label': `Удалить: ${item || index + 1}`,
          onclick: () => {
            items.splice(index, 1);
            if (selectedIndex === index) selectedIndex = 0;
            else if (selectedIndex > index) selectedIndex--;
            emit();
            render();
          },
        }, '×');
        return el('div', { class: 'list-input-row' }, [primary, input, remove]);
      }));
      if (focusIndex >= 0) rows.children[focusIndex]?.querySelector('input')?.focus();
    }

    function add() {
      items.push('');
      render(items.length - 1);
    }

    render();
    return root;
  };
}
