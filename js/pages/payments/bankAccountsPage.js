import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { bankAccountsApi, organizationsApi } from '../../api/resources.js';
import { bankAccountFields } from '../fields.js';
import { formatPeriod } from '../../lib/format.js';

const yesNo = [{ value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }];

export async function bankAccountsPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  const { items: organizations } = await organizationsApi.list({ limit: 200 });
  const orgName = new Map(organizations.map((o) => [o.id, o.name]));

  const list = createCrudList({
    entityTitle: 'Банковский счёт',
    api: bankAccountsApi,
    fields: bankAccountFields(organizations),
    filters: [
      { name: 'organization_id', label: 'Организация', type: 'select', options: organizations.map((o) => ({ value: String(o.id), label: o.name })) },
      { name: 'is_special', label: 'Специальный', type: 'select', options: yesNo },
      { name: 'active', label: 'Активный', type: 'select', options: yesNo },
    ],
    columns: [
      { key: 'number', label: 'Номер счёта', primary: true },
      { key: 'bank_name', label: 'Банк', render: (r) => [r.bank_name, r.bik ? `БИК ${r.bik}` : null].filter(Boolean).join(', ') },
      { key: 'is_special', label: 'Тип', render: (r) => (r.is_special ? 'Специальный' : 'Обычный') },
      { key: 'organization_id', label: 'Организация', render: (r) => orgName.get(r.organization_id) || '' },
      { key: 'valid_from', label: 'Период', render: (r) => formatPeriod(r.valid_from, r.valid_to) },
      { key: 'active', label: 'Статус', render: (r) => el('span', { class: r.active ? 'badge badge-success' : 'badge badge-neutral' }, r.active ? 'Активен' : 'Закрыт') },
      { key: 'description', label: 'Описание' },
    ],
    emptyMessage: organizations.length ? 'Банковских счетов пока нет' : 'Сначала добавьте организацию',
    deleteMessage: (r) => `Удалить банковский счёт ${r.number}? Удалить можно только счёт без реестров и платежей.`,
  });

  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Банковские счета')),
    list.element,
  ]));
}
