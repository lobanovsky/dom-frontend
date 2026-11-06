import test from 'node:test';
import assert from 'node:assert/strict';
import { premisesKinds, setPremisesKinds, premisesKindOptions, kindRules, relations, setKinships, relationOptions, label } from './labels.js';

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

test('родство заменяется содержимым справочника, удалённое показывается кодом', () => {
  const before = { ...relations };
  setKinships([{ code: 'cousin', name: 'Двоюродный брат' }, { code: 'owner', name: 'Собственник' }]);
  assert.deepEqual(relationOptions(), [{ value: 'cousin', label: 'Двоюродный брат' }, { value: 'owner', label: 'Собственник' }]);
  assert.equal(label(relations, 'cousin'), 'Двоюродный брат');
  assert.equal(label(relations, 'son'), 'son');
  setKinships(Object.entries(before).map(([code, name]) => ({ code, name })));
  assert.equal(label(relations, 'son'), 'Сын');
});

test('правила вида помещения берутся из справочника', () => {
  const before = { ...premisesKinds };
  setPremisesKinds([
    { code: 'parking_space', name: 'Машиноместо', no_residents: true, single_owner: true },
    { code: 'apartment', name: 'Квартира', no_residents: false, single_owner: false },
    { code: 'storage', name: 'Кладовая', no_residents: true, single_owner: false },
  ]);
  assert.deepEqual(kindRules('parking_space'), { noResidents: true, singleOwner: true });
  assert.deepEqual(kindRules('storage'), { noResidents: true, singleOwner: false });
  assert.deepEqual(kindRules('apartment'), { noResidents: false, singleOwner: false });
  assert.deepEqual(kindRules('unknown'), { noResidents: false, singleOwner: false });
  setPremisesKinds(Object.entries(before).map(([code, name]) => ({ code, name, no_residents: code === 'parking_space', single_owner: code === 'parking_space' })));
  assert.deepEqual(kindRules('storage'), { noResidents: false, singleOwner: false });
});
