import { el } from '../lib/dom.js';
import { paymentRegistriesApi } from '../api/resources.js';
import { summaryText, summaryTone, problemFiles } from '../lib/registryImport.js';
import { formatDate, formatMoney } from '../lib/format.js';
import { startFilesUpload, fileCard, shortList, errorDetails } from './uploadReport.js';

function skippedBlock(skipped) {
  if (!skipped?.length) return null;
  return el('details', {}, [
    el('summary', {}, `Пропущено платежей, которые уже есть в базе: ${skipped.length}`),
    el('p', { class: 'field-help' }, 'Один и тот же платёж не должен попадать в разные реестры. Если это неожиданно, проверьте, что файлы выгружены за разные периоды.'),
    shortList(skipped, (s) => `${formatDate(s.payment_date)} · ${s.payer_name} · ${formatMoney(s.amount)} · операция ${s.external_id}`),
  ]);
}

// Подробности по файлу в зависимости от статуса.
function fileDetails(f) {
  switch (f.status) {
    case 'imported': {
      const r = f.result;
      return [
        el('div', {}, `Платежей: ${r.created}. Привязано к лицевым счетам: ${r.linked}, без привязки: ${r.unlinked}.`),
        r.warnings?.length ? shortList(r.warnings, (w) => w) : null,
        skippedBlock(r.skipped),
        el('a', { href: `/payment-registries/${r.registry_id}` }, 'Открыть реестр'),
      ];
    }
    case 'duplicate_file':
      return [
        el('div', {}, 'Содержимое файла полностью совпадает с уже загруженным реестром (имя файла не учитывается).'),
        f.duplicate_of ? el('div', {}, ['Совпадает с файлом: ', el('span', { class: 'import-file-name' }, f.duplicate_of)]) : null,
        el('a', { href: `/payment-registries/${f.registry_id}` }, 'Открыть реестр'),
      ];
    case 'all_duplicates':
      return [el('div', {}, 'Все платежи файла уже есть в базе, реестр не создан.'), skippedBlock(f.skipped)];
    case 'unknown_account':
      return [el('div', {}, ['В имени файла есть номер счёта, которого нет в системе. Добавьте счёт на странице ', el('a', { href: '/bank-accounts' }, 'Банковские счета'), ' и загрузите файл ещё раз.'])];
    default:
      return errorDetails(f);
  }
}

// Загружает выбранные файлы (реестры .txt и/или zip-архивы) одним запросом и показывает отчёт по каждому файлу.
// Счёт для каждого файла бэкенд определяет по номеру в его имени. onImported вызывается, если хоть что-то загружено.
export function startRegistryUpload(files, { onImported } = {}) {
  return startFilesUpload({
    title: 'Загрузка реестров',
    files,
    upload: (list) => paymentRegistriesApi.importFiles(list),
    summaryText,
    summaryTone,
    problems: problemFiles,
    card: (f) => fileCard(f, fileDetails(f)),
    onImported,
  });
}
