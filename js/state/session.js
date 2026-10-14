// Сессия: действующая cookie есть или нет, и кто вошёл ({username, role}).
// Роль приходит из GET /auth/me; права на самом деле проверяет сервер, здесь они нужны,
// чтобы не показывать кнопки, которые всё равно закончатся ответом 403.

let authenticated = false;
let user = null;
const listeners = new Set();

export function isAuthenticated() {
  return authenticated;
}

export function setAuthenticated(value) {
  authenticated = value;
  if (!value) user = null;
  for (const listener of listeners) listener(authenticated);
}

export function getUser() {
  return user;
}

export function setUser(value) {
  user = value;
}

export function subscribeSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
