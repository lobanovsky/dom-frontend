import { client } from '../api/client.js';
import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

export async function openResidentWindow(building) {
  const period = el('input', { type: 'month', required: true });
  const opens = el('input', { type: 'date', required: true });
  const closes = el('input', { type: 'date', required: true });
  const status = el('p', { role: 'alert' });
  const submit = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Сохранить');
  const form = el('form', { class: 'form' }, [el('p', {}, 'Настройка действует для индивидуальных счётчиков всех помещений этого дома. Даты включительно, часовой пояс — Москва. Для закрытия приёма укажите прошедшую дату окончания.'), el('label', {}, ['Расчётный месяц', period]), el('label', {}, ['Начало приёма', opens]), el('label', {}, ['Окончание приёма', closes]), status, submit]);
  const modal = openModal({ title: 'Приём показаний в личном кабинете', content: form });
  try {
    const current = await client.get(`/api/v1/resident-windows/${building.id}`);
    if (current) { period.value = current.period.slice(0, 7); opens.value = current.opens_on; closes.value = current.closes_on; }
  } catch { status.textContent = 'Не удалось загрузить настройку. Повторите попытку.'; submit.disabled = true; }
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (closes.value < opens.value) { status.textContent = 'Окончание не может быть раньше начала.'; return; }
    submit.disabled = true;
    try {
      await client.put(`/api/v1/resident-windows/${building.id}`, { period: `${period.value}-01`, opens_on: opens.value, closes_on: closes.value });
      toast.success('Период приёма сохранён'); modal.close();
    } catch { status.textContent = 'Не удалось сохранить период приёма.'; } finally { submit.disabled = false; }
  });
}
