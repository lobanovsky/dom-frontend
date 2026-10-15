import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailStatus, detailHint, runSummary, scheduleLabel, connectionView } from './mailSync.js';

test('detailStatus knows no_account and registry statuses', () => {
  assert.equal(detailStatus('no_account').tone, 'error');
  assert.equal(detailStatus('imported').label, 'Загружен');
  assert.equal(detailStatus('duplicate_file').tone, 'neutral');
});

test('detailHint only for account problems', () => {
  assert.match(detailHint('no_account'), /код реестра/);
  assert.match(detailHint('unknown_account'), /банковский счёт/);
  assert.equal(detailHint('imported'), '');
});

test('runSummary', () => {
  assert.equal(runSummary({ messages: 0 }), '');
  assert.equal(
    runSummary({ finished_at: 'x', messages: 2, imported: 1, payments: 12, duplicates: 1, failed: 0 }),
    'письма 2, загружено реестров 1 (платежей 12), уже было 1, не загрузилось 0',
  );
  assert.match(runSummary({ finished_at: 'x', messages: 1, imported: 1, payments: 1, duplicates: 0, failed: 0 }), /^письмо 1, .*платёж 1/);
});

test('scheduleLabel', () => {
  assert.match(scheduleLabel(''), /только по кнопке/);
  assert.match(scheduleLabel('1h0m0s'), /раз в час/);
  assert.match(scheduleLabel('3h0m0s'), /раз в 3 часа/);
  assert.match(scheduleLabel('30m0s'), /раз в 30 минут/);
  assert.match(scheduleLabel('1h30m0s'), /раз в 1 ч 30 мин/);
});

test('connectionView', () => {
  assert.equal(connectionView({ configured: false }).kind, 'neutral');
  assert.equal(connectionView({ configured: true }).title, 'Подключено');
});
