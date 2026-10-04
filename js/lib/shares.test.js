import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeShareSum, describeShareSum } from './shares.js';

const own = (num, den, from, to = null) => ({ share_num: num, share_den: den, valid_from: from, valid_to: to });

test('sums only active ownerships and reduces the fraction', () => {
  const list = [own(1, 2, '2020-01-01'), own(1, 4, '2020-01-01'), own(1, 4, '2020-01-01', '2021-01-01')];
  assert.deepEqual(activeShareSum(list, '2024-01-01'), { num: 3, den: 4 });
  assert.deepEqual(activeShareSum(list, '2020-06-01'), { num: 1, den: 1 });
});

test('empty list is zero', () => {
  assert.deepEqual(activeShareSum([], '2024-01-01'), { num: 0, den: 1 });
});

test('describeShareSum', () => {
  assert.equal(describeShareSum({ num: 0, den: 1 }), 'нет действующих собственников');
  assert.equal(describeShareSum({ num: 1, den: 1 }), 'распределено полностью');
  assert.equal(describeShareSum({ num: 1, den: 2 }), 'распределено 1/2');
  assert.equal(describeShareSum({ num: 3, den: 2 }), 'превышает 1 (3/2)');
});
