import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resourceUnit, tariffColumns, formatReading, formatDelta, consumption, lastReadingText, meterStatus, verificationState, meterTitle, previousReadingText } from './meters.js';

test('units and tariff columns', () => {
  assert.equal(resourceUnit('electricity'), 'кВт·ч');
  assert.equal(resourceUnit('hot_water'), 'м³');
  assert.deepEqual(tariffColumns(1).map((c) => c.label), ['Показание']);
  assert.deepEqual(tariffColumns(3).map((c) => c.label), ['Т1', 'Т2', 'Т3']);
  assert.deepEqual(tariffColumns(3).map((c) => c.key), ['t1', 't2', 't3']);
  assert.equal(tariffColumns(undefined).length, 1);
  assert.equal(tariffColumns(7).length, 3);
});

test('readings and deltas are formatted', () => {
  assert.equal(formatReading(1234.5).replace(/\s/g, ''), '1234,5');
  assert.equal(formatReading(0.001), '0,001');
  assert.equal(formatReading(null), '');
  assert.equal(formatDelta(20.5), '+20,5');
  assert.equal(formatDelta(0), '0');
  assert.equal(formatDelta(undefined), '');
});

test('consumption sums tariffs and lists parts for multi-tariff meters', () => {
  assert.deepEqual(consumption({ delta_t1: 20, delta_t2: 20.5, delta_t3: 10 }, 3), { total: 50.5, parts: ['Т1 +20', 'Т2 +20,5', 'Т3 +10'] });
  assert.deepEqual(consumption({ delta_t1: 3 }, 1), { total: 3, parts: [] });
  assert.deepEqual(consumption({ delta_t1: 0.1, delta_t2: 0.2 }, 2).total, 0.3);
  assert.deepEqual(consumption({}, 1), { total: null, parts: [] });
});

test('last reading text', () => {
  assert.equal(lastReadingText({ tariffs: 3, last_reading_date: null }), '');
  assert.equal(lastReadingText({ tariffs: 3, last_reading_date: '2026-02-01', last_t1: 1, last_t2: 2.5, last_t3: 3 }), '1 · 2,5 · 3');
  assert.equal(lastReadingText({ tariffs: 1, last_reading_date: '2026-02-01', last_t1: 12 }), '12');
});

test('meter status and title', () => {
  assert.deepEqual(meterStatus({ active: true }), { text: 'Работает', kind: 'success' });
  assert.deepEqual(meterStatus({ active: false, removed_at: '2026-03-01' }), { text: 'Выведен 01.03.2026', kind: 'neutral' });
  assert.equal(meterStatus({ active: false, removed_at: null }).text, 'Не введён в эксплуатацию');
  assert.equal(meterTitle({ resource: 'cold_water', serial_number: '42' }), 'Холодная вода № 42');
});

test('verification state', () => {
  const today = '2026-10-15';
  assert.equal(verificationState({ next_verification_at: null }, today), null);
  assert.equal(verificationState({ next_verification_at: '2026-10-14' }, today), 'overdue');
  assert.equal(verificationState({ next_verification_at: '2026-10-15' }, today), 'soon');
  assert.equal(verificationState({ next_verification_at: '2026-11-14' }, today), 'soon');
  assert.equal(verificationState({ next_verification_at: '2026-11-15' }, today), null);
  assert.equal(verificationState({ next_verification_at: '2020-01-01', removed_at: '2021-01-01' }, today), null);
});

test('hint with the previous reading', () => {
  const m = { tariffs: 2, initial_t1: 10, initial_t2: 5.5 };
  assert.equal(previousReadingText(m), 'Начальное: 10 · 5,5');
  assert.equal(previousReadingText({ ...m, last_reading_date: '2026-02-01', last_t1: 12, last_t2: 6 }), 'Предыдущее на 01.02.2026: 12 · 6');
});
