import { el } from '../../lib/dom.js';
import { openModal } from '../../ui/modal.js';
import { createCrudList } from '../../ui/crudList.js';
import { incomingPaymentsApi, outgoingPaymentsApi, paymentRegistriesApi } from '../../api/resources.js';
import { saveFile } from '../../ui/saveFile.js';
import { toast } from '../../ui/toast.js';
import { incomingPaymentFields } from '../fields.js';
import { formatMoney, formatTime, monthLabel, registryLabel } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { loadPaymentRefs, bankFilterOptions, categoryFilterOptions, dateFilters, seasonRowClass, dateWithSeason } from './common.js';
import { openAssignDialog, openAssignHistory } from '../../ui/assignDialog.js';
import { scopeFromQuery, originLabel, directionTexts } from '../../lib/rules.js';
import { payments } from '../../lib/registryImport.js';
import { createExportSelection } from '../../ui/exportSelection.js';

// Список входящих платежей. Используется и на странице «Входящие платежи», и на странице реестра
// (fixedQuery: {registry_id}, showRegistry: false) и на странице выписки (fixedQuery: {statement_id}).
// selection — колонка галочек для выгрузки в реестр (ui/exportSelection.js), только на странице «Входящие».
export function createIncomingList(refs, { fixedQuery = {}, showRegistry = true, compact = false, selection } = {}) {
  const fields = incomingPaymentFields({ banks: refs.banks, categories: refs.incomingCategories });
  return createCrudList({
    entityTitle: 'Платёж',
    addLabel: 'Добавить платёж',
    api: incomingPaymentsApi,
    fields,
    watch: ['personal_account_id', 'attention'],
    fixedQuery,
    groupBy: (r) => monthLabel(r.payment_date),
    rowClass: (r) => [seasonRowClass(r), r.attention ? 'row-attention' : null].filter(Boolean).join(' ') || null,
    canAdd: !compact,
    selection,
    filters: compact ? [] : [
      { name: 'bank_account_id', label: 'Счёт', type: 'select', options: bankFilterOptions(refs.banks) },
      ...dateFilters,
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Плательщик, лицевой счёт, назначение' },
      { name: 'category_id', label: 'Категория', type: 'select', options: categoryFilterOptions(refs.incomingCategories) },
      { name: 'attention', label: 'Внимание', type: 'select', options: [{ value: 'true', label: 'Требуют внимания' }] },
      { name: 'export', label: 'Выгрузка в реестр', type: 'select', options: [{ value: 'pending', label: 'Не выгружены' }, { value: 'done', label: 'Выгружены' }] },
      { name: 'binding', label: 'Привязка', type: 'select', options: [{ value: 'account', label: 'К лицевым счетам' }, { value: 'unlinked', label: 'Не привязанные' }] },
      // Платёж банка с реестром уже показывает строки реестра суммой: детализация открывается по клику на источник.
      showRegistry ? { name: 'hide_registry_details', label: 'Строки реестров', type: 'select', allLabel: 'Показывать', options: [{ value: 'true', label: 'Скрыть (в окне платежа)' }], defaultValue: 'true' } : null,
    ].filter(Boolean),
    columns: [
      { key: 'payment_date', label: 'Дата', primary: true, render: (r) => dateWithSeason(r, r.payment_time ? ` ${formatTime(r.payment_time)}` : '') },
      { key: 'payer_name', label: 'От кого' },
      { key: 'amount', label: 'Сумма', render: (r) => el('span', { class: 'nowrap' }, formatMoney(r.amount)) },
      { key: 'link', label: 'Лицевой счёт / категория', render: (r) => withExported(withAttention(linkCell(r, refs), r), r) },
      { key: 'bank_account_id', label: 'Счёт', render: (r) => refs.bankName(r.bank_account_id) },
      showRegistry ? { key: 'registry_id', label: 'Источник', render: (r) => sourceCell(r, refs) } : null,
      { key: 'purpose', label: 'Назначение' },
      { key: 'comment', label: 'Комментарий' },
    ].filter(Boolean),
    emptyMessage: 'Платежей не найдено',
    deleteMessage: (r) => `Удалить платёж ${formatMoney(r.amount)}${r.payer_name ? ` от «${r.payer_name}»` : ''}?`,
  });
}

// Платёж с флагом «обратить внимание» (например, капремонт на обычном счёте): метка под привязкой, причина — в подсказке и комментарии.
function withAttention(node, r) {
  if (!r.attention) return node;
  return el('div', {}, [node, el('div', {}, el('span', { class: 'badge badge-attention', title: r.comment || '' }, '⚠ Обратить внимание'))]);
}

// Платёж, выгруженный в реестр для внешней системы: метка с именем файла в подсказке.
function withExported(node, r) {
  if (!r.export_id) return node;
  return el('div', {}, [node, el('div', {}, el('a', { class: 'badge badge-success', href: '/payment-exports', title: `Выгружен в реестр ${r.export_file_name || ''}` }, '✓ Выгружен'))]);
}

function linkCell(r, refs) {
  if (!r.personal_account_number && !r.category_id) return el('span', { class: 'badge badge-neutral' }, 'Не привязан');
  const origin = originLabel(r);
  return el('div', {}, [
    r.personal_account_number ? accountLink(r) : refs.categoryBadge(r.category_id),
    origin ? el('div', { class: 'assigned-by' }, origin) : null,
  ]);
}

// Лицевой счёт: цветная метка-ссылка на страницу помещения, к которому он привязан.
function accountLink(r) {
  const text = `ЛС ${r.personal_account_number}`;
  if (!r.premises_id) return el('span', { class: 'account-link' }, text);
  return el('a', { class: 'account-link', href: `/premises/${r.premises_id}`, title: 'Открыть помещение' }, text);
}

// Кнопка «Скачать в Excel»: все платежи по текущим фильтрам списка (на сервере есть предел по числу строк).
function excelButton(list, direction) {
  const api = direction === 'outgoing' ? outgoingPaymentsApi : incomingPaymentsApi;
  const button = el('button', { type: 'button', class: 'btn', title: 'Все платежи по текущим фильтрам, а не только текущая страница' }, 'Скачать в Excel');
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Формируем файл…';
    try {
      saveFile(await api.exportExcel(list.getQuery()));
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
    } finally {
      button.disabled = false;
      button.textContent = 'Скачать в Excel';
    }
  });
  return button;
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
    excelButton(list, direction),
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
  const exporting = createExportSelection({ bankName: refs.bankName });
  const list = createIncomingList(refs, { selection: exporting.selection });
  exporting.bind(list);
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [el('h1', {}, 'Входящие платежи'), assignActions(list)]),
    refs.banks.length ? null : el('div', { class: 'form-error' }, ['Сначала добавьте ', el('a', { href: '/bank-accounts' }, 'банковский счёт'), '.']),
    exporting.bar,
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
