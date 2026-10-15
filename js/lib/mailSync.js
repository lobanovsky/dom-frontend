// Тексты страницы «Почта» (забор реестров из письма). Без DOM, покрыто тестами.

import { statusInfo, plural } from './registryImport.js';

export { runState, RUN_STATE_LABELS, TRIGGER_LABELS } from './sberApi.js';

// Статус файла из журнала запуска: коды загрузки реестров плюс no_account (в имени нет известного кода реестра).
export function detailStatus(status) {
  if (status === 'no_account') return { label: 'Счёт не найден по коду реестра', tone: 'error' };
  return statusInfo(status);
}

// Что делать с файлом, который не загрузился из-за счёта; для остальных статусов подсказка не нужна.
export function detailHint(status) {
  if (status === 'no_account') return 'Добавьте код реестра в карточку банковского счёта — письмо подхватится при следующей проверке.';
  if (status === 'unknown_account') return 'Номера этого счёта нет в системе: добавьте банковский счёт — письмо подхватится при следующей проверке.';
  return '';
}

// Итог запуска одной строкой: «писем 2, реестров загружено 1 (платежей 12), уже было 1, не загрузилось 0».
export function runSummary(run) {
  if (!run.finished_at) return '';
  return `${plural(run.messages, 'письмо', 'письма', 'писем')} ${run.messages}, `
    + `загружено реестров ${run.imported} (${plural(run.payments, 'платёж', 'платежа', 'платежей')} ${run.payments}), `
    + `уже было ${run.duplicates}, не загрузилось ${run.failed}`;
}

// Подпись расписания из ответа status: every — длительность Go («1h0m0s»), пусто — только по кнопке.
export function scheduleLabel(every) {
  if (!every) return 'Автоматическая проверка выключена, загрузка только по кнопке.';
  return `Почта проверяется ${everyText(every)}. Письма в ящике не меняются, повторы не задваиваются.`;
}

function everyText(every) {
  const m = String(every).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:\d+s)?$/);
  const h = Number(m?.[1] || 0);
  const min = Number(m?.[2] || 0);
  if (!m || (!h && !min)) return `раз в ${every}`;
  if (h === 24 && !min) return 'раз в сутки';
  if (h && !min) return h === 1 ? 'раз в час' : `раз в ${h} ${plural(h, 'час', 'часа', 'часов')}`;
  if (!h) return `раз в ${min} ${plural(min, 'минуту', 'минуты', 'минут')}`;
  return `раз в ${h} ч ${min} мин`;
}

// Шапка страницы: состояние интеграции.
export function connectionView(status) {
  if (!status.configured) {
    return { kind: 'neutral', title: 'Не настроено', hint: 'На сервере не задан ящик (MAIL_USER и файл с паролем для внешнего приложения). Порядок подключения описан в README бэкенда.' };
  }
  return { kind: 'success', title: 'Подключено', hint: '' };
}
