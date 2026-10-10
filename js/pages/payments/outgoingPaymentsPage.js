import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { outgoingPaymentsApi } from '../../api/resources.js';
import { outgoingPaymentFields } from '../fields.js';
import { formatMoney, monthLabel } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { sourceCell, assignActions } from './incomingPaymentsPage.js';
import { originLabel } from '../../lib/rules.js';
import { loadPaymentRefs, bankFilterOptions, categoryFilterOptions, dateFilters, seasonRowClass, dateWithSeason } from './common.js';

// Список исходящих платежей. Используется и на странице «Исходящие платежи», и на странице выписки
// (fixedQuery: {statement_id}, showSource: false).
export function createOutgoingList(refs, { fixedQuery = {}, showSource = true } = {}) {
  return createCrudList({
    entityTitle: 'Платёж',
    addLabel: 'Добавить платёж',
    api: outgoingPaymentsApi,
    groupBy: (r) => monthLabel(r.payment_date),
    rowClass: seasonRowClass,
    fixedQuery,
    fields: outgoingPaymentFields({ banks: refs.banks, categories: refs.outgoingCategories }),
    filters: [
      { name: 'bank_account_id', label: 'Со счёта', type: 'select', options: bankFilterOptions(refs.banks) },
      ...dateFilters,
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Получатель, назначение, документ' },
      { name: 'category_id', label: 'Категория', type: 'select', options: categoryFilterOptions(refs.outgoingCategories) },
      { name: 'unlinked', label: 'Категория', type: 'select', options: [{ value: 'true', label: 'Без категории' }] },
    ],
    columns: [
      { key: 'payment_date', label: 'Дата', primary: true, render: (r) => dateWithSeason(r) },
      { key: 'recipient_name', label: 'Кому' },
      { key: 'amount', label: 'Сумма', render: (r) => el('span', { class: 'nowrap' }, formatMoney(r.amount)) },
      { key: 'category_id', label: 'Категория', render: (r) => categoryCell(r, refs) },
      { key: 'bank_account_id', label: 'Со счёта', render: (r) => refs.bankName(r.bank_account_id) },
      showSource ? { key: 'statement_id', label: 'Источник', render: (r) => sourceCell(r) } : null,
      { key: 'purpose', label: 'Назначение' },
    ].filter(Boolean),
    emptyMessage: 'Платежей не найдено',
    deleteMessage: (r) => `Удалить платёж ${formatMoney(r.amount)} для «${r.recipient_name}»?`,
  });
}

function categoryCell(r, refs) {
  if (!r.category_id) return el('span', { class: 'badge badge-neutral' }, 'Без категории');
  const origin = originLabel(r);
  return el('div', {}, [refs.categoryName(r.category_id), origin ? el('div', { class: 'assigned-by' }, origin) : null]);
}

export async function outgoingPaymentsPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let refs;
  try {
    refs = await loadPaymentRefs();
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }
  const list = createOutgoingList(refs);
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [el('h1', {}, 'Исходящие платежи'), assignActions(list, { direction: 'outgoing' })]),
    refs.banks.length ? null : el('div', { class: 'form-error' }, ['Сначала добавьте ', el('a', { href: '/bank-accounts' }, 'банковский счёт'), '.']),
    list.element,
  ]));
}
