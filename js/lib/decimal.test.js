import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDecimal } from './decimal.js';

test('normalizeDecimal: запятая -> точка, пробелы убираются', () => {
  assert.equal(normalizeDecimal('101,71'), '101.71');
  assert.equal(normalizeDecimal(' 101.71\n'), '101.71');
  assert.equal(normalizeDecimal('234 773,5'), '234773.5');
  assert.equal(normalizeDecimal('0,001'), '0.001');
  assert.equal(normalizeDecimal('5'), '5');
});

test('normalizeDecimal: не число — null', () => {
  assert.equal(normalizeDecimal('abc'), null);
  assert.equal(normalizeDecimal('1,2,3'), null);
  assert.equal(normalizeDecimal(''), null);
  assert.equal(normalizeDecimal(null), null);
});
