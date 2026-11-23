import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { openEntityForm } from '../../ui/entityForm.js';
import { metersApi, meterReadingsApi } from '../../api/resources.js';
import { meterFields, meterReadingFields } from '../fields.js';
import { meterResources, meterTariffs, premisesKinds, label, options } from '../../lib/labels.js';
import { formatDate, monthLabel, todayIso } from '../../lib/format.js';
import { coefficientNote, formatDelta, formatReading, meterGroup, meterStatus, meterTitle, premisesGroup, resourceUnit, serialParts, tariffColumns, verificationState } from '../../lib/meters.js';
import { buildingLabel, buildingLabelOf } from '../../lib/buildings.js';
import { meterIcon } from '../../ui/meterIcon.js';

// Список счётчиков. Используется на странице «Счётчики», в карточке помещения (fixedQuery/fixed: premises_id)
// и на странице дома (fixedQuery: {scope: 'common', building_id}, fixed: {building_id}).
// target — как в форме выбирается привязка (см. meterFields); showLocation: false — без колонки «Где» (место и так известно).
export function createMetersList({ fixedQuery = {}, fixed = {}, target = 'fixed', buildings = [], showFilters = false, showLocation = true, emptyMessage = 'Счётчиков пока нет' } = {}) {
  const today = todayIso();
  // Страница «Счётчики → В помещениях»: счётчики сгруппированы по помещениям, место указано в заголовке группы.
  const byPremises = showFilters && fixedQuery.scope === 'individual';
  // Общедомовые: место и так известно (дом в заголовке группы), вместо «Где» — дата ввода в эксплуатацию.
  const common = fixedQuery.scope === 'common';
  let list;

  // Быстрый ввод показания прямо из списка.
  function addReading(meter) {
    openEntityForm({
      title: `Новое показание: ${meterTitle(meter)}`,
      fields: (values) => meterReadingFields(meter, values),
      watch: ['no_consumption_t1', 'no_consumption_t2', 'no_consumption_t3'],
      initialFocus: '[name="t1"]',
      initialValues: { reading_date: today, new_reading: true },
      fixed: { meter_id: meter.id },
      save: (body) => meterReadingsApi.create(body),
      onSaved: () => list.reload(),
    });
  }

  const filters = showFilters ? [
    { name: 'building_id', label: 'Дом', type: 'select', options: buildings.map((b) => ({ value: String(b.id), label: buildingLabel(b) })) },
    ...(byPremises ? [{ name: 'premises_number', label: 'Помещение №', type: 'search', placeholder: 'Номер квартиры' }] : []),
    { name: 'resource', label: 'Ресурс', type: 'select', options: options(meterResources) },
    { name: 'reading_period', label: 'Месяц показаний', type: 'month', defaultValue: today.slice(0, 7) },
    { name: 'has_reading', label: 'Передача за месяц', type: 'select', allLabel: 'Все', options: [{ value: 'true', label: 'Передали' }, { value: 'false', label: 'Не передали' }] },
    { name: 'manual_reading_required', label: 'Ручная передача', type: 'select', allLabel: 'Все', options: [{ value: 'true', label: 'Требуется' }, { value: 'false', label: 'Не требуется' }] },
    { name: 'active', label: 'Состояние', type: 'select', allLabel: 'Все', options: [{ value: 'true', label: 'Работают' }, { value: 'false', label: 'Не работают' }] },
    { name: 'broken', label: 'Сломан', type: 'select', allLabel: 'Все', options: [{ value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }] },
    { name: 'q', label: 'Поиск', type: 'search', placeholder: 'Номер или название счётчика' },
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
    // Общедомовые счётчики сгруппированы по ресурсу (сервер отдаёт их по дому, ресурсу и названию), индивидуальные на странице «Счётчики» — по помещениям (сервер отдаёт счётчики помещения подряд).
    groupBy: (m) => (m.premises_id ? (byPremises ? premisesGroup(m, buildings.length > 1) : null) : meterGroup(m, showLocation)),
    rowClass: (m) => (m.active ? null : 'row-muted'),
    columns: [
      { key: 'serial_number', label: 'Счётчик', primary: true, render: (m) => el('span', { class: 'meter-cell' }, [meterIcon(m.resource), el('a', { href: `/meters/${m.id}` }, m.active ? meterCellTitle(m) : el('s', {}, meterCellTitle(m))), m.manual_reading_required ? manualReadingIcon() : null]) },
      showLocation && !byPremises && !common ? { key: 'location', label: 'Где', render: locationCell } : null,
      { key: 'tariffs', label: 'Тарифность', render: (m) => (m.resource === 'electricity' ? label(meterTariffs, m.tariffs) : '') },
      { key: 'last', label: 'Последнее показание', render: (m) => lastCell(m, today) },
      { key: 'last_consumption', label: 'Расход по последнему показанию', render: lastConsumptionCell },
      common ? { key: 'installed_at', label: 'Введён в эксплуатацию', render: (m) => formatDate(m.installed_at) } : null,
      { key: 'verification', label: 'Поверка', render: (m) => verificationCell(m, today) },
      { key: 'status', label: 'Состояние', render: (m) => { const s = meterStatus(m); return el('span', { class: `badge badge-${s.kind}` }, s.text); } },
    ].filter(Boolean),
    extraActions: (m) => (m.active ? [el('button', { type: 'button', class: 'btn btn-sm', onclick: () => addReading(m) }, 'Показание')] : []),
    emptyMessage,
    deleteMessage: (m) => `Удалить счётчик ${meterTitle(m)}? Удалить можно только счётчик без показаний; обычно его выводят из работы датой окончания.`,
  });
  return list;
}

