import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isAuthenticated, setAuthenticated, subscribeSession } from './session.js';

describe('session state', () => {
  test('starts unauthenticated and reflects setAuthenticated', () => {
    setAuthenticated(false);
    assert.equal(isAuthenticated(), false);
    setAuthenticated(true);
    assert.equal(isAuthenticated(), true);
    setAuthenticated(false);
  });

  test('notifies subscribers on change', () => {
    const seen = [];
    const unsubscribe = subscribeSession((value) => seen.push(value));
    setAuthenticated(true);
    setAuthenticated(false);
    unsubscribe();
    setAuthenticated(true);
    setAuthenticated(false);
    assert.deepEqual(seen, [true, false]);
  });
});
