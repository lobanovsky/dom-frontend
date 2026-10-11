import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnover, accountsText } from './counterparties.js';

test('turnover is empty without payments', () => {
  assert.equal(turnover(0, 0), '');
  assert.match(turnover(1, 10), /^1 платёж · /);
  assert.match(turnover(2, 150.5), /^2 платежа · .*150,50/);
  assert.match(turnover(5, 1), /^5 платежей · /);
});

test('accountsText shows the first account and how many more', () => {
  assert.equal(accountsText(undefined), '');
  assert.equal(accountsText([]), '');
  assert.equal(accountsText(['111']), '111');
  assert.equal(accountsText(['111', '222', '333']), '111 (+2)');
});
