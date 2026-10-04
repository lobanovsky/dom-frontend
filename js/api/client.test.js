import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { client, ApiError, buildQueryString, onUnauthenticated, onGlobalError } from './client.js';

const originalFetch = globalThis.fetch;

function mockFetch(impl) {
  globalThis.fetch = impl;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  onUnauthenticated(null);
  onGlobalError(null);
});

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status text',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('buildQueryString', () => {
  test('omits undefined/null/empty values', () => {
    assert.equal(buildQueryString({ a: 1, b: undefined, c: null, d: '' }), '?a=1');
  });

  test('returns empty string when nothing to build', () => {
    assert.equal(buildQueryString(), '');
    assert.equal(buildQueryString({}), '');
  });
});

describe('client requests', () => {
  test('resolves parsed JSON on success', async () => {
    mockFetch(async () => jsonResponse(200, { ok: true }));
    const result = await client.get('/api/v1/organizations');
    assert.deepEqual(result, { ok: true });
  });

  test('parses the backend\'s flat {"error": "..."} envelope into ApiError.message', async () => {
    mockFetch(async () => jsonResponse(400, { error: 'birth_date must be in YYYY-MM-DD format' }));
    await assert.rejects(
      () => client.post('/api/v1/persons', {}),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 400);
        assert.equal(err.message, 'birth_date must be in YYYY-MM-DD format');
        return true;
      },
    );
  });

  test('401 triggers onUnauthenticated and not onGlobalError', async () => {
    mockFetch(async () => jsonResponse(401, { error: 'unauthorized' }));
    let unauthCalls = 0;
    let globalCalls = 0;
    onUnauthenticated(() => unauthCalls++);
    onGlobalError(() => globalCalls++);

    await assert.rejects(() => client.get('/api/v1/organizations'));
    assert.equal(unauthCalls, 1);
    assert.equal(globalCalls, 0);
  });

  test('500 triggers onGlobalError', async () => {
    mockFetch(async () => jsonResponse(500, { error: 'internal error' }));
    let globalCalls = 0;
    onGlobalError(() => globalCalls++);

    await assert.rejects(() => client.get('/api/v1/organizations'));
    assert.equal(globalCalls, 1);
  });

  test('400/404 do not trigger onGlobalError (page handles them)', async () => {
    mockFetch(async () => jsonResponse(404, { error: 'not found' }));
    let globalCalls = 0;
    onGlobalError(() => globalCalls++);

    await assert.rejects(() => client.get('/api/v1/persons/999'));
    assert.equal(globalCalls, 0);
  });

  test('network failure produces status 0 and triggers onGlobalError', async () => {
    mockFetch(async () => {
      throw new Error('fetch failed');
    });
    let globalError = null;
    onGlobalError((err) => {
      globalError = err;
    });

    await assert.rejects(() => client.get('/api/v1/organizations'));
    assert.equal(globalError.status, 0);
  });

  test('put sends JSON body with method PUT', async () => {
    let seen = null;
    mockFetch(async (url, init) => {
      seen = { url, init };
      return jsonResponse(200, { id: 1 });
    });
    await client.put('/api/v1/organizations/1', { name: 'ТСН' });
    assert.equal(seen.url, '/api/v1/organizations/1');
    assert.equal(seen.init.method, 'PUT');
    assert.equal(seen.init.headers['Content-Type'], 'application/json');
    assert.equal(seen.init.body, '{"name":"ТСН"}');
    assert.equal(seen.init.credentials, 'include');
  });

  test('delete resolves null on 204', async () => {
    mockFetch(async () => ({ ok: true, status: 204, statusText: 'No Content', text: async () => '' }));
    assert.equal(await client.delete('/api/v1/organizations/1'), null);
  });

  test('query params are appended, empty values skipped', async () => {
    let seenUrl = null;
    mockFetch(async (url) => {
      seenUrl = url;
      return jsonResponse(200, { items: [] });
    });
    await client.get('/api/v1/persons', { query: { q: 'Ив', phone: '', limit: 50 } });
    assert.equal(seenUrl, '/api/v1/persons?q=%D0%98%D0%B2&limit=50');
  });
});
