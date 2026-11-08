import test from 'node:test';
import assert from 'node:assert/strict';
import { residentAccessStatus, attachResidentAccess } from './residentAccess.js';

const allowed = { configured: true, enabled: true, eligible: true, registered: false, account_active: false };
test('статус различает неизвестные сведения, разрешение, регистрацию и вход', () => {
  assert.equal(residentAccessStatus(null).title, 'Не загружен');
  assert.equal(residentAccessStatus({ configured: false }).title, 'Не выдан');
  assert.equal(residentAccessStatus(allowed).title, 'Разрешён');
  assert.equal(residentAccessStatus({ ...allowed, registered: true, account_active: true }).title, 'Зарегистрирован');
  assert.equal(residentAccessStatus({ ...allowed, registered: true, account_active: true, last_login_at: '2026-11-08T12:00:00Z' }).title, 'Входил');
});
test('отключение и утрата собственности важнее факта входа', () => {
  const account = { ...allowed, registered: true, account_active: true, last_login_at: '2026-11-08T12:00:00Z' };
  assert.equal(residentAccessStatus({ ...account, enabled: false }).title, 'Отключён');
  assert.equal(residentAccessStatus({ ...account, account_active: false }).title, 'Отключён');
  assert.equal(residentAccessStatus({ ...account, eligible: false }).title, 'Вход недоступен');
});
test('статусы запрашиваются одним пакетом и сопоставляются по id', async () => {
  const items = [{ id: 1 }, { id: 2 }]; let calls = 0;
  const result = await attachResidentAccess(items, async (ids) => { calls++; assert.deepEqual(ids, [1, 2]); return [{ person_id: 2, ...allowed }, { person_id: 1, configured: false }]; });
  assert.equal(calls, 1);
  assert.equal(result[0].resident_access.configured, false);
  assert.equal(result[1].resident_access.enabled, true);
  assert.equal(items[0].resident_access, undefined);
});
test('сбой загрузки не выдаёт неизвестный статус за отсутствие доступа', async () => {
  const result = await attachResidentAccess([{ id: 1 }], async () => { throw new Error('offline'); });
  assert.equal(residentAccessStatus(result[0].resident_access).title, 'Не загружен');
  assert.deepEqual(await attachResidentAccess([], () => { throw new Error('unexpected request'); }), []);
});
