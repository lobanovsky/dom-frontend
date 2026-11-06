import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { kinshipsApi } from '../../api/resources.js';
import { kinshipFields } from '../fields.js';

// Справочник родства: список «Кем приходится собственнику» в форме проживающего строится из него,
// а в будущем по нему будут считаться льготы.
export function kinshipsPage(container) {
  const list = createCrudList({
    api: kinshipsApi,
    entityTitle: 'Родство',
    addLabel: 'Добавить родство',
    fields: kinshipFields,
    columns: [
      { key: 'name', label: 'Название', primary: true },
      { key: 'code', label: 'Код' },
      { key: 'position', label: 'Порядок' },
    ],
    emptyMessage: 'Записей справочника пока нет',
    deleteMessage: (r) => `Удалить «${r.name}»? Удалить можно только запись, которой не пользуются проживающие.`,
  });
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Родство')),
    list.element,
  ]));
}
