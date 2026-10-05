import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { outgoingPaymentsApi } from '../../api/resources.js';
import { outgoingPaymentFields } from '../fields.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { loadPaymentRefs, bankFilterOptions, categoryFilterOptions, dateFilters } from './common.js';

export async function outgoingPaymentsPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let refs;
  try {
    refs = await loadPaymentRefs();
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }
  const list = createCrudList({
    entityTitle: 'Платёж',
    addLabel: 'Добавить платёж',
    api: outgoingPaymentsApi,
    fields: outgoingPaymentFields({ banks: refs.banks, categories: refs.outgoingCategories }),
    filters: [
      { name: 'bank_account_id', label: 'Со счёта', type: 'select', options: bankFilterOptions(refs.banks) },
      ...dateFilters,
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Получатель, назначение, документ' },
      { name: 'category_id', label: 'Категория', type: 'select', options: categoryFilterOptions(refs.outgoingCategories) },
    ],
    columns: [
      { key: 'payment_date', label: 'Дата', primary: true, render: (r) => formatDate(r.payment_date) },
      { key: 'recipient_name', label: 'Кому' },
      { key: 'amount', label: 'Сумма', render: (r) => formatMoney(r.amount) },
      { key: 'category_id', label: 'Категория', render: (r) => refs.categoryName(r.category_id) },
      { key: 'bank_account_id', label: 'Со счёта', render: (r) => refs.bankName(r.bank_account_id) },
      { key: 'purpose', label: 'Назначение' },
    ],
    emptyMessage: 'Платежей не найдено',
    deleteMessage: (r) => `Удалить платёж ${formatMoney(r.amount)} для «${r.recipient_name}»?`,
  });
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Исходящие платежи')),
    refs.banks.length ? null : el('div', { class: 'form-error' }, ['Сначала добавьте ', el('a', { href: '/bank-accounts' }, 'банковский счёт'), '.']),
    list.element,
  ]));
}
