import { el } from '../../lib/dom.js';
import { paymentRegistriesApi } from '../../api/resources.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { toast } from '../../ui/toast.js';
import { notFoundView, definitionList } from '../common.js';
import { loadPaymentRefs } from './common.js';
import { createIncomingList, assignActions } from './incomingPaymentsPage.js';
import { canWrite } from '../../lib/permissions.js';

// Реестр: сводка по файлу и таблица его платежей.
export async function paymentRegistryPage(container, { id }) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let registry;
  let refs;
  try {
    [registry, refs] = await Promise.all([paymentRegistriesApi.get(id), loadPaymentRefs()]);
  } catch (err) {
    container.replaceChildren(notFoundView(describeApiError(err).message, '/payment-registries', 'К списку реестров'));
    return;
  }

  const list = createIncomingList(refs, { fixedQuery: { registry_id: registry.id }, showRegistry: false });
  container.replaceChildren(el('div', { class: 'page' }, [
    el('nav', { class: 'breadcrumbs' }, [el('a', { href: '/payment-registries' }, 'Реестры'), ' / ']),
    el('div', { class: 'section-header' }, [
      el('h1', {}, `Реестр ${registry.registry_number || `№ ${registry.id}`}`),
      el('div', { class: 'header-actions' }, [
        registry.payment_id || !canWrite() ? null : el('button', { type: 'button', class: 'btn', onclick: () => relink(container, { id }) }, 'Найти платёж в выписке'),
        el('a', { class: 'btn', href: paymentRegistriesApi.fileUrl(registry.id), download: registry.file_name }, 'Скачать файл'),
      ].filter(Boolean)),
    ]),
    el('div', { class: 'card' }, definitionList([
      ['Файл', registry.file_name],
      ['Дата реестра', formatDate(registry.registry_date)],
      ['Счёт', refs.bankName(registry.bank_account_id)],
      ['Платежей в файле', registry.payments_count],
      ['Сумма', formatMoney(registry.total_amount)],
      ['К перечислению', formatMoney(registry.total_transferred)],
      ['Комиссия', formatMoney(registry.total_commission)],
      ['Загружен', formatDate(registry.created_at)],
      ['Платёж в выписке', paymentCell(registry)],
    ])),
    el('div', { class: 'section-header section-header--sub' }, [el('h2', { class: 'section-title' }, 'Платежи реестра'), assignActions(list)]),
    list.element,
  ]));
}

// Платёж из банка, который этот реестр детализирует: ссылка на выписку с суммой и сверкой, либо подсказка.
function paymentCell(registry) {
  if (!registry.payment_id) return el('span', { class: 'badge badge-neutral', title: 'Платёж появится после получения выписки: ночная синхронизация, «Загрузить сейчас» на странице «Банк (Сбер)» или файл 1С' }, 'не найден');
  const same = registry.payment_amount === registry.total_transferred;
  const text = `${formatDate(registry.payment_date)}, ${formatMoney(registry.payment_amount)}${same ? ' · сумма совпадает с реестром' : ''}`;
  return registry.payment_statement_id
    ? el('a', { href: `/bank-statements/${registry.payment_statement_id}` }, `${text} (выписка № ${registry.payment_statement_id})`)
    : text;
}

// Повторное сопоставление: платёж мог появиться после загрузки реестра.
async function relink(container, { id }) {
  try {
    const { linked } = await paymentRegistriesApi.relink();
    toast[linked ? 'success' : 'info'](linked ? `Найдено платежей для реестров: ${linked}` : 'Платёж в выписке пока не найден');
    paymentRegistryPage(container, { id });
  } catch (err) {
    if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
  }
}
