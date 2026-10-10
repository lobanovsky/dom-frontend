import { el } from '../../lib/dom.js';
import { renderTable } from '../../ui/table.js';
import { toast } from '../../ui/toast.js';
import { sberApi } from '../../api/resources.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { formatDate, todayIso } from '../../lib/format.js';
import { runState, runPeriod, runSummary, connectionView, certNote, scheduleLabel, periodBody, cleanToken, runErrorText, RUN_STATE_LABELS, TRIGGER_LABELS } from '../../lib/sberApi.js';

const BADGE = { running: 'badge-warning', error: 'badge-danger', ok: 'badge-success' };
const POLL_MS = 3000;

const dateTime = (iso) => (iso ? `${formatDate(iso)} ${new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : '');

// Банк (Сбер API): состояние подключения, получение выписок кнопкой или за период, ввод токена, журнал запусков.
export async function sberApiPage(container) {
  const body = el('div', {});
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Банк (Сбер API)')),
    el('p', { class: 'section-note' }, 'Платежи читаются прямо из банка (только чтение) и попадают во «Входящие» и «Исходящие». Повторы из файлов 1С и прошлых запусков не задваиваются. Лицевой счёт определяют правила.'),
    body,
  ]));

  let timer = null;
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  async function refresh() {
    // Страницу сменили — опрос статуса прекращается.
    if (!body.isConnected) { stop(); return; }
    let status;
    try {
      status = await sberApi.status();
    } catch (err) {
      stop();
      body.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
      return;
    }
    render(status);
    if (status.running && !timer) timer = setInterval(refresh, POLL_MS);
    if (!status.running) stop();
  }

  async function run(request, doneText) {
    try {
      await request();
      toast.success(doneText);
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err).message);
    }
  }

  function render(status) {
    const view = connectionView(status);
    const ready = status.configured && status.tokens_set;
    const note = status.configured ? certNote(status.cert_expires_at) : '';

    const from = el('input', { type: 'date', id: 'sber-from', max: todayIso() });
    const to = el('input', { type: 'date', id: 'sber-to', max: todayIso() });
    const token = el('input', { type: 'password', id: 'sber-token', autocomplete: 'off', placeholder: 'refresh_token из личного кабинета Sber API' });

    const syncPeriod = () => {
      const p = periodBody(from.value, to.value);
      if (p.error) { toast.error(p.error); return; }
      run(() => sberApi.sync(p.body), 'Получение запущено');
    };
    const saveToken = () => {
      const value = cleanToken(token.value);
      if (!value) { toast.error('Вставьте refresh_token'); return; }
      run(async () => { await sberApi.setTokens(value); token.value = ''; }, 'Токен сохранён');
    };

    // null-дети нужно отфильтровать: replaceChildren(null) рисует текст «null»
    body.replaceChildren(...[
      el('div', { class: 'card sber-card' }, [
        el('div', {}, [el('span', { class: `badge badge-${view.kind}` }, view.title), status.running ? el('span', { class: 'badge badge-warning' }, 'Идёт получение…') : null]),
        view.hint ? el('p', { class: 'section-note' }, view.hint) : null,
        status.configured ? el('p', { class: 'section-note' }, scheduleLabel(status.schedule_interval)) : null,
        note ? el('p', { class: 'section-note' }, note) : null,
        status.tokens_updated_at ? el('p', { class: 'section-note' }, `Токены обновлены: ${dateTime(status.tokens_updated_at)}`) : null,
        el('div', { class: 'header-actions' }, [
          el('button', { type: 'button', class: 'btn btn-primary', disabled: !ready || status.running, onclick: () => run(() => sberApi.sync(), 'Получение запущено') }, 'Загрузить сейчас'),
        ]),
      ]),

      ready ? el('div', { class: 'page-section' }, [
        el('h2', {}, 'Загрузить за период'),
        el('p', { class: 'section-note' }, 'Для первой загрузки истории. Пустые даты — последние дни; не больше 400 дней за раз. Повторная загрузка безопасна.'),
        el('div', { class: 'table-toolbar' }, [
          el('div', { class: 'field' }, [el('label', { for: 'sber-from' }, 'С'), from]),
          el('div', { class: 'field' }, [el('label', { for: 'sber-to' }, 'По'), to]),
          el('button', { type: 'button', class: 'btn', disabled: status.running, onclick: syncPeriod }, 'Загрузить за период'),
        ]),
      ]) : null,

      status.configured ? el('div', { class: 'page-section' }, [
        el('h2', {}, 'Токен доступа'),
        el('p', { class: 'section-note' }, 'Нужен один раз (и если сервис не работал больше 180 дней): в личном кабинете Sber API → «Ключи доступа» выпустите токены и вставьте refresh_token. Дальше система обновляет его сама. Токен нигде не показывается.'),
        el('div', { class: 'table-toolbar' }, [
          el('div', { class: 'field field--search' }, [el('label', { for: 'sber-token' }, 'Refresh token'), token]),
          el('button', { type: 'button', class: 'btn', onclick: saveToken }, 'Сохранить токен'),
        ]),
      ]) : null,

      el('div', { class: 'page-section' }, [
        el('h2', {}, 'Запуски'),
        renderTable({
          rows: status.runs,
          emptyMessage: 'Запусков ещё не было',
          columns: [
            { key: 'started_at', label: 'Начало', primary: true, render: (r) => dateTime(r.started_at) },
            { key: 'trigger', label: 'Как', render: (r) => TRIGGER_LABELS[r.trigger] || r.trigger },
            { key: 'period', label: 'Период', render: runPeriod },
            { key: 'state', label: 'Состояние', render: (r) => el('span', { class: `badge ${BADGE[runState(r)]}` }, RUN_STATE_LABELS[runState(r)]) },
            { key: 'summary', label: 'Итог', render: (r) => runSummary(r) },
            { key: 'error', label: 'Ошибка', render: (r) => runErrorText(r.error) },
          ],
        }),
        status.runs.some((r) => r.incoming || r.outgoing)
          ? el('p', { class: 'section-note' }, [el('a', { href: '/payments/incoming' }, 'Входящие платежи'), ' — там кнопка «Определить лицевые счета».'])
          : null,
      ]),
    ].filter(Boolean));
  }

  await refresh();
}
