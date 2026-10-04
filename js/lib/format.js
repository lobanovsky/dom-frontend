// Форматирование значений для отображения. Без DOM — покрыто тестами.

const pad = (n) => String(n).padStart(2, '0');

// "2020-03-05" -> "05.03.2020"; пустое значение -> ''.
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}.${m}.${y}` : String(iso);
}

export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Период владения/проживания: "с 01.01.2020" или "01.01.2020 — 31.12.2021".
export function formatPeriod(from, to) {
  if (!from && !to) return '';
  if (!to) return `с ${formatDate(from)}`;
  return `${formatDate(from)} — ${formatDate(to)}`;
}

export function formatShare(num, den) {
  if (!num || !den) return '';
  return num === den ? 'целиком' : `${num}/${den}`;
}

export function formatArea(value) {
  if (value === null || value === undefined || value === '') return '';
  return `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} м²`;
}

export function personName(person) {
  if (!person) return '';
  return [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ');
}

// Период активен на дату day (строки YYYY-MM-DD сравниваются лексикографически).
export function isActiveOn(from, to, day) {
  return (!from || from <= day) && (!to || to >= day);
}
