// Лёгкая клиентская валидация — только чтобы не отправлять заведомо пустые
// формы. Сервер остаётся источником истины и проверяет всё заново.

import { normalizeDecimal } from './decimal.js';

export function isRequired(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

export function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateFieldDef(def, value) {
  if (def.required && def.type !== 'checkbox' && !isRequired(value)) {
    return 'Обязательное поле';
  }
  if (!isRequired(value)) return null;

  if (def.type === 'date' && !isValidDate(value)) {
    return 'Некорректная дата';
  }

  if (def.decimalInput) {
    const normalized = normalizeDecimal(value);
    if (normalized === null) return 'Введите число';
    const fraction = normalized.split('.')[1] || '';
    const maxDecimals = def.maxDecimals ?? 3;
    if (fraction.length > maxDecimals) return `Не больше ${maxDecimals} знаков после запятой`;
    if (def.min !== undefined && Number(normalized) < Number(def.min)) return `Значение не может быть меньше ${def.min}`;
  }

  return null;
}
