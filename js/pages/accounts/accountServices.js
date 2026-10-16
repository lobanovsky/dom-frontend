import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { accountServicesApi, servicesApi } from '../../api/resources.js';
import { accountServiceFields } from '../fields.js';
import { assignmentPeriod, formatPrice, receiptName } from '../../lib/services.js';
import { formatDate } from '../../lib/format.js';
import { formatReading } from '../../lib/meters.js';
import { describeApiError } from '../../lib/apiErrors.js';

// Услуги лицевого счёта (раскрывается в карточке счёта в карточке помещения): список назначений и добавление услуги.
// Предлагаются действующие услуги того же типа счёта, применимые к виду помещения; уже назначенные не исключаются —
// одна услуга может быть назначена несколькими непересекающимися периодами (разовая в разные месяцы).
export async function createAccountServices({ account, premises }) {
  const host = el('div', { class: 'account-services' }, el('div', { class: 'table-status' }, 'Загрузка…'));
  let services;
  try {
    ({ items: services } = await servicesApi.list({ active: 'true', account_purpose: account.purpose, limit: 200 }));
  } catch (err) {
    host.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return host;
  }
  const suitable = services.filter((s) => !s.premises_kinds.length || s.premises_kinds.includes(premises.kind));
  const byId = new Map(services.map((s) => [s.id, s]));

  const list = createCrudList({
    entityTitle: 'Услуга',
    addLabel: 'Добавить услугу',
    api: accountServicesApi,
    fields: accountServiceFields({ services: suitable }),
    watch: ['service_id'],
    fixedQuery: { account_id: account.id },
    fixed: { account_id: account.id },
    columns: [
      { key: 'service', label: 'Услуга', primary: true, render: (x) => el('a', { href: `/services/${x.service_id}` }, receiptName(byId.get(x.service_id) || { name: x.service_name })) },
      { key: 'period', label: 'Период', render: (x) => assignmentPeriod(x.valid_from, x.valid_to, formatDate) },
      { key: 'quantity', label: 'Количество', render: (x) => (x.quantity === null || x.quantity === undefined ? '' : formatReading(x.quantity)) },
      { key: 'price', label: 'Цена сейчас', render: (x) => (x.current_price === null || x.current_price === undefined ? '' : el('span', { class: 'nowrap' }, formatPrice(x.current_price, x.service_unit))) },
      { key: 'comment', label: 'Комментарий' },
    ],
    emptyMessage: 'Услуг пока нет',
    deleteMessage: (x) => `Убрать услугу «${x.service_name}» у счёта № ${account.number}?`,
  });
  host.replaceChildren(list.element);
  return host;
}
