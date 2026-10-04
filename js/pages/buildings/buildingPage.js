import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { openEntityForm } from '../../ui/entityForm.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { toast } from '../../ui/toast.js';
import { goTo } from '../../state/nav.js';
import { buildingsApi, organizationsApi, premisesApi } from '../../api/resources.js';
import { buildingFields, premisesFields } from '../fields.js';
import { buildingKinds, premisesKinds, label, options } from '../../lib/labels.js';
import { formatArea } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { notFoundView, definitionList } from '../common.js';

export async function buildingPage(container, { id }) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let building;
  let organizations;
  try {
    [building, { items: organizations }] = await Promise.all([buildingsApi.get(id), organizationsApi.list({ limit: 200 })]);
  } catch (err) {
    container.replaceChildren(notFoundView(describeApiError(err).message, '/buildings', 'К списку домов'));
    return;
  }

  const info = el('div', { class: 'card' });
  const title = el('h1', {});

  function renderInfo() {
    title.textContent = building.address;
    const org = organizations.find((o) => o.id === building.organization_id);
    info.replaceChildren(definitionList([
      ['Тип', label(buildingKinds, building.kind)],
      ['Организация', org ? org.name : ''],
      ['Кадастровый номер', building.cadastral_number],
      ['Год постройки', building.year_built],
      ['Этажей', building.floors],
      ['Подъездов', building.entrances],
      ['Общая площадь', formatArea(building.total_area)],
    ]));
  }

  function edit() {
    openEntityForm({
      title: 'Дом: редактирование',
      fields: buildingFields(organizations),
      entity: building,
      save: (body) => buildingsApi.update(building.id, body),
      onSaved: (saved) => { building = saved; renderInfo(); },
    });
  }

  async function remove() {
    const ok = await confirmDialog({ title: 'Удаление', message: `Удалить дом «${building.address}»? Удалить можно только дом без помещений.`, confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    try {
      await buildingsApi.remove(building.id);
      toast.success('Дом удалён');
      goTo('/buildings');
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err, { action: 'delete' }).message);
    }
  }

  const premises = createCrudList({
    entityTitle: 'Помещение',
    addLabel: 'Добавить помещение',
    api: premisesApi,
    fields: premisesFields,
    fixedQuery: { building_id: building.id },
    fixed: { building_id: building.id },
    filters: [
      { name: 'kind', label: 'Вид', type: 'select', options: options(premisesKinds) },
      { name: 'number', label: 'Номер', type: 'search', placeholder: 'Точный номер' },
    ],
    columns: [
      { key: 'number', label: 'Номер', primary: true, render: (r) => el('a', { href: `/premises/${r.id}` }, `${label(premisesKinds, r.kind)} № ${r.number}`) },
      { key: 'entrance', label: 'Подъезд' },
      { key: 'floor', label: 'Этаж' },
      { key: 'total_area', label: 'Площадь', render: (r) => formatArea(r.total_area) },
      { key: 'rooms', label: 'Комнат' },
    ],
    emptyMessage: 'Помещений пока нет',
    deleteMessage: (r) => `Удалить помещение № ${r.number}? Удалить можно только помещение без собственников, жителей и счетов.`,
  });

  renderInfo();
  container.replaceChildren(el('div', { class: 'page' }, [
    el('nav', { class: 'breadcrumbs' }, [el('a', { href: '/buildings' }, 'Дома'), ' / ']),
    el('div', { class: 'section-header' }, [
      title,
      el('div', { class: 'header-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: edit }, 'Изменить'),
        el('button', { type: 'button', class: 'btn btn-ghost btn-danger-text', onclick: remove }, 'Удалить'),
      ]),
    ]),
    info,
    el('h2', { class: 'section-title' }, 'Помещения'),
    premises.element,
  ]));
}
