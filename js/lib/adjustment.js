// Корректировочные реестры: чистые функции для страницы журнала. Покрыто тестами.

// Сводка по не снятым реестрам: сколько условных платежей ещё лежит во внешней системе и на какую сумму.
export function pendingSummary(items) {
  const pending = (items || []).filter((r) => !r.resolved_at && !r.deleted_at);
  const kopecks = pending.reduce((sum, r) => sum + Math.round(r.amount * 100), 0);
  return { count: pending.length, total: kopecks / 100 };
}

// Подпись статуса реестра в журнале.
export const resolvedText = (r) => (r.resolved_at ? 'Снято' : 'Висит');
