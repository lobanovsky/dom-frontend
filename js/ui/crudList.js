import { el } from '../lib/dom.js';
import { renderTable } from './table.js';
import { confirmDialog } from './confirmDialog.js';
import { openEntityForm } from './entityForm.js';
import { toast } from './toast.js';
import { describeApiError } from '../lib/apiErrors.js';
import { config } from '../config.js';

// Список записей одной сущности: фильтры, таблица, пагинация, добавление,
// редактирование и удаление через модальную форму. Удаление мягкое: переключатель
// «Удалённые» показывает корзину, где записи можно восстановить.
//
// filters: [{name, label, type: 'search'|'select'|'date', options?}] — значения уходят в query.
// fixedQuery — всегда добавляется к запросу списка (например building_id).
// fixed — всегда добавляется к телу при создании/сохранении.
// newDefaults — начальные значения формы новой записи.
// rowClass(row) -> CSS-класс строки, см. ui/table.js.
// groupBy(row) -> строка: метка группы (например месяц), см. ui/table.js.
// extraActions(row) -> [Node] — дополнительные кнопки в строках действующих записей.
// Возвращает {element, reload}.
export function createCrudList({
  api, columns, fields, watch, filters = [], fixedQuery = {}, fixed = {},
  entityTitle, addLabel = 'Добавить', emptyMessage, deleteMessage = (row) => 'Удалить запись?',
  canEdit = true, extraActions, groupBy, rowClass, newDefaults = {},
}) {
  let offset = 0;
  let showDeleted = false;
  const filterValues = {};
  let searchTimer = null;
  let seq = 0;

  const tableHost = el('div', { class: 'crud-table' }, el('div', { class: 'table-status' }, 'Загрузка…'));
  const prevButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { offset = Math.max(0, offset - config.pageSize); load(); } }, '← Назад');
  const nextButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { offset += config.pageSize; load(); } }, 'Вперёд →');
  const pageInfo = el('span', { class: 'pager-info' });
  const pager = el('div', { class: 'pager' }, [prevButton, pageInfo, nextButton]);

  const addButton = canEdit ? el('button', { type: 'button', class: 'btn btn-primary btn-add', onclick: () => openForm(null) }, addLabel) : null;
  const toolbar = el('div', { class: 'table-toolbar' }, [
    ...filters.map(renderFilter),
    el('div', { class: 'table-toolbar-spacer' }),
    canEdit ? deletedToggle((checked) => {
      showDeleted = checked;
      offset = 0;
      addButton.hidden = checked;
      load();
    }) : null,
    addButton,
  ]);

  function renderFilter(f) {
    const id = `filter-${f.name}`;
    let input;
    if (f.type === 'select') {
      input = el('select', { id }, [el('option', { value: '' }, 'Все'), ...f.options.map((o) => el('option', { value: o.value }, o.label))]);
      input.addEventListener('change', () => { filterValues[f.name] = input.value; offset = 0; load(); });
    } else if (f.type === 'date') {
      input = el('input', { type: 'date', id });
      input.addEventListener('change', () => { filterValues[f.name] = input.value; offset = 0; load(); });
    } else {
      input = el('input', { type: 'search', id, placeholder: f.placeholder || 'Поиск', autocomplete: 'off' });
      input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { filterValues[f.name] = input.value.trim(); offset = 0; load(); }, 300);
      });
    }
    return el('div', { class: f.type === 'select' || f.type === 'date' ? 'field' : 'field field--search' }, [el('label', { for: id }, f.label), input]);
  }

  function openForm(row) {
    openEntityForm({
      title: row ? `${entityTitle}: редактирование` : `${entityTitle}: новая запись`,
      fields,
      watch,
      entity: row,
      initialValues: row ? {} : newDefaults,
      fixed,
      save: (body) => (row ? api.update(row.id, body) : api.create(body)),
      onSaved: () => load(),
    });
  }

  async function remove(row) {
    const ok = await confirmDialog({
      title: 'Удаление',
      message: `${deleteMessage(row)} Запись попадёт в «Удалённые», её можно будет восстановить.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.remove(row.id);
      toast.success('Удалено. Восстановить можно в «Удалённые»');
      load();
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err, { action: 'delete' }).message);
    }
  }

  async function restore(row) {
    try {
      await api.restore(row.id);
      toast.success('Восстановлено');
      load();
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
    }
  }

  async function load() {
    const current = ++seq;
    try {
      const { items } = await api.list({ ...fixedQuery, ...filterValues, deleted: showDeleted ? 'only' : undefined, limit: config.pageSize, offset });
      if (current !== seq) return;
      tableHost.classList.toggle('crud-table--deleted', showDeleted);
      tableHost.replaceChildren(renderTable({
        columns,
        groupBy,
        rowClass,
        rows: items,
        emptyMessage: showDeleted ? 'Удалённых записей нет' : emptyMessage,
        rowActions: !canEdit ? null : showDeleted
          ? (row) => [el('button', { type: 'button', class: 'btn btn-sm', onclick: () => restore(row) }, 'Восстановить')]
          : (row) => [
            ...(extraActions ? extraActions(row) : []),
            el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => openForm(row) }, 'Изменить'),
            el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-danger-text', onclick: () => remove(row) }, 'Удалить'),
          ],
      }));
      prevButton.disabled = offset === 0;
      nextButton.disabled = items.length < config.pageSize;
      pager.hidden = offset === 0 && items.length < config.pageSize;
      pageInfo.textContent = `${offset + 1}–${offset + items.length}`;
    } catch (err) {
      if (current !== seq) return;
      tableHost.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    }
  }

  load();
  // Текущие фильтры списка (для действий над выборкой: определение лицевых счетов и т.п.).
  const getQuery = () => ({ ...fixedQuery, ...filterValues });
  return { element: el('div', { class: 'crud-list' }, [toolbar, tableHost, pager]), reload: load, getQuery };
}

// Страница-справочник: заголовок + список.
export function crudPage({ title, ...listOptions }) {
  return (container) => {
    const list = createCrudList(listOptions);
    container.replaceChildren(el('div', { class: 'page' }, [
      el('div', { class: 'section-header' }, el('h1', {}, title)),
      list.element,
    ]));
  };
}

// Переключатель «Удалённые» для списков и блоков карточки.
export function deletedToggle(onChange) {
  const input = el('input', { type: 'checkbox' });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'deleted-toggle' }, [input, ' Удалённые']);
}
