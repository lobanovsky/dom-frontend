import { meterReadingsApi } from '../api/resources.js';
import { buildingLabel } from '../lib/buildings.js';
import { describeApiError, describeImportRowError } from '../lib/apiErrors.js';
import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

const dateTime = (value) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

export async function openMeterImportHistoryDialog(buildings = []) {
  const content = el('div', { class: 'import-history' }, el('p', { class: 'table-status' }, 'Загрузка истории…'));
  const modal = openModal({ title: 'История загрузки показаний', content, wide: true });
  const buildingById = new Map(buildings.map((b) => [b.id, buildingLabel(b)]));

  async function refresh() {
    content.replaceChildren(el('p', { class: 'table-status' }, 'Загрузка истории…'));
    try {
      const { items } = await meterReadingsApi.um31ImportHistory();
      if (modal.dialog.isConnected === false) return;
      if (!items.length) {
        content.replaceChildren(el('p', { class: 'table-status' }, 'Загрузок пока нет.'));
        return;
      }
      content.replaceChildren(...items.map((item) => {
        const result = item.result || {};
        const issues = item.issues || [];
        const heading = `${dateTime(item.created_at)} · ${buildingById.get(item.building_id) || 'Дом'} · ${item.period}`;
        const summary = `Загружено показаний: ${result.readings || 0}; расчётных: ${result.estimated_readings || 0}; замечаний: ${issues.length}`;
        const issueList = issues.length
          ? el('ul', { class: 'import-history-issues' }, issues.map((issue) => el('li', {}, [
            issue.row ? `Строка ${issue.row} · ` : '',
            issue.serial ? `${issue.serial}: ` : '',
            issue.kind === 'invalid_row' ? describeImportRowError(issue.message) : issue.message,
          ])))
          : el('p', { class: 'field-help' }, 'Пропусков и предупреждений нет.');
        const undoButton = item.can_undo ? el('button', { type: 'button', class: 'btn btn-danger btn-sm' }, 'Отменить импорт') : null;
        const undoConfirm = item.can_undo ? el('div', { class: 'import-undo-confirm', hidden: true }, [
          el('span', {}, `Удалить ${result.readings} показаний этой загрузки? Отмена необратима. При наличии более поздних показаний система её заблокирует.`),
          el('button', { type: 'button', class: 'btn btn-danger btn-sm', onclick: async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            button.textContent = 'Отменяем…';
            try {
              const undone = await meterReadingsApi.undoUM31Import(item.id);
              toast.success(`Импорт отменён. Удалено показаний: ${undone.removed_readings}.`);
              await refresh();
            } catch (err) {
              toast.error(describeApiError(err).message);
              button.disabled = false;
              button.textContent = 'Да, отменить';
            }
          } }, 'Да, отменить'),
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { undoConfirm.hidden = true; undoButton.hidden = false; } }, 'Нет'),
        ]) : null;
        if (undoButton) undoButton.addEventListener('click', () => { undoButton.hidden = true; undoConfirm.hidden = false; });
        const status = item.undone_at
          ? el('span', { class: 'badge badge-neutral' }, `Отменён ${dateTime(item.undone_at)}`)
          : (!item.can_undo && result.readings > 0 ? el('span', { class: 'field-help' }, 'Старая загрузка без возможности отмены') : null);
        return el('details', { class: 'import-history-item' }, [
          el('summary', {}, [el('strong', {}, heading), el('span', {}, summary)]),
          el('div', { class: 'import-history-body' }, [
            el('div', {}, `Файл: ${item.file_name}`),
            el('div', {}, `Уже были внесены: ${result.skipped_existing || 0}; без расчёта: ${result.skipped_no_history || 0}`),
            status,
            undoButton,
            undoConfirm,
            issueList,
          ]),
        ]);
      }));
    } catch (err) {
      content.replaceChildren(el('p', { class: 'form-error' }, describeApiError(err).message));
    }
  }
  await refresh();
  return modal;
}