function manualReadingIcon() {
  return el('span', {
    class: 'manual-reading-icon', role: 'img', title: 'Показания передавать вручную', 'aria-label': 'Показания передавать вручную',
    html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10 4.5a1.5 1.5 0 0 1 3 0V10 6a1.5 1.5 0 0 1 3 0v5 2l1-1a1.7 1.7 0 0 1 2.6 2.1l-3.4 5A4 4 0 0 1 14.9 22h-2.2a5 5 0 0 1-3.5-1.4L5.5 17a2 2 0 0 1 2.8-2.8L10 16V11a1 1 0 0 0-2 0Z"/></svg>',
  });
}

// Название в списке: у общедомовых вид ресурса уже указан в заголовке группы, поэтому «ИТП · № …»; у индивидуальных
// «Холодная вода № …». Номер: голова приглушена, последние 4 цифры жирно (тире рисует CSS).
function meterCellTitle(m) {
  const { head, tail } = serialParts(m.serial_number);
  return [
    ...[m.name, coefficientNote(m)].filter(Boolean).map((s) => `${s} · `),
    m.premises_id ? `${label(meterResources, m.resource)} ` : '',
    // «№» держится рядом с номером: при переносе строки они не разъезжаются
    el('span', { class: 'nowrap' }, ['№ ', el('span', { class: 'serial' }, [head ? el('span', { class: 'serial-head' }, head) : null, el('span', { class: 'serial-tail' }, tail)])]),
  ];
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

function lastCell(m, today) {
  if (!m.last_reading_date) return el('span', { class: 'text-muted' }, 'Показаний нет');
  const period = m.last_reading_period || m.last_reading_date;
  const monthBadge = String(period || '').slice(0, 7) === today.slice(0, 7) ? 'badge-success' : 'badge-neutral';
  const values = tariffColumns(m.tariffs).map((column) => {
    const value = formatReading(m[`last_${column.key}`]);
    return `${m.tariffs > 1 ? `${column.label}: ` : ''}${value} ${resourceUnit(m.resource)}`;
  });
  return el('div', {}, [
    el('div', { class: 'meter-last-reading-value' }, [
      el('div', { class: 'meter-tariff-values' }, values.map((value) => el('div', {}, value))),
      monthLabel(period) ? el('span', { class: `badge ${monthBadge}` }, monthLabel(period)) : null,
    ]),
    el('div', { class: 'text-muted' }, formatDate(m.last_reading_date)),
  ]);
}

function lastConsumptionCell(m) {
  if (!m.last_reading_date) return el('span', { class: 'text-muted' }, 'Нет данных');
  const values = tariffColumns(m.tariffs)
    .map((column) => ({ label: column.label, value: m[`last_${column.delta}`] }))
    .filter((column) => column.value !== null && column.value !== undefined);
  if (!values.length) return el('span', { class: 'text-muted' }, 'Нет данных');
  const period = m.last_reading_period || m.last_reading_date;
  return el('div', {}, [
    el('div', { class: 'meter-tariff-values' }, values.map((column) => el('div', {}, `${m.tariffs > 1 ? `${column.label}: ` : ''}${formatDelta(column.value)} ${resourceUnit(m.resource)}`))),
    monthLabel(period) ? el('small', { class: 'text-muted' }, `за ${monthLabel(period)}`) : null,
  ]);
}

function verificationCell(m, today) {
  if (!m.next_verification_at) return '';
  const state = verificationState(m, today);
  return el('div', {}, [
    el('span', { class: 'nowrap' }, `до ${formatDate(m.next_verification_at)}`),
    state ? el('div', {}, el('span', { class: `badge badge-${state === 'overdue' ? 'danger' : 'warning'}` }, state === 'overdue' ? 'Просрочена' : 'Скоро')) : null,
  ]);
}
