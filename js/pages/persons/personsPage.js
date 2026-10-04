import { crudPage } from '../../ui/crudList.js';
import { personsApi } from '../../api/resources.js';
import { personFields } from '../fields.js';
import { formatDate, personName } from '../../lib/format.js';

export const personsPage = crudPage({
  title: 'Физлица',
  entityTitle: 'Физлицо',
  api: personsApi,
  fields: personFields,
  filters: [{ name: 'q', label: 'Поиск', type: 'search', placeholder: 'Фамилия, имя или телефон' }],
  columns: [
    { key: 'name', label: 'ФИО', primary: true, render: personName },
    { key: 'birth_date', label: 'Дата рождения', render: (r) => formatDate(r.birth_date) },
    { key: 'phone', label: 'Телефон' },
    { key: 'email', label: 'Email' },
  ],
  emptyMessage: 'Физлиц не найдено',
  deleteMessage: (r) => `Удалить «${personName(r)}»?`,
});
