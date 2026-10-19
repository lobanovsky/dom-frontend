import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingLabel, buildingLabelOf } from './buildings.js';

test('buildingLabel: название, иначе адрес', () => {
  assert.equal(buildingLabel({ name: 'Паркинг', address: 'г. Москва, ул. Длинная, д. 1' }), 'Паркинг');
  assert.equal(buildingLabel({ name: null, address: 'г. Москва, ул. Длинная, д. 1' }), 'г. Москва, ул. Длинная, д. 1');
  assert.equal(buildingLabel({ name: '', address: 'адрес' }), 'адрес');
  assert.equal(buildingLabel(undefined), '');
});

test('buildingLabelOf: building_name, иначе building_address', () => {
  assert.equal(buildingLabelOf({ building_name: 'Паркинг', building_address: 'адрес' }), 'Паркинг');
  assert.equal(buildingLabelOf({ building_name: null, building_address: 'адрес' }), 'адрес');
  assert.equal(buildingLabelOf(null), '');
});
