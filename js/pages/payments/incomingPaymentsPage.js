import { el } from '../../lib/dom.js';
import { openModal } from '../../ui/modal.js';
import { createCrudList } from '../../ui/crudList.js';
import { incomingPaymentsApi, paymentRegistriesApi } from '../../api/resources.js';
import { incomingPaymentFields } from '../fields.js';
import { formatMoney, formatTime, monthLabel, registryLabel } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { loadPaymentRefs, bankFilterOptions, categoryFilterOptions, dateFilters, seasonRowClass, dateWithSeason } from './common.js';
import { openAssignDialog, openAssignHistory } from '../../ui/assignDialog.js';
import { scopeFromQuery, originLabel, directionTexts } from '../../lib/rules.js';
import { payments } from '../../lib/registryImport.js';

// Список входящих платежей. Используется и на странице «Входящие платежи», и на странице реестра
// (fixedQuery: {registry_id}, showRegistry: false) и на странице выписки (fixedQuery: {statement_id}).
export function createIncomingList(refs, { fixedQuery = {}, showRegistry = true, compact = false } = {}) {
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
    canAdd: !compact,
    filters: compact ? [] : [
      { name: 'bank_account_id', label: 'Счёт', type: 'select', options: bankFilterOptions(refs.banks) },
      ...dateFilters,
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Плательщик, лицевой счёт, назначение' },
      { name: 'category_id', label: 'Категория', type: 'select', options: categoryFilterOptions(refs.incomingCategories) },
      { name: 'binding', label: 'Привязка', type: 'select', options: [{ value: 'account', label: 'К лицевым счетам' }, { value: 'unlinked', label: 'Не привязанные' }] },
      // Платёж банка с реестром уже показывает строки реестра суммой: детализация открывается по клику на источник.
      showRegistry ? { name: 'hide_registry_details', label: 'Строки реестров', type: 'select', allLabel: 'Показывать', options: [{ value: 'true', label: 'Скрыть (в окне платежа)' }], defaultValue: 'true' } : null,
    ].filter(Boolean),
    columns: [
      { key: 'payment_date', label: 'Дата', primary: true, render: (r) => dateWithSeason(r, r.payment_time ? ` ${formatTime(r.payment_time)}` : '') },
      { key: 'payer_name', label: 'От кого' },
      { key: 'amount', label: 'Сумма', render: (r) => el('span', { class: 'nowrap' }, formatMoney(r.amount)) },
      { key: 'link', label: 'Лицевой счёт / категория', render: (r) => linkCell(r, refs) },
      { key: 'bank_account_id', label: 'Счёт', render: (r) => refs.bankName(r.bank_account_id) },
      showRegistry ? { key: 'registry_id', label: 'Источник', render: (r) => sourceCell(r, refs) } : null,
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
    r.personal_account_number ? accountLink(r) : refs.categoryName(r.category_id),
    origin ? el('div', { class: 'assigned-by' }, origin) : null,
  ]);
}

// Лицевой счёт: цветная метка-ссылка на страницу помещения, к которому он привязан.
function accountLink(r) {
  const text = `ЛС ${r.personal_account_number}`;
  if (!r.premises_id) return el('span', { class: 'account-link' }, text);
  return el('a', { class: 'account-link', href: `/premises/${r.premises_id}`, title: 'Открыть помещение' }, text);
}

// Кнопки «Определить лицевые счета» («Определить категории» для исходящих) и «История определений» для списка платежей:
// правила применяются по его текущим фильтрам.
export function assignActions(list, { direction = 'incoming' } = {}) {
  return el('div', { class: 'header-actions' }, [
    el('button', {
      type: 'button', class: 'btn btn-primary',
      onclick: () => openAssignDialog({ direction, scope: scopeFromQuery(list.getQuery()), onApplied: () => list.reload() }),
    }, directionTexts(direction).assign),
    el('button', { type: 'button', class: 'btn', onclick: () => openAssignHistory({ direction, onChanged: () => list.reload() }) }, 'История определений'),
    el('a', { class: 'btn', href: `/payment-rules?direction=${direction}` }, 'Правила'),
  ]);
}

// Источник платежа. У платежа банка, детализированного реестром, — кнопка «Реестр <файл> · N платежей»: окно с его строками.
export function sourceCell(r, refs) {
  if (r.detail_registry_id) {
    return el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', title: 'Показать платежи реестра',
      onclick: () => openRegistryDetails(refs, { id: r.detail_registry_id, file_name: r.detail_registry_file_name }),
    }, `Реестр ${r.detail_registry_file_name} · ${payments(r.detail_count || 0)} ▸`);
  }
  if (r.registry_id) return el('a', { href: `/payment-registries/${r.registry_id}` }, registryLabel(r));
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

// Окно детализации: сводка реестра и его платежи (их можно привязывать к лицевым счетам, как на странице реестра).
export function openRegistryDetails(refs, { id, file_name }) {
  const body = el('div', {}, el('div', { class: 'table-status' }, 'Загрузка…'));
  const modal = openModal({ title: `Реестр ${file_name}`, content: body, wide: true });
  modal.dialog.classList.add('modal-dialog--xl');
  paymentRegistriesApi.get(id).then((registry) => {
    const list = createIncomingList(refs, { fixedQuery: { registry_id: registry.id }, showRegistry: false, compact: true });
    body.replaceChildren(
      el('p', { class: 'field-help' }, [
        `Платежей в реестре: ${registry.payments_count}, на сумму ${formatMoney(registry.total_transferred)}${registry.payment_amount === registry.total_transferred ? ' — совпадает с платежом из банка' : ''}. `,
        el('a', { href: `/payment-registries/${registry.id}`, onclick: () => modal.close() }, 'Открыть страницу реестра'),
      ]),
      list.element,
      el('div', { class: 'form-actions' }, el('button', { type: 'button', class: 'btn btn-primary', onclick: () => modal.close() }, 'Закрыть')),
    );
  }, (err) => {
    body.replaceChildren(el('div', { class: 'form-error', role: 'alert' }, describeApiError(err).message));
  });
  return modal;
}
