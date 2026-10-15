import { el } from '../../lib/dom.js';
import { renderTable } from '../../ui/table.js';
import { toast } from '../../ui/toast.js';
import { mailApi } from '../../api/resources.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { formatDateTime } from '../../lib/format.js';
import { runState, RUN_STATE_LABELS, TRIGGER_LABELS, detailStatus, detailHint, runSummary, scheduleLabel, connectionView } from '../../lib/mailSync.js';
import { canWrite } from '../../lib/permissions.js';

const BADGE = { running: 'badge-warning', error: 'badge-danger', ok: 'badge-success' };
const TONE = { success: 'badge-success', neutral: 'badge-neutral', error: 'badge-danger' };
const POLL_MS = 3000;

// Почта: реестры ВТБ, которые приходят письмами в папку ящика, загружаются сами; здесь состояние, проверка по кнопке и журнал.
export async function mailSyncPage(container) {
  const body = el('div', {});
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Почта')),
    el('p', { class: 'section-note' }, 'Реестры из писем в выбранной папке ящика загружаются так же, как при ручной загрузке. Письма в почте не меняются (ящик читается только на чтение), повторы не задваиваются.'),
    body,
  ]));

  let timer = null;
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  async function refresh() {
    // Страницу сменили — опрос статуса прекращается.
    if (!body.isConnected) { stop(); return; }
    let status;
    try {
      status = await mailApi.status();
    } catch (err) {
      stop();
      body.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
      return;
    }
    render(status);
    if (status.running && !timer) timer = setInterval(refresh, POLL_MS);
    if (!status.running) stop();
  }

  async function check() {
    try {
      await mailApi.sync();
      toast.success('Проверка почты запущена');
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err).message);
    }
  }

  // Результат по каждому файлу запуска: что загружено, что нет и почему.
  function detailsTable(run) {
    const rows = (run.details || []).map((d, i) => ({ ...d, id: i }));
    return renderTable({
      rows,
      emptyMessage: 'В письмах не было реестров',
      columns: [
        { key: 'file', label: 'Файл', primary: true },
        { key: 'subject', label: 'Письмо', render: (d) => [d.subject, d.date ? formatDateTime(d.date) : ''].filter(Boolean).join(' · ') },
        { key: 'status', label: 'Результат', render: (d) => {
          const info = detailStatus(d.status);
          const hint = detailHint(d.status);
          return el('div', {}, [
            el('span', { class: `badge ${TONE[info.tone] || 'badge-neutral'}`, title: d.error || '' }, info.label),
            d.payments ? el('span', { class: 'nowrap' }, ` · платежей ${d.payments}`) : null,
            d.registry_id ? el('span', {}, [' · ', el('a', { href: `/payment-registries/${d.registry_id}` }, 'реестр')]) : null,
            hint ? el('div', { class: 'field-help' }, hint) : null,
          ]);
        } },
      ],
    });
  }

  function render(status) {
    const view = connectionView(status);
    body.replaceChildren(...[
      el('div', { class: 'card sber-card' }, [
        el('div', {}, [el('span', { class: `badge badge-${view.kind}` }, view.title), status.running ? el('span', { class: 'badge badge-warning' }, 'Идёт проверка…') : null]),
        view.hint ? el('p', { class: 'section-note' }, view.hint) : null,
        status.configured ? el('p', { class: 'section-note' }, `Ящик ${status.user}, папка «${status.folder}», письма за последние ${status.since_days} дн.`) : null,
        status.configured ? el('p', { class: 'section-note' }, scheduleLabel(status.every)) : null,
        canWrite() ? el('div', { class: 'header-actions' }, [
          el('button', { type: 'button', class: 'btn btn-primary', disabled: !status.configured || status.running, onclick: check }, 'Проверить почту сейчас'),
        ]) : null,
      ]),

      status.configured ? el('div', { class: 'page-section' }, [
        el('h2', {}, 'Проверки'),
        renderTable({
          rows: status.runs,
          emptyMessage: 'Проверок ещё не было',
          columns: [
            { key: 'started_at', label: 'Начало', primary: true, render: (r) => formatDateTime(r.started_at) },
            { key: 'trigger', label: 'Как', render: (r) => TRIGGER_LABELS[r.trigger] || r.trigger },
            { key: 'state', label: 'Состояние', render: (r) => el('span', { class: `badge ${BADGE[runState(r)]}` }, RUN_STATE_LABELS[runState(r)]) },
            { key: 'summary', label: 'Итог', render: runSummary },
            { key: 'error', label: 'Ошибка', render: (r) => r.error || '' },
          ],
          rowActions: (r) => (r.details || []).length
            ? [el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => showDetails(r) }, 'Файлы')]
            : [],
        }),
        el('div', { class: 'section-note' }, [el('a', { href: '/payment-registries' }, 'Реестры'), ' — загруженные файлы. Если письмо не загрузилось из-за счёта, добавьте код реестра в ', el('a', { href: '/bank-accounts' }, 'банковский счёт'), '.']),
      ]) : null,
    ].filter(Boolean));
  }

  function showDetails(run) {
    const host = el('div', {}, [
      el('h2', {}, `Файлы проверки от ${formatDateTime(run.started_at)}`),
      detailsTable(run),
    ]);
    body.querySelector('.mail-details')?.remove();
    const wrap = el('div', { class: 'page-section mail-details' }, host);
    body.append(wrap);
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  await refresh();
}
