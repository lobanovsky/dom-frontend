// Тексты и состояния страницы «Банк (Сбер)». Без DOM, покрыто тестами.

import { formatDate } from './format.js';

const DAY = 24 * 60 * 60 * 1000;

// Состояние запуска: идёт / с ошибкой / успешно.
export function runState(run) {
  if (!run.finished_at) return 'running';
  return run.error ? 'error' : 'ok';
}

export const RUN_STATE_LABELS = { running: 'Идёт', error: 'Ошибка', ok: 'Готово' };
export const TRIGGER_LABELS = { schedule: 'По расписанию', manual: 'Вручную' };

// «09.10.2026» или «07.10.2026 — 09.10.2026».
export function runPeriod(run) {
  return run.date_from === run.date_to ? formatDate(run.date_from) : `${formatDate(run.date_from)} — ${formatDate(run.date_to)}`;
}

// Итог запуска одной строкой: «входящих 3, исходящих 1, пропущено повторов 12».
export function runSummary(run) {
  if (!run.finished_at) return '';
  return `входящих ${run.incoming}, исходящих ${run.outgoing}, уже было ${run.skipped}`;
}

// Что показать в шапке: состояние интеграции и подсказка, что делать дальше.
export function connectionView(status) {
  if (!status.configured) {
    return { kind: 'neutral', title: 'Не настроено', hint: 'На сервере не заданы параметры Sber API (SBER_CLIENT_ID и файлы сертификата). Порядок подключения описан в инструкции.' };
  }
  if (!status.tokens_set) {
    return { kind: 'warning', title: 'Нужен токен', hint: 'Выпустите токены в личном кабинете Sber API и вставьте refresh_token ниже.' };
  }
  return { kind: 'success', title: 'Подключено', hint: '' };
}

// Предупреждение о сроке клиентского сертификата (12 месяцев): за 30 дней и после истечения.
export function certNote(expiresAt, now = new Date()) {
  if (!expiresAt) return '';
  const left = new Date(expiresAt).getTime() - now.getTime();
  if (left < 0) return `Сертификат истёк ${formatDate(expiresAt)}: выпустите новый в личном кабинете.`;
  if (left < 30 * DAY) return `Сертификат истекает ${formatDate(expiresAt)}: выпустите новый заранее.`;
  return `Сертификат действует до ${formatDate(expiresAt)}.`;
}

// «1h0m0s» из ответа бэкенда -> «каждый час»; пустое значение — опроса по расписанию нет.
export function scheduleLabel(interval) {
  if (!interval) return 'Автоматический опрос выключен, загрузка только по кнопке.';
  const m = interval.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m) return `Опрос банка: ${interval}.`;
  const [h, min] = [Number(m[1] || 0), Number(m[2] || 0)];
  if (h === 1 && !min) return 'Банк опрашивается каждый час.';
  if (h && !min) return `Банк опрашивается каждые ${h} ч.`;
  if (!h && min) return `Банк опрашивается каждые ${min} мин.`;
  return `Опрос банка: ${interval}.`;
}

// Разбор введённого периода: обе даты необязательны; возвращает тело запроса или текст ошибки.
export function periodBody(from, to) {
  if (from && to && from > to) return { error: 'Начало периода позже окончания' };
  const body = {};
  if (from) body.date_from = from;
  if (to) body.date_to = to;
  return { body };
}

// Из вставленного текста вынимает токен: пробелы и кавычки по краям убираются;
// допускается строка вида «refresh_token: abc».
export function cleanToken(text) {
  const t = String(text ?? '').trim().replace(/^refresh_token\s*[:=]\s*/i, '').replace(/^["']+|["']+$/g, '').trim();
  return t;
}

// Ошибка запуска (приходит по-английски, несколько счетов через «; ») -> понятный текст.
export function runErrorText(error) {
  if (!error) return '';
  return String(error).split('; ').map((part) => {
    if (part.includes('token refresh failed')) return 'Банк не принял токен: введите новый refresh_token из личного кабинета';
    if (part.startsWith('stopped: the bank rejected the tokens')) return 'Остальные счета не опрашивались';
    if (part.includes('status 403')) return part.replace(/status 403.*$/, 'нет доступа к счёту в банке (403)');
    if (part.includes('status 429')) return 'Банк ограничил число запросов (429), повторите позже';
    if (part.includes('interrupted: server restarted')) return 'Прервано перезапуском сервера';
    return part;
  }).join('; ');
}
