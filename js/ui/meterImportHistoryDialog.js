import { meterReadingsApi } from '../api/resources.js';
import { buildingLabel } from '../lib/buildings.js';
import { describeApiError, describeImportRowError } from '../lib/apiErrors.js';
import { el } from '../lib/dom.js';
import { openModal } from './modal.js';

const dateTime = (value) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

export async function openMeterImportHistoryDialog(buildings = []) {
  const content = el('div', { class: 'import-history' }, el('p', { class: 'table-status' }, 'Загрузка истории…'));
  const modal = openModal({ title: 'История загрузки показаний', content, wide: true });
  try {
    const { items } = await meterReadingsApi.um31ImportHistory();
    if (modal.dialog.isConnected === false) return;
    const buildingById = new Map(buildings.map((b) => [b.id, buildingLabel(b)]));
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
      return el('details', { class: 'import-history-item' }, [
        el('summary', {}, [el('strong', {}, heading), el('span', {}, summary)]),
        el('div', { class: 'import-history-body' }, [
          el('div', {}, `Файл: ${item.file_name}`),
          el('div', {}, `Уже были внесены: ${result.skipped_existing || 0}; без расчёта: ${result.skipped_no_history || 0}`),
          issueList,
        ]),
      ]);
    }));
  } catch (err) {
    content.replaceChildren(el('p', { class: 'form-error' }, describeApiError(err).message));
  }
  return modal;
}
