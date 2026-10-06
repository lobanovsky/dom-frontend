import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeConditions, changeField, describeCondition, describeConditions, describeAction, normalizeAction, previewSummary, hasChanges, opsFor, scopeFromQuery, originLabel,
} from './rules.js';

test('conditions are normalised for the API', () => {
  assert.deepEqual(
    normalizeConditions([
      { field: 'purpose', op: 'contains', values: [' кв. 1 ', '', 'кв 1'], ignore_spaces: true },
      { field: 'payer_name', op: 'contains', values: ['', ' '] },
      { field: 'amount', op: 'gt', values: ['100'], ignore_spaces: true },
      { field: 'purpose', op: 'regex', values: ['\\d+'], ignore_spaces: true },
    ]),
    [
      { field: 'purpose', op: 'contains', values: ['кв. 1', 'кв 1'], ignore_spaces: true },
      { field: 'amount', op: 'gt', values: ['100'] },
      { field: 'purpose', op: 'regex', values: ['\\d+'] },
    ],
  );
  assert.deepEqual(normalizeConditions(null), []);
});

test('changing the field keeps compatible operation, resets incompatible values', () => {
  const c = { field: 'purpose', op: 'regex', values: ['abc'] };
  assert.deepEqual(changeField(c, 'payer_name'), { field: 'payer_name', op: 'regex', values: ['abc'] });
  assert.deepEqual(changeField(c, 'amount'), { field: 'amount', op: 'equals', values: [''] });
  assert.deepEqual(changeField({ field: 'amount', op: 'gt', values: ['5'] }, 'purpose'), { field: 'purpose', op: 'contains', values: [''] });
  assert.deepEqual(Object.keys(opsFor('bank_account_id')), ['equals']);
});

test('descriptions are readable', () => {
  assert.equal(describeCondition({ field: 'payer_name', op: 'contains', values: ['Иванов', 'Петров'] }), 'ФИО или название плательщика содержит «Иванов» или «Петров»');
  assert.equal(describeCondition({ field: 'amount', op: 'between', values: ['10', '20'] }), 'Сумма между 10 и 20');
  assert.equal(describeCondition({ field: 'purpose', op: 'contains', values: ['ЛС 1'], ignore_spaces: true }), 'Назначение платежа содержит «ЛС 1» (без пробелов)');
  assert.equal(describeCondition({ field: 'bank_account_id', op: 'equals', values: ['3'] }, { bankName: (id) => `счёт ${id}` }), 'Банковский счёт (получатель) — счёт 3');
  assert.equal(describeConditions({ conditions: [] }), 'Любой платёж');
  assert.equal(
    describeConditions({ match_mode: 'any', conditions: [{ field: 'payer_inn', op: 'equals', values: ['1'] }, { field: 'amount', op: 'lt', values: ['5'] }] }),
    'ИНН плательщика равно «1» ИЛИ Сумма меньше 5',
  );
  assert.equal(describeAction({ type: 'set_category', category_id: 2 }, { categoryName: () => 'Аренда' }), 'Категория: Аренда');
  assert.equal(describeAction({ type: 'link_by_owner' }), 'Найти по ФИО (собственник/плательщик счёта)');
});

test('action is cleaned to the fields of its type', () => {
  assert.deepEqual(normalizeAction({ type: 'link_premises', premises_id: 4, category_id: 9, pattern: 'x' }), { type: 'link_premises', premises_id: 4 });
  assert.deepEqual(
    normalizeAction({ type: 'premises_from_text', pattern: ' м/м\\s*(\\d+) ', premises_kind: 'parking_space', ignore_spaces: true, premises_id: 1 }),
    { type: 'premises_from_text', field: 'purpose', pattern: 'м/м\\s*(\\d+)', ignore_spaces: true, premises_kind: 'parking_space' },
  );
  assert.deepEqual(normalizeAction({ type: 'link_by_owner', pattern: 'x' }), { type: 'link_by_owner' });
});

test('preview summary', () => {
  const p = { candidates: 10, new: 6, changed: 0, same: 1, cleared: 1, unresolved: 2 };
  assert.equal(previewSummary(p), 'Проверено платежей: 10. Получат привязку: 6. Привязка снимется: 1. Без изменений: 1. Останутся без привязки: 2.');
  assert.equal(hasChanges(p), true);
  assert.equal(hasChanges({ new: 0, changed: 0, cleared: 0 }), false);
});

test('scope is built from the list filters', () => {
  assert.deepEqual(
    scopeFromQuery({ bank_account_id: '3', date_from: '2026-01-01', date_to: '', q: ' иванов ', unlinked: 'true', registry_id: 7, amount_from: '10.5', category_id: undefined }),
    { bank_account_id: 3, registry_id: 7, amount_from: 10.5, date_from: '2026-01-01', q: 'иванов' },
  );
  assert.deepEqual(scopeFromQuery(), {});
});

test('origin label', () => {
  assert.equal(originLabel({ assigned_by: 'rule', rule_name: 'Аренда' }), 'по правилу «Аренда»');
  assert.equal(originLabel({ assigned_by: 'registry' }), 'из реестра');
  assert.equal(originLabel({ assigned_by: 'manual' }), 'вручную');
  assert.equal(originLabel({ assigned_by: null }), '');
});
