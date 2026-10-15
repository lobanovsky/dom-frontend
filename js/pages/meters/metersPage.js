import { el } from '../../lib/dom.js';
import { buildingsApi } from '../../api/resources.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { createMetersList } from './metersList.js';

const MODES = [
  { id: 'common', title: 'Общедомовые', target: 'building' },
  { id: 'individual', title: 'В помещениях', target: 'premises' },
];

// Раздел «Счётчики»: общедомовые счётчики домов и индивидуальные счётчики помещений.
export async function metersPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let buildings;
  try {
    ({ items: buildings } = await buildingsApi.list({ limit: 200 }));
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }

  let mode = MODES[1];
  const switcher = el('div', { class: 'segmented', role: 'tablist' });
  const host = el('div', {});

  function show() {
    switcher.replaceChildren(...MODES.map((m) => el('button', {
      type: 'button', role: 'tab', class: m === mode ? 'segmented-item is-active' : 'segmented-item', 'aria-selected': String(m === mode),
      onclick: () => { mode = m; show(); },
    }, m.title)));
    const list = createMetersList({
      fixedQuery: { scope: mode.id },
      target: mode.target,
      buildings,
      showFilters: true,
      emptyMessage: mode.id === 'common' ? 'Общедомовых счётчиков пока нет' : 'Счётчиков в помещениях пока нет',
    });
    host.replaceChildren(list.element);
  }

  show();
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Счётчики')),
    switcher,
    host,
  ]));
}
