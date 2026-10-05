import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { paymentRegistriesApi } from '../../api/resources.js';
import { startRegistryUpload } from '../../ui/registryImportDialog.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { loadPaymentRefs, bankFilterOptions, dateFilters } from './common.js';

// Загруженные реестры: поиск по имени файла/номеру, фильтры по счёту и датам; клик открывает платежи реестра.
export async function paymentRegistriesPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let refs;
  try {
    refs = await loadPaymentRefs();
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }

  const list = createCrudList({
    api: paymentRegistriesApi,
    canEdit: false,
    filters: [
      { name: 'bank_account_id', label: 'Счёт', type: 'select', options: bankFilterOptions(refs.banks) },
      ...dateFilters,
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Имя файла или номер реестра' },
    ],
    columns: [
      { key: 'registry_date', label: 'Дата реестра', primary: true, render: (r) => el('a', { href: `/payment-registries/${r.id}` }, formatDate(r.registry_date) || `№ ${r.id}`) },
      { key: 'file_name', label: 'Файл' },
      { key: 'registry_number', label: 'Номер' },
      { key: 'bank_account_id', label: 'Счёт', render: (r) => refs.bankName(r.bank_account_id) },
      { key: 'payments_count', label: 'Платежей' },
      { key: 'total_amount', label: 'Сумма', render: (r) => formatMoney(r.total_amount) },
      { key: 'created_at', label: 'Загружен', render: (r) => formatDate(r.created_at) },
    ],
    emptyMessage: 'Реестров пока нет. Загрузите файл реестра Сбера',
  });

  // Выбор файла сразу запускает загрузку; счёт определяется по номеру в имени файла.
  function uploadButton(label, { accept, multiple, primary }) {
    const input = el('input', { type: 'file', accept, multiple, hidden: true });
    input.addEventListener('change', () => {
      if (input.files.length) startRegistryUpload([...input.files], { onImported: () => list.reload() });
      input.value = '';
    });
    const button = el('button', {
      type: 'button', class: primary ? 'btn btn-primary' : 'btn', disabled: refs.banks.length === 0, onclick: () => input.click(),
    }, label);
    return [button, input];
  }

  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [
      el('h1', {}, 'Реестры платежей'),
      el('div', { class: 'header-actions' }, [
        ...uploadButton('Загрузить ZIP', { accept: '.zip,application/zip', multiple: false, primary: true }),
        ...uploadButton('Загрузить файлы', { accept: '.txt,text/plain', multiple: true, primary: false }),
      ]),
    ]),
    el('p', { class: 'field-help' }, 'Счёт определяется по номеру в имени файла (например, 900005_9715357654_40703810338000004376_640.txt), поэтому он должен быть добавлен в «Банковские счета». В ZIP реестры ищутся во всех вложенных папках, остальные файлы игнорируются.'),
    refs.banks.length ? null : el('div', { class: 'form-error' }, ['Сначала добавьте ', el('a', { href: '/bank-accounts' }, 'банковский счёт'), '.']),
    list.element,
  ]));
}
