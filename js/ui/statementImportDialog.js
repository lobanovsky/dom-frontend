import { el } from '../lib/dom.js';
import { bankStatementsApi } from '../api/resources.js';
import { summaryText, summaryTone, problemFiles } from '../lib/statementImport.js';
import { formatDate, formatMoney } from '../lib/format.js';
import { startFilesUpload, fileCard, shortList, errorDetails } from './uploadReport.js';

function skippedBlock(skipped, text) {
  if (!skipped?.length) return null;
  return el('details', {}, [
    el('summary', {}, text(skipped.length)),
    shortList(skipped, (s) => `${formatDate(s.payment_date)} · ${s.outgoing ? 'списание' : 'поступление'} · ${s.counterpart || '—'} · ${formatMoney(s.amount)}${s.doc_number ? ` · док. ${s.doc_number}` : ''}`),
  ]);
}

function fileDetails(f) {
  switch (f.status) {
    case 'imported': {
      const r = f.result;
      return [
        el('div', {}, `Поступлений: ${r.incoming}, списаний: ${r.outgoing}.`),
        skippedBlock(r.skipped, (n) => `Пропущено операций, которые уже были в другой выписке: ${n} (пересекающиеся периоды — это нормально)`),
        el('a', { href: `/bank-statements/${r.statement_id}` }, 'Открыть выписку'),
      ];
    }
    case 'duplicate_file':
      return [
        el('div', {}, 'Содержимое файла полностью совпадает с уже загруженной выпиской (имя файла не учитывается).'),
        f.duplicate_of ? el('div', {}, ['Совпадает с файлом: ', el('span', { class: 'import-file-name' }, f.duplicate_of)]) : null,
        el('a', { href: `/bank-statements/${f.statement_id}` }, 'Открыть выписку'),
      ];
    case 'all_duplicates':
      return [el('div', {}, 'Все операции файла уже есть в базе из других выписок, выписка не создана.'), skippedBlock(f.skipped, (n) => `Операций: ${n}`)];
    case 'unknown_account':
      return [el('div', {}, ['Счёта из шапки выписки нет в системе. Добавьте его на странице ', el('a', { href: '/bank-accounts' }, 'Банковские счета'), ' и загрузите файл ещё раз.'])];
    default:
      return errorDetails(f);
  }
}

// Загружает выписки (.xlsx и/или zip-архивы) одним запросом; счёт бэкенд берёт из шапки каждой выписки.
export function startStatementUpload(files, { onImported } = {}) {
  return startFilesUpload({
    title: 'Загрузка выписок',
    files,
    upload: (list) => bankStatementsApi.importFiles(list),
    summaryText,
    summaryTone,
    problems: problemFiles,
    card: (f) => fileCard(f, fileDetails(f)),
    onImported,
  });
}
