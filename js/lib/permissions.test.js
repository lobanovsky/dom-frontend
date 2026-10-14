import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canWrite, isAdmin, roleCanWrite, roleLabel } from './permissions.js';
import { setAuthenticated, setUser } from '../state/session.js';

test('only admin may write', () => {
  assert.equal(roleCanWrite('admin'), true);
  assert.equal(roleCanWrite('viewer'), false);
  assert.equal(roleCanWrite(undefined), false);
});

test('permissions follow the current user and default to read-only', () => {
  setAuthenticated(false);
  assert.equal(canWrite(), false);
  setUser({ username: 'a', role: 'admin' });
  assert.equal(canWrite(), true);
  assert.equal(isAdmin(), true);
  setUser({ username: 'b', role: 'viewer' });
  assert.equal(canWrite(), false);
  assert.equal(isAdmin(), false);
  setAuthenticated(false); // выход забывает пользователя
  assert.equal(canWrite(), false);
});

test('role labels', () => {
  assert.equal(roleLabel('viewer'), 'Просмотр');
  assert.equal(roleLabel('x'), 'x');
});
