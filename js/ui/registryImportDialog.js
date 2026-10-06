import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { paymentRegistriesApi } from '../api/resources.js';
import { describeApiError, describeImportRowError } from '../lib/apiErrors.js';
import { statusInfo, summaryText, summaryTone, problemFiles } from '../lib/registryImport.js';
import { formatDate, formatMoney } from '../lib/format.js';

const MAX_SHOWN = 50;

const TONE_CLASS = { success: 'badge badge-success', error: 'badge badge-danger', neutral: 'badge badge-neutral' };

function shortList(items, render) {
  const rows = items.slice(0, MAX_SHOWN).map((item) => el('li', {}, render(item)));
  if (items.length > MAX_SHOWN) rows.push(el('li', {}, `…и ещё ${items.length - MAX_SHOWN}`));
  return el('ul', { class: 'import-errors' }, rows);
}

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
      return [
        el('div', {}, describeApiError(new Error(f.error)).message),
        f.rows?.length ? shortList(f.rows, (r) => `Строка ${r.row}: ${describeImportRowError(r.error)}`) : null,
      ];
  }
}

function fileCard(f) {
  const info = statusInfo(f.status);
  return el('div', { class: 'import-file' }, [
    el('div', { class: 'import-file-head' }, [el('span', { class: 'import-file-name' }, f.file_name), el('span', { class: TONE_CLASS[info.tone] }, info.label)]),
    ...fileDetails(f).filter(Boolean),
  ]);
}

// Загружает выбранные файлы (реестры .txt и/или zip-архивы) одним запросом и показывает отчёт по каждому файлу.
// Счёт для каждого файла бэкенд определяет по номеру в его имени. onImported вызывается, если хоть что-то загружено.
export function startRegistryUpload(files, { onImported } = {}) {
  const body = el('div', {}, el('div', { class: 'table-status' }, `Загрузка файлов: ${files.length}…`));
  const modal = openModal({ title: 'Загрузка реестров', content: body, wide: true });

  paymentRegistriesApi.importFiles(files).then(({ files: results, summary }) => {
    const tone = summaryTone(summary);
    const problems = problemFiles(results);
    const clean = results.length - problems.length;

    // Файлы без замечаний скрыты: в архиве их могут быть тысячи, и проблемные тонут. Кнопка показывает все.
    const allFiles = el('div', {});
    allFiles.hidden = true;
    const toggleAll = el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm',
      onclick: () => {
        if (!allFiles.childElementCount) allFiles.replaceChildren(...results.map(fileCard));
        allFiles.hidden = !allFiles.hidden;
        problemsBlock.hidden = !allFiles.hidden;
        toggleAll.textContent = allFiles.hidden ? `Показать все файлы (${results.length})` : 'Показать только проблемные';
      },
    }, `Показать все файлы (${results.length})`);
    const problemsBlock = el('div', {}, problems.map(fileCard));

    body.replaceChildren(...[
      el('div', { class: tone === 'success' ? 'form-success' : 'form-error', role: 'status' }, summaryText(summary)),
      problems.length
        ? el('p', {}, `Файлов с замечаниями: ${problems.length}. Без замечаний: ${clean}.`)
        : el('p', {}, 'Замечаний нет: все файлы загружены без предупреждений.'),
      problemsBlock,
      results.length > problems.length ? toggleAll : null,
      allFiles,
      el('div', { class: 'form-actions' }, el('button', { type: 'button', class: 'btn btn-primary', onclick: () => modal.close() }, 'Закрыть')),
    ].filter(Boolean)); // replaceChildren(null) рисует текст «null»
    if (summary.files_imported) onImported?.(summary);
  }, (err) => {
    if (err.status === 0 || err.status >= 500) {
      modal.close(); // глобальный тост уже показан клиентом
      return;
    }
    body.replaceChildren(
      el('div', { class: 'form-error', role: 'alert' }, err.status === 413 ? 'Слишком большой запрос: загрузите меньше файлов или архив поменьше' : describeApiError(err).message),
      el('div', { class: 'form-actions' }, el('button', { type: 'button', class: 'btn', onclick: () => modal.close() }, 'Закрыть')),
    );
  });
  return modal;
}
