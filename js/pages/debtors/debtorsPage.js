import { debtorsApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { formatMoney, formatPhone } from '../../lib/format.js';
import { currentMonth } from '../../lib/calculation.js';
import { monthLabel } from '../../lib/format.js';
import { openModal } from '../../ui/modal.js';
import { saveFile } from '../../ui/saveFile.js';
import { canWrite } from '../../lib/permissions.js';

const categories = [
  ['utilities:apartment', 'Квартиры · ЖКУ'],
  ['utilities:parking_space', 'Машиноместа · ЖКУ'],
  ['capital_repair:apartment', 'Квартиры · капремонт'],
  ['capital_repair:parking_space', 'Машиноместа · капремонт'],
  ['other', 'Коммерческие помещения'],
];

function categoryOf(row) {
  if (row.premises_kind === 'apartment' || row.premises_kind === 'parking_space') return `${row.purpose}:${row.premises_kind}`;
  return 'other';
}

function formatPeriod(value) {
  const date = String(value).slice(0, 10);
  return monthLabel(date.slice(0, 7));
}

function categoryLabel(row) {
  const kind = row.premises_kind === 'apartment' ? 'Квартира'
    : row.premises_kind === 'parking_space' ? 'Машиноместо'
      : 'Коммерческое помещение';
  const purpose = row.purpose === 'capital_repair' ? 'капремонт' : 'ЖКУ';
  return `${kind} · ${purpose}`;
}

export async function debtorsPage(container) {
  const editable = canWrite();
  let reports = [];
  let rows = [];
  let selectedPeriod = '';
  const selectedCategories = new Set(categories.map(([value]) => value));
  let search = '';
  const page = el('div', { class: 'page' });
  const output = el('div', {});

  const periodSelect = el('select', { class: 'form-control', 'aria-label': 'Месяц задолженности', onchange: async () => {
    selectedPeriod = periodSelect.value;
    await loadRows();
  } });

  const upload = async (file, period, button) => {
    if (!file || !period) return;
    if (reports.some((item) => String(item.period).startsWith(period))) {
      const ok = await confirmDialog({
        title: 'Заменить отчёт',
        message: `Отчёт за ${monthLabel(period)} уже загружен. Новый файл полностью заменит текущий список за этот месяц. Продолжить?`,
        confirmLabel: 'Заменить',
      });
      if (!ok) return;
    }
    button.disabled = true;
    try {
      await debtorsApi.import(period, file);
      await loadReports(period);
    } catch (error) {
      openModal({ title: 'Не удалось загрузить отчёт', content: el('p', {}, describeApiError(error).message) });
    } finally { button.disabled = false; }
  };

  const fileInput = el('input', { type: 'file', accept: '.xlsx', class: 'form-control', 'aria-label': 'Файл с долгами', onchange: () => {
    const match = fileInput.files?.[0]?.name.match(/\b(20\d{2}-(?:0[1-9]|1[0-2]))\b/);
    if (match) periodInput.value = match[1];
  } });
  const periodInput = el('input', { type: 'month', class: 'form-control', value: currentMonth(), 'aria-label': 'Месяц отчёта' });
  const uploadButton = el('button', { type: 'button', class: 'btn btn-primary', onclick: () => upload(fileInput.files?.[0], periodInput.value, uploadButton) }, 'Загрузить Excel');
  const searchInput = el('input', { type: 'search', class: 'form-control', placeholder: 'Лицевой счёт, помещение, ФИО, телефон или email', oninput: () => { search = searchInput.value.trim().toLocaleLowerCase('ru'); render(); } });
  const categoryHint = el('span', { class: 'field-help', role: 'status', 'aria-live': 'polite' }, 'Выберите одну или несколько категорий. Оставьте выбранной минимум одну.');
  const categoryFilters = el('div', { class: 'debtors-category-filters', role: 'group', 'aria-label': 'Категории должников' }, categories.map(([value, label]) => {
    const checkbox = el('input', { type: 'checkbox', checked: true, onchange: () => {
      if (!checkbox.checked && selectedCategories.size === 1) {
        checkbox.checked = true;
        categoryHint.textContent = 'Должна оставаться выбранной хотя бы одна категория.';
        return;
      }
      if (checkbox.checked) selectedCategories.add(value);
      else selectedCategories.delete(value);
      categoryHint.textContent = 'Выберите одну или несколько категорий. Оставьте выбранной минимум одну.';
      render();
    } });
    return el('label', { class: 'debtors-category-option' }, [checkbox, el('span', {}, label)]);
  }));
  const exportButton = el('button', { type: 'button', class: 'btn', disabled: true, onclick: async () => {
    exportButton.disabled = true;
    try {
      saveFile(await debtorsApi.exportExcel({ period: selectedPeriod, categories: [...selectedCategories].join(','), q: searchInput.value.trim() }));
    } catch (error) {
      openModal({ title: 'Не удалось выгрузить Excel', content: el('p', {}, describeApiError(error).message) });
    } finally { exportButton.disabled = !selectedPeriod; }
  } }, 'Выгрузить в Excel');
  const undoButton = el('button', { type: 'button', class: 'btn btn-ghost', disabled: true, onclick: async () => {
    if (!selectedPeriod) return;
    const period = selectedPeriod;
    if (!await confirmDialog({
      title: 'Откатить загрузку должников',
      message: `Удалить весь загруженный снимок за ${monthLabel(period)}? После этого можно будет загрузить исправленный файл за этот месяц.`,
      confirmLabel: 'Удалить снимок',
      danger: true,
    })) return;
    undoButton.disabled = true;
    try {
      await debtorsApi.undoReport(period);
      selectedPeriod = '';
      await loadReports();
    } catch (error) {
      openModal({ title: 'Не удалось отменить загрузку', content: el('p', {}, describeApiError(error).message) });
    } finally { undoButton.disabled = !selectedPeriod; }
  } }, 'Откатить загрузку');

  async function loadReports(preferred = '') {
    try {
      const result = await debtorsApi.reports();
      reports = result.items;
      periodSelect.replaceChildren(...reports.map((report) => el('option', {
        value: String(report.period).slice(0, 7),
        selected: String(report.period).startsWith(preferred || selectedPeriod),
      }, `${formatPeriod(report.period)} · ${report.rows_count} должников`)));
      if (!reports.length) {
        selectedPeriod = '';
        rows = [];
        exportButton.disabled = true;
        undoButton.disabled = true;
        render();
        return;
      }
      selectedPeriod = periodSelect.value || String(reports[0].period).slice(0, 7);
      periodSelect.value = selectedPeriod;
      exportButton.disabled = false;
      undoButton.disabled = false;
      await loadRows();
    } catch (error) {
      output.replaceChildren(el('div', { class: 'card empty-state' }, describeApiError(error).message));
    }
  }

  async function loadRows() {
    if (!selectedPeriod) { rows = []; render(); return; }
    output.replaceChildren(el('p', { class: 'muted' }, 'Загрузка списка должников…'));
    try {
      const result = await debtorsApi.list(selectedPeriod);
      rows = result.items;
      render();
    } catch (error) {
      output.replaceChildren(el('div', { class: 'card empty-state' }, describeApiError(error).message));
    }
  }

  function render() {
    if (!selectedPeriod) {
      output.replaceChildren(el('div', { class: 'card empty-state' }, 'Отчёты о задолженности ещё не загружены.'));
      return;
    }
    const filtered = rows.filter((row) => {
      if (!selectedCategories.has(categoryOf(row))) return false;
      if (!search) return true;
      const text = [row.account_number, row.premises_number, ...(row.holder_names || []), ...(row.phones || []), ...(row.emails || [])].join(' ').toLocaleLowerCase('ru');
      return text.includes(search);
    });
    const total = filtered.reduce((sum, row) => sum + Number(row.debt || 0), 0);
    const summary = el('div', { class: 'electricity-total' }, [
      el('div', {}, [el('span', {}, `Должников: ${filtered.length}`), el('small', {}, `Данные на ${selectedPeriod ? monthLabel(selectedPeriod) : '—'}`)]),
      el('strong', {}, formatMoney(total)),
    ]);
    const table = el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Лицевой счёт', 'Помещение', 'Тип счёта', 'Собственник', 'Телефон', 'Email', 'Долг'].map((title) => el('th', {}, title)))),
      el('tbody', {}, filtered.map((row) => el('tr', {}, [
        el('td', {}, row.premises_id ? el('a', { href: `/premises/${row.premises_id}` }, row.account_number) : row.account_number),
        el('td', {}, row.premises_number || 'Не найдено'),
        el('td', {}, categoryLabel(row)),
        el('td', {}, (row.holder_names || []).join(', ') || 'Не указан'),
        el('td', {}, (row.phones || []).map(formatPhone).join(', ') || '—'),
        el('td', {}, (row.emails || []).join(', ') || '—'),
        el('td', { class: 'numeric' }, el('strong', {}, formatMoney(Number(row.debt)))),
      ]))),
    ]);
    output.replaceChildren(summary, el('div', { class: 'card electricity-table-scroll' }, filtered.length ? table : el('div', { class: 'empty-state' }, 'По выбранным условиям должников нет.')));
  }

  page.append(
    el('div', { class: 'section-header' }, [el('h1', {}, 'Должники'), el('div', { class: 'header-actions debtors-header-actions' }, [periodSelect, editable ? undoButton : null, exportButton])]),
    editable ? el('div', { class: 'card debtors-import-card' }, [
      el('p', { class: 'muted' }, 'Загрузите Excel-отчёт из «Домовладельца». Берётся столбец «Долг на конец»; в список попадают только положительные долги. Повторная загрузка месяца заменит его снимок.'),
      el('div', { class: 'debtors-upload-controls' }, [periodInput, fileInput, uploadButton]),
    ]) : null,
    el('div', { class: 'debtors-list-toolbar' }, [
      el('div', {}, [categoryFilters, categoryHint]),
      searchInput,
    ]),
    output,
  );
  container.replaceChildren(page);
  await loadReports();
}
