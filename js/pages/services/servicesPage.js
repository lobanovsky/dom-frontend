import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { organizationsApi, servicesApi } from '../../api/resources.js';
import { serviceFields } from '../fields.js';
import { serviceKinds, serviceUnits, accountPurposes, premisesKinds, label, options } from '../../lib/labels.js';
import { calcMethodText, formatPrice, premisesKindsText } from '../../lib/services.js';
import { describeApiError } from '../../lib/apiErrors.js';

// Справочник услуг: коммунальные, эксплуатационные и дополнительные услуги организации с текущей ценой.
export async function servicesPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let organizations;
  let services;
  try {
    [{ items: organizations }, { items: services }] = await Promise.all([organizationsApi.list({ limit: 200 }), servicesApi.list({ limit: 200 })]);
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }
  const byId = new Map(services.map((s) => [s.id, s]));

  // Список услуг и форма «Из каких услуг состоит» опираются на актуальный перечень: после изменений перечитываем его.
  const catalogApi = {
    ...servicesApi,
    create: async (body) => { const r = await servicesApi.create(body); await reloadCatalog(); return r; },
    update: async (id, body) => { const r = await servicesApi.update(id, body); await reloadCatalog(); return r; },
    remove: async (id) => { await servicesApi.remove(id); await reloadCatalog(); },
    restore: async (id) => { const r = await servicesApi.restore(id); await reloadCatalog(); return r; },
  };
  async function reloadCatalog() {
    try {
      ({ items: services } = await servicesApi.list({ limit: 200 }));
      byId.clear();
      services.forEach((s) => byId.set(s.id, s));
    } catch {
      // перечень обновится при следующем открытии страницы
    }
  }

  const list = createCrudList({
    entityTitle: 'Услуга',
    addLabel: 'Добавить услугу',
    api: catalogApi,
    fields: (values) => serviceFields({ organizations, services })(values),
    watch: ['calc_method', 'meter_resource'],
    newDefaults: { active: true, account_purpose: 'utilities', ...(organizations.length === 1 ? { organization_id: String(organizations[0].id) } : {}) },
    filters: [
      { name: 'organization_id', label: 'Организация', type: 'select', options: organizations.map((o) => ({ value: String(o.id), label: o.name })) },
      { name: 'kind', label: 'Вид', type: 'select', options: options(serviceKinds) },
      { name: 'account_purpose', label: 'Счёт', type: 'select', options: options(accountPurposes) },
      { name: 'active', label: 'Состояние', type: 'select', allLabel: 'Все', options: [{ value: 'true', label: 'Оказываются' }, { value: 'false', label: 'Не оказываются' }], defaultValue: 'true' },
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Название услуги' },
    ],
    rowClass: (s) => (s.active ? null : 'row-muted'),
    columns: [
      { key: 'name', label: 'Услуга', primary: true, render: (s) => el('a', { href: `/services/${s.id}` }, s.name) },
      { key: 'kind', label: 'Вид', render: (s) => label(serviceKinds, s.kind) },
      { key: 'account_purpose', label: 'Счёт', render: (s) => label(accountPurposes, s.account_purpose) },
      { key: 'premises', label: 'Помещения', render: (s) => premisesKindsText(s.premises_kinds, premisesKinds) },
      { key: 'calc', label: 'Как считается', render: (s) => calcMethodText(s, byId) },
      { key: 'unit', label: 'Единица', render: (s) => label(serviceUnits, s.unit) },
      { key: 'price', label: 'Цена сейчас', render: (s) => (s.current_price === null || s.current_price === undefined
        ? el('span', { class: 'badge badge-warning' }, 'Нет тарифа') : el('span', { class: 'nowrap' }, formatPrice(s.current_price, s.unit))) },
    ],
    emptyMessage: 'Услуг пока нет',
    deleteMessage: (s) => `Удалить услугу «${s.name}»? Удалить можно только услугу без тарифов, не входящую в состав других услуг. Обычно услугу просто отключают («Услуга оказывается»).`,
  });

  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Услуги')),
    list.element,
  ]));
}
