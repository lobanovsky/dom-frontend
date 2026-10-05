import { crudPage } from '../../ui/crudList.js';
import { paymentCategoriesApi } from '../../api/resources.js';
import { paymentCategoryFields } from '../fields.js';
import { paymentDirections, label, options } from '../../lib/labels.js';

export const paymentCategoriesPage = crudPage({
  title: 'Категории платежей',
  entityTitle: 'Категория',
  api: paymentCategoriesApi,
  fields: paymentCategoryFields,
  filters: [{ name: 'direction', label: 'Направление', type: 'select', options: options(paymentDirections) }],
  columns: [
    { key: 'name', label: 'Название', primary: true },
    { key: 'direction', label: 'Направление', render: (r) => label(paymentDirections, r.direction) },
  ],
  emptyMessage: 'Категорий пока нет. Они нужны для платежей без лицевого счёта (например, аренда оборудования) и для расходов',
  deleteMessage: (r) => `Удалить категорию «${r.name}»? Удалить можно только категорию без платежей.`,
});
