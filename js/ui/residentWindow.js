import { client } from '../api/client.js';
import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { formatDate } from '../lib/format.js';

// Постоянное расписание задаётся один раз; исключения хранятся отдельно по месяцам.
export async function openResidentWindow(building) {
  const enabled = el('input', { type: 'checkbox', disabled: true });
  const opens = el('input', { type: 'number', min: 1, max: 31, required: true, value: 17, disabled: true });
  const closes = el('input', { type: 'number', min: 1, max: 31, required: true, value: 22, disabled: true });
  const status = el('p', { role: 'alert' });
  const preview = el('p', { class: 'field-help' });
  const submit = el('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Сохранить расписание');
  const form = el('form', { class: 'form' }, [
    el('label', {}, [enabled, ' Включить ежемесячный приём показаний']),
    el('div', { class: 'form-row' }, [el('label', { class: 'field' }, ['Каждый месяц с числа', opens]), el('label', { class: 'field' }, ['По число включительно', closes])]),
    el('p', { class: 'field-help' }, 'Расписание повторяется автоматически. Исключение для месяца имеет приоритет. Время московское. Если указанного числа в месяце нет, используется последний день месяца.'), preview, status, submit,
  ]);
  const period = el('input', { type: 'month', required: true, disabled: true });
  const exceptionEnabled = el('input', { type: 'checkbox', disabled: true });
  const from = el('input', { type: 'date', required: true, disabled: true });
  const to = el('input', { type: 'date', required: true, disabled: true });
  const exceptionStatus = el('p', { role: 'status' });
  const exceptionSave = el('button', { type: 'submit', class: 'btn', disabled: true }, 'Сохранить исключение');
  const reset = el('button', { type: 'button', class: 'btn btn-ghost', disabled: true }, 'Вернуть обычное расписание');
  const exceptionForm = el('form', { class: 'form' }, [
    el('label', { class: 'field' }, ['Месяц', period]),
    el('label', {}, [exceptionEnabled, ' Разрешить приём в этом месяце']),
    el('div', { class: 'form-row' }, [el('label', { class: 'field' }, ['С даты', from]), el('label', { class: 'field' }, ['По дату включительно', to])]),
    el('p', { class: 'field-help' }, 'Исключение меняет приём только для выбранного месяца. Снимите галочку, чтобы закрыть приём за этот месяц.'),
    exceptionStatus, el('div', { class: 'header-actions' }, [exceptionSave, reset]),
  ]);
  const details = el('details', {}, [el('summary', {}, 'Исключение для отдельного месяца'), exceptionForm]);
  const modal = openModal({ title: 'Приём показаний', content: el('div', {}, [form, details]) });
  let current = null;
  let busy = false;
  const inputs = [enabled, opens, closes, submit, period, exceptionEnabled, from, to, exceptionSave, reset];
  function controls() { for (const input of inputs) input.disabled = !current || busy; }
  function defaultsForMonth() {
    if (!period.value || !current) return;
    const override = current.overrides.find((w) => w.period.slice(0, 7) === period.value);
    const [year, month] = period.value.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const d = (day) => `${period.value}-${String(Math.min(day, last)).padStart(2, '0')}`;
    from.value = override?.opens_on || d(current.opens_day);
    to.value = override?.closes_on || d(current.closes_day);
    exceptionEnabled.checked = override ? override.enabled : current.enabled;
    exceptionStatus.textContent = override ? 'Для этого месяца действует исключение.' : 'Применяется обычное расписание.';
  }
  function draw() {
    enabled.checked = current.enabled; opens.value = current.opens_day; closes.value = current.closes_day;
    const w = current.current_window;
    preview.textContent = w.enabled ? `Текущий месяц: ${formatDate(w.opens_on)} — ${formatDate(w.closes_on)}.` : 'В текущем месяце приём отключён.';
    if (!period.value) period.value = w.period.slice(0, 7);
    defaultsForMonth(); controls();
  }
  async function refresh() { current = await client.get(`/api/v1/resident-schedules/${building.id}`); draw(); }
  try { await refresh(); }
  catch { status.textContent = 'Не удалось загрузить настройки. Закройте окно и повторите попытку.'; }
  period.addEventListener('change', defaultsForMonth);
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy || !current) return;
    if (Number(closes.value) < Number(opens.value)) { status.textContent = 'Окончание не может быть раньше начала.'; return; }
    const body = { enabled: enabled.checked, opens_day: Number(opens.value), closes_day: Number(closes.value) };
    busy = true; controls(); status.textContent = '';
    try { current = await client.put(`/api/v1/resident-schedules/${building.id}`, body); draw(); toast.success('Ежемесячное расписание сохранено'); }
    catch { status.textContent = 'Не удалось сохранить расписание.'; }
    finally { busy = false; controls(); }
  });
  exceptionForm.addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy || !current) return;
    if (to.value < from.value) { exceptionStatus.textContent = 'Окончание не может быть раньше начала.'; return; }
    const body = { period: `${period.value}-01`, enabled: exceptionEnabled.checked, opens_on: from.value, closes_on: to.value };
    busy = true; controls();
    try { await client.put(`/api/v1/resident-windows/${building.id}`, body); await refresh(); toast.success('Исключение сохранено'); }
    catch { exceptionStatus.textContent = 'Не удалось сохранить исключение.'; }
    finally { busy = false; controls(); }
  });
  reset.addEventListener('click', async () => {
    if (!period.value || busy || !current) return;
    busy = true; controls();
    try { await client.delete(`/api/v1/resident-windows/${building.id}?period=${encodeURIComponent(period.value)}`); await refresh(); toast.success('Обычное расписание восстановлено'); }
    catch { exceptionStatus.textContent = 'Не удалось удалить исключение.'; }
    finally { busy = false; controls(); }
  });
  return modal;
}
