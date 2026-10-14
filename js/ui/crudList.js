import { el } from '../lib/dom.js';
import { renderTable } from './table.js';
import { confirmDialog } from './confirmDialog.js';
import { openEntityForm } from './entityForm.js';
import { toast } from './toast.js';
import { describeApiError } from '../lib/apiErrors.js';
import { PAGE_SIZES, loadPageSize, savePageSize } from '../lib/pageSize.js';
import { canWrite } from '../lib/permissions.js';

// Список записей одной сущности: фильтры, таблица, пагинация, добавление,
// редактирование и удаление через модальную форму. Удаление мягкое: переключатель
// «Удалённые» показывает корзину, где записи можно восстановить.
//
// filters: [{name, label, type: 'search'|'select'|'date', options?, allLabel?, defaultValue?}] — значения уходят в query;
// у select allLabel — подпись пустого значения (по умолчанию «Все»), defaultValue — выбранное значение при открытии.
// fixedQuery — всегда добавляется к запросу списка (например building_id).
// fixed — всегда добавляется к телу при создании/сохранении.
// newDefaults — начальные значения формы новой записи.
// rowClass(row) -> CSS-класс строки, см. ui/table.js.
// groupBy(row) -> строка: метка группы (например месяц), см. ui/table.js.
// canAdd: false — без кнопки добавления (окно детализации).
// onReorder(rows) — включает перетаскивание строк мышью (не в режиме «Удалённые»), получает строки в новом порядке.
// extraActions(row) -> [Node] — дополнительные кнопки в строках действующих записей.
// selection: {canSelect(row), isSelected(row), onToggle(rows, checked), onFilterChange?()} — колонка галочек (см. ui/table.js),
// не показывается в режиме «Удалённые»; onFilterChange вызывается при смене фильтров (выбор обычно сбрасывают).
// Возвращает {element, reload, redraw, getQuery}: redraw перерисовывает текущую страницу без запроса (после смены выбора).
export function createCrudList({
  api, columns, fields, watch, filters = [], fixedQuery = {}, fixed = {},
  entityTitle, addLabel = 'Добавить', emptyMessage, deleteMessage = (row) => 'Удалить запись?',
  canEdit = canWrite(), canAdd = true, extraActions, groupBy, rowClass, newDefaults = {}, onReorder, selection,
}) {
  let offset = 0;
  let pageSize = loadPageSize();
  let showDeleted = false;
  const filterValues = {};
  let searchTimer = null;
  let seq = 0;
  let lastItems = [];

  const tableHost = el('div', { class: 'crud-table' }, el('div', { class: 'table-status' }, 'Загрузка…'));
  const prevButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { offset = Math.max(0, offset - pageSize); load(); } }, '← Назад');
  const nextButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { offset += pageSize; load(); } }, 'Вперёд →');
  const pageInfo = el('span', { class: 'pager-info' });
  const sizeSelect = el('select', { 'aria-label': 'Строк на странице' }, PAGE_SIZES.map((n) => el('option', { value: String(n) }, String(n))));
  sizeSelect.value = String(pageSize);
  sizeSelect.addEventListener('change', () => { pageSize = Number(sizeSelect.value); savePageSize(pageSize); offset = 0; load(); });
  const pager = el('div', { class: 'pager' }, [prevButton, pageInfo, nextButton, el('label', { class: 'pager-size' }, ['На странице: ', sizeSelect])]);

  const addButton = canEdit && canAdd ? el('button', { type: 'button', class: 'btn btn-primary btn-add', onclick: () => openForm(null) }, addLabel) : null;
  const toolbar = el('div', { class: 'table-toolbar' }, [
    ...filters.map(renderFilter),
    el('div', { class: 'table-toolbar-spacer' }),
    canEdit ? deletedToggle((checked) => {
      showDeleted = checked;
      offset = 0;
      filtersChanged();
      if (addButton) addButton.hidden = checked;
      load();
    }) : null,
    addButton,
  ]);

  const filtersChanged = () => { if (selection && selection.onFilterChange) selection.onFilterChange(); };

  function renderFilter(f) {
    const id = `filter-${f.name}`;
    let input;
    if (f.type === 'select') {
      input = el('select', { id }, [el('option', { value: '' }, f.allLabel || 'Все'), ...f.options.map((o) => el('option', { value: o.value }, o.label))]);
      if (f.defaultValue !== undefined) {
        input.value = f.defaultValue;
        filterValues[f.name] = f.defaultValue;
      }
      input.addEventListener('change', () => { filterValues[f.name] = input.value; offset = 0; filtersChanged(); load(); });
    } else if (f.type === 'date') {
      input = el('input', { type: 'date', id });
      input.addEventListener('change', () => { filterValues[f.name] = input.value; offset = 0; filtersChanged(); load(); });
    } else {
      input = el('input', { type: 'search', id, placeholder: f.placeholder || 'Поиск', autocomplete: 'off' });
      input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { filterValues[f.name] = input.value.trim(); offset = 0; filtersChanged(); load(); }, 300);
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

  function draw() {
    tableHost.classList.toggle('crud-table--deleted', showDeleted);
    tableHost.replaceChildren(renderTable({
      columns,
      groupBy,
      rowClass,
      onReorder: showDeleted ? null : onReorder,
      selection: showDeleted ? null : selection,
      rows: lastItems,
      emptyMessage: showDeleted ? 'Удалённых записей нет' : emptyMessage,
      rowActions: !canEdit ? null : showDeleted
        ? (row) => [el('button', { type: 'button', class: 'btn btn-sm', onclick: () => restore(row) }, 'Восстановить')]
        : (row) => [
          ...(extraActions ? extraActions(row) : []),
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => openForm(row) }, 'Изменить'),
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-danger-text', onclick: () => remove(row) }, 'Удалить'),
        ],
    }));
  }

  async function load() {
    const current = ++seq;
    try {
      const { items } = await api.list({ ...fixedQuery, ...filterValues, deleted: showDeleted ? 'only' : undefined, limit: pageSize, offset });
      if (current !== seq) return;
      lastItems = items;
      draw();
      prevButton.disabled = offset === 0;
      nextButton.disabled = items.length < pageSize;
      // Пока выбран не минимальный размер страницы, панель остаётся: иначе его нельзя уменьшить обратно.
      pager.hidden = offset === 0 && items.length < pageSize && pageSize === PAGE_SIZES[0];
      pageInfo.textContent = `${offset + 1}–${offset + items.length}`;
    } catch (err) {
      if (current !== seq) return;
      tableHost.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    }
  }

  load();
  // Текущие фильтры списка (для действий над выборкой: определение лицевых счетов и т.п.).
  const getQuery = () => ({ ...fixedQuery, ...filterValues });
  return { element: el('div', { class: 'crud-list' }, [toolbar, tableHost, pager]), reload: load, redraw: draw, getQuery };
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
