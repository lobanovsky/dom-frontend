import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { paymentRegistriesApi } from '../api/resources.js';
import { describeApiError, describeImportRowError } from '../lib/apiErrors.js';
import { bankLabel } from '../lib/labels.js';
import { formatDate, formatMoney } from '../lib/format.js';
import { goTo } from '../state/nav.js';

const MAX_SHOWN = 50;

// Окно «Загрузить реестр»: банковский счёт-получатель + файл реестра Сбера (.txt).
// Повторная загрузка безопасна: тот же файл отклоняется, уже известные платежи пропускаются.
export function openRegistryImportDialog({ banks, onImported }) {
  let modal;
  let submitting = false;

  const activeFirst = [...banks].sort((a, b) => Number(b.active) - Number(a.active));
  const bankSelect = el('select', { id: 'registry-bank', required: true },
    activeFirst.map((b) => el('option', { value: String(b.id) }, `${bankLabel(b)}${b.active ? '' : ' (закрыт)'}`)));
  const fileInput = el('input', { id: 'registry-file', type: 'file', accept: '.txt,text/plain', required: true });
  const message = el('div', { role: 'alert' });
  message.hidden = true;
  const details = el('div', {});
  const submitButton = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Загрузить');
  const cancelButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => modal.close() }, 'Отмена');

  function showMessage(text, variant) {
    message.className = variant === 'success' ? 'form-success' : 'form-error';
    message.textContent = text;
    message.hidden = false;
  }

  function list(items) {
    return el('ul', { class: 'import-errors' }, items);
  }

  function showResult(r) {
    const parts = [`Загружено платежей: ${r.created}. Привязано к лицевым счетам: ${r.linked}, без привязки: ${r.unlinked}.`];
    if (r.skipped_duplicates) parts.push(`Пропущено уже загруженных: ${r.skipped_duplicates}.`);
    showMessage(parts.join(' '), 'success');
    const blocks = [];
    if (r.unlinked) blocks.push(el('p', { class: 'field-help' }, 'Платежи без привязки найдутся в «Входящих платежах» по фильтру «Не привязанные».'));
    if (r.warnings?.length) blocks.push(list(r.warnings.map((w) => el('li', {}, w))));
    if (r.skipped?.length) {
      blocks.push(el('p', {}, 'Пропущены (уже есть в базе):'));
      blocks.push(list(r.skipped.slice(0, MAX_SHOWN).map((s) => el('li', {}, `${formatDate(s.payment_date)} · ${s.payer_name} · ${formatMoney(s.amount)} · операция ${s.external_id}`))));
    }
    blocks.push(el('div', { class: 'form-actions' }, [
      el('button', { type: 'button', class: 'btn btn-primary', onclick: () => { modal.close(); goTo(`/payment-registries/${r.registry_id}`); } }, 'Открыть реестр'),
    ]));
    details.replaceChildren(...blocks);
    submitButton.hidden = true;
    cancelButton.textContent = 'Закрыть';
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const file = fileInput.files[0];
    if (!file) {
      showMessage('Выберите файл', 'error');
      return;
    }
    submitting = true;
    submitButton.disabled = true;
    message.hidden = true;
    details.replaceChildren();
    try {
      const result = await paymentRegistriesApi.importFile(bankSelect.value, file);
      showResult(result);
      onImported?.(result);
    } catch (err) {
      if (err.status === 0 || err.status >= 500) return;
      const info = describeApiError(err);
      showMessage(info.message, 'error');
      if (info.registryId) {
        details.replaceChildren(el('a', { href: `/payment-registries/${info.registryId}`, onclick: () => modal.close() }, 'Открыть загруженный реестр'));
      } else if (err.rows?.length) {
        const rows = err.rows.slice(0, MAX_SHOWN).map((r) => el('li', {}, `Строка ${r.row}: ${describeImportRowError(r.error)}`));
        if (err.rows.length > MAX_SHOWN) rows.push(el('li', {}, `…и ещё ${err.rows.length - MAX_SHOWN}`));
        details.replaceChildren(list(rows));
      }
    } finally {
      submitting = false;
      submitButton.disabled = false;
    }
  }

  const form = el('form', { class: 'entity-form', onsubmit: submit }, [
    el('p', { class: 'field-help' }, [
      'Реестр платежей Сбера (текстовый файл .txt). Выберите банковский счёт, на который поступили платежи (в имени файла он указан после ИНН). ',
      'Номера лицевых счетов берутся из файла; платежи привязываются к ним автоматически. ',
      'Файл можно загружать повторно: тот же файл не загрузится, а платежи, которые уже есть в базе, будут пропущены. Если в файле ошибка, не загружается ничего.',
    ]),
    message,
    details,
    el('div', { class: 'field' }, [el('label', { for: 'registry-bank' }, 'Банковский счёт-получатель'), bankSelect]),
    el('div', { class: 'field' }, [el('label', { for: 'registry-file' }, 'Файл реестра'), fileInput]),
    el('div', { class: 'form-actions' }, [submitButton, cancelButton]),
  ]);

  modal = openModal({ title: 'Загрузить реестр', content: form, wide: true });
  return modal;
}
