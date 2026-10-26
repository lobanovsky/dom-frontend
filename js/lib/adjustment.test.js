import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingSummary, resolvedText } from './adjustment.js';

test('pendingSummary: считает только не снятые и не удалённые, без ошибок округления', () => {
  const items = [
    { amount: 0.1, resolved_at: null },
    { amount: 0.2, resolved_at: null },
    { amount: 500, resolved_at: '2026-10-01T10:00:00Z' },
    { amount: 700, resolved_at: null, deleted_at: '2026-10-02T10:00:00Z' },
  ];
  assert.deepEqual(pendingSummary(items), { count: 2, total: 0.3 });
  assert.deepEqual(pendingSummary([]), { count: 0, total: 0 });
  assert.deepEqual(pendingSummary(undefined), { count: 0, total: 0 });
});

test('resolvedText', () => {
  assert.equal(resolvedText({ resolved_at: null }), 'Висит');
  assert.equal(resolvedText({ resolved_at: '2026-10-01T10:00:00Z' }), 'Снято');
});
