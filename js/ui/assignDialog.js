import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { renderTable } from './table.js';
import { toast } from './toast.js';
import { paymentAssignmentsApi } from '../api/resources.js';
import { describeApiError } from '../lib/apiErrors.js';
import { formatDate, formatMoney, formatTime } from '../lib/format.js';
import { changeLabels, MODE_LABELS, previewSummary, hasChanges, directionTexts } from '../lib/rules.js';

const failed = (err) => err.status === 0 || err.status >= 500; // глобальный тост уже показан клиентом

function samplesTable(samples, emptyMessage, direction) {
  const labels = changeLabels(direction);
  const texts = directionTexts(direction);
  return renderTable({
    columns: [
      { key: 'change', label: 'Результат', primary: true, render: (s) => labels[s.change] || s.change },
      { key: 'payment_date', label: 'Дата', render: (s) => formatDate(s.payment_date) },
      { key: 'payer_name', label: texts.counterparty },
      { key: 'amount', label: 'Сумма', render: (s) => el('span', { class: 'nowrap' }, formatMoney(s.amount)) },
      { key: 'purpose', label: 'Назначение' },
      { key: 'target', label: texts.target, render: (s) => [s.account_number ? `ЛС ${s.account_number}` : s.category_name, s.rule_name ? ` · «${s.rule_name}»` : ''].join('') },
      { key: 'reason', label: 'Причина', render: (s) => s.reason || (s.prev_account ? `было: ${s.prev_account}` : '') },
    ],
    rows: samples,
    getRowKey: (s) => s.payment_id,
    emptyMessage,
  });
}

// Окно «Определить лицевые счета» (для исходящих — «Определить категории»): выбор режима, предпросмотр
// (ничего не записывается), применение и откат запуска.
// direction — incoming | outgoing; scope — фильтры списка платежей; ruleId — проверить только одно правило (без применения);
// onApplied вызывается после применения или отката (чтобы обновить список).
export function openAssignDialog({ direction = 'incoming', scope = {}, ruleId = null, title, onApplied } = {}) {
  const texts = directionTexts(direction);
  const outgoing = direction === 'outgoing';
  title = title || texts.assignTitle;
  let mode = 'unassigned';
  let preview = null;
  let seq = 0;
  let applying = false;
  let lastRun = null;

  const body = el('div', {});
  const modal = openModal({ title, content: body, wide: true });
  modal.dialog.classList.add('modal-dialog--xl'); // таблицы с примерами платежей шире обычного окна

  const modeSelect = el('select', { 'aria-label': 'Режим' }, Object.entries({ ...MODE_LABELS, unassigned: texts.unassigned }).map(([value, label]) => el('option', { value }, label)));
  modeSelect.addEventListener('change', () => { mode = modeSelect.value; load(); });

  async function load() {
    const current = ++seq;
    lastRun = null;
    body.replaceChildren(el('div', { class: 'table-status' }, 'Проверка платежей по правилам…'));
    try {
      const res = await paymentAssignmentsApi.preview({ direction, mode, scope, ...(ruleId ? { rule_id: ruleId } : {}) });
      if (current !== seq) return;
      preview = res;
      render();
    } catch (err) {
      if (current !== seq || failed(err)) {
        if (failed(err)) modal.close();
        return;
      }
      body.replaceChildren(el('div', { class: 'form-error', role: 'alert' }, describeApiError(err).message), closeRow());
    }
  }

  const closeRow = () => el('div', { class: 'form-actions' }, el('button', { type: 'button', class: 'btn', onclick: () => modal.close() }, 'Закрыть'));

  async function apply() {
    if (applying) return;
    applying = true;
    try {
      const res = await paymentAssignmentsApi.apply({ direction, mode, scope });
      lastRun = res;
      onApplied?.();
      renderApplied(res);
    } catch (err) {
      if (!failed(err)) toast.error(describeApiError(err).message);
    } finally {
      applying = false;
    }
  }

  async function rollbackRun(id) {
    try {
      const r = await paymentAssignmentsApi.rollback(id);
      toast.success(`Откат выполнен: восстановлено платежей ${r.restored}${r.kept ? `, оставлено без изменений ${r.kept} (${outgoing ? 'их категорию' : 'их привязку'} потом меняли)` : ''}`);
      onApplied?.();
      modal.close();
    } catch (err) {
      if (!failed(err)) toast.error(describeApiError(err).message);
    }
  }

  function renderApplied(res) {
    const text = res.run_id
      ? `Готово: получили ${texts.noun} ${res.new}, изменено ${res.changed}, снято ${res.cleared}. Запуск № ${res.run_id} записан в историю: его можно откатить.`
      : 'Менять нечего: все платежи уже в нужном состоянии.';
    body.replaceChildren(
      el('div', { class: 'form-success', role: 'status' }, text),
      el('div', { class: 'form-actions' }, [
        res.run_id ? el('button', { type: 'button', class: 'btn btn-danger', onclick: () => rollbackRun(res.run_id) }, 'Откатить этот запуск') : null,
        el('button', { type: 'button', class: 'btn btn-primary', onclick: () => modal.close() }, 'Закрыть'),
      ].filter(Boolean)),
    );
  }

  function render() {
    const p = preview;
    const blocks = [
      el('p', { class: 'field-help' }, ruleId
        ? 'Проверка одного правила: ничего не записывается. Показано, какие платежи оно определило бы.'
        : `Правила применяются к платежам по текущим фильтрам страницы. Сначала показан предпросмотр, ничего ещё не записано. ${outgoing ? 'Категории, поставленные вручную, правила не меняют.' : 'Привязки «вручную» и «из реестра» правила не меняют.'}`),
      el('div', { class: 'field' }, [el('label', {}, 'Что определять'), modeSelect]),
      el('div', { class: p.new + p.changed + p.cleared > 0 ? 'form-success' : 'form-error', role: 'status' }, previewSummary(p, direction)),
    ];
    if (p.warnings?.length) blocks.push(el('div', { class: 'form-error' }, p.warnings.join('; ')));
    if (p.by_rule?.length) {
      blocks.push(el('h3', { class: 'section-title' }, 'Что определили правила'), renderTable({
        columns: [{ key: 'rule_name', label: 'Правило', primary: true }, { key: 'count', label: 'Платежей' }],
        rows: p.by_rule, getRowKey: (r) => r.rule_id,
      }));
    }
    if (p.reasons?.length) {
      blocks.push(el('h3', { class: 'section-title' }, outgoing ? 'Почему остались без категории' : 'Почему остались без привязки'), renderTable({
        columns: [{ key: 'reason', label: 'Причина', primary: true }, { key: 'count', label: 'Платежей' }],
        rows: p.reasons, getRowKey: (r) => r.reason,
      }));
    }
    if (p.samples?.length) {
      blocks.push(el('details', { open: true }, [el('summary', {}, `Что изменится (первые ${p.samples.length})`), samplesTable(p.samples, '', direction)]));
    }
    if (p.unmatched?.length) {
      blocks.push(el('details', {}, [el('summary', {}, `Не определены (первые ${p.unmatched.length})`), samplesTable(p.unmatched, '', direction)]));
    }
    blocks.push(el('div', { class: 'form-actions' }, [
      !ruleId && hasChanges(p) ? el('button', { type: 'button', class: 'btn btn-primary', onclick: apply }, 'Применить') : null,
      el('button', { type: 'button', class: 'btn', onclick: () => modal.close() }, 'Закрыть'),
    ].filter(Boolean)));
    body.replaceChildren(...blocks);
    modeSelect.value = mode;
  }

  load();
  return modal;
}

