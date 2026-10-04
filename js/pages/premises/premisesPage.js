import { el } from '../../lib/dom.js';
import { renderTable } from '../../ui/table.js';
import { openEntityForm } from '../../ui/entityForm.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { toast } from '../../ui/toast.js';
import { goTo } from '../../state/nav.js';
import {
  premisesApi, buildingsApi, ownershipsApi, residenciesApi, accountsApi, accountHoldersApi, personsApi, legalEntitiesApi,
} from '../../api/resources.js';
import {
  premisesFields, ownershipFields, residencyFields, accountFields, accountHolderFields, ownerKindOf,
} from '../fields.js';
import { premisesKinds, relations, accountPurposes, accountStatuses, label } from '../../lib/labels.js';
import { formatArea, formatDate, formatPeriod, formatShare, personName, isActiveOn, todayIso } from '../../lib/format.js';
import { activeShareSum, describeShareSum } from '../../lib/shares.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { notFoundView, definitionList } from '../common.js';

// Карточка помещения: сведения, собственники с долями, жители, лицевые счета
// с плательщиками. Каждый блок перезагружается сам после изменений.
export async function premisesPage(container, { id }) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let premises;
  let building;
  try {
    premises = await premisesApi.get(id);
    building = await buildingsApi.get(premises.building_id);
  } catch (err) {
    container.replaceChildren(notFoundView(describeApiError(err).message, '/buildings', 'К списку домов'));
    return;
  }

  const today = todayIso();
  const names = createNameCache();

  const title = el('h1', {});
  const info = el('div', { class: 'card' });
  const ownersBody = el('div', {});
  const residentsBody = el('div', {});
  const accountsBody = el('div', {});

  function renderInfo() {
    title.textContent = `${label(premisesKinds, premises.kind)} № ${premises.number}`;
    info.replaceChildren(definitionList([
      ['Адрес', building.address],
      ['Подъезд', premises.entrance],
      ['Этаж', premises.floor],
      ['Общая площадь', formatArea(premises.total_area)],
      ['Жилая площадь', formatArea(premises.living_area)],
      ['Комнат', premises.rooms],
      ['Кадастровый номер', premises.cadastral_number],
    ]));
  }

  function editPremises() {
    openEntityForm({
      title: 'Помещение: редактирование',
      fields: premisesFields,
      entity: premises,
      fixed: { building_id: premises.building_id },
      save: (body) => premisesApi.update(premises.id, body),
      onSaved: (saved) => { premises = saved; renderInfo(); },
    });
  }

  async function removePremises() {
    const ok = await confirmDialog({ title: 'Удаление', message: `Удалить помещение № ${premises.number}? Удалить можно только помещение без собственников, жителей и счетов.`, confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    if (await removeWithToast(() => premisesApi.remove(premises.id), 'Помещение удалено')) goTo(`/buildings/${building.id}`);
  }

  // --- Собственники ---

  async function loadOwners() {
    try {
      const { items } = await premisesApi.ownerships(premises.id);
      const sum = activeShareSum(items, today);
      ownersBody.replaceChildren(
        el('p', { class: sum.num > sum.den ? 'section-note section-note--warning' : 'section-note' }, `Доли на сегодня: ${describeShareSum(sum)}`),
        renderTable({
          columns: [
            { key: 'owner', label: 'Собственник', primary: true, render: (r) => [r.owner_name, r.owner_kind === 'legal_entity' ? el('span', { class: 'badge badge-neutral' }, 'юрлицо') : null] },
            { key: 'share', label: 'Доля', render: (r) => formatShare(r.share_num, r.share_den) },
            { key: 'period', label: 'Период', render: (r) => periodCell(r.valid_from, r.valid_to) },
            { key: 'basis', label: 'Основание' },
          ],
          rows: items,
          emptyMessage: 'Собственники не указаны',
          rowActions: (r) => [
            editButton(() => ownershipForm(r)),
            deleteButton(() => removeRow(`Удалить запись о собственности «${r.owner_name}»?`, () => ownershipsApi.remove(r.id), loadOwners)),
          ],
        }),
      );
    } catch (err) {
      ownersBody.replaceChildren(errorStatus(err));
    }
  }

  function ownershipForm(row) {
    openEntityForm({
      title: row ? 'Собственник: редактирование' : 'Новый собственник',
      fields: ownershipFields,
      watch: ['owner_kind'],
      entity: row,
      initialValues: row ? { owner_kind: ownerKindOf(row) } : { owner_kind: 'person', share_num: '1', share_den: '1', valid_from: today },
      fixed: { premises_id: premises.id },
      save: (body) => (row ? ownershipsApi.update(row.id, body) : ownershipsApi.create(body)),
      onSaved: loadOwners,
    });
  }

  // --- Жители ---

  async function loadResidents() {
    try {
      const { items } = await residenciesApi.list({ premises_id: premises.id, limit: 200 });
      await names.preload(items.flatMap((r) => [['person', r.person_id], ['person', r.related_owner_id]]));
      residentsBody.replaceChildren(renderTable({
        columns: [
          { key: 'person', label: 'Житель', primary: true, render: (r) => names.get('person', r.person_id) },
          { key: 'relation', label: 'Кем приходится', render: (r) => relationText(r) },
          { key: 'registered', label: 'Регистрация', render: (r) => (r.registered ? 'Прописан' : 'Проживает без прописки') },
          { key: 'period', label: 'Период', render: (r) => periodCell(r.valid_from, r.valid_to) },
        ],
        rows: items,
        emptyMessage: 'Жители не указаны',
        rowActions: (r) => [
          editButton(() => residencyForm(r)),
          deleteButton(() => removeRow(`Удалить запись о проживании «${names.get('person', r.person_id)}»?`, () => residenciesApi.remove(r.id), loadResidents)),
        ],
      }));
    } catch (err) {
      residentsBody.replaceChildren(errorStatus(err));
    }
  }

  function relationText(r) {
    const rel = label(relations, r.relation);
    return r.related_owner_id ? `${rel} — ${names.get('person', r.related_owner_id)}` : rel;
  }

  function residencyForm(row) {
    openEntityForm({
      title: row ? 'Житель: редактирование' : 'Новый житель',
      fields: residencyFields,
      entity: row,
      initialValues: row ? {} : { relation: 'other', valid_from: today },
      fixed: { premises_id: premises.id },
      save: (body) => (row ? residenciesApi.update(row.id, body) : residenciesApi.create(body)),
      onSaved: loadResidents,
    });
  }

  // --- Лицевые счета и плательщики ---

  async function loadAccounts() {
    try {
      const { items } = await premisesApi.accounts(premises.id);
      accountsBody.replaceChildren(items.length
        ? el('div', { class: 'account-list' }, items.map(renderAccount))
        : el('div', { class: 'data-table-wrap' }, el('div', { class: 'table-status' }, 'Лицевых счетов нет')));
    } catch (err) {
      accountsBody.replaceChildren(errorStatus(err));
    }
  }

  function renderAccount(account) {
    const holdersBody = el('div', { class: 'account-holders' });
    holdersBody.hidden = true;
    const toggle = el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', 'aria-expanded': 'false',
      onclick: () => {
        holdersBody.hidden = !holdersBody.hidden;
        toggle.setAttribute('aria-expanded', String(!holdersBody.hidden));
        toggle.textContent = holdersBody.hidden ? 'Плательщики' : 'Скрыть плательщиков';
        if (!holdersBody.hidden) loadHolders(account, holdersBody);
      },
    }, 'Плательщики');

    return el('div', { class: 'card account-card' }, [
      el('div', { class: 'account-card-header' }, [
        el('div', {}, [
          el('div', { class: 'account-number' }, `№ ${account.number}`),
          el('div', { class: 'account-meta' }, [
            label(accountPurposes, account.purpose), ' · ',
            el('span', { class: account.status === 'active' ? 'badge badge-success' : 'badge badge-neutral' }, label(accountStatuses, account.status)), ' · ',
            account.closed_at ? `${formatDate(account.opened_at)} — ${formatDate(account.closed_at)}` : `открыт ${formatDate(account.opened_at)}`,
          ]),
          el('div', { class: 'account-holder' }, account.holder_name ? `Плательщик: ${account.holder_name}` : 'Плательщик не указан'),
        ]),
        el('div', { class: 'row-actions' }, [
          toggle,
          editButton(() => accountForm(account)),
          deleteButton(() => removeRow(`Удалить лицевой счёт № ${account.number}? Удалить можно только счёт без плательщиков.`, () => accountsApi.remove(account.id), loadAccounts)),
        ]),
      ]),
      holdersBody,
    ]);
  }

  async function loadHolders(account, host) {
    host.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
    const reload = () => { loadHolders(account, host); loadAccounts(); };
    try {
      const { items } = await accountHoldersApi.list({ account_id: account.id, limit: 200 });
      await names.preload(items.map((h) => (h.person_id ? ['person', h.person_id] : ['legal_entity', h.legal_entity_id])));
      host.replaceChildren(
        renderTable({
          columns: [
            { key: 'holder', label: 'Плательщик', primary: true, render: (h) => holderName(h) },
            { key: 'period', label: 'Период', render: (h) => periodCell(h.valid_from, h.valid_to) },
          ],
          rows: items,
          emptyMessage: 'Плательщики не указаны',
          rowActions: (h) => [
            editButton(() => holderForm(account, h, reload)),
            deleteButton(() => removeRow(`Удалить плательщика «${holderName(h)}»?`, () => accountHoldersApi.remove(h.id), reload)),
          ],
        }),
        el('div', { class: 'form-actions' }, el('button', { type: 'button', class: 'btn btn-sm', onclick: () => holderForm(account, null, reload) }, '+ Добавить плательщика')),
      );
    } catch (err) {
      host.replaceChildren(errorStatus(err));
    }
  }

  function holderName(h) {
    return h.person_id ? names.get('person', h.person_id) : names.get('legal_entity', h.legal_entity_id);
  }

  function holderForm(account, row, onSaved) {
    openEntityForm({
      title: row ? 'Плательщик: редактирование' : `Новый плательщик по счёту № ${account.number}`,
      fields: accountHolderFields,
      watch: ['owner_kind'],
      entity: row,
      initialValues: row ? { owner_kind: ownerKindOf(row) } : { owner_kind: 'person', valid_from: today },
      fixed: { account_id: account.id },
      save: (body) => (row ? accountHoldersApi.update(row.id, body) : accountHoldersApi.create(body)),
      onSaved,
    });
  }

  function accountForm(account) {
    openEntityForm({
      title: account ? 'Лицевой счёт: редактирование' : 'Новый лицевой счёт',
      fields: accountFields,
      entity: account,
      initialValues: account ? {} : { purpose: 'utilities', status: 'active', opened_at: today },
      fixed: { premises_id: premises.id },
      save: (body) => (account ? accountsApi.update(account.id, body) : accountsApi.create(body)),
      onSaved: loadAccounts,
    });
  }

  // --- Общие мелочи ---

  function periodCell(from, to) {
    const active = isActiveOn(from, to, today);
    return el('span', { class: active ? '' : 'text-muted' }, [formatPeriod(from, to), active ? null : ' (в прошлом)']);
  }

  renderInfo();
  container.replaceChildren(el('div', { class: 'page' }, [
    el('nav', { class: 'breadcrumbs' }, [
      el('a', { href: '/buildings' }, 'Дома'), ' / ',
      el('a', { href: `/buildings/${building.id}` }, building.address), ' /',
    ]),
    el('div', { class: 'section-header' }, [
      title,
      el('div', { class: 'header-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: editPremises }, 'Изменить'),
        el('button', { type: 'button', class: 'btn btn-ghost btn-danger-text', onclick: removePremises }, 'Удалить'),
      ]),
    ]),
    info,
    section('Собственники', 'Добавить собственника', () => ownershipForm(null), ownersBody),
    section('Жители', 'Добавить жителя', () => residencyForm(null), residentsBody),
    section('Лицевые счета', 'Открыть счёт', () => accountForm(null), accountsBody),
  ]));

  loadOwners();
  loadResidents();
  loadAccounts();
}

