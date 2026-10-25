// Тексты расчёта стоимости услуг счёта за месяц. Статусы и предупреждения приходят от бэкенда кодами. Покрыто тестами.

import { meterNumberText } from './meters.js';

// Почему строку нельзя посчитать: статус -> объяснение.
const STATUS_TEXT = {
  no_price: 'на начало месяца нет цены (тарифа)',
  no_area: 'не указана площадь помещения (или не из чего считать долю)',
  no_norm: 'у дома нет норматива на этот месяц',
  no_meters: 'не найден подходящий счётчик',
  no_reading: 'показания за этот месяц не переданы',
  no_previous: 'нет предыдущего показания: первое показание счётчика служит точкой отсчёта, расход считается со следующего месяца',
  negative: 'показание меньше предыдущего',
  no_quantity: 'не задано количество',
  component_failed: 'не посчиталась входящая услуга',
  retired: 'снят с учёта в этом месяце, показаний нет — не учтён',
};

const WARNING_TEXT = {
  price_changes: 'цена меняется внутри месяца: взята цена на первое число',
  norm_changes: 'норматив меняется внутри месяца: взят норматив на первое число',
  area_missing: 'у части помещений, между которыми делится расход, не указана площадь',
};

// Порядок видов услуг в расчёте: дополнительные, коммунальные, эксплуатационные, капитальный ремонт.
const KIND_ORDER = ['additional', 'utility', 'maintenance', 'capital_repair'];

// Строки расчёта, сгруппированные по виду услуги; внутри вида порядок бэкенда сохраняется. Неизвестные виды — в конце.
export function sortLinesByKind(lines) {
  const rank = (l) => { const i = KIND_ORDER.indexOf(l.kind); return i === -1 ? KIND_ORDER.length : i; };
  return lines.map((l, i) => [l, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([l]) => l);
}

// Объяснение строки, которую нельзя посчитать; у составной услуги — какая из входящих не посчиталась.
export function statusText(line) {
  if (!line || line.status === 'ok') return '';
  const base = STATUS_TEXT[line.status] || line.status;
  if (line.failed_component) {
    return line.status === 'component_failed' ? `${line.failed_component}: ${componentProblem(line)}` : `${line.failed_component}: ${base}`;
  }
  return base;
}

// У составной услуги причина — в счётчиках слагаемого: показывает, чего именно не хватает.
function componentProblem(line) {
  const bad = (line.meters || []).find((m) => m.status !== 'ok');
  return bad ? STATUS_TEXT[bad.status] || bad.status : STATUS_TEXT.component_failed;
}

export const warningText = (code) => WARNING_TEXT[code] || code;

// Расход одного счётчика одной строкой: «№ 123: 100 → 120,5 = 20,5» или причина.
export function meterUseText(use, formatNumber) {
  const who = meterNumberText(use);
  if (use.status !== 'ok') return `${who}: ${STATUS_TEXT[use.status] || use.status}`;
  return `${who}: ${formatNumber(use.previous)} → ${formatNumber(use.current)} = ${formatNumber(use.consumption)}`;
}

// Расчётный месяц по умолчанию — текущий: «2026-10» из даты (локальной).
export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

// Короткое название месяца (1–12) для кнопки выбора месяца.
export const monthShortName = (month) => MONTHS_SHORT[month - 1] || '';

// Год со сдвигом: shiftYear(2026, -1) -> 2025.
export const shiftYear = (year, delta) => year + delta;

// Показания месяца M берутся в расчёт за M; «предыдущий» месяц для подсказки.
export function previousMonth(month) {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return '';
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

// Количество в строке расчёта: до четырёх знаков после запятой; пустое значение -> ''.
export function formatQuantity(value) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 4 });
}
