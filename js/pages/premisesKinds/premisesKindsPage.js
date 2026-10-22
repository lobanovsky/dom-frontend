import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { premisesKindsApi } from '../../api/resources.js';
import { premisesKindFields } from '../fields.js';

// Справочник видов помещений: список выбора в формах помещений, фильтрах, услугах и правилах строится из него.
export function premisesKindsPage(container) {
  const list = createCrudList({
    api: premisesKindsApi,
    entityTitle: 'Вид помещения',
    addLabel: 'Добавить вид',
    fields: premisesKindFields,
    columns: [
      { key: 'name', label: 'Название', primary: true },
      { key: 'code', label: 'Код' },
      { key: 'position', label: 'Порядок' },
    ],
    emptyMessage: 'Видов помещений пока нет',
    deleteMessage: (r) => `Удалить вид «${r.name}»? Удалить можно только вид, которым не пользуются помещения и услуги.`,
  });
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Виды помещений')),
    list.element,
  ]));
}
