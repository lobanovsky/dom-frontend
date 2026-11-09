import { residentAccessApi } from '../api/resources.js';
import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { personName } from '../lib/format.js';
import { residentAccessStatusView } from './residentAccessStatus.js';

// Подтверждение контакта выполняет сотрудник после проверки личности собственника.
export async function openResidentAccess(person, { onSaved } = {}) {
  const primaryEmail = (person.emails || []).find((value) => value.trim()) || '';
  const email = el('input', { type: 'email', readonly: true, value: primaryEmail, autocomplete: 'off', disabled: true });
  const enabled = el('input', { type: 'checkbox', disabled: true });
  const status = el('p', { role: 'alert' });
  const summary = el('div', { 'aria-live': 'polite' });
  const save = el('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Сохранить');
  const invite = el('button', { type: 'button', class: 'btn', disabled: true }, 'Сохранить и отправить приглашение');
  let registered = false;
  let loaded = false;
  let busy = false;
  function syncButtons() {
    email.disabled = !loaded || busy;
    enabled.disabled = !loaded || busy;
    save.disabled = !loaded || busy;
    invite.hidden = registered;
    invite.disabled = !loaded || busy || !enabled.checked;
  }
  const form = el('form', { class: 'form' }, [
    el('p', {}, 'Подтверждайте доступ после проверки личности и принадлежности почты. Один адрес может использоваться только для одного кабинета.'),
    summary,
    el('label', { class: 'field' }, [el('span', {}, 'Почта для входа'), email]),
    el('p', { class: 'field-help' }, 'Адрес для входа выбирается в карточке физлица.'),
    el('label', {}, [enabled, ' Разрешить личный кабинет']),
    el('p', { class: 'field-help' }, '«Сохранить» изменяет разрешение без письма. Для первой регистрации можно сохранить доступ и отправить приглашение со ссылкой для установки пароля.'),
    status,
    el('div', { class: 'header-actions' }, [save, invite]),
  ]);
  const modal = openModal({ title: `Личный кабинет: ${personName(person)}`, content: form });
  enabled.addEventListener('change', syncButtons);
  try {
    const state = await residentAccessApi.get(person.id);
    enabled.checked = state.enabled;
    registered = state.registered;
    email.disabled = false;
    summary.replaceChildren(residentAccessStatusView(state));
    if (registered) summary.append(el('p', { class: 'field-help' }, 'Аккаунт уже зарегистрирован. Если пароль забыт, собственник может восстановить его на странице входа.'));
    loaded = true;
    syncButtons();
  } catch { status.textContent = 'Не удалось загрузить настройки. Закройте окно и повторите попытку.'; }
  async function send(withInvite) {
    if (!loaded || busy || !form.reportValidity()) return;
    busy = true; syncButtons(); status.textContent = '';
    try {
      const body = { email: email.value.trim(), enabled: enabled.checked };
      if (!body.email) { status.textContent = 'Добавьте email в профиль физлица и выберите его для кабинета.'; return; }
      if (withInvite && !body.enabled) { status.textContent = 'Для приглашения разрешите личный кабинет.'; return; }
      if (withInvite) await residentAccessApi.invite(person.id, { email: body.email });
      else await residentAccessApi.update(person.id, body);
      toast.success(withInvite ? 'Доступ сохранён. Приглашение поставлено в очередь отправки.' : 'Настройки личного кабинета сохранены');
      modal.close();
      await onSaved?.();
    } catch (e) {
      status.textContent = e.message.includes('resident email must be listed') ? 'Для входа можно использовать только адрес из профиля физлица. Сначала обновите профиль.'
        : e.message.includes('resident_access_email_key') ? 'Эта почта уже подтверждена для другого физлица.'
        : e.message.includes('account email cannot be changed') ? 'У кабинета уже есть другой логин. Здесь можно отключить доступ; смена логина требует отдельной процедуры.'
        : e.status === 503 ? 'Исходящая почта пока не настроена. Можно сохранить доступ без приглашения.' : 'Не удалось сохранить настройки. Проверьте данные и повторите попытку.';
    } finally { busy = false; syncButtons(); }
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); send(false); });
  invite.addEventListener('click', () => send(true));
}
