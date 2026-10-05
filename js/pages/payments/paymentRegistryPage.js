import { el } from '../../lib/dom.js';
import { paymentRegistriesApi } from '../../api/resources.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { notFoundView, definitionList } from '../common.js';
import { loadPaymentRefs } from './common.js';
import { createIncomingList } from './incomingPaymentsPage.js';

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
      el('div', { class: 'header-actions' }, el('a', { class: 'btn', href: paymentRegistriesApi.fileUrl(registry.id), download: registry.file_name }, 'Скачать файл')),
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
    ])),
    el('h2', { class: 'section-title' }, 'Платежи реестра'),
    list.element,
  ]));
}
