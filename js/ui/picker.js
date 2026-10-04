import { el } from '../lib/dom.js';
import { personsApi, legalEntitiesApi } from '../api/resources.js';
import { personName } from '../lib/format.js';
import { describeApiError } from '../lib/apiErrors.js';

// Поле выбора физлица или юрлица с поиском по подстроке (q) и, для физлиц,
// созданием нового человека прямо из формы.

const KINDS = {
  person: {
    api: personsApi,
    title: (p) => personName(p),
    hint: (p) => [p.birth_date ? p.birth_date.split('-').reverse().join('.') : null, p.phone].filter(Boolean).join(', '),
    placeholder: 'Фамилия, имя или телефон',
  },
  legal_entity: {
    api: legalEntitiesApi,
    title: (l) => l.name,
    hint: (l) => `ИНН ${l.inn}`,
    placeholder: 'Название или ИНН',
  },
};

export function entityPicker(kind, { allowCreate = false } = {}) {
  const spec = KINDS[kind];

  return function createPicker({ id, value, onChange }) {
    let timer = null;
    let requestSeq = 0;

    const root = el('div', { class: 'picker' });

    function select(item) {
      onChange(item ? item.id : null);
      render(item);
    }

    function render(selected) {
      if (selected) {
        root.replaceChildren(el('div', { class: 'picker-selected' }, [
          el('span', { class: 'picker-selected-name' }, spec.title(selected)),
          el('button', {
            type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Выбрать другого',
            onclick: () => select(null),
          }, 'Изменить'),
        ]));
        return;
      }
      renderSearch('');
    }

    function renderSearch(initialText) {
      const input = el('input', { type: 'search', id, placeholder: spec.placeholder, autocomplete: 'off' });
      input.value = initialText;
      const results = el('ul', { class: 'picker-results', role: 'listbox' });
      const createBox = el('div', { class: 'picker-create' });

      async function search() {
        const text = input.value.trim();
        const seq = ++requestSeq;
        if (text.length < 2) {
          results.replaceChildren();
          renderCreateLink(text);
          return;
        }
        try {
          const { items } = await spec.api.list({ q: text, limit: 10 });
          if (seq !== requestSeq) return;
          results.replaceChildren(...(items.length ? items.map((item) => el('li', {}, el('button', {
            type: 'button', class: 'picker-option', onclick: () => select(item),
          }, [el('span', {}, spec.title(item)), el('span', { class: 'picker-hint' }, spec.hint(item))]))) : [el('li', { class: 'picker-empty' }, 'Не найдено')]));
        } catch {
          if (seq === requestSeq) results.replaceChildren(el('li', { class: 'picker-empty' }, 'Не удалось выполнить поиск'));
        }
        renderCreateLink(text);
      }

      function renderCreateLink(text) {
        if (!allowCreate) return;
        createBox.replaceChildren(el('button', {
          type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => renderCreateForm(text),
        }, '+ Новое физлицо'));
      }

      function renderCreateForm(text) {
        const [lastName = '', firstName = '', middleName = ''] = text.split(/\s+/);
        const inputs = {
          last_name: el('input', { type: 'text', placeholder: 'Фамилия' }),
          first_name: el('input', { type: 'text', placeholder: 'Имя' }),
          middle_name: el('input', { type: 'text', placeholder: 'Отчество' }),
          phone: el('input', { type: 'tel', placeholder: 'Телефон', inputmode: 'tel' }),
        };
        inputs.last_name.value = lastName;
        inputs.first_name.value = firstName;
        inputs.middle_name.value = middleName;
        const error = el('div', { class: 'field-error' });

        async function create() {
          const body = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim() || null]));
          try {
            select(await personsApi.create(body));
          } catch (err) {
            error.textContent = describeApiError(err).message;
          }
        }

        for (const i of Object.values(inputs)) {
          // Enter внутри мини-формы не должен отправлять внешнюю форму.
          i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
        }
        createBox.replaceChildren(el('div', { class: 'picker-create-form' }, [
          el('div', { class: 'picker-create-fields' }, Object.values(inputs)),
          error,
          el('div', { class: 'form-actions' }, [
            el('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: create }, 'Создать и выбрать'),
            el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => renderCreateLink(input.value.trim()) }, 'Отмена'),
          ]),
        ]));
        inputs.last_name.focus();
      }

      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(search, 250);
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

      root.replaceChildren(input, results, createBox);
      renderCreateLink(initialText);
      return input;
    }

    if (value) {
      root.replaceChildren(el('div', { class: 'picker-selected' }, 'Загрузка…'));
      spec.api.get(value).then(render, () => render(null));
    } else {
      render(null);
    }
    return root;
  };
}
