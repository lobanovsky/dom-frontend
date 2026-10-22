import test from 'node:test';
import assert from 'node:assert/strict';
import { premisesKinds, setPremisesKinds, premisesKindOptions, label } from './labels.js';

test('виды помещений заменяются содержимым справочника, порядок сохраняется', () => {
  const before = { ...premisesKinds };
  setPremisesKinds([{ code: 'garage', name: 'Гараж' }, { code: 'apartment', name: 'Квартира' }]);
  assert.deepEqual(premisesKindOptions(), [{ value: 'garage', label: 'Гараж' }, { value: 'apartment', label: 'Квартира' }]);
  assert.equal(label(premisesKinds, 'garage'), 'Гараж');
  // вид, которого нет в справочнике (удалён), показывается кодом
  assert.equal(label(premisesKinds, 'storage'), 'storage');
  setPremisesKinds(Object.entries(before).map(([code, name]) => ({ code, name })));
  assert.equal(label(premisesKinds, 'storage'), 'Кладовая');
});
