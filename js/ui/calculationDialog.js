import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { renderTable } from './table.js';
import { accountsApi } from '../api/resources.js';
import { describeApiError } from '../lib/apiErrors.js';
import { createMonthPicker } from './monthPicker.js';
import { currentMonth, formatQuantity, meterUseText, statusText, warningText } from '../lib/calculation.js';
import { formatMoney, unitShort } from '../lib/services.js';
import { formatReading } from '../lib/meters.js';
import { monthLabel } from '../lib/format.js';

// Окно «Расчёт за месяц» лицевого счёта: услуги, назначенные на месяц, их количество, цена и сумма. Ничего не сохраняет.
// Что не удалось посчитать (нет показаний, цены…), показывается строкой с причиной и в итог не входит.
export function openCalculationDialog({ account }) {
  const result = el('div', { class: 'calculation-result' });
  let requestId = 0;
  const picker = createMonthPicker({ value: currentMonth(), onChange: () => load() });

  async function load() {
    const month = picker.value;
    const mine = ++requestId;
    result.replaceChildren(el('div', { class: 'table-status' }, 'Расчёт…'));
    try {
      const data = await accountsApi.calculation(account.id, month);
      if (mine === requestId) result.replaceChildren(...renderResult(data));
    } catch (err) {
      if (mine === requestId) result.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    }
  }

  const content = el('div', { class: 'calculation' }, [
    el('p', { class: 'field-help' }, 'Услуги, назначенные счёту хотя бы на один день месяца, считаются за весь месяц. Расход по счётчикам — показание этого месяца минус показание предыдущего месяца, у которого есть показания. Ничего не сохраняется.'),
    el('div', { class: 'field' }, [el('label', {}, 'За какой месяц'), picker.element]),
    result,
  ]);
  const modal = openModal({ title: `Расчёт по счёту № ${account.number}`, content, extraWide: true });
  load();
  return modal;
}

function details(line) {
  const parts = [];
  if (line.calc_method === 'per_area_norm' && line.area !== null && line.norm !== null) {
    parts.push(`${formatQuantity(line.area)} м² × ${formatQuantity(line.norm)} Гкал/м²`);
  }
  if (line.calc_method === 'common_meter' && line.common_total !== null && line.share_base) {
    parts.push(`${formatQuantity(line.common_total)} × ${formatQuantity(line.area)} м² / ${formatQuantity(line.share_base)} м²`);
  }
  // У составной услуги, которая не посчиталась, причина названа в статусе (со слагаемым): неудачные счётчики не повторяем.
  for (const m of line.meters || []) {
    if (line.status === 'component_failed' && m.status !== 'ok') continue;
    parts.push(meterUseText(m, formatReading));
  }
  return parts;
}

// Причина уже видна в строке счётчика: отдельным текстом её не повторяем.
const SHOWN_BY_METER = new Set(['no_reading', 'no_previous', 'negative']);

function problem(line) {
  if (SHOWN_BY_METER.has(line.status) && (line.meters || []).some((m) => m.status !== 'ok')) return null;
  return el('div', { class: 'text-warning' }, statusText(line));
}

function renderResult(data) {
  if (!data.lines.length) {
    return [el('div', { class: 'table-status' }, `На ${monthLabel(data.period)} счёту не назначено ни одной услуги`)];
  }
  const table = renderTable({
    columns: [
      { key: 'name', label: 'Услуга', primary: true, render: (l) => el('div', {}, [
        el('div', {}, l.name),
        ...details(l).map((d) => el('div', { class: 'text-muted' }, d)),
        ...(l.status === 'ok' ? l.warnings.map((w) => el('div', { class: 'text-warning' }, warningText(w))) : [problem(l)]),
      ]) },
      { key: 'quantity', label: 'Количество', render: (l) => (l.quantity === null ? '' : el('span', { class: 'nowrap' }, `${formatQuantity(l.quantity)} ${unitShort(l.unit)}`.trim())) },
      { key: 'price', label: 'Цена', render: (l) => (l.price === null ? '' : el('span', { class: 'nowrap' }, formatMoney(l.price))) },
      { key: 'amount', label: 'Сумма', render: (l) => (l.amount === null ? el('span', { class: 'badge badge-warning' }, 'Не посчитано') : el('strong', { class: 'nowrap' }, formatMoney(l.amount))) },
    ],
    rows: data.lines,
    getRowKey: (l) => l.service_id,
  });
  const total = el('div', { class: 'calculation-total' }, [
    el('span', {}, `Итого за ${monthLabel(data.period).toLowerCase()}: `),
    el('strong', {}, formatMoney(data.total)),
    data.complete ? null : el('div', { class: 'text-warning' }, 'Итог неполный: часть услуг не посчитана (причины указаны в строках).'),
  ]);
  return [table, total];
}
