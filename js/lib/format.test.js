import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatPeriod, formatShare, formatArea, personName, isActiveOn, todayIso } from './format.js';

test('formatDate', () => {
  assert.equal(formatDate('2020-03-05'), '05.03.2020');
  assert.equal(formatDate(''), '');
  assert.equal(formatDate(null), '');
});

test('todayIso uses local date with zero padding', () => {
  assert.equal(todayIso(new Date(2024, 0, 7)), '2024-01-07');
});

test('formatPeriod', () => {
  assert.equal(formatPeriod('2020-01-01', null), 'с 01.01.2020');
  assert.equal(formatPeriod('2020-01-01', '2021-12-31'), '01.01.2020 — 31.12.2021');
  assert.equal(formatPeriod(null, null), '');
});

test('formatShare', () => {
  assert.equal(formatShare(1, 2), '1/2');
  assert.equal(formatShare(1, 1), 'целиком');
  assert.equal(formatShare(0, 0), '');
});

test('formatArea', () => {
  assert.match(formatArea(54.3), /^54,3\s?м²$/);
  assert.equal(formatArea(null), '');
});

test('personName skips empty parts', () => {
  assert.equal(personName({ last_name: 'Иванов', first_name: 'Иван', middle_name: null }), 'Иванов Иван');
  assert.equal(personName(null), '');
});

test('isActiveOn', () => {
  assert.equal(isActiveOn('2020-01-01', null, '2024-05-01'), true);
  assert.equal(isActiveOn('2020-01-01', '2021-12-31', '2024-05-01'), false);
  assert.equal(isActiveOn('2025-01-01', null, '2024-05-01'), false);
  assert.equal(isActiveOn('2020-01-01', '2024-05-01', '2024-05-01'), true);
});

test('formatMoney and formatTime', async () => {
  const { formatMoney, formatTime } = await import('./format.js');
  assert.equal(formatMoney(8575.3).replace(/\s/g, ' '), '8 575,30 ₽');
  assert.equal(formatMoney(0).replace(/\s/g, ' '), '0,00 ₽');
  assert.equal(formatMoney(null), '');
  assert.equal(formatTime('09:32:33'), '09:32');
  assert.equal(formatTime(null), '');
});
