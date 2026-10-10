import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runState, runPeriod, runSummary, connectionView, certNote, scheduleLabel, periodBody, cleanToken, runErrorText } from './sberApi.js';

test('run state', () => {
  assert.equal(runState({ finished_at: null }), 'running');
  assert.equal(runState({ finished_at: '2026-10-10T10:00:00Z', error: 'x' }), 'error');
  assert.equal(runState({ finished_at: '2026-10-10T10:00:00Z', error: null }), 'ok');
});

test('run period and summary', () => {
  assert.equal(runPeriod({ date_from: '2026-10-09', date_to: '2026-10-09' }), '09.10.2026');
  assert.equal(runPeriod({ date_from: '2026-10-07', date_to: '2026-10-09' }), '07.10.2026 — 09.10.2026');
  assert.equal(runSummary({ finished_at: null }), '');
  assert.equal(runSummary({ finished_at: 'x', incoming: 3, outgoing: 1, skipped: 12 }), 'входящих 3, исходящих 1, уже было 12');
});

test('connection view guides the next step', () => {
  assert.equal(connectionView({ configured: false }).title, 'Не настроено');
  assert.equal(connectionView({ configured: true, tokens_set: false }).kind, 'warning');
  assert.equal(connectionView({ configured: true, tokens_set: true }).title, 'Подключено');
});

test('certificate note warns 30 days ahead', () => {
  const now = new Date('2026-10-10T00:00:00Z');
  assert.match(certNote('2027-10-01T00:00:00Z', now), /действует до 01.10.2027/);
  assert.match(certNote('2026-10-20T00:00:00Z', now), /истекает 20.10.2026/);
  assert.match(certNote('2026-10-01T00:00:00Z', now), /истёк 01.10.2026/);
  assert.equal(certNote(null, now), '');
});

test('schedule label', () => {
  assert.match(scheduleLabel(''), /выключен/);
  assert.equal(scheduleLabel('1h0m0s'), 'Банк опрашивается каждый час.');
  assert.equal(scheduleLabel('2h0m0s'), 'Банк опрашивается каждые 2 ч.');
  assert.equal(scheduleLabel('30m0s'), 'Банк опрашивается каждые 30 мин.');
});

test('period body', () => {
  assert.deepEqual(periodBody('', ''), { body: {} });
  assert.deepEqual(periodBody('2026-10-01', '2026-10-09'), { body: { date_from: '2026-10-01', date_to: '2026-10-09' } });
  assert.match(periodBody('2026-10-10', '2026-10-09').error, /позже/);
});

test('token is cleaned from pasted text', () => {
  assert.equal(cleanToken('  abc123 \n'), 'abc123');
  assert.equal(cleanToken('"abc123"'), 'abc123');
  assert.equal(cleanToken('refresh_token: abc123'), 'abc123');
  assert.equal(cleanToken(null), '');
});

test('run errors are translated', () => {
  assert.equal(runErrorText(''), '');
  assert.match(runErrorText('4070: 2026-10-08: sber api: status 400: token refresh failed: invalid_grant'), /новый refresh_token/);
  assert.equal(runErrorText('4070: 2026-10-08: sber api: status 403: FORBIDDEN: no access'), '4070: 2026-10-08: sber api: нет доступа к счёту в банке (403)');
  assert.equal(runErrorText('interrupted: server restarted'), 'Прервано перезапуском сервера');
  assert.equal(runErrorText('something else'), 'something else');
});
