import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { incomingPaymentsApi } from '../../api/resources.js';
import { incomingPaymentFields } from '../fields.js';
import { formatMoney, formatTime, monthLabel } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { loadPaymentRefs, bankFilterOptions, categoryFilterOptions, dateFilters, seasonRowClass, dateWithSeason } from './common.js';
import { openAssignDialog, openAssignHistory } from '../../ui/assignDialog.js';
import { scopeFromQuery, originLabel } from '../../lib/rules.js';

// Список входящих платежей. Используется и на странице «Входящие платежи», и на странице реестра
// (fixedQuery: {registry_id}, showRegistry: false) и на странице выписки (fixedQuery: {statement_id}).
export function createIncomingList(refs, { fixedQuery = {}, showRegistry = true } = {}) {
  const fields = incomingPaymentFields({ banks: refs.banks, categories: refs.incomingCategories });
  return createCrudList({
    entityTitle: 'Платёж',
    addLabel: 'Добавить платёж',
    api: incomingPaymentsApi,
    fields,
    watch: ['personal_account_id'],
    fixedQuery,
    groupBy: (r) => monthLabel(r.payment_date),
    rowClass: seasonRowClass,
    filters: [
      { name: 'bank_account_id', label: 'Счёт', type: 'select', options: bankFilterOptions(refs.banks) },
      ...dateFilters,
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Плательщик, лицевой счёт, назначение' },
      { name: 'category_id', label: 'Категория', type: 'select', options: categoryFilterOptions(refs.incomingCategories) },
      { name: 'unlinked', label: 'Привязка', type: 'select', options: [{ value: 'true', label: 'Не привязанные' }] },
    ],
    columns: [
      { key: 'payment_date', label: 'Дата', primary: true, render: (r) => dateWithSeason(r, r.payment_time ? ` ${formatTime(r.payment_time)}` : '') },
      { key: 'payer_name', label: 'От кого' },
      { key: 'amount', label: 'Сумма', render: (r) => el('span', { class: 'nowrap' }, formatMoney(r.amount)) },
      { key: 'link', label: 'Лицевой счёт / категория', render: (r) => linkCell(r, refs) },
      { key: 'bank_account_id', label: 'Счёт', render: (r) => refs.bankName(r.bank_account_id) },
      showRegistry ? { key: 'registry_id', label: 'Источник', render: (r) => sourceCell(r) } : null,
      { key: 'purpose', label: 'Назначение' },
      { key: 'comment', label: 'Комментарий' },
    ].filter(Boolean),
    emptyMessage: 'Платежей не найдено',
    deleteMessage: (r) => `Удалить платёж ${formatMoney(r.amount)}${r.payer_name ? ` от «${r.payer_name}»` : ''}?`,
  });
}

function linkCell(r, refs) {
  if (!r.personal_account_number && !r.category_id) return el('span', { class: 'badge badge-neutral' }, 'Не привязан');
  const origin = originLabel(r);
  return el('div', {}, [
    r.personal_account_number ? `ЛС ${r.personal_account_number}` : refs.categoryName(r.category_id),
    origin ? el('div', { class: 'assigned-by' }, origin) : null,
  ]);
}

// Кнопки «Определить лицевые счета» и «История определений» для списка платежей: правила применяются по его текущим фильтрам.
export function assignActions(list) {
  return el('div', { class: 'header-actions' }, [
    el('button', {
      type: 'button', class: 'btn btn-primary',
      onclick: () => openAssignDialog({ scope: scopeFromQuery(list.getQuery()), onApplied: () => list.reload() }),
    }, 'Определить лицевые счета'),
    el('button', { type: 'button', class: 'btn', onclick: () => openAssignHistory({ onChanged: () => list.reload() }) }, 'История определений'),
  ]);
}

export function sourceCell(r) {
  if (r.registry_id) return el('a', { href: `/payment-registries/${r.registry_id}` }, `Реестр${r.registry_number ? ` ${r.registry_number}` : ''}`);
  if (r.statement_id) return el('a', { href: `/bank-statements/${r.statement_id}` }, `Выписка № ${r.statement_id}`);
  return 'Вручную';
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
    el('div', { class: 'section-header' }, [el('h1', {}, 'Входящие платежи'), assignActions(list)]),
    refs.banks.length ? null : el('div', { class: 'form-error' }, ['Сначала добавьте ', el('a', { href: '/bank-accounts' }, 'банковский счёт'), '.']),
    list.element,
  ]));
}
