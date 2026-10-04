import { el } from '../lib/dom.js';

// Stateless-таблица. На телефоне CSS превращает строки в карточки: подпись
// колонки берётся из data-label ячейки.
//
// columns: [{key, label, render?(row) -> Node|string, primary?}]
// primary-колонка на телефоне идёт заголовком карточки без подписи.
export function renderTable({ columns, rows, rowActions, getRowKey = (row) => row.id, emptyMessage = 'Ничего не найдено' }) {
  if (!rows || rows.length === 0) {
    return el('div', { class: 'data-table-wrap' }, el('div', { class: 'table-status' }, emptyMessage));
  }

  const thead = el('thead', {}, el('tr', {}, [
    ...columns.map((c) => el('th', {}, c.label)),
    rowActions ? el('th', { class: 'col-actions' }, el('span', { class: 'visually-hidden' }, 'Действия')) : null,
  ]));
  const tbody = el('tbody', {}, rows.map((row) => el('tr', { 'data-row-key': String(getRowKey(row)) }, [
    ...columns.map((c) => {
      const value = c.render ? c.render(row) : row[c.key];
      return el('td', { 'data-label': c.label, class: c.primary ? 'col-primary' : null }, value ?? '');
    }),
    rowActions ? el('td', { class: 'col-actions' }, el('div', { class: 'row-actions' }, rowActions(row))) : null,
  ])));

  return el('div', { class: 'data-table-wrap' }, el('table', { class: 'data-table' }, [thead, tbody]));
}
