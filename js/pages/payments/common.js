import { bankAccountsApi, paymentCategoriesApi } from '../../api/resources.js';
import { bankLabel } from '../../lib/labels.js';

// Справочники для списков и форм платежей: банковские счета и категории (все, включая закрытые счета:
// старые платежи ссылаются на них).
export async function loadPaymentRefs() {
  const [{ items: banks }, { items: categories }] = await Promise.all([
    bankAccountsApi.list({ limit: 200 }),
    paymentCategoriesApi.list({ limit: 200 }),
  ]);
  const bankById = new Map(banks.map((b) => [b.id, b]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  return {
    banks,
    categories,
    incomingCategories: categories.filter((c) => c.direction === 'incoming'),
    outgoingCategories: categories.filter((c) => c.direction === 'outgoing'),
    bankName: (id) => (bankById.has(id) ? bankLabel(bankById.get(id)) : ''),
    categoryName: (id) => categoryById.get(id)?.name || '',
  };
}

export const bankFilterOptions = (banks) => banks.map((b) => ({ value: String(b.id), label: bankLabel(b) }));
export const categoryFilterOptions = (categories) => categories.map((c) => ({ value: String(c.id), label: c.name }));

// Общие фильтры списков платежей.
export const dateFilters = [
  { name: 'date_from', label: 'С даты', type: 'date' },
  { name: 'date_to', label: 'По дату', type: 'date' },
];
