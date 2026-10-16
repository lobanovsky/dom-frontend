// Логика услуг и тарифов без DOM: единицы, цена, способ расчёта. Покрыта тестами.

import { label, meterResources, serviceCalcMethods } from './labels.js';

const SHORT_UNITS = { kwh: 'кВт·ч', m3: 'м³', gcal: 'Гкал', m2: 'м²', piece: 'шт.', month: 'мес.' };

export const unitShort = (unit) => SHORT_UNITS[unit] || '';

// 45.1234 -> «45,1234 ₽»; не меньше двух и не больше четырёх знаков после запятой; пустое значение -> ''.
export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  return `${Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₽`;
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
    case 'sum': {
      const names = (service.component_ids || []).map((id) => byId.get(id)?.name || `№${id}`);
      return names.length ? `Сумма: ${names.join(' + ')}` : 'Сумма других услуг';
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
