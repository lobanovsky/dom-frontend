import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { paymentCategoriesApi } from '../../api/resources.js';
import { paymentCategoryFields } from '../fields.js';
import { categoryBadge } from '../../ui/categoryStyle.js';

// Категории платежей: направление выбирается переключателем (как на странице правил), по умолчанию входящие;
// ?direction=outgoing открывает исходящие. Направление берётся из переключателя, а не из формы.
export function paymentCategoriesPage(container, _params, query = {}) {
  let direction = query.direction === 'outgoing' ? 'outgoing' : 'incoming';
  const title = el('h1', {}, 'Категории платежей');
  const switcher = el('div', { class: 'segmented', role: 'tablist' });
  const host = el('div', {});

  function buildList() {
    return createCrudList({
      api: paymentCategoriesApi,
      fixedQuery: { direction },
      fixed: { direction },
      entityTitle: 'Категория',
      addLabel: 'Добавить категорию',
      fields: paymentCategoryFields,
      columns: [{ key: 'name', label: 'Название', primary: true, render: (r) => categoryBadge(r) }],
      emptyMessage: direction === 'outgoing'
        ? 'Категорий расходов пока нет'
        : 'Категорий пока нет. Они нужны для платежей без лицевого счёта (например, аренда оборудования)',
      deleteMessage: (r) => `Удалить категорию «${r.name}»? У платежей с этой категорией она будет снята.`,
    });
  }

  function show() {
    switcher.replaceChildren(...[['incoming', 'Входящие платежи'], ['outgoing', 'Исходящие платежи']].map(([d, text]) => el('button', {
      type: 'button', role: 'tab', class: d === direction ? 'segmented-item is-active' : 'segmented-item', 'aria-selected': String(d === direction),
      onclick: () => { if (d === direction) return; direction = d; show(); },
    }, text)));
    host.replaceChildren(buildList().element);
  }

  container.replaceChildren(el('div', { class: 'page' }, [el('div', { class: 'section-header' }, title), switcher, host]));
  show();
}
