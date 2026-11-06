import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupPeople } from './people.js';

const own = (id, person, from, to = null) => ({ id, person_id: person, owner_name: `П${person}`, share_num: 1, share_den: 1, valid_from: from, valid_to: to });
const res = (id, person, from, to = null) => ({ id, person_id: person, valid_from: from, valid_to: to });
const day = '2026-11-06';

test('an owner who lives there is one row, owners come first', () => {
  const rows = groupPeople([own(1, 5, '2020-01-01')], [res(1, 7, '2016-01-01'), res(2, 5, '2020-01-01')], { tab: 'current', day });
  assert.deepEqual(rows.map((r) => [r.key, r.isOwner, r.residencies.length]), [['p5', true, 1], ['p7', false, 1]]);
});

test('current and history split records by period', () => {
  const o = [own(1, 5, '2020-01-01', '2023-09-30'), own(2, 6, '2023-10-01')];
  const r = [res(1, 5, '2020-01-01', '2023-09-30'), res(2, 6, '2023-10-01')];
  assert.deepEqual(groupPeople(o, r, { tab: 'current', day }).map((x) => x.key), ['p6']);
  assert.deepEqual(groupPeople(o, r, { tab: 'history', day }).map((x) => x.key), ['p5']);
});

test('a person with current residency and past ownership shows only the current part', () => {
  const rows = groupPeople([own(1, 5, '2020-01-01', '2021-01-01')], [res(1, 5, '2020-01-01')], { tab: 'current', day });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].isOwner, false);
  assert.equal(rows[0].residencies.length, 1);
});

test('legal entity owner is its own row, deleted tab keeps everything', () => {
  const legal = { id: 3, legal_entity_id: 9, owner_name: 'ООО', owner_kind: 'legal_entity', share_num: 1, share_den: 1, valid_from: '2020-01-01', valid_to: '2021-01-01' };
  const rows = groupPeople([legal], [], { tab: 'deleted', day });
  assert.deepEqual(rows.map((r) => [r.key, r.legalEntityId, r.isOwner]), [['l9', 9, true]]);
});

test('residents are ordered by name when nameOf is given', () => {
  const rows = groupPeople([], [res(1, 2, '2020-01-01'), res(2, 1, '2020-01-01')], { tab: 'current', day, nameOf: (r) => ({ 1: 'Б', 2: 'А' })[r.personId] });
  assert.deepEqual(rows.map((r) => r.personId), [2, 1]);
});
