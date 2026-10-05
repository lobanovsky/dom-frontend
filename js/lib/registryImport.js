// Отчёт о пакетной загрузке реестров: подписи статусов и сводка. Без DOM, покрыто тестами.

export const FILE_STATUSES = {
  imported: { label: 'Загружен', tone: 'success' },
  duplicate_file: { label: 'Уже загружен', tone: 'neutral' },
  all_duplicates: { label: 'Все платежи уже были', tone: 'neutral' },
  unknown_account: { label: 'Счёт не найден в системе', tone: 'error' },
  invalid: { label: 'Ошибка в файле', tone: 'error' },
  error: { label: 'Ошибка', tone: 'error' },
};

export function statusInfo(status) {
  return FILE_STATUSES[status] || { label: status, tone: 'neutral' };
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const files = (n) => `${n} ${plural(n, 'файл', 'файла', 'файлов')}`;
const payments = (n) => `${n} ${plural(n, 'платёж', 'платежа', 'платежей')}`;

// Итоговая строка для окна результата.
export function summaryText(summary) {
  const parts = [];
  if (summary.files_imported) {
    parts.push(`Загружено: ${files(summary.files_imported)}, ${payments(summary.payments_created)}. `
      + `Привязано к лицевым счетам: ${summary.linked}, без привязки: ${summary.unlinked}.`);
  } else {
    parts.push('Ни один файл не загружен.');
  }
  if (summary.payments_skipped) parts.push(`Пропущено уже загруженных платежей: ${summary.payments_skipped}.`);
  if (summary.files_failed) parts.push(`Не загружено файлов: ${summary.files_failed}.`);
  if (summary.files_ignored) parts.push(`Пропущено файлов, не похожих на реестры: ${summary.files_ignored}.`);
  return parts.join(' ');
}

// Тон итогового сообщения: ошибка, если ничего не загружено или есть неудачные файлы.
export function summaryTone(summary) {
  if (summary.files_failed || !summary.files_imported) return summary.files_imported ? 'warning' : 'error';
  return 'success';
}
