import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { incomingPaymentsApi } from '../../api/resources.js';
import { incomingPaymentFields } from '../fields.js';
import { formatDate, formatMoney, formatTime } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { loadPaymentRefs, bankFilterOptions, categoryFilterOptions, dateFilters } from './common.js';

// Список входящих платежей. Используется и на странице «Входящие платежи», и на странице реестра
// (fixedQuery: {registry_id}, showRegistry: false).
export function createIncomingList(refs, { fixedQuery = {}, showRegistry = true } = {}) {
  const fields = incomingPaymentFields({ banks: refs.banks, categories: refs.incomingCategories });
  return createCrudList({
    entityTitle: 'Платёж',
    addLabel: 'Добавить платёж',
    api: incomingPaymentsApi,
    fields,
    watch: ['personal_account_id'],
    fixedQuery,
    filters: [
      { name: 'bank_account_id', label: 'Счёт', type: 'select', options: bankFilterOptions(refs.banks) },
      ...dateFilters,
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Плательщик, назначение, документ' },
      { name: 'category_id', label: 'Категория', type: 'select', options: categoryFilterOptions(refs.incomingCategories) },
      { name: 'unlinked', label: 'Привязка', type: 'select', options: [{ value: 'true', label: 'Не привязанные' }] },
    ],
    columns: [
      { key: 'payment_date', label: 'Дата', primary: true, render: (r) => [formatDate(r.payment_date), r.payment_time ? ` ${formatTime(r.payment_time)}` : ''].join('') },
      { key: 'payer_name', label: 'От кого' },
      { key: 'amount', label: 'Сумма', render: (r) => formatMoney(r.amount) },
      { key: 'link', label: 'Лицевой счёт / категория', render: (r) => linkCell(r, refs) },
      { key: 'bank_account_id', label: 'Счёт', render: (r) => refs.bankName(r.bank_account_id) },
      showRegistry ? { key: 'registry_id', label: 'Источник', render: (r) => sourceCell(r) } : null,
      { key: 'purpose', label: 'Назначение' },
    ].filter(Boolean),
    emptyMessage: 'Платежей не найдено',
    deleteMessage: (r) => `Удалить платёж ${formatMoney(r.amount)}${r.payer_name ? ` от «${r.payer_name}»` : ''}?`,
  });
}

function linkCell(r, refs) {
  if (r.personal_account_number) return `ЛС ${r.personal_account_number}`;
  if (r.category_id) return refs.categoryName(r.category_id);
  return el('span', { class: 'badge badge-neutral' }, 'Не привязан');
}

function sourceCell(r) {
  if (!r.registry_id) return 'Вручную';
  return el('a', { href: `/payment-registries/${r.registry_id}` }, `Реестр${r.registry_number ? ` ${r.registry_number}` : ''}`);
}

export async function incomingPaymentsPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let refs;
  try {
    refs = await loadPaymentRefs();
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }
  const list = createIncomingList(refs);
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Входящие платежи')),
    refs.banks.length ? null : el('div', { class: 'form-error' }, ['Сначала добавьте ', el('a', { href: '/bank-accounts' }, 'банковский счёт'), '.']),
    list.element,
  ]));
}
