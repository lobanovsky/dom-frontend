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
  const ownerHelp = el('p', { class: 'field-help', hidden: true }, 'Разрешить личный кабинет можно только действующему собственнику.');
  const save = el('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, 'Сохранить');
  const invite = el('button', { type: 'button', class: 'btn', disabled: true }, 'Сохранить и отправить приглашение');
  const password = el('input', { type: 'password', autocomplete: 'new-password', maxlength: 72 });
  const passwordRepeat = el('input', { type: 'password', autocomplete: 'new-password', maxlength: 72 });
  const setPassword = el('button', { type: 'button', class: 'btn', disabled: true }, 'Задать пароль');
  const passwordSection = el('section', { class: 'resident-password-section', hidden: true }, [
    el('p', { class: 'field-help' }, 'Это создаст кабинет или задаст новый пароль и включит доступ. Передайте пароль жителю лично; он сможет сменить его в любое время в профиле кабинета.'),
    el('label', { class: 'field' }, [el('span', {}, 'Пароль (не короче 8 символов)'), password]),
    el('label', { class: 'field' }, [el('span', {}, 'Повторите пароль'), passwordRepeat]),
    setPassword,
  ]);
  let registered = false;
  let eligible = false;
  let loaded = false;
  let busy = false;
  function syncButtons() {
    email.disabled = !loaded || busy;
    enabled.disabled = !loaded || busy || (!eligible && !enabled.checked);
    save.disabled = !loaded || busy;
    invite.hidden = registered;
    invite.disabled = !loaded || busy || !enabled.checked || !eligible;
    password.disabled = !loaded || busy || !eligible;
    passwordRepeat.disabled = !loaded || busy || !eligible;
    setPassword.disabled = !loaded || busy || !eligible || !email.value.trim();
  }
  const form = el('form', { class: 'form' }, [
    el('p', {}, 'Подтверждайте доступ после проверки личности и принадлежности почты. Один адрес может использоваться только для одного кабинета.'),
    summary,
    el('label', { class: 'field' }, [el('span', {}, 'Почта для входа'), email]),
    el('p', { class: 'field-help' }, 'Адрес для входа выбирается в карточке физлица.'),
    el('label', {}, [enabled, ' Разрешить личный кабинет']),
    el('p', { class: 'field-help' }, '«Сохранить» изменяет разрешение без письма. Для первой регистрации можно сохранить доступ и отправить приглашение со ссылкой для установки пароля.'),
    ownerHelp,
    passwordSection,
    status,
    el('div', { class: 'header-actions' }, [save, invite]),
  ]);
  const modal = openModal({ title: `Личный кабинет: ${personName(person)}`, content: form });
  enabled.addEventListener('change', syncButtons);
  try {
    const state = await residentAccessApi.get(person.id);
    email.value = state.email || primaryEmail;
    enabled.checked = state.enabled;
    registered = state.registered;
    eligible = state.eligible;
    ownerHelp.hidden = eligible;
    passwordSection.hidden = !eligible;
    email.disabled = false;
    summary.replaceChildren(residentAccessStatusView(state));
    if (registered) summary.append(el('p', { class: 'field-help' }, 'Аккаунт уже зарегистрирован. Если пароль забыт, собственник может восстановить его на странице входа.'));
    setPassword.textContent = registered ? 'Задать новый пароль и включить доступ' : 'Создать кабинет и включить доступ';
    loaded = true;
    syncButtons();
  } catch { status.textContent = 'Не удалось загрузить настройки. Закройте окно и повторите попытку.'; }
  async function send(withInvite) {
    if (!loaded || busy || !form.reportValidity()) return;
    busy = true; syncButtons(); status.textContent = '';
    try {
      const body = { email: email.value.trim(), enabled: enabled.checked };
      if (!body.email) { status.textContent = 'Добавьте email в профиль физлица и выберите его для кабинета.'; return; }
      if (body.enabled && !eligible) { status.textContent = 'Личный кабинет доступен только действующим собственникам.'; return; }
      if (withInvite && !body.enabled) { status.textContent = 'Для приглашения разрешите личный кабинет.'; return; }
      if (withInvite) await residentAccessApi.invite(person.id, { email: body.email });
      else await residentAccessApi.update(person.id, body);
      toast.success(withInvite ? 'Доступ сохранён. Приглашение поставлено в очередь отправки.' : 'Настройки личного кабинета сохранены');
      modal.close();
      await onSaved?.();
    } catch (e) {
      status.textContent = e.message.includes('resident email must be listed') ? 'Для входа можно использовать только адрес из профиля физлица. Сначала обновите профиль.'
        : e.message.includes('resident access can only be enabled for current owners') ? 'Личный кабинет доступен только действующим собственникам.'
        : e.message.includes('resident_access_email_key') ? 'Эта почта уже подтверждена для другого физлица.'
        : e.message.includes('account email cannot be changed') ? 'У кабинета уже есть другой логин. Здесь можно отключить доступ; смена логина требует отдельной процедуры.'
        : e.status === 503 ? 'Исходящая почта пока не настроена. Можно сохранить доступ без приглашения.' : 'Не удалось сохранить настройки. Проверьте данные и повторите попытку.';
    } finally { busy = false; syncButtons(); }
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); send(false); });
  invite.addEventListener('click', () => send(true));
  setPassword.addEventListener('click', async () => {
    if (!loaded || busy || !eligible) return;
    status.textContent = '';
    if (Array.from(password.value).length < 8) { status.textContent = 'Пароль должен содержать не менее 8 символов.'; password.focus(); return; }
    if (password.value !== passwordRepeat.value) { status.textContent = 'Пароли не совпадают.'; passwordRepeat.focus(); return; }
    busy = true; syncButtons();
    try {
      await residentAccessApi.setPassword(person.id, { email: email.value.trim(), password: password.value });
      toast.success(registered ? 'Пароль обновлён. Предыдущие сеансы завершены.' : 'Кабинет создан и доступ включён. Передайте пароль жителю.');
      password.value = ''; passwordRepeat.value = '';
      modal.close();
      await onSaved?.();
    } catch (e) {
      status.textContent = e.message.includes('resident email must be listed') ? 'Для входа можно использовать только основной email из профиля физлица. Сначала обновите профиль.'
        : e.message.includes('resident access can only be enabled for current owners') ? 'Личный кабинет доступен только действующим собственникам.'
        : e.message.includes('account email cannot be changed') ? 'У кабинета уже другой email для входа. Здесь нельзя изменить логин.'
        : e.message.includes('resident account is disabled') ? 'Аккаунт отключён. Включите доступ в поддержку системы.'
        : e.message.includes('resident_access_email_key') ? 'Эта почта уже подтверждена для другого физлица.'
        : e.message.includes('resident_accounts_email_key') ? 'Эта почта уже используется другим кабинетом.'
        : 'Не удалось задать пароль. Проверьте данные и повторите попытку.';
    } finally { busy = false; syncButtons(); }
  });
}
