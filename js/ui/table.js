import { el } from '../lib/dom.js';

// Stateless-таблица. На телефоне CSS превращает строки в карточки: подпись
// колонки берётся из data-label ячейки.
//
// columns: [{key, label, render?(row) -> Node|string, primary?}]
// primary-колонка на телефоне идёт заголовком карточки без подписи.
// groupBy(row) -> строка: перед первой строкой каждой группы (подряд идущих строк с одним значением)
// добавляется строка-заголовок с меткой, например месяц. Порядок строк задаёт вызывающий.
export function renderTable({ columns, rows, rowActions, getRowKey = (row) => row.id, emptyMessage = 'Ничего не найдено', groupBy }) {
  if (!rows || rows.length === 0) {
    return el('div', { class: 'data-table-wrap' }, el('div', { class: 'table-status' }, emptyMessage));
  }

  const thead = el('thead', {}, el('tr', {}, [
    ...columns.map((c) => el('th', {}, c.label)),
    rowActions ? el('th', { class: 'col-actions' }, el('span', { class: 'visually-hidden' }, 'Действия')) : null,
  ]));
  const span = columns.length + (rowActions ? 1 : 0);
  const trs = [];
  let currentGroup = null;
  for (const row of rows) {
    const group = groupBy ? groupBy(row) : null;
    if (group && group !== currentGroup) {
      trs.push(el('tr', { class: 'group-row' }, el('th', { colspan: String(span), scope: 'colgroup' }, el('span', { class: 'group-tag' }, group))));
    }
    currentGroup = group;
    trs.push(el('tr', { 'data-row-key': String(getRowKey(row)) }, [
      ...columns.map((c) => {
        const value = c.render ? c.render(row) : row[c.key];
        return el('td', { 'data-label': c.label, class: c.primary ? 'col-primary' : null }, value ?? '');
      }),
      rowActions ? el('td', { class: 'col-actions' }, el('div', { class: 'row-actions' }, rowActions(row))) : null,
    ]));
  }
  const tbody = el('tbody', {}, trs);

  return el('div', { class: 'data-table-wrap' }, el('table', { class: 'data-table' }, [thead, tbody]));
}
