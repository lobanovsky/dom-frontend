import { el } from '../lib/dom.js';
import { paymentExportsApi } from '../api/resources.js';
import { plural } from '../lib/registryImport.js';
import {
  emptySelection, selectAllMatching, isSelected, isEmptySelection, setSelected, canExport, selectionText, exportBody,
} from '../lib/paymentExport.js';
import { openExportDialog } from './exportDialog.js';

// Выбор платежей галочками для выгрузки в реестр: состояние выбора, панель над таблицей и настройка для createCrudList.
// Использование: const ctl = createExportSelection({ bankName }); createCrudList({ selection: ctl.selection, ... });
// затем ctl.bind(list) и ctl.bar в разметку страницы.
export function createExportSelection({ bankName }) {
  let sel = emptySelection();
  let list = null;
  let preview = null; // сколько платежей в режиме «все по фильтру» (только для подписи)
  let seq = 0;
  const bar = el('div', { class: 'selection-bar' });

  function changed() {
    if (list) list.redraw();
    refresh();
  }

  async function refresh() {
    const current = ++seq;
    preview = null;
    render();
    if (!sel.all || !list) return;
    try {
      const p = await paymentExportsApi.preview(list.getQuery(), exportBody(sel));
      if (current !== seq) return;
      preview = p;
      render();
    } catch {
      // подпись останется без числа; ошибку покажет само окно выгрузки
    }
  }

  function render() {
    const query = list ? list.getQuery() : {};
    const bankChosen = !!query.bank_account_id;
    const empty = isEmptySelection(sel);
    bar.replaceChildren(...[
      el('span', { class: 'selection-text' }, selectionText(sel, preview, plural)),
      el('div', { class: 'selection-actions' }, [
        sel.all ? null : el('button', { type: 'button', class: 'btn btn-sm', onclick: () => { sel = selectAllMatching(); changed(); } }, 'Выбрать все невыгруженные по фильтру'),
        empty ? null : el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { sel = emptySelection(); changed(); } }, 'Снять выбор'),
        el('button', {
          type: 'button', class: 'btn btn-primary btn-sm', disabled: empty || !bankChosen,
          title: bankChosen ? '' : 'Выберите банковский счёт в фильтре: в одном реестре платежи только одного счёта',
          onclick: () => openExportDialog({ query, selection: sel, bankName, onDone: () => { sel = emptySelection(); list.reload(); refresh(); } }),
        }, 'Выгрузить в реестр…'),
      ].filter(Boolean)),
      empty || bankChosen ? null : el('span', { class: 'field-help' }, 'Выберите банковский счёт в фильтре.'),
    ].filter(Boolean));
  }

  render();
  return {
    bar,
    bind(l) { list = l; render(); },
    selection: {
      canSelect: canExport,
      isSelected: (row) => isSelected(sel, row.id),
      onToggle: (rows, checked) => { sel = setSelected(sel, rows.map((r) => r.id), checked); changed(); },
      onFilterChange: () => { sel = emptySelection(); refresh(); },
    },
  };
}
