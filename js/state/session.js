// Учётка администратора одна (задана в окружении бэкенда), поэтому сессия
// здесь — просто флаг «действующая cookie есть или нет».

let authenticated = false;
const listeners = new Set();

export function isAuthenticated() {
  return authenticated;
}

export function setAuthenticated(value) {
  authenticated = value;
  for (const listener of listeners) listener(authenticated);
}

export function subscribeSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
