// Лёгкая клиентская валидация — только чтобы не отправлять заведомо пустые
// формы. Сервер остаётся источником истины и проверяет всё заново.

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

  return null;
}
