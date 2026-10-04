import { crudPage } from '../../ui/crudList.js';
import { organizationsApi } from '../../api/resources.js';
import { organizationFields } from '../fields.js';
import { organizationKinds, label, options } from '../../lib/labels.js';

export const organizationsPage = crudPage({
  title: 'Организации',
  entityTitle: 'Организация',
  api: organizationsApi,
  fields: organizationFields,
  filters: [{ name: 'kind', label: 'Тип', type: 'select', options: options(organizationKinds) }],
  columns: [
    { key: 'name', label: 'Название', primary: true },
    { key: 'kind', label: 'Тип', render: (r) => label(organizationKinds, r.kind) },
    { key: 'inn', label: 'ИНН' },
  ],
  emptyMessage: 'Организаций пока нет',
  deleteMessage: (r) => `Удалить организацию «${r.name}»?`,
});
