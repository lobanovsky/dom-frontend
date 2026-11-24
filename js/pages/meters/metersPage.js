import { openMeterExportDialog } from '../../ui/meterExportDialog.js';
import { el } from '../../lib/dom.js';
import { buildingsApi } from '../../api/resources.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { openMeterImportDialog } from '../../ui/meterImportDialog.js';
import { canWrite } from '../../lib/permissions.js';
import { createMetersList } from './metersList.js';
import { metersApi } from '../../api/resources.js';
import { saveFile } from '../../ui/saveFile.js';
import { toast } from '../../ui/toast.js';
import { openMeterImportHistoryDialog } from '../../ui/meterImportHistoryDialog.js';
import { confirmDialog } from '../../ui/confirmDialog.js';

const MODES = [
  { id: 'common', title: 'Общедомовые', target: 'building' },
  { id: 'individual', title: 'В помещениях', target: 'premises' },
];

// Раздел «Счётчики»: общедомовые счётчики домов и индивидуальные счётчики помещений.
export async function metersPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let buildings;
  try {
    ({ items: buildings } = await buildingsApi.list({ limit: 200 }));
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }

  let mode = MODES[0];
  let currentList;
  const switcher = el('div', { class: 'segmented', role: 'tablist' });
  const host = el('div', {});

  function show() {
    switcher.replaceChildren(...MODES.map((m) => el('button', {
      type: 'button', role: 'tab', class: m === mode ? 'segmented-item is-active' : 'segmented-item', 'aria-selected': String(m === mode),
      onclick: () => { mode = m; show(); },
    }, m.title)));
    const list = createMetersList({
      fixedQuery: { scope: mode.id },
      target: mode.target,
      buildings,
      showFilters: true,
      emptyMessage: mode.id === 'common' ? 'Общедомовых счётчиков пока нет' : 'Счётчиков в помещениях пока нет',
    });
    currentList = list;
    host.replaceChildren(list.element);
  }

  async function exportMeters() {
    try {
      saveFile(await metersApi.exportExcel(currentList?.getQuery() || { scope: mode.id }));
    } catch (err) {
      toast.error(describeApiError(err).message);
    }
  }

  async function applyDefaultReadings() {
    const month = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }).format(new Date());
    const confirmed = await confirmDialog({
      title: 'Подставить показания по умолчанию',
      message: `За ${month} будут добавлены показания только счётчикам с ручной передачей, у которых показаний за этот месяц ещё нет. Средний расход прибавится к предыдущему показанию (или к начальному). Продолжить?`,
      confirmLabel: 'Подставить',
    });
    if (!confirmed) return;
    try {
      const result = await metersApi.applyDefaultReadings();
      const details = [
        result.unconfigured ? `без заданного среднего расхода: ${result.unconfigured}` : null,
        result.skipped ? `не удалось применить (проверьте показания): ${result.skipped}` : null,
      ].filter(Boolean);
      toast.success(`Добавлено показаний: ${result.applied}.${details.length ? ` ${details.join('; ')}.` : ''}`);
      await currentList?.reload();
    } catch (err) {
      toast.error(describeApiError(err).message);
    }
  }

  show();
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [
      el('h1', {}, 'Счётчики'),
      el('div', { class: 'header-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: exportMeters }, 'Экспорт счётчиков'),
        el('button', { type: 'button', class: 'btn', onclick: openMeterExportDialog }, 'Экспорт показаний'),
        canWrite() ? el('button', { type: 'button', class: 'btn', onclick: () => openMeterImportDialog({ buildings, onImported: show }) }, 'Загрузить показания') : null,
        canWrite() ? el('button', { type: 'button', class: 'btn', onclick: applyDefaultReadings }, 'Подставить значения по умолчанию') : null,
        canWrite() ? el('button', { type: 'button', class: 'btn', onclick: () => openMeterImportHistoryDialog(buildings) }, 'История загрузок') : null,
      ]),
    ]),
    switcher,
    host,
  ]));
}
