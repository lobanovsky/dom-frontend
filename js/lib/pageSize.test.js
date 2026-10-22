import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_SIZES, DEFAULT_PAGE_SIZE, normalizePageSize, loadPageSize, savePageSize } from './pageSize.js';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v) };
};

test('допустимые значения и значение по умолчанию', () => {
  assert.deepEqual(PAGE_SIZES, [10, 50, 100]);
  assert.equal(DEFAULT_PAGE_SIZE, 10);
  assert.equal(normalizePageSize('50'), 50);
  assert.equal(normalizePageSize('7'), 10);
  assert.equal(normalizePageSize(null), 10);
});

test('выбор запоминается', () => {
  const storage = memory();
  assert.equal(loadPageSize(storage), 10);
  savePageSize(100, storage);
  assert.equal(loadPageSize(storage), 100);
  savePageSize(33, storage);
  assert.equal(loadPageSize(storage), 10);
});

test('недоступное хранилище не ломает', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(loadPageSize(broken), 10);
  assert.doesNotThrow(() => savePageSize(50, broken));
});
