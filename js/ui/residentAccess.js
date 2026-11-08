import { client } from '../api/client.js';
import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { personName } from '../lib/format.js';

// Подтверждение контакта выполняет сотрудник после проверки личности собственника.
export async function openResidentAccess(person) {
  const email = el('input', { type: 'email', required: true, autocomplete: 'off', maxlength: 254 });
  email.value = person.emails?.[0] || '';
  const enabled = el('input', { type: 'checkbox' }); enabled.checked = true;
  const status = el('p', { role: 'alert' });
  const save = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Сохранить доступ');
  const invite = el('button', { type: 'button', class: 'btn' }, 'Подтвердить и пригласить');
  const form = el('form', { class: 'form' }, [
    el('p', {}, 'Подтверждайте доступ только после проверки личности и принадлежности почты. Семейный адрес нельзя использовать для нескольких кабинетов.'),
    el('label', {}, ['Почта для входа', email]), el('label', {}, [enabled, ' Доступ разрешён']), status,
    el('div', { class: 'header-actions' }, [save, invite]),
  ]);
  const modal = openModal({ title: `Личный кабинет: ${personName(person)}`, content: form });
  try {
    const state = await client.get(`/api/v1/resident-access/${person.id}`);
    if (state.email) email.value = state.email;
    enabled.checked = state.enabled;
  } catch { status.textContent = 'Не удалось загрузить настройки. Закройте окно и повторите попытку.'; save.disabled = true; invite.disabled = true; }
  async function send(withInvite) {
    if (!form.reportValidity()) return;
    save.disabled = true; invite.disabled = true; status.textContent = '';
    try {
      const body = { email: email.value.trim(), enabled: enabled.checked };
      if (withInvite && !body.enabled) { status.textContent = 'Для приглашения разрешите доступ.'; return; }
      if (withInvite) await client.post(`/api/v1/resident-access/${person.id}/invite`, { email: body.email });
      else await client.put(`/api/v1/resident-access/${person.id}`, body);
      toast.success(withInvite ? 'Доступ сохранён. Для нового кабинета письмо поставлено в очередь; для существующего используйте восстановление пароля.' : 'Доступ сохранён'); modal.close();
    } catch (e) {
      status.textContent = e.message.includes('resident_access_email_key') ? 'Эта почта уже подтверждена для другого физлица.'
        : e.message.includes('account email cannot be changed') ? 'У кабинета уже есть другой логин. Здесь можно отключить доступ; смена логина требует отдельной процедуры.'
        : e.status === 503 ? 'Исходящая почта пока не настроена. Можно сохранить доступ без приглашения.' : 'Не удалось сохранить доступ. Проверьте данные и повторите попытку.';
    } finally { save.disabled = false; invite.disabled = false; }
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); send(false); });
  invite.addEventListener('click', () => send(true));
}
