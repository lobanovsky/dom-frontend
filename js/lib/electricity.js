// Последние месяцы в порядке от нового к старому, независимо от часового пояса браузера.
export function recentMonths(period, count = 12) {
  const [year, month] = period.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}
export const monthLabel = (period) => new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T12:00:00Z`));

// Все месяцы выбранного календарного года: от декабря к январю.
export function yearMonths(year) {
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new RangeError('Invalid year');
  return Array.from({ length: 12 }, (_, index) => `${String(year).padStart(4, '0')}-${String(12 - index).padStart(2, '0')}`);
}

// Годовой итог складывает только полностью рассчитанные месяцы, в целых копейках.
export function annualElectricityTotal(rows) {
  const ready = rows.filter(({ result, error }) => !error && result?.complete);
  return {
    total: ready.length ? ready.reduce((sum, { result }) => sum + Math.round(result.total * 100), 0) / 100 : null,
    monthsCount: ready.length,
    complete: rows.length === 12 && ready.length === 12,
  };
}
