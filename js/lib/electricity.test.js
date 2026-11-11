import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recentMonths } from './electricity.js';
test('12 месяцев от текущего с переходом через границу года', () => {
 const months = recentMonths('2026-02');
 assert.equal(months.length, 12);
 assert.deepEqual(months.slice(0, 3), ['2026-02', '2026-01', '2025-12']);
 assert.equal(months.at(-1), '2025-03');
});
