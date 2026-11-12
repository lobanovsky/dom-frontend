import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recentMonths, yearMonths, annualElectricityTotal } from './electricity.js';
test('12 месяцев от текущего с переходом через границу года', () => {
 const months = recentMonths('2026-02');
 assert.equal(months.length, 12);
 assert.deepEqual(months.slice(0, 3), ['2026-02', '2026-01', '2025-12']);
 assert.equal(months.at(-1), '2025-03');
});

test('выбранный год включает только его месяцы, от декабря к январю', () => {
 const months = yearMonths(2025);
 assert.equal(months.length, 12);
 assert.equal(months[0], '2025-12');
 assert.equal(months.at(-1), '2025-01');
 assert.ok(months.every((period) => period.startsWith('2025-')));
 assert.equal(yearMonths(1).at(-1), '0001-01');
 assert.equal(yearMonths(9999)[0], '9999-12');
});
test('некорректный год не формирует запросы расчёта', () => {
 for (const year of [0, 10000, 2025.5, NaN]) assert.throws(() => yearMonths(year), RangeError);
});

test('годовой итог складывает 12 месяцев без погрешности копеек', () => {
 const rows = Array.from({ length: 12 }, (_, i) => ({ result: { complete: true, total: i % 2 ? 0.2 : 0.1 } }));
 assert.deepEqual(annualElectricityTotal(rows), { total: 1.8, monthsCount: 12, complete: true });
});
test('неполные и незагруженные месяцы не включаются в годовую сумму', () => {
 const rows = [
  { result: { complete: true, total: 100.15 } },
  { result: { complete: false, total: 999 } },
  { error: new Error('network') },
 ];
 assert.deepEqual(annualElectricityTotal(rows), { total: 100.15, monthsCount: 1, complete: false });
 assert.deepEqual(annualElectricityTotal([{ result: { complete: false, total: 999 } }]), { total: null, monthsCount: 0, complete: false });
 assert.equal(annualElectricityTotal([{ result: { complete: true, total: 0 } }]).total, 0);
});
