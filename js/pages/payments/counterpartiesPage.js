import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { counterpartiesApi } from '../../api/resources.js';
import { formatDate } from '../../lib/format.js';
import { turnover, accountsText } from '../../lib/counterparties.js';

// Контрагенты: получатели наших платежей и плательщики из выписок. Список строится из платежей и всегда актуален
// (отдельного справочника и ночного обновления нет), в Sber API такого списка нет: там только адресная книга СберБизнес.
export async function counterpartiesPage(container) {
  const list = createCrudList({
    api: counterpartiesApi,
    canEdit: false,
    filters: [
      { name: 'direction', label: 'Кто', type: 'select', options: [{ value: 'outgoing', label: 'Получатели (мы платили)' }, { value: 'incoming', label: 'Плательщики (нам платили)' }] },
      { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Название, ИНН или счёт' },
    ],
    columns: [
      { key: 'name', label: 'Наименование', primary: true },
      { key: 'inn', label: 'ИНН' },
      { key: 'accounts', label: 'Счёт', render: (r) => accountsText(r.accounts) },
      { key: 'bank_name', label: 'Банк' },
      { key: 'outgoing', label: 'Мы платили', render: (r) => el('span', { class: 'nowrap' }, turnover(r.outgoing_count, r.outgoing_total)) },
      { key: 'incoming', label: 'Нам платили', render: (r) => el('span', { class: 'nowrap' }, turnover(r.incoming_count, r.incoming_total)) },
      { key: 'last_payment', label: 'Последний платёж', render: (r) => formatDate(r.last_payment) },
    ],
    emptyMessage: 'Контрагентов пока нет: они появятся после загрузки платежей',
  });
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [el('h1', {}, 'Контрагенты')]),
    el('p', { class: 'field-help' }, 'Все, кому мы платили, и юрлица, от которых получали платежи по выпискам. Список строится из платежей автоматически и обновляется после каждой загрузки выписки, в том числе ночной синхронизации со Сбером.'),
    list.element,
  ]));
}
