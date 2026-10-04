import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { buildingsApi, organizationsApi } from '../../api/resources.js';
import { buildingFields } from '../fields.js';
import { buildingKinds, label, options } from '../../lib/labels.js';

export async function buildingsPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  const { items: organizations } = await organizationsApi.list({ limit: 200 });
  const orgName = new Map(organizations.map((o) => [o.id, o.name]));

  const list = createCrudList({
    entityTitle: 'Дом',
    api: buildingsApi,
    fields: buildingFields(organizations),
    filters: [
      { name: 'organization_id', label: 'Организация', type: 'select', options: organizations.map((o) => ({ value: String(o.id), label: o.name })) },
      { name: 'kind', label: 'Тип', type: 'select', options: options(buildingKinds) },
    ],
    columns: [
      { key: 'address', label: 'Адрес', primary: true, render: (r) => el('a', { href: `/buildings/${r.id}` }, r.address) },
      { key: 'kind', label: 'Тип', render: (r) => label(buildingKinds, r.kind) },
      { key: 'organization_id', label: 'Организация', render: (r) => orgName.get(r.organization_id) || '' },
      { key: 'floors', label: 'Этажей' },
    ],
    emptyMessage: organizations.length ? 'Домов пока нет' : 'Сначала добавьте организацию',
    deleteMessage: (r) => `Удалить дом «${r.address}»? Удалить можно только дом без помещений.`,
  });

  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Дома')),
    list.element,
  ]));
}