function section(titleText, addLabel, onAdd, body) {
  return el('section', { class: 'page-section' }, [
    el('div', { class: 'section-header section-header--sub' }, [
      el('h2', {}, titleText),
      el('button', { type: 'button', class: 'btn btn-primary btn-add', onclick: onAdd }, addLabel),
    ]),
    body,
  ]);
}

function editButton(onclick) {
  return el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick }, 'Изменить');
}

function deleteButton(onclick) {
  return el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-danger-text', onclick }, 'Удалить');
}

function errorStatus(err) {
  return el('div', { class: 'data-table-wrap' }, el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
}

async function removeWithToast(call, message) {
  try {
    await call();
    toast.success(message);
    return true;
  } catch (err) {
    if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err, { action: 'delete' }).message);
    return false;
  }
}

async function removeRow(message, call, reload) {
  const ok = await confirmDialog({ title: 'Удаление', message, confirmLabel: 'Удалить', danger: true });
  if (ok && (await removeWithToast(call, 'Удалено'))) reload();
}

// Кэш имён физлиц и юрлиц на время жизни страницы: жители и плательщики
// приходят только с id.
function createNameCache() {
  const cache = new Map();
  const apis = { person: personsApi, legal_entity: legalEntitiesApi };
  const toName = { person: personName, legal_entity: (l) => l.name };

  async function preload(refs) {
    const missing = [...new Set(refs.filter(([, id]) => id).map(([kind, id]) => `${kind}:${id}`))].filter((k) => !cache.has(k));
    await Promise.all(missing.map(async (key) => {
      const [kind, id] = key.split(':');
      try {
        cache.set(key, toName[kind](await apis[kind].get(id)));
      } catch {
        cache.set(key, `#${id}`);
      }
    }));
  }

  return { preload, get: (kind, id) => cache.get(`${kind}:${id}`) || `#${id}` };
}
