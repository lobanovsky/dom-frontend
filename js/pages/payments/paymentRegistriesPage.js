import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { paymentRegistriesApi } from '../../api/resources.js';
import { openRegistryImportDialog } from '../../ui/registryImportDialog.js';
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

  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [
      el('h1', {}, 'Реестры платежей'),
      el('div', { class: 'header-actions' }, el('button', {
        type: 'button', class: 'btn btn-primary', disabled: refs.banks.length === 0,
        onclick: () => openRegistryImportDialog({ banks: refs.banks, onImported: () => list.reload() }),
      }, 'Загрузить реестр')),
    ]),
    refs.banks.length ? null : el('div', { class: 'form-error' }, ['Сначала добавьте ', el('a', { href: '/bank-accounts' }, 'банковский счёт'), '.']),
    list.element,
  ]));
}