// История запусков определения с откатом.
export function openAssignHistory({ direction = 'incoming', onChanged } = {}) {
  const body = el('div', {}, el('div', { class: 'table-status' }, 'Загрузка…'));
  const modal = openModal({ title: directionTexts(direction).historyTitle, content: body, wide: true });

  async function rollbackRun(run) {
    try {
      const r = await paymentAssignmentsApi.rollback(run.id);
      toast.success(`Откат запуска № ${run.id}: восстановлено платежей ${r.restored}${r.kept ? `, без изменений ${r.kept}` : ''}`);
      onChanged?.();
      load();
    } catch (err) {
      if (!failed(err)) toast.error(describeApiError(err).message);
    }
  }

  async function load() {
    try {
      const { items } = await paymentAssignmentsApi.runs({ direction, limit: 100 });
      body.replaceChildren(renderTable({
        columns: [
          { key: 'id', label: 'Запуск', primary: true, render: (r) => `№ ${r.id}` },
          { key: 'created_at', label: 'Когда', render: (r) => `${formatDate(r.created_at)} ${formatTime(String(r.created_at).slice(11, 19))}` },
          { key: 'mode', label: 'Режим', render: (r) => ({ ...MODE_LABELS, unassigned: directionTexts(direction).unassigned })[r.mode] || r.mode },
          { key: 'assigned_count', label: 'Определено', render: (r) => `${r.assigned_count}${r.changed_count ? ` (из них изменено ${r.changed_count})` : ''}${r.cleared_count ? `, снято ${r.cleared_count}` : ''}` },
          { key: 'status', label: 'Статус', render: (r) => (r.rolled_back_at ? `Откатан ${formatDate(r.rolled_back_at)}${r.rolled_back_kept ? `, оставлено ${r.rolled_back_kept}` : ''}` : 'Действует') },
        ],
        rows: items,
        emptyMessage: 'Запусков пока не было',
        rowActions: (r) => (r.rolled_back_at ? [] : [el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-danger-text', onclick: () => rollbackRun(r) }, 'Откатить')]),
      }));
    } catch (err) {
      if (failed(err)) modal.close();
      else body.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    }
  }
  load();
  return modal;
}
