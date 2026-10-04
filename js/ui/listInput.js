import { el } from '../lib/dom.js';

// Поле-список строк (телефоны, email): по одной строке ввода на значение,
// кнопка «+ Добавить» и крестик у каждой строки. Первое значение основное.
// Возвращает компонент для form.js (type: 'list'): ({id, value, onChange}) -> Node.
export function listInput({ inputType = 'text', inputmode, placeholder, addLabel = '+ Добавить', autocomplete } = {}) {
  return function createListInput({ id, value, onChange }) {
    // Пустой список — одна пустая строка ввода; пустые строки в API не уходят (lib/payload.js).
    let items = Array.isArray(value) && value.length ? [...value] : [''];

    const rows = el('div', { class: 'list-input-rows' });
    const addButton = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => add() }, addLabel);
    const root = el('div', { class: 'list-input', id }, [rows, addButton]);

    function emit() {
      onChange([...items]);
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
          emit();
        });
        // Enter внутри списка добавляет строку, а не отправляет всю форму.
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (input.value.trim() !== '') add();
          }
        });
        const remove = el('button', {
          type: 'button', class: 'btn btn-ghost btn-sm list-input-remove', 'aria-label': `Удалить: ${item || index + 1}`,
          onclick: () => {
            items.splice(index, 1);
            emit();
            render();
          },
        }, '×');
        return el('div', { class: 'list-input-row' }, [input, remove]);
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
