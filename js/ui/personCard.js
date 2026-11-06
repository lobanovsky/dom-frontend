import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { openEntityForm } from './entityForm.js';
import { openPropertiesDialog } from './propertiesDialog.js';
import { personsApi } from '../api/resources.js';
import { personFields } from '../pages/fields.js';
import { definitionList } from '../pages/common.js';
import { describeApiError } from '../lib/apiErrors.js';
import { formatDate, formatPhone, personName } from '../lib/format.js';
import { canWrite } from '../lib/permissions.js';

// Контакты по одному на строку, первый — основной; ссылки открывают почту/звонок.
function contactList(items, hrefPrefix, hrefOf = (s) => s, textOf = (s) => s) {
  if (!items || items.length === 0) return null;
  return el('div', { class: 'contact-list contact-list--left' }, items.map((item, i) => el(
    'div',
    { class: i === 0 && items.length > 1 ? 'contact-primary' : null },
    el('a', { href: `${hrefPrefix}${hrefOf(item)}` }, textOf(item)),
  )));
}

// Ссылка tel: — цифры с «+» (в базе номер без плюса).
const phoneHref = (s) => {
  const d = s.replace(/[^\d+]/g, '');
  return d.startsWith('+') || d.length < 10 ? d : `+${d}`;
};

// Карточка физлица: контакты и дата рождения, «Изменить» открывает форму.
// onChanged(person) вызывается после сохранения, чтобы страница обновила имена и контакты.
export function openPersonCard(id, { onChanged } = {}) {
  const body = el('div', {}, el('div', { class: 'table-status' }, 'Загрузка…'));
  const modal = openModal({ title: 'Физлицо', content: body });

  function showError(err) {
    if (err.status === 0 || err.status >= 500) return modal.close(); // глобальный тост уже показан клиентом
    body.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
  }

  function render(person) {
    const actions = [
      el('button', {
        type: 'button',
        class: 'btn btn-ghost',
        onclick: () => openPropertiesDialog({ title: `Недвижимость: ${personName(person)}`, load: () => personsApi.properties(person.id) }),
      }, 'Недвижимость'),
    ];
    if (canWrite()) {
      actions.unshift(el('button', { type: 'button', class: 'btn', onclick: () => edit(person) }, 'Изменить'));
    }
    // replaceChildren превращает null в текст «null», поэтому пустые узлы отфильтровываем.
    body.replaceChildren(...[
      el('h3', { class: 'person-card-name' }, personName(person)),
      definitionList([
        ['Дата рождения', formatDate(person.birth_date)],
        ['Телефоны', contactList(person.phones, 'tel:', phoneHref, formatPhone)],
        ['Email', contactList(person.emails, 'mailto:')],
      ]),
      person.phones?.length || person.emails?.length || person.birth_date
        ? null
        : el('p', { class: 'section-note' }, 'Контакты не указаны'),
      el('div', { class: 'form-actions' }, actions),
    ].filter(Boolean));
  }

  function edit(person) {
    openEntityForm({
      title: 'Физлицо: редактирование',
      fields: personFields,
      entity: person,
      save: (payload) => personsApi.update(person.id, payload),
      onSaved: (saved) => {
        onChanged?.(saved);
        openPersonCard(id, { onChanged });
      },
    });
  }

  personsApi.get(id).then(render, showError);
  return modal;
}
