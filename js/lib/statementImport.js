// Отчёт о загрузке банковских выписок: сводка и выбор файлов с замечаниями. Без DOM, покрыто тестами.

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const files = (n) => `${n} ${plural(n, 'файл', 'файла', 'файлов')}`;
const operations = (n) => `${n} ${plural(n, 'операция', 'операции', 'операций')}`;

export function summaryText(summary) {
  const parts = [];
  if (summary.files_imported) {
    parts.push(`Загружено: ${files(summary.files_imported)}. Поступлений: ${summary.incoming_created}, списаний: ${summary.outgoing_created}.`);
  } else {
    parts.push('Ни одна выписка не загружена.');
  }
  if (summary.operations_skipped) parts.push(`Пропущено операций, которые уже были загружены раньше: ${summary.operations_skipped}.`);
  if (summary.files_failed) parts.push(`Не загружено файлов: ${summary.files_failed}.`);
  if (summary.files_ignored) parts.push(`Пропущено файлов, не похожих на выписки: ${summary.files_ignored}.`);
  return parts.join(' ');
}

export function summaryTone(summary) {
  if (summary.files_failed || !summary.files_imported) return summary.files_imported ? 'warning' : 'error';
  return 'success';
}

// Файл с замечанием: не загружен. Загруженная выписка с пропущенными операциями — норма (пересекающиеся периоды),
// поэтому замечанием не считается.
export function isProblem(file) {
  return file.status !== 'imported';
}

const SEVERITY = { error: 0, invalid: 0, unknown_account: 0, duplicate_file: 1, all_duplicates: 1 };

export function problemFiles(files) {
  return files
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => isProblem(f))
    .sort((a, b) => (SEVERITY[a.f.status] ?? 1) - (SEVERITY[b.f.status] ?? 1) || a.i - b.i)
    .map(({ f }) => f);
}

export { operations };
