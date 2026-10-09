import { el } from '../lib/dom.js';
import { personsApi, legalEntitiesApi, accountsApi, premisesApi, buildingsApi } from '../api/resources.js';
import { accountPurposes, premisesKinds, label } from '../lib/labels.js';
import { personName } from '../lib/format.js';
import { createPersonForm } from './personCreate.js';

// Поле выбора физлица или юрлица. Поиск по подстроке (q); для физлиц при
// allowCreate сверху переключатель «Найти в базе / Новое физлицо» — новое
// физлицо вводится раздельными полями (ФИО, телефоны, email).

// Помещение: поиск по началу номера; в подсказке адрес дома (дома загружаются один раз).
let buildingAddresses = null;
async function addresses() {
  if (!buildingAddresses) {
    const { items } = await buildingsApi.list({ limit: 200 });
    buildingAddresses = new Map(items.map((b) => [b.id, b.address]));
  }
  return buildingAddresses;
}
const withAddress = async (p) => ({ ...p, _address: (await addresses()).get(p.building_id) || '' });
const premisesPickerApi = {
  list: async (query) => {
    const { items } = await premisesApi.list(query);
    return { items: await Promise.all(items.map(withAddress)) };
  },
  get: async (id) => withAddress(await premisesApi.get(id)),
};

const KINDS = {
  premises: {
    api: premisesPickerApi,
    title: (p) => `${label(premisesKinds, p.kind)} № ${p.number}`,
    hint: (p) => p._address,
    placeholder: 'Номер помещения',
    minChars: 1, // номера короткие: «5» уже осмысленный запрос
    limit: 30,
  },
  person: {
    api: personsApi,
    title: (p) => personName(p),
    hint: (p) => [p.birth_date ? p.birth_date.split('-').reverse().join('.') : null, (p.phones || [])[0]].filter(Boolean).join(', '),
    placeholder: 'Фамилия, имя, телефон или email',
  },
  // Лицевой счёт помещения: поиск по началу номера.
  personal_account: {
    api: accountsApi,
    title: (a) => `№ ${a.number}`,
    hint: (a) => label(accountPurposes, a.purpose),
    placeholder: 'Номер лицевого счёта',
  },
  legal_entity: {
    api: legalEntitiesApi,
    title: (l) => l.name,
    hint: (l) => `ИНН ${l.inn}`,
    placeholder: 'Название или ИНН',
  },
};

export function entityPicker(kind, { allowCreate = false } = {}) {
  // Поиск по ФИО/названию начинается с двух символов (иначе подходит почти всё); для помещений достаточно одного.
  const spec = { minChars: 2, limit: 10, ...KINDS[kind] };

  return function createPicker({ id, value, onChange }) {
    let timer = null;
    let requestSeq = 0;
    let lastSearchText = '';

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
      showMode('search');
    }

    function modeBar(active) {
      const button = (mode, text) => el('button', {
        type: 'button', class: mode === active ? 'picker-mode picker-mode--active' : 'picker-mode',
        'aria-pressed': String(mode === active), onclick: () => showMode(mode),
      }, text);
      return el('div', { class: 'picker-modes', role: 'group', 'aria-label': 'Способ выбора' }, [
        button('search', 'Найти в базе'),
        button('new', 'Новое физлицо'),
      ]);
    }

    function showMode(mode) {
      const bar = allowCreate ? modeBar(mode) : null;
      if (mode === 'new') {
        const form = createPersonForm({ prefill: lastSearchText, onCreated: select, onCancel: () => showMode('search') });
        root.replaceChildren(...[bar, form.element].filter(Boolean));
        form.focus();
        return;
      }
      const search = renderSearch();
      root.replaceChildren(...[bar, ...search.nodes].filter(Boolean)); // replaceChildren(null) рисует текст «null»
    }

    function renderSearch() {
      const input = el('input', { type: 'search', id, placeholder: spec.placeholder, autocomplete: 'off' });
      input.value = lastSearchText;
      const results = el('ul', { class: 'picker-results', role: 'listbox' });

      async function search() {
        const text = input.value.trim();
        lastSearchText = text;
        const seq = ++requestSeq;
        if (text.length < spec.minChars) {
          results.replaceChildren();
          return;
        }
        try {
          const { items } = await spec.api.list({ q: text, limit: spec.limit });
          if (seq !== requestSeq) return;
          results.replaceChildren(...(items.length
            ? items.map((item) => el('li', {}, el('button', {
              type: 'button', class: 'picker-option', onclick: () => select(item),
            }, [el('span', {}, spec.title(item)), el('span', { class: 'picker-hint' }, spec.hint(item))])))
            : [el('li', { class: 'picker-empty' }, allowCreate ? 'Не найдено — добавьте во вкладке «Новое физлицо»' : 'Не найдено')]));
        } catch {
          if (seq === requestSeq) results.replaceChildren(el('li', { class: 'picker-empty' }, 'Не удалось выполнить поиск'));
        }
      }

      input.addEventListener('input', () => {
        lastSearchText = input.value.trim(); // запоминаем сразу: он попадёт в поля ФИО нового физлица
        clearTimeout(timer);
        timer = setTimeout(search, 250);
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
      if (lastSearchText) search();

      return { nodes: [input, results] };
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
