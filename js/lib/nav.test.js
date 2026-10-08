import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV, isActive, groupIsActive, loadOpenGroups, saveOpenGroups } from './nav.js';

const finance = NAV.find((n) => n.group === 'Финансы');

test('finance group holds the requested items', () => {
  assert.deepEqual(
    finance.items.map((i) => i.label),
    ['Входящие', 'Исходящие', 'Реестры', 'Выписки', 'Правила'],
  );
});

test('every route appears in the menu exactly once', () => {
  const hrefs = NAV.flatMap((n) => (n.group ? n.items : [n])).map((n) => n.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const href of ['/payments/incoming', '/payments/outgoing', '/payment-registries', '/bank-statements', '/payment-rules', '/bank-accounts', '/payment-categories', '/organizations', '/buildings', '/persons', '/legal-entities']) {
    assert.ok(hrefs.includes(href), href);
  }
});

test('active item and group by path', () => {
  assert.equal(isActive('/', '/'), true);
  assert.equal(isActive('/', '/persons'), false);
  assert.equal(isActive('/payment-registries', '/payment-registries/7'), true);
  assert.equal(isActive('/payment-registries', '/payment-rules'), false);
  assert.equal(isActive('/buildings', '/premises/5'), true);
  assert.equal(groupIsActive(finance, '/bank-statements/3'), true);
  assert.equal(groupIsActive(finance, '/bank-accounts'), false);
});

test('open groups are persisted and survive broken storage', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual([...loadOpenGroups(storage)], []);
  saveOpenGroups(new Set(['Финансы']), storage);
  assert.deepEqual([...loadOpenGroups(storage)], ['Финансы']);
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual([...loadOpenGroups(broken)], []);
  assert.doesNotThrow(() => saveOpenGroups(new Set(['x']), broken));
  assert.deepEqual([...loadOpenGroups({ getItem: () => 'not json' })], []);
});
