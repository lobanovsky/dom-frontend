import { isAdmin } from '../../lib/permissions.js';
import { attachResidentAccess } from '../../lib/residentAccess.js';
import { residentAccessStatusView } from '../../ui/residentAccessStatus.js';
import { openResidentAccess } from '../../ui/residentAccess.js';
import { createCrudList } from '../../ui/crudList.js';
import { openPropertiesDialog } from '../../ui/propertiesDialog.js';
import { personsApi, residentAccessApi } from '../../api/resources.js';
import { personFields } from '../fields.js';
import { el } from '../../lib/dom.js';
import { saveFile } from '../../ui/saveFile.js';
import { toast } from '../../ui/toast.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { formatDate, formatPhone, personName } from '../../lib/format.js';

// Контакты по одному на строку; первый — основной (жирным, если их несколько).
function contactList(items, textOf = (s) => s) {
  if (!items || items.length === 0) return '';
  return el('div', { class: 'contact-list' }, items.map((item, i) => el('div', { class: i === 0 && items.length > 1 ? 'contact-primary' : null }, textOf(item))));
}

// Отчёт «физлица и их недвижимость» (квартиры → коммерческие → машиноместа); доступен и для просмотра.
async function downloadReport() {
  try {
    saveFile(await personsApi.propertiesReportPdf());
  } catch (err) {
    if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
  }
}

export function personsPage(container) {
  const admin = isAdmin();
  const list = createCrudList({
    entityTitle: 'Физлицо',
    api: { ...personsApi, list: async (query) => {
      const result = await personsApi.list(query);
      return admin ? { ...result, items: await attachResidentAccess(result.items, residentAccessApi.list) } : result;
    } },
    fields: personFields,
    filters: [{ name: 'q', label: 'Поиск', type: 'search', placeholder: 'Фамилия, имя, телефон или email' }],
    columns: [
      { key: 'name', label: 'ФИО', primary: true, render: personName },
      { key: 'birth_date', label: 'Дата рождения', render: (r) => formatDate(r.birth_date) },
      { key: 'phones', label: 'Телефоны', render: (r) => contactList(r.phones, formatPhone) },
      { key: 'emails', label: 'Email', render: (r) => contactList(r.emails) },
      ...(admin ? [{ key: 'resident_access', label: 'Личный кабинет', render: (r) => residentAccessStatusView(r.resident_access) }] : []),
    ],
    extraActions: (r) => [el('button', {
      type: 'button',
      class: 'btn btn-ghost btn-sm',
      onclick: () => openPropertiesDialog({ title: `Недвижимость: ${personName(r)}`, load: () => personsApi.properties(r.id) }),
    }, 'Недвижимость'), el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => openResidentAccess(r, { onSaved: () => list.reload() }) }, 'Личный кабинет')],
    emptyMessage: 'Физлиц не найдено',
    deleteMessage: (r) => `Удалить «${personName(r)}»?`,
  });
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [el('h1', {}, 'Физлица'), el('div', { class: 'header-actions' }, [el('button', { type: 'button', class: 'btn', onclick: downloadReport }, 'Отчёт: физлица и недвижимость (PDF)')])]),
    list.element,
  ]));
}
