import { el } from '../lib/dom.js';

// Stateless-таблица. На телефоне CSS превращает строки в карточки: подпись
// колонки берётся из data-label ячейки.
//
// columns: [{key, label, render?(row) -> Node|string, primary?}]
// primary-колонка на телефоне идёт заголовком карточки без подписи.
// groupBy(row) -> строка: перед первой строкой каждой группы (подряд идущих строк с одним значением)
// добавляется строка-заголовок с меткой, например месяц. Порядок строк задаёт вызывающий.
// rowClass(row) -> строка: дополнительный CSS-класс строки (например, цвет по времени года).
// onReorder(rows) -> void: строки можно перетаскивать мышью за ручку «⠿» (слева); вызывается с новым порядком строк.
// Перетаскивание HTML5 работает только мышью, на телефоне ручка скрыта (там остаются кнопки ↑/↓ вызывающего).
// selection: {canSelect(row), isSelected(row), onToggle(rows, checked)} — колонка с галочками (слева); у строк, которые
// выбрать нельзя, галочки нет; галочка в шапке отмечает/снимает все доступные строки страницы.
export function renderTable({ columns, rows, rowActions, getRowKey = (row) => row.id, emptyMessage = 'Ничего не найдено', groupBy, rowClass, onReorder, selection }) {
  if (!rows || rows.length === 0) {
    return el('div', { class: 'data-table-wrap' }, el('div', { class: 'table-status' }, emptyMessage));
  }

  const selectable = selection ? rows.filter(selection.canSelect) : [];
  const chosen = selectable.filter(selection ? selection.isSelected : () => false).length;
  const thead = el('thead', {}, el('tr', {}, [
    selection ? el('th', { class: 'col-select' }, selectable.length ? pageCheckbox(selectable, chosen, selection) : null) : null,
    onReorder ? el('th', { class: 'col-drag' }, el('span', { class: 'visually-hidden' }, 'Порядок')) : null,
    ...columns.map((c) => el('th', {}, c.label)),
    rowActions ? el('th', { class: 'col-actions' }, el('span', { class: 'visually-hidden' }, 'Действия')) : null,
  ]));
  const span = columns.length + (rowActions ? 1 : 0) + (onReorder ? 1 : 0) + (selection ? 1 : 0);
  const trs = [];
  let currentGroup = null;
  for (const row of rows) {
    const group = groupBy ? groupBy(row) : null;
    if (group && group !== currentGroup) {
      trs.push(el('tr', { class: 'group-row' }, el('th', { colspan: String(span), scope: 'colgroup' }, el('span', { class: 'group-tag' }, group))));
    }
    currentGroup = group;
    trs.push(el('tr', { 'data-row-key': String(getRowKey(row)), class: rowClass ? rowClass(row) || null : null }, [
      selection ? el('td', { class: 'col-select' }, selection.canSelect(row) ? rowCheckbox(row, selection) : null) : null,
      onReorder ? el('td', { class: 'col-drag' }, el('span', { class: 'drag-handle', title: 'Перетащите, чтобы изменить порядок', 'aria-hidden': 'true' }, '⠿')) : null,
      ...columns.map((c) => {
        const value = c.render ? c.render(row) : row[c.key];
        return el('td', { 'data-label': c.label, class: c.primary ? 'col-primary' : null }, value ?? '');
      }),
      rowActions ? el('td', { class: 'col-actions' }, el('div', { class: 'row-actions' }, rowActions(row))) : null,
    ]));
  }
  const tbody = el('tbody', {}, trs);
  if (onReorder) enableDragReorder(tbody, rows, getRowKey, onReorder);

  return el('div', { class: 'data-table-wrap' }, el('table', { class: 'data-table' }, [thead, tbody]));
}

function rowCheckbox(row, selection) {
  const input = el('input', { type: 'checkbox', 'aria-label': 'Выбрать платёж' });
  input.checked = selection.isSelected(row);
  input.addEventListener('change', () => selection.onToggle([row], input.checked));
  return input;
}

function pageCheckbox(selectable, chosen, selection) {
  const input = el('input', { type: 'checkbox', 'aria-label': 'Выбрать все на странице' });
  input.checked = chosen === selectable.length;
  input.indeterminate = chosen > 0 && chosen < selectable.length;
  input.addEventListener('change', () => selection.onToggle(selectable, input.checked));
  return input;
}

// Перетаскивание строк за ручку: строка встаёт перед или после той, над которой отпустили (по половине высоты).
function enableDragReorder(tbody, rows, getRowKey, onReorder) {
  const byKey = new Map(rows.map((r) => [String(getRowKey(r)), r]));
  let dragged = null;
  const clearMarks = () => tbody.querySelectorAll('.drop-before, .drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after'));
  const rowOf = (target) => target.closest('tr[data-row-key]');
  const isBefore = (tr, e) => e.clientY < tr.getBoundingClientRect().top + tr.offsetHeight / 2;

  // Строка тянется только за ручку, иначе нельзя было бы выделять текст и нажимать кнопки.
  tbody.addEventListener('mousedown', (e) => {
    const tr = rowOf(e.target);
    if (tr) tr.draggable = !!e.target.closest('.drag-handle');
  });
  tbody.addEventListener('dragstart', (e) => {
    dragged = rowOf(e.target);
    if (!dragged || !dragged.draggable) return;
    dragged.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragged.dataset.rowKey);
  });
  tbody.addEventListener('dragover', (e) => {
    const tr = rowOf(e.target);
    if (!dragged || !tr || tr === dragged) return;
    e.preventDefault();
    clearMarks();
    tr.classList.add(isBefore(tr, e) ? 'drop-before' : 'drop-after');
  });
  tbody.addEventListener('drop', (e) => {
    const tr = rowOf(e.target);
    if (!dragged || !tr || tr === dragged) return;
    e.preventDefault();
    tr.parentNode.insertBefore(dragged, isBefore(tr, e) ? tr : tr.nextSibling);
    clearMarks();
    onReorder([...tbody.querySelectorAll('tr[data-row-key]')].map((n) => byKey.get(n.dataset.rowKey)));
  });
  tbody.addEventListener('dragend', () => {
    if (dragged) { dragged.classList.remove('is-dragging'); dragged.draggable = false; }
    dragged = null;
    clearMarks();
  });
}
