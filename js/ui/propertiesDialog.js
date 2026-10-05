import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { renderTable } from './table.js';
import { describeApiError } from '../lib/apiErrors.js';
import { premisesKinds, label } from '../lib/labels.js';
import { formatArea, formatShare, formatPeriod } from '../lib/format.js';

// Окно «Недвижимость владельца»: помещения, которыми физлицо или юрлицо владеет сегодня.
// load() -> Promise<{items}> (GET /persons|legal-entities/{id}/properties).
export function openPropertiesDialog({ title, load }) {
  const body = el('div', {}, el('div', { class: 'table-status' }, 'Загрузка…'));
  const modal = openModal({ title, content: body, wide: true });

  load().then(({ items }) => {
    const totalArea = items.reduce((sum, r) => sum + (r.total_area || 0), 0);
    body.replaceChildren(
      el('p', {}, items.length === 0
        ? 'Действующих объектов недвижимости нет'
        : `Объектов: ${items.length}${totalArea ? `, общая площадь ${formatArea(Math.round(totalArea * 100) / 100)}` : ''}`),
      renderTable({
        columns: [
          { key: 'premises', label: 'Помещение', primary: true, render: (r) => el('a', { href: `/premises/${r.premises_id}`, onclick: () => modal.close() }, `${label(premisesKinds, r.premises_kind)} № ${r.premises_number}`) },
          { key: 'building_address', label: 'Дом' },
          { key: 'total_area', label: 'Площадь', render: (r) => formatArea(r.total_area) },
          { key: 'share', label: 'Доля', render: (r) => formatShare(r.share_num, r.share_den) },
          { key: 'period', label: 'Период', render: (r) => formatPeriod(r.valid_from, r.valid_to) },
        ],
        rows: items,
        getRowKey: (r) => r.ownership_id,
      }),
    );
  }, (err) => {
    if (err.status === 0 || err.status >= 500) return modal.close(); // глобальный тост уже показан клиентом
    body.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
  });
  return modal;
}
