import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recentMonths, yearMonths } from './electricity.js';
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
