import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from './router.js';

const fakeContainer = { replaceChildren() {} };

function makeRouter(patterns) {
  const routes = patterns.map((pattern) => ({ pattern, mount: () => {} }));
  return createRouter(routes, fakeContainer);
}

describe('router matching', () => {
  test('matches a static path', () => {
    const router = makeRouter(['/', '/students']);
    const result = router.match('/students');
    assert.equal(result.route.pattern, '/students');
    assert.deepEqual(result.params, {});
  });

  test('extracts named params', () => {
    const router = makeRouter(['/students/:id', '/students/:id/edit']);
    const result = router.match('/students/abc-123/edit');
    assert.equal(result.route.pattern, '/students/:id/edit');
    assert.deepEqual(result.params, { id: 'abc-123' });
  });

  test('decodes URL-encoded params', () => {
    const router = makeRouter(['/students/:id']);
    const result = router.match('/students/a%20b');
    assert.deepEqual(result.params, { id: 'a b' });
  });

  test('returns null for unmatched path', () => {
    const router = makeRouter(['/students']);
    assert.equal(router.match('/nope'), null);
  });

  test('prefers the first matching route in declaration order', () => {
    const router = makeRouter(['/students/new', '/students/:id']);
    const result = router.match('/students/new');
    assert.equal(result.route.pattern, '/students/new');
  });

  test('matches root path exactly', () => {
    const router = makeRouter(['/', '/students']);
    assert.equal(router.match('/students/extra'), null);
  });
});
