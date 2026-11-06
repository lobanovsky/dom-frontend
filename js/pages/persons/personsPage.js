import { crudPage } from '../../ui/crudList.js';
import { openPropertiesDialog } from '../../ui/propertiesDialog.js';
import { personsApi } from '../../api/resources.js';
import { personFields } from '../fields.js';
import { el } from '../../lib/dom.js';
import { saveFile } from '../../ui/saveFile.js';
import { toast } from '../../ui/toast.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { formatDate, personName } from '../../lib/format.js';

// Контакты по одному на строку; первый — основной (жирным, если их несколько).
function contactList(items) {
  if (!items || items.length === 0) return '';
  return el('div', { class: 'contact-list' }, items.map((item, i) => el('div', { class: i === 0 && items.length > 1 ? 'contact-primary' : null }, item)));
}

// Отчёт «физлица и их недвижимость» (квартиры → коммерческие → машиноместа); доступен и для просмотра.
async function downloadReport() {
  try {
    saveFile(await personsApi.propertiesReportPdf());
  } catch (err) {
    if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
  }
}

export const personsPage = crudPage({
  title: 'Физлица',
  headerActions: [el('button', { type: 'button', class: 'btn', onclick: downloadReport }, 'Отчёт: физлица и недвижимость (PDF)')],
  entityTitle: 'Физлицо',
  api: personsApi,
  fields: personFields,
  filters: [{ name: 'q', label: 'Поиск', type: 'search', placeholder: 'Фамилия, имя, телефон или email' }],
  columns: [
    { key: 'name', label: 'ФИО', primary: true, render: personName },
    { key: 'birth_date', label: 'Дата рождения', render: (r) => formatDate(r.birth_date) },
    { key: 'phones', label: 'Телефоны', render: (r) => contactList(r.phones) },
    { key: 'emails', label: 'Email', render: (r) => contactList(r.emails) },
  ],
  extraActions: (r) => [el('button', {
    type: 'button',
    class: 'btn btn-ghost btn-sm',
    onclick: () => openPropertiesDialog({ title: `Недвижимость: ${personName(r)}`, load: () => personsApi.properties(r.id) }),
  }, 'Недвижимость')],
  emptyMessage: 'Физлиц не найдено',
  deleteMessage: (r) => `Удалить «${personName(r)}»?`,
});
