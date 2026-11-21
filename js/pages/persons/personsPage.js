import { isAdmin } from '../../lib/permissions.js';
import { attachResidentAccess } from '../../lib/residentAccess.js';
import { residentAccessStatusView } from '../../ui/residentAccessStatus.js';
import { openResidentAccess } from '../../ui/residentAccess.js';
import { createCrudList } from '../../ui/crudList.js';
import { openPropertiesDialog } from '../../ui/propertiesDialog.js';
import { personsApi, residentAccessApi } from '../../api/resources.js';
import { personFields } from '../fields.js';
import { el } from '../../lib/dom.js';
import { saveFile } from '../../ui/saveFile.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { openModal } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { formatDate, formatPhone, personName } from '../../lib/format.js';

// Контакты по одному на строку; первый — основной (жирным, если их несколько).
function contactList(items, textOf = (s) => s) {
  if (!items || items.length === 0) return '';
  return el('div', { class: 'contact-list' }, items.map((item, i) => el('div', { class: i === 0 && items.length > 1 ? 'contact-primary' : null }, textOf(item))));
}

// Отчёт «физлица и их недвижимость» (квартиры → коммерческие → машиноместа); доступен и для просмотра.
async function downloadReport() {
  try {
    saveFile(await personsApi.propertiesReportPdf());
  } catch (err) {
    if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
  }
}

export function personsPage(container) {
  const admin = isAdmin();
  let invitingOwners = false;
  let inviteOwnersButton;
  const list = createCrudList({
    entityTitle: 'Физлицо',
    api: { ...personsApi, list: async (query) => {
      const result = await personsApi.list(query);
      return admin ? { ...result, items: await attachResidentAccess(result.items, residentAccessApi.list) } : result;
    } },
    fields: personFields,
    filters: [{ name: 'q', label: 'Поиск', type: 'search', placeholder: 'Фамилия, имя, телефон или email' }, ...(admin ? [{ name: 'resident_status', label: 'Личный кабинет', type: 'select', allLabel: 'Все статусы', options: [{ value: 'unissued', label: 'Не выдан' }, { value: 'approved', label: 'Разрешён' }, { value: 'registered', label: 'Зарегистрирован' }, { value: 'used', label: 'Входил' }, { value: 'disabled', label: 'Отключён' }, { value: 'unavailable', label: 'Вход недоступен' }] }] : [])],
    columns: [
      { key: 'name', label: 'ФИО', primary: true, render: personName },
      { key: 'birth_date', label: 'Дата рождения', render: (r) => formatDate(r.birth_date) },
      { key: 'phones', label: 'Телефоны', render: (r) => contactList(r.phones, formatPhone) },
      { key: 'emails', label: 'Email', render: (r) => contactList(r.emails) },
      ...(admin ? [{ key: 'resident_access', label: 'Личный кабинет', render: (r) => residentAccessStatusView(r.resident_access) }] : []),
    ],
    extraActions: (r) => r.resident_access?.eligible ? [el('button', {
      type: 'button',
      class: 'btn btn-ghost btn-sm',
      onclick: () => openPropertiesDialog({ title: `Недвижимость: ${personName(r)}`, load: () => personsApi.properties(r.id) }),
    }, 'Недвижимость'), el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => openResidentAccess(r, { onSaved: () => list.reload() }) }, 'Личный кабинет')] : [],
    emptyMessage: 'Физлиц не найдено',
    deleteMessage: (r) => `Удалить «${personName(r)}»?`,
  });

  async function inviteAllOwners() {
    if (invitingOwners) return;
    const confirmed = await confirmDialog({
      title: 'Пригласить собственников',
      message: 'Будут приглашены действующие собственники-физлица со статусом «Не выдан». Им включится разрешение на личный кабинет, а письмо придёт на основной email из профиля. Собственники без email и ранее отключённые кабинеты не затрагиваются.',
      confirmLabel: 'Пригласить',
    });
    if (!confirmed) return;
    invitingOwners = true;
    inviteOwnersButton.disabled = true;
    inviteOwnersButton.textContent = 'Ставим приглашения в очередь…';
    try {
      const result = await residentAccessApi.inviteOwners();
      const skipped = result.skipped || [];
      if (!result.invited && !skipped.length) toast.info('Действующих собственников без выданного доступа не найдено.');
      else toast.success(`Приглашений поставлено в очередь: ${result.invited}. Пропущено: ${skipped.length}.`);
      if (skipped.length) showInviteSkips(result.invited, skipped);
      await list.reload();
    } catch (err) {
      toast.error(describeApiError(err).message);
    } finally {
      invitingOwners = false;
      inviteOwnersButton.disabled = false;
      inviteOwnersButton.textContent = 'Пригласить собственников без доступа';
    }
  }

  function showInviteSkips(invited, skipped) {
    const reasons = {
      already_registered: 'аккаунт уже зарегистрирован',
      missing_email: 'в профиле не указан основной email',
      invalid_email: 'основной email указан некорректно',
      email_in_use: 'email уже используется другим кабинетом',
      no_longer_eligible: 'нет действующего права собственности',
    };
    openModal({
      title: 'Не приглашены',
      content: el('div', {}, [
        el('p', {}, `В очередь поставлено приглашений: ${invited}. Пропущено: ${skipped.length}.`),
        el('ul', {}, skipped.map((item) => el('li', {}, [el('strong', {}, item.name || `Физлицо № ${item.person_id}`), ` — ${reasons[item.reason] || 'не удалось пригласить'}`]))),
      ]),
    });
  }

  inviteOwnersButton = admin ? el('button', { type: 'button', class: 'btn', onclick: inviteAllOwners }, 'Пригласить собственников без доступа') : null;
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [el('h1', {}, 'Физлица'), el('div', { class: 'header-actions' }, [...(admin ? [inviteOwnersButton] : []), el('button', { type: 'button', class: 'btn', onclick: downloadReport }, 'Отчёт: физлица и недвижимость (PDF)')])]),
    list.element,
  ]));
}
