// Логика счётчиков и показаний без DOM: единицы, тарифы, форматирование, статус и поверка. Покрыта тестами.

import { formatDate } from './format.js';
import { label, meterResources } from './labels.js';

const UNITS = { cold_water: 'м³', hot_water: 'м³', electricity: 'кВт·ч' };

export const resourceUnit = (resource) => UNITS[resource] || '';

// Названия показаний счётчика по числу тарифов: однотарифный и водяной — «Показание», иначе Т1…Т3.
export function tariffColumns(tariffs) {
  const n = Math.min(Math.max(Number(tariffs) || 1, 1), 3);
  return Array.from({ length: n }, (_, i) => ({ key: `t${i + 1}`, delta: `delta_t${i + 1}`, label: n === 1 ? 'Показание' : `Т${i + 1}` }));
}

// 1234.5 -> «1 234,5»; не больше трёх знаков после запятой; пустое значение -> ''.
export function formatReading(value) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 });
}

// Расход: «+20,5» / «0»; пустое значение -> ''.
export function formatDelta(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })}`;
}

// Расход по всем тарифам вместе (сумма delta_t*) и по каждому тарифу: {total, parts: ['Т1 +20', …]}.
export function consumption(reading, tariffs) {
  const cols = tariffColumns(tariffs);
  const values = cols.map((c) => reading[c.delta]).filter((v) => v !== null && v !== undefined);
  if (values.length === 0) return { total: null, parts: [] };
  const total = values.reduce((sum, v) => sum + Number(v), 0);
  return { total: Math.round(total * 1000) / 1000, parts: cols.length > 1 ? cols.map((c) => `${c.label} ${formatDelta(reading[c.delta])}`) : [] };
}

// Последнее показание счётчика в одну строку: «1 234 · 560 · 80»; нет показаний -> ''.
export function lastReadingText(meter) {
  if (!meter.last_reading_date) return '';
  return tariffColumns(meter.tariffs).map((c) => formatReading(meter[`last_${c.key}`])).join(' · ');
}

// «№ 42» или, если у счётчика есть название, «ИТП, № 42».
export const meterNumberText = (meter) => `${meter.name ? `${meter.name}, ` : ''}№ ${meter.serial_number}`;

// «ИТП · Холодная вода № 42»; без названия — «Холодная вода № 42».
export const meterTitle = (meter) => `${meter.name ? `${meter.name} · ` : ''}${label(meterResources, meter.resource)} № ${meter.serial_number}`;

// Состояние счётчика по дням работы: {text, kind} для бейджа (kind — суффикс badge-*).
export function meterStatus(meter) {
  if (meter.active) return { text: 'Работает', kind: 'success' };
  if (meter.removed_at) return { text: `Выведен ${formatDate(meter.removed_at)}`, kind: 'neutral' };
  return { text: 'Не введён в эксплуатацию', kind: 'neutral' };
}

const SOON_DAYS = 30;

// Поверка: 'overdue' — срок вышел, 'soon' — в ближайшие 30 дней, null — всё в порядке или срок не задан/счётчик выведен.
export function verificationState(meter, today) {
  if (!meter.next_verification_at || (meter.removed_at && meter.removed_at < today)) return null;
  if (meter.next_verification_at < today) return 'overdue';
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + SOON_DAYS);
  return meter.next_verification_at <= limit.toISOString().slice(0, 10) ? 'soon' : null;
}

// Подсказка при вводе показания: что было последним («Предыдущее на 01.02.2026: 1 · 2 · 3») или, пока показаний нет, начальные.
export function previousReadingText(meter) {
  const cols = tariffColumns(meter.tariffs);
  if (meter.last_reading_date) return `Предыдущее на ${formatDate(meter.last_reading_date)}: ${lastReadingText(meter)}`;
  return `Начальное: ${cols.map((c) => formatReading(meter[`initial_${c.key}`] ?? 0)).join(' · ')}`;
}

const isRetired = (m) => !m.active && Boolean(m.removed_at);

// Пометка выведенного из работы счётчика для списков выбора: « (выведен 01.03.2026)»; рабочему — ''.
export const retiredNote = (m) => (isRetired(m) ? ` (выведен ${formatDate(m.removed_at)})` : '');

// Общедомовые счётчики ресурса для выбора в услуге: работающие первыми, выведенные из работы в конце (с пометкой).
// Выведенные не скрываются: расчёт за прошлый месяц берёт те счётчики услуги, что работали в этом месяце,
// поэтому старый счётчик нужен услуге, пока по нему считают прошлые периоды.
export const selectableCommonMeters = (meters, resource) =>
  meters.filter((m) => m.resource === resource).sort((a, b) => Number(isRetired(a)) - Number(isRetired(b)));

// Метка группы общедомовых счётчиков: «Холодная вода»; withBuilding — с домом: «Паркинг · Холодная вода».
export const meterGroup = (meter, withBuilding = false) => {
  const resource = label(meterResources, meter.resource);
  const building = withBuilding ? (meter.building_name || meter.building_address) : '';
  return building ? `${building} · ${resource}` : resource;
};
