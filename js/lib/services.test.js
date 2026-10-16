import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, formatPrice, meterText, calcMethodText, tariffPeriod } from './services.js';

const nbsp = (s) => s.replace(/\s/g, ' ');

test('formatMoney: от двух до четырёх знаков', () => {
  assert.equal(nbsp(formatMoney(5.8)), '5,80 ₽');
  assert.equal(nbsp(formatMoney(45.1234)), '45,1234 ₽');
  assert.equal(nbsp(formatMoney(1234.5)), '1 234,50 ₽');
  assert.equal(formatMoney(null), '');
  assert.equal(formatMoney(''), '');
});

test('formatPrice добавляет единицу', () => {
  assert.equal(nbsp(formatPrice(5.89, 'kwh')), '5,89 ₽ / кВт·ч');
  assert.equal(nbsp(formatPrice(2400, 'gcal')), '2 400,00 ₽ / Гкал');
  assert.equal(formatPrice(undefined, 'kwh'), '');
});

test('meterText и calcMethodText', () => {
  assert.equal(meterText({ meter_resource: 'electricity', meter_tariff: 2 }), 'Электроэнергия Т2');
  assert.equal(meterText({ meter_resource: 'cold_water', meter_tariff: 1 }), 'Холодная вода');
  assert.equal(meterText({ meter_resource: null }), '');
  assert.equal(calcMethodText({ calc_method: 'individual_meter', meter_resource: 'hot_water', meter_tariff: 1 }), 'По счётчику: Горячая вода');
  assert.equal(calcMethodText({ calc_method: 'common_meter', meter_resource: 'electricity', meter_tariff: 1 }), 'Общедомовой счётчик: Электроэнергия Т1');
  assert.equal(calcMethodText({ calc_method: 'per_area' }), 'За м² площади помещения');
  const byId = new Map([[1, { name: 'ХВС' }], [2, { name: 'ХВС для ГВС' }]]);
  assert.equal(calcMethodText({ calc_method: 'sum', component_ids: [1, 2] }, byId), 'Сумма: ХВС + ХВС для ГВС');
  assert.equal(calcMethodText({ calc_method: 'sum', component_ids: [] }), 'Сумма других услуг');
});

test('tariffPeriod', () => {
  const f = (iso) => iso.split('-').reverse().join('.');
  assert.equal(tariffPeriod('2026-01-01', null, f), 'с 01.01.2026');
  assert.equal(tariffPeriod('2025-01-01', '2025-12-31', f), '01.01.2025 — 31.12.2025');
  assert.equal(tariffPeriod(null, null, f), '');
});
