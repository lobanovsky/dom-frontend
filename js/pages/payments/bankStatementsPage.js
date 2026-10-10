import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { bankStatementsApi } from '../../api/resources.js';
import { startStatementUpload } from '../../ui/statementImportDialog.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { loadPaymentRefs, bankFilterOptions, dateFilters } from './common.js';

const period = (r) => (r.period_from && r.period_to ? `${formatDate(r.period_from)} — ${formatDate(r.period_to)}` : '');

// Кнопка выбора файлов: выбор сразу запускает загрузку; счета бэкенд берёт из самого файла.
export function uploadButton(label, { accept, multiple, primary, disabled, onFiles }) {
  const input = el('input', { type: 'file', accept, multiple, hidden: true });
  input.addEventListener('change', () => {
    if (input.files.length) onFiles([...input.files]);
    input.value = '';
  });
  const button = el('button', { type: 'button', class: primary ? 'btn btn-primary' : 'btn', disabled, onclick: () => input.click() }, label);
  return [button, input];
}

// Загруженные выписки: список с поиском и фильтрами; клик открывает платежи выписки.
export async function bankStatementsPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let refs;
  try {
    refs = await loadPaymentRefs();
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }

  const list = createCrudList({
    api: bankStatementsApi,
    canEdit: false,
    filters: [
      { name: 'bank_account_id', label: 'Счёт', type: 'select', options: bankFilterOptions(refs.banks) },
      ...dateFilters,
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Имя файла' },
    ],
    columns: [
      { key: 'id', label: '№', render: (r) => el('span', { class: 'nowrap' }, `№ ${r.id}`) }, // тот же номер указан в «Источнике» платежей
      { key: 'period', label: 'Период', primary: true, render: (r) => el('a', { href: `/bank-statements/${r.id}` }, period(r) || `Выписка № ${r.id}`) },
      { key: 'file_name', label: 'Файл' },
      { key: 'bank_account_id', label: 'Счёт', render: (r) => refs.bankName(r.bank_account_id) },
      { key: 'opening_balance', label: 'Остаток на начало', render: (r) => el('span', { class: 'nowrap' }, formatMoney(r.opening_balance)) },
      { key: 'closing_balance', label: 'Остаток на конец', render: (r) => el('span', { class: 'nowrap' }, formatMoney(r.closing_balance)) },
      { key: 'credit_count', label: 'Поступлений' },
      { key: 'debit_count', label: 'Списаний' },
      { key: 'created_at', label: 'Загружена', render: (r) => formatDate(r.created_at) },
    ],
    emptyMessage: 'Выписок пока нет. Загрузите файл обмена с 1С (.txt)',
  });

  const onFiles = (files) => startStatementUpload(files, { onImported: () => list.reload() });
  const disabled = refs.banks.length === 0;
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [
      el('h1', {}, 'Банковские выписки'),
      el('div', { class: 'header-actions' }, [
        ...uploadButton('Загрузить ZIP', { accept: '.zip,application/zip', multiple: false, primary: true, disabled, onFiles }),
        ...uploadButton('Загрузить файлы', { accept: '.txt,text/plain', multiple: true, primary: false, disabled, onFiles }),
      ]),
    ]),
    el('p', { class: 'field-help' }, 'Выписки в формате обмена с 1С («Клиент-банк — 1С», версия 1.03, файл .txt). Банковские счета берутся из файла, поэтому они должны быть добавлены в «Банковские счета»; если в файле несколько счетов, на каждый создаётся своя выписка. Выписки за пересекающиеся периоды загружать можно: операции, которые уже есть в базе, будут пропущены. В ZIP выписки ищутся во всех вложенных папках.'),
    disabled ? el('div', { class: 'form-error' }, ['Сначала добавьте ', el('a', { href: '/bank-accounts' }, 'банковский счёт'), '.']) : null,
    list.element,
  ]));
}
