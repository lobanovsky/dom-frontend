import { config } from '../config.js';

// Единственное место, которое знает про fetch, cookie-сессию dom_session
// и конверт ошибок бэкенда {"error": "строка"}. Перевод сообщений на русский
// и разбор «поле: причина» — в lib/apiErrors.js.

export class ApiError extends Error {
  // rows — построчные ошибки импорта [{row, error}], если бэкенд их вернул.
  constructor({ status, message, rows = null }) {
    super(message || 'Ошибка запроса');
    this.name = 'ApiError';
    this.status = status;
    this.rows = rows;
  }
}

let unauthenticatedHandler = null;
export function onUnauthenticated(handler) {
  unauthenticatedHandler = handler;
}

let globalErrorHandler = null;
export function onGlobalError(handler) {
  globalErrorHandler = handler;
}


export function buildQueryString(params) {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

async function toApiError(response) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    // тело не JSON или пустое
  }
  return new ApiError({
    status: response.status,
    message: (data && data.error) || response.statusText,
    rows: data && Array.isArray(data.rows) ? data.rows : null,
  });
}

function isGlobalError(error) {
  return error.status === 0 || error.status >= 500;
}

export async function request(method, path, { query, body, signal } = {}) {
  const url = `${config.apiBase}${path}${buildQueryString(query)}`;
  const headers = {};
  let payload;

  if (body instanceof FormData) {
    // Content-Type с boundary выставит браузер.
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, { method, headers, body: payload, credentials: 'include', signal });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    const networkError = new ApiError({ status: 0, message: 'Не удалось связаться с сервером' });
    if (globalErrorHandler) globalErrorHandler(networkError);
    throw networkError;
  }

  if (response.ok) {
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  const error = await toApiError(response);
  if (error.status === 401) {
    if (unauthenticatedHandler) unauthenticatedHandler();
  } else if (isGlobalError(error)) {
    if (globalErrorHandler) globalErrorHandler(error);
  }
  throw error;
}

export const client = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};
