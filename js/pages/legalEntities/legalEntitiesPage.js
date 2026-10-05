import { crudPage } from '../../ui/crudList.js';
import { el } from '../../lib/dom.js';
import { openPropertiesDialog } from '../../ui/propertiesDialog.js';
import { legalEntitiesApi } from '../../api/resources.js';
import { legalEntityFields } from '../fields.js';

export const legalEntitiesPage = crudPage({
  title: 'Юрлица',
  entityTitle: 'Юрлицо',
  api: legalEntitiesApi,
  fields: legalEntityFields,
  filters: [{ name: 'q', label: 'Поиск', type: 'search', placeholder: 'Название или ИНН' }],
  columns: [
    { key: 'name', label: 'Название', primary: true },
    { key: 'inn', label: 'ИНН' },
    { key: 'kpp', label: 'КПП' },
  ],
  extraActions: (r) => [el('button', {
    type: 'button',
    class: 'btn btn-ghost btn-sm',
    onclick: () => openPropertiesDialog({ title: `Недвижимость: ${r.name}`, load: () => legalEntitiesApi.properties(r.id) }),
  }, 'Недвижимость')],
  emptyMessage: 'Юрлиц не найдено',
  deleteMessage: (r) => `Удалить юрлицо «${r.name}»?`,
});
