// Число строк на странице списков: выбирает пользователь, выбор запоминается в браузере. Без DOM, покрыто тестами.

export const PAGE_SIZES = [10, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

const STORAGE_KEY = 'dom.page-size';

export const normalizePageSize = (value) => {
  const n = Number(value);
  return PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE;
};

// Хранилище может быть недоступно (приватный режим) — тогда действует значение по умолчанию.
export function loadPageSize(storage = globalThis.localStorage) {
  try {
    return normalizePageSize(storage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function savePageSize(size, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, String(normalizePageSize(size)));
  } catch {
    // не страшно: выбор просто не запомнится
  }
}
