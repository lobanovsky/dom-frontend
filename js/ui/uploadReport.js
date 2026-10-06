import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { describeApiError, describeImportRowError } from '../lib/apiErrors.js';
import { statusInfo } from '../lib/registryImport.js';

// Общее окно отчёта о пакетной загрузке файлов (реестры, выписки): индикатор, сводка, карточки файлов с замечаниями,
// кнопка «Показать все файлы». Различаются только запрос, тексты и карточка файла.

export const MAX_SHOWN = 50;

const TONE_CLASS = { success: 'badge badge-success', error: 'badge badge-danger', neutral: 'badge badge-neutral' };

export function shortList(items, render) {
  const rows = items.slice(0, MAX_SHOWN).map((item) => el('li', {}, render(item)));
  if (items.length > MAX_SHOWN) rows.push(el('li', {}, `…и ещё ${items.length - MAX_SHOWN}`));
  return el('ul', { class: 'import-errors' }, rows);
}

// Подробности файла с ошибкой: перевод сообщения бэкенда и строки с ошибками.
export function errorDetails(f) {
  return [
    el('div', {}, describeApiError(new Error(f.error)).message),
    f.rows?.length ? shortList(f.rows, (r) => `Строка ${r.row}: ${describeImportRowError(r.error)}`) : null,
  ];
}

// Карточка файла: имя, бейдж статуса и подробности (details — массив узлов, null пропускается).
export function fileCard(f, details) {
  const info = statusInfo(f.status);
  return el('div', { class: 'import-file' }, [
    el('div', { class: 'import-file-head' }, [el('span', { class: 'import-file-name' }, f.file_name), el('span', { class: TONE_CLASS[info.tone] }, info.label)]),
    ...details.filter(Boolean),
  ]);
}

// Загружает файлы одним запросом и показывает отчёт.
// upload(files) -> Promise<{files, summary}>; problems(files) -> файлы с замечаниями; card(file) -> узел;
// summaryText/summaryTone(summary); onImported(summary) вызывается, если хоть что-то загружено.
export function startFilesUpload({ title, files, upload, summaryText, summaryTone, problems, card, onImported }) {
  const body = el('div', {}, el('div', { class: 'table-status' }, `Загрузка файлов: ${files.length}…`));
  const modal = openModal({ title, content: body, wide: true });

  upload(files).then(({ files: results, summary }) => {
    const tone = summaryTone(summary);
    const shown = problems(results);
    const clean = results.length - shown.length;

    // Файлы без замечаний скрыты: в архиве их могут быть тысячи, и проблемные тонут. Кнопка показывает все.
    const allFiles = el('div', {});
    allFiles.hidden = true;
    const problemsBlock = el('div', {}, shown.map(card));
    const toggleAll = el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm',
      onclick: () => {
        if (!allFiles.childElementCount) allFiles.replaceChildren(...results.map(card));
        allFiles.hidden = !allFiles.hidden;
        problemsBlock.hidden = !allFiles.hidden;
        toggleAll.textContent = allFiles.hidden ? `Показать все файлы (${results.length})` : 'Показать только проблемные';
      },
    }, `Показать все файлы (${results.length})`);

    body.replaceChildren(...[
      el('div', { class: tone === 'success' ? 'form-success' : 'form-error', role: 'status' }, summaryText(summary)),
      shown.length
        ? el('p', {}, `Файлов с замечаниями: ${shown.length}. Без замечаний: ${clean}.`)
        : el('p', {}, 'Замечаний нет: все файлы загружены без предупреждений.'),
      problemsBlock,
      results.length > shown.length ? toggleAll : null,
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
