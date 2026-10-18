// Логика услуг и тарифов без DOM: единицы, цена, способ расчёта. Покрыта тестами.

import { label, meterResources, serviceCalcMethods } from './labels.js';

const SHORT_UNITS = { kwh: 'кВт·ч', m3: 'м³', gcal: 'Гкал', m2: 'м²', piece: 'шт.', month: 'мес.' };

export const unitShort = (unit) => SHORT_UNITS[unit] || '';

// 45.1234 -> «45,1234 ₽»; не меньше двух и не больше четырёх знаков после запятой; пустое значение -> ''.
export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  return `${Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₽`;
}

// Норматив, Гкал на м²: 0.011 -> «0,011»; до пяти знаков после запятой; пустое значение -> ''.
export function formatNorm(value) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 5 });
}

// Цена за единицу услуги: «5,89 ₽ / кВт·ч».
export function formatPrice(value, unit) {
  const money = formatMoney(value);
  if (!money) return '';
  const short = unitShort(unit);
  return short ? `${money} / ${short}` : money;
}

// Какой счётчик берёт услуга: «Электроэнергия Т2», «Холодная вода»; у услуг без счётчика — ''.
export function meterText(service) {
  if (!service.meter_resource) return '';
  const name = label(meterResources, service.meter_resource);
  return service.meter_resource === 'electricity' && service.meter_tariff ? `${name} Т${service.meter_tariff}` : name;
}

// Как считается услуга, одной строкой. byId — услуги по id (названия слагаемых у суммы).
export function calcMethodText(service, byId = new Map()) {
  switch (service.calc_method) {
    case 'individual_meter':
      return `По счётчику: ${meterText(service)}`;
    case 'common_meter':
      return `Общедомовой счётчик: ${meterText(service)}`;
    case 'sum_volumes':
    case 'sum_prices': {
      const names = (service.component_ids || []).map((id) => byId.get(id)?.name || `№${id}`);
      const what = service.calc_method === 'sum_volumes' ? 'объёмов' : 'цен';
      return names.length ? `Сумма ${what}: ${names.join(' + ')}` : `Сумма ${what} других услуг`;
    }
    default:
      return label(serviceCalcMethods, service.calc_method);
  }
}

// Период действия тарифа: «с 01.01.2026» или «01.01.2025 — 31.12.2025»; даты в формате ISO.
export function tariffPeriod(from, to, formatDate) {
  if (!from) return '';
  return to ? `${formatDate(from)} — ${formatDate(to)}` : `с ${formatDate(from)}`;
}

// Название услуги в квитанции: receipt_name, а если пусто — название из справочника.
export const receiptName = (service) => (service.receipt_name && service.receipt_name.trim()) || service.name;

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// Период назначения услуги: целый календарный месяц — «Октябрь 2026», иначе «с 01.10.2026» или «01.10.2026 — 15.12.2026».
export function assignmentPeriod(from, to, formatDate) {
  if (!from) return '';
  if (to) {
    const [fy, fm, fd] = from.slice(0, 10).split('-').map(Number);
    const [ty, tm, td] = to.slice(0, 10).split('-').map(Number);
    const lastDay = new Date(Date.UTC(fy, fm, 0)).getUTCDate();
    if (fy === ty && fm === tm && fd === 1 && td === lastDay) return `${MONTHS[fm - 1]} ${fy}`;
  }
  return tariffPeriod(from, to, formatDate);
}

// Виды помещений услуги: пустой список — «любые».
export function premisesKindsText(kinds, kindLabels) {
  return kinds && kinds.length ? kinds.map((k) => kindLabels[k] || k).join(', ') : 'любые';
}

// Составная услуга: сумма объёмов или сумма цен других услуг.
export const isSumMethod = (method) => method === 'sum_volumes' || method === 'sum_prices';
