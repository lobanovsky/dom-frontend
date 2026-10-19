import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusText, warningText, meterUseText, currentMonth, previousMonth, monthShortName, shiftYear } from './calculation.js';

test('statusText: причина, по которой строка не считается', () => {
  assert.equal(statusText({ status: 'ok' }), '');
  assert.match(statusText({ status: 'no_reading' }), /не переданы/);
  assert.match(statusText({ status: 'no_previous' }), /точкой отсчёта/);
  assert.match(statusText({ status: 'no_norm' }), /норматива/);
});

test('statusText: у составной услуги называется слагаемое и чего ему не хватает', () => {
  const line = { status: 'component_failed', failed_component: 'ХВС', meters: [{ status: 'no_reading' }] };
  assert.equal(statusText(line), 'ХВС: показания за этот месяц не переданы');
  assert.equal(statusText({ status: 'no_price', failed_component: 'ХВС' }), 'ХВС: на начало месяца нет цены (тарифа)');
});

test('warningText и meterUseText', () => {
  assert.match(warningText('price_changes'), /первое число/);
  assert.equal(warningText('unknown'), 'unknown');
  const fmt = (v) => String(v).replace('.', ',');
  assert.equal(meterUseText({ serial_number: '77', status: 'ok', previous: 100, current: 120.5, consumption: 20.5 }, fmt), '№ 77: 100 → 120,5 = 20,5');
  assert.match(meterUseText({ serial_number: '77', status: 'no_reading' }, fmt), /№ 77: показания/);
  assert.equal(meterUseText({ serial_number: '77', name: 'ИТП', status: 'ok', previous: 100, current: 120.5, consumption: 20.5 }, fmt), 'ИТП, № 77: 100 → 120,5 = 20,5');
});

test('currentMonth и previousMonth', () => {
  assert.equal(currentMonth(new Date(2026, 9, 17)), '2026-10');
  assert.equal(previousMonth('2026-10'), '2026-09');
  assert.equal(previousMonth('2026-01'), '2025-12');
  assert.equal(previousMonth(''), '');
});

test('formatQuantity: до четырёх знаков', async () => {
  const { formatQuantity } = await import('./calculation.js');
  assert.equal(formatQuantity(0.6215).replace(/\s/g, ' '), '0,6215');
  assert.equal(formatQuantity(20.5), '20,5');
  assert.equal(formatQuantity(null), '');
});

test('monthShortName и shiftYear', () => {
  assert.equal(monthShortName(1), 'янв');
  assert.equal(monthShortName(12), 'дек');
  assert.equal(monthShortName(13), '');
  assert.equal(shiftYear(2026, -1), 2025);
  assert.equal(shiftYear(2026, 1), 2027);
});
