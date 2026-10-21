import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { openEntityForm } from '../../ui/entityForm.js';
import { metersApi, meterReadingsApi } from '../../api/resources.js';
import { meterFields, meterReadingFields } from '../fields.js';
import { meterResources, meterTariffs, premisesKinds, label, options } from '../../lib/labels.js';
import { formatDate, todayIso } from '../../lib/format.js';
import { lastReadingText, meterGroup, meterStatus, meterTitle, resourceUnit, verificationState } from '../../lib/meters.js';
import { buildingLabel, buildingLabelOf } from '../../lib/buildings.js';

// Список счётчиков. Используется на странице «Счётчики», в карточке помещения (fixedQuery/fixed: premises_id)
// и на странице дома (fixedQuery: {scope: 'common', building_id}, fixed: {building_id}).
// target — как в форме выбирается привязка (см. meterFields); showLocation: false — без колонки «Где» (место и так известно).
export function createMetersList({ fixedQuery = {}, fixed = {}, target = 'fixed', buildings = [], showFilters = false, showLocation = true, emptyMessage = 'Счётчиков пока нет' } = {}) {
  const today = todayIso();
  let list;

  // Быстрый ввод показания прямо из списка.
  function addReading(meter) {
    openEntityForm({
      title: `Новое показание: ${meterTitle(meter)}`,
      fields: meterReadingFields(meter),
      initialValues: { reading_date: today },
      fixed: { meter_id: meter.id },
      save: (body) => meterReadingsApi.create(body),
      onSaved: () => list.reload(),
    });
  }

  const filters = showFilters ? [
    { name: 'building_id', label: 'Дом', type: 'select', options: buildings.map((b) => ({ value: String(b.id), label: buildingLabel(b) })) },
    { name: 'resource', label: 'Ресурс', type: 'select', options: options(meterResources) },
    { name: 'active', label: 'Состояние', type: 'select', allLabel: 'Все', options: [{ value: 'true', label: 'Работают' }, { value: 'false', label: 'Не работают' }], defaultValue: 'true' },
    { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Номер, название счётчика или номер помещения' },
  ] : [];

  list = createCrudList({
    entityTitle: 'Счётчик',
    addLabel: 'Добавить счётчик',
    api: metersApi,
    fields: meterFields({ target, buildings }),
    watch: ['resource', 'tariffs'],
    fixedQuery,
    fixed,
    newDefaults: { installed_at: today, tariffs: '3', coefficient: '1', ...(target === 'building' && buildings.length === 1 ? { building_id: String(buildings[0].id) } : {}) },
    filters,
    // Общедомовые счётчики сгруппированы по ресурсу (сервер отдаёт их по дому, ресурсу и названию); индивидуальные — без групп.
    groupBy: (m) => (m.premises_id ? null : meterGroup(m, showLocation)),
    rowClass: (m) => (m.active ? null : 'row-muted'),
    columns: [
      { key: 'serial_number', label: 'Счётчик', primary: true, render: (m) => el('a', { href: `/meters/${m.id}` }, meterTitle(m)) },
      showLocation ? { key: 'location', label: 'Где', render: locationCell } : null,
      { key: 'tariffs', label: 'Тарифность', render: (m) => (m.resource === 'electricity' ? label(meterTariffs, m.tariffs) : '') },
      { key: 'last', label: 'Последнее показание', render: (m) => lastCell(m) },
      { key: 'verification', label: 'Поверка', render: (m) => verificationCell(m, today) },
      { key: 'status', label: 'Состояние', render: (m) => { const s = meterStatus(m); return el('span', { class: `badge badge-${s.kind}` }, s.text); } },
    ].filter(Boolean),
    extraActions: (m) => (m.active ? [el('button', { type: 'button', class: 'btn btn-sm', onclick: () => addReading(m) }, 'Показание')] : []),
    emptyMessage,
    deleteMessage: (m) => `Удалить счётчик ${meterTitle(m)}? Удалить можно только счётчик без показаний; обычно его выводят из работы датой окончания.`,
  });
  return list;
}

function locationCell(m) {
  if (m.premises_id) {
    return el('div', {}, [
      el('a', { href: `/premises/${m.premises_id}` }, `${label(premisesKinds, m.premises_kind)} № ${m.premises_number}`),
      el('div', { class: 'text-muted' }, buildingLabelOf(m)),
    ]);
  }
  return el('div', {}, [el('span', { class: 'badge badge-neutral' }, 'Общедомовой'), el('div', { class: 'text-muted' }, buildingLabelOf(m))]);
}

function lastCell(m) {
  const text = lastReadingText(m);
  if (!text) return el('span', { class: 'text-muted' }, 'Показаний нет');
  return el('div', {}, [el('span', { class: 'nowrap' }, `${text} ${resourceUnit(m.resource)}`), el('div', { class: 'text-muted' }, formatDate(m.last_reading_date))]);
}

function verificationCell(m, today) {
  if (!m.next_verification_at) return '';
  const state = verificationState(m, today);
  return el('div', {}, [
    el('span', { class: 'nowrap' }, `до ${formatDate(m.next_verification_at)}`),
    state ? el('div', {}, el('span', { class: `badge badge-${state === 'overdue' ? 'danger' : 'warning'}` }, state === 'overdue' ? 'Просрочена' : 'Скоро')) : null,
  ]);
}
