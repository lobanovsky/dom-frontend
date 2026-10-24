import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { organizationsApi, tariffsApi } from '../../api/resources.js';
import { tariffFields } from '../fields.js';
import { serviceUnits, label, options } from '../../lib/labels.js';
import { formatPrice, tariffPeriod } from '../../lib/services.js';
import { formatDate } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';

// Справочник тарифов: цена, общая для нескольких услуг («Электроэнергия Т1» — для квартир, машиномест и т. д.).
export async function tariffsPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let organizations;
  try {
    ({ items: organizations } = await organizationsApi.list({ limit: 200 }));
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }
  const list = createCrudList({
    entityTitle: 'Тариф',
    addLabel: 'Добавить тариф',
    api: tariffsApi,
    fields: tariffFields(organizations),
    newDefaults: organizations.length === 1 ? { organization_id: String(organizations[0].id) } : {},
    filters: [
      { name: 'organization_id', label: 'Организация', type: 'select', options: organizations.map((o) => ({ value: String(o.id), label: o.name })) },
      { name: 'unit', label: 'Единица', type: 'select', options: options(serviceUnits) },
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Название тарифа' },
    ],
    columns: [
      { key: 'name', label: 'Тариф', primary: true, render: (t) => el('a', { href: `/tariffs/${t.id}` }, t.name) },
      { key: 'organization_name', label: 'Организация' },
      { key: 'unit', label: 'Единица', render: (t) => label(serviceUnits, t.unit) },
      { key: 'price', label: 'Цена сейчас', render: (t) => (t.current_price === null || t.current_price === undefined
        ? el('span', { class: 'badge badge-warning' }, 'Нет цены') : el('span', { class: 'nowrap' }, formatPrice(t.current_price, t.unit))) },
      { key: 'price_period', label: 'Действует', render: (t) => (t.current_price_from ? el('span', { class: 'nowrap' }, tariffPeriod(t.current_price_from, t.current_price_to, formatDate)) : '') },
      { key: 'services_count', label: 'Услуг' },
    ],
    emptyMessage: 'Тарифов пока нет',
    deleteMessage: (t) => `Удалить тариф «${t.name}»? Удалить можно только тариф без цен и без услуг.`,
  });
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Тарифы')),
    el('p', { class: 'text-muted' }, 'Цена, которую берут сразу несколько услуг. Меняется в одном месте: например, «Электроэнергия Т1» для квартир, машиномест и коммунальной услуги.'),
    list.element,
  ]));
}
