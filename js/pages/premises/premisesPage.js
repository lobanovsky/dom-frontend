import { el } from '../../lib/dom.js';
import { renderTable } from '../../ui/table.js';
import { deletedToggle } from '../../ui/crudList.js';
import { openEntityForm } from '../../ui/entityForm.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { toast } from '../../ui/toast.js';
import { goTo } from '../../state/nav.js';
import {
  premisesApi, buildingsApi, ownershipsApi, residenciesApi, accountsApi, accountHoldersApi, personsApi, legalEntitiesApi,
  incomingPaymentsApi,
} from '../../api/resources.js';
import {
  premisesFields, ownershipFields, residencyFields, accountFields, accountHolderFields, ownerKindOf,
} from '../fields.js';
import { premisesKinds, relations, accountPurposes, accountStatuses, label, kindRules } from '../../lib/labels.js';
import { formatArea, formatDate, formatMoney, formatPeriod, formatShare, formatTime, personName, isActiveOn, todayIso, registryLabel } from '../../lib/format.js';
import { activeShareSum, describeShareSum } from '../../lib/shares.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { canWrite } from '../../lib/permissions.js';
import { createMetersList } from '../meters/metersList.js';
import { createAccountServices } from '../accounts/accountServices.js';
import { openCalculationDialog } from '../../ui/calculationDialog.js';
import { openPersonCard } from '../../ui/personCard.js';
import { openModal } from '../../ui/modal.js';
import { groupPeople } from '../../lib/people.js';
import { notFoundView, definitionList, deletedBanner } from '../common.js';
import { buildingLabel } from '../../lib/buildings.js';

// Карточка помещения: сведения, люди (собственники с долями и жители в одной таблице), лицевые счета
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
  // Какие блоки сейчас показывают удалённые записи («корзину»).
  const showDeleted = { accounts: false };

  // Виды помещений с правилом «проживающих не бывает» (машиноместо) показываются без блока жителей.
  const hasResidents = !kindRules(premises.kind).noResidents;
  const title = el('h1', {});
  const info = el('div', { class: 'card' });
  const peopleBody = el('div', {});
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

  if (premises.deleted_at) {
    renderInfo();
    container.replaceChildren(el('div', { class: 'page' }, [
      el('nav', { class: 'breadcrumbs' }, [el('a', { href: '/buildings' }, 'Дома'), ' / ', el('a', { href: `/buildings/${building.id}` }, buildingLabel(building)), ' /']),
      el('div', { class: 'section-header' }, title),
      deletedBanner({
        deletedAt: premises.deleted_at,
        onRestore: async () => {
          if (await restoreWithToast(() => premisesApi.restore(premises.id))) premisesPage(container, { id });
        },
      }),
      info,
    ]));
    return;
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
    const ok = await confirmDialog({ title: 'Удаление', message: `Удалить помещение № ${premises.number}? Удалить можно только помещение без собственников, жителей и счетов. Помещение попадёт в «Удалённые», его можно будет восстановить.`, confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    if (await removeWithToast(() => premisesApi.remove(premises.id), 'Помещение удалено. Восстановить можно в списке помещений дома')) goTo(`/buildings/${building.id}`);
  }

  // Имя физлица, по клику — карточка с контактами; после правки обновляем имена и блоки страницы.
  function personLink(personId, text) {
    return el('button', {
      type: 'button',
      class: 'link-button',
      title: 'Открыть карточку',
      onclick: () => openPersonCard(personId, {
        onChanged: (saved) => {
          names.set('person', personId, personName(saved));
          loadPeople();
          loadAccounts();
        },
      }),
    }, text);
  }

  // --- Люди: собственники и жители в одной таблице, собственники сверху и выделены ---

  const TABS = [['current', 'Сейчас'], ['history', 'История'], ...(canWrite() ? [['deleted', 'Удалённые']] : [])];
  let peopleTab = 'current';
  const tabsBar = el('div', { class: 'segmented', role: 'tablist' });

  function renderTabs() {
    tabsBar.replaceChildren(...TABS.map(([tab, text]) => el('button', {
      type: 'button', role: 'tab', class: tab === peopleTab ? 'segmented-item is-active' : 'segmented-item', 'aria-selected': String(tab === peopleTab),
      onclick: () => { if (tab === peopleTab) return; peopleTab = tab; renderTabs(); loadPeople(); },
    }, text)));
  }

  async function loadPeople() {
    const deleted = peopleTab === 'deleted';
    try {
      const [{ items: ownerships }, { items: residencies }] = await Promise.all([
        premisesApi.ownerships(premises.id, deleted ? { deleted: 'only' } : undefined),
        hasResidents ? residenciesApi.list({ premises_id: premises.id, deleted: deleted ? 'only' : undefined, limit: 200 }) : { items: [] },
      ]);
      await names.preload(residencies.flatMap((r) => [['person', r.person_id], ['person', r.related_owner_id]]));
      const nameOfRow = (row) => (row.ownerName || names.get('person', row.personId));
      const rows = groupPeople(ownerships, residencies, { tab: peopleTab, day: today, nameOf: nameOfRow });
      const sum = activeShareSum(ownerships, today);
      const emptyMessages = { current: 'Сейчас никого нет', history: 'Прошлых записей нет', deleted: 'Удалённых записей нет' };
      // replaceChildren превращает null в текст «null», поэтому пустые узлы отфильтровываем.
      peopleBody.replaceChildren(...[
        peopleTab === 'current' ? el('p', { class: sum.num > sum.den ? 'section-note section-note--warning' : 'section-note' }, `Доли на сегодня: ${describeShareSum(sum)}`) : null,
        renderTable({
          columns: [
            { key: 'person', label: 'Человек', primary: true, render: (row) => personCell(row, nameOfRow(row)) },
            { key: 'ownership', label: 'Владение', render: (row) => ownershipCell(row) },
            ...(hasResidents ? [{ key: 'residency', label: 'Проживание', render: (row) => residencyCell(row) }] : []),
          ],
          rows,
          getRowKey: (row) => row.key,
          rowClass: (row) => (row.ownerships.some((o) => isActiveOn(o.valid_from, o.valid_to, today)) ? 'person-row--owner' : ''),
          emptyMessage: emptyMessages[peopleTab],
        }),
      ].filter(Boolean));
      peopleBody.classList.toggle('crud-table--deleted', deleted);
    } catch (err) {
      peopleBody.replaceChildren(errorStatus(err));
    }
  }

  function personCell(row, text) {
    const name = row.personId ? personLink(row.personId, text) : text;
    return [name, row.ownerKind === 'legal_entity' ? el('span', { class: 'badge badge-neutral' }, 'юрлицо') : null];
  }

  // Кнопки одной записи (собственности или проживания): изменить/удалить, на вкладке «Удалённые» — восстановить.
  function recordButtons({ edit, remove, restore }) {
    if (!canWrite()) return null;
    return peopleTab === 'deleted'
      ? restoreButton(restore)
      : [editButton(edit), deleteButton(remove)];
  }

  function ownershipCell(row) {
    if (row.ownerships.length === 0) return el('span', { class: 'text-muted' }, '—');
    return row.ownerships.map((o) => {
      const active = isActiveOn(o.valid_from, o.valid_to, today);
      return el('div', { class: 'person-record' }, [
        el('span', { class: active ? 'badge badge-owner' : 'badge badge-neutral' }, `${active ? 'Собственник' : 'Собственник (не сейчас)'} ${formatShare(o.share_num, o.share_den)}`),
        periodCell(o.valid_from, o.valid_to),
        o.basis ? el('span', { class: 'text-muted' }, o.basis) : null,
        recordButtons({
          edit: () => ownershipForm(o),
          remove: () => removeRow(`Удалить запись о собственности «${o.owner_name}»?`, () => ownershipsApi.remove(o.id), loadPeople),
          restore: () => restoreRow(() => ownershipsApi.restore(o.id), loadPeople),
        }),
      ]);
    });
  }

  function residencyCell(row) {
    const records = row.residencies.map((r) => el('div', { class: 'person-record' }, [
      el('span', {}, [r.registered ? 'Прописан' : 'Проживает без прописки', r.relation === 'owner' ? '' : ` · ${relationText(r)}`]),
      periodCell(r.valid_from, r.valid_to),
      recordButtons({
        edit: () => residencyForm(r),
        remove: () => removeRow(`Удалить запись о проживании «${names.get('person', r.person_id)}»?`, () => residenciesApi.remove(r.id), loadPeople),
        restore: () => restoreRow(() => residenciesApi.restore(r.id), loadPeople),
      }),
    ]));
    if (records.length > 0) return records;
    // Собственник без записи о проживании: быстро добавить проживание с родством «собственник».
    const owned = row.ownerships.find((o) => isActiveOn(o.valid_from, o.valid_to, today));
    const addable = canWrite() && peopleTab === 'current' && row.personId && owned;
    return [
      el('span', { class: 'text-muted' }, '—'),
      addable ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => residencyForm(null, { person_id: row.personId, relation: 'owner', valid_from: owned.valid_from }) }, '+ проживание') : null,
    ];
  }

  function ownershipForm(row, { thenResidency = false } = {}) {
    openEntityForm({
      title: row ? 'Собственник: редактирование' : 'Новый собственник',
      fields: ownershipFields,
      watch: ['owner_kind'],
      entity: row,
      initialValues: row ? { owner_kind: ownerKindOf(row) } : { owner_kind: 'person', share_num: '1', share_den: '1', valid_from: today },
      fixed: { premises_id: premises.id },
      save: (body) => (row ? ownershipsApi.update(row.id, body) : ownershipsApi.create(body)),
      onSaved: (saved) => {
        loadPeople();
        if (thenResidency && saved?.person_id) residencyForm(null, { person_id: saved.person_id, relation: 'owner', valid_from: saved.valid_from });
      },
    });
  }

  function residencyForm(row, preset = {}) {
    openEntityForm({
      title: row ? 'Житель: редактирование' : 'Новый житель',
      fields: residencyFields,
      entity: row,
      initialValues: row ? {} : { relation: 'other', valid_from: today, ...preset },
      fixed: { premises_id: premises.id },
      save: (body) => (row ? residenciesApi.update(row.id, body) : residenciesApi.create(body)),
      onSaved: loadPeople,
    });
  }

  function addPerson() {
    if (!hasResidents) return ownershipForm(null);
    const choose = (open) => () => { modal.close(); open(); };
    const option = (text, hint, open) => el('button', { type: 'button', class: 'btn add-person-option', onclick: choose(open) }, [el('strong', {}, text), el('span', { class: 'text-muted' }, hint)]);
    const modal = openModal({
      title: 'Кого добавить?',
      content: el('div', { class: 'add-person-options' }, [
        option('Собственника, который здесь живёт', 'Запись о собственности и о проживании за один шаг', () => ownershipForm(null, { thenResidency: true })),
        option('Собственника', 'Не проживает (например, юрлицо или сдаёт жильё)', () => ownershipForm(null)),
        option('Жителя', 'Член семьи или другой проживающий, не собственник', () => residencyForm(null)),
      ]),
    });
  }

  function relationText(r) {
    const rel = label(relations, r.relation);
    return r.related_owner_id ? `${rel} — ${names.get('person', r.related_owner_id)}` : rel;
  }

  // --- Лицевые счета и плательщики ---

  async function loadAccounts() {
    const deleted = showDeleted.accounts;
    try {
      const { items } = await premisesApi.accounts(premises.id, deleted ? { deleted: 'only' } : undefined);
      accountsBody.replaceChildren(items.length
        ? el('div', { class: 'account-list' }, items.map(deleted ? renderDeletedAccount : renderAccount))
        : el('div', { class: 'data-table-wrap' }, el('div', { class: 'table-status' }, deleted ? 'Удалённых счетов нет' : 'Лицевых счетов нет')));
    } catch (err) {
      accountsBody.replaceChildren(errorStatus(err));
    }
  }

  function renderDeletedAccount(account) {
    return el('div', { class: 'card account-card crud-table--deleted' }, el('div', { class: 'account-card-header' }, [
      el('div', {}, [
        el('div', { class: 'account-number' }, `№ ${account.number}`),
        el('div', { class: 'account-meta' }, `${label(accountPurposes, account.purpose)} · удалён ${formatDate(account.deleted_at)}`),
      ]),
      el('div', { class: 'row-actions' }, canWrite() ? restoreButton(() => restoreRow(() => accountsApi.restore(account.id), loadAccounts)) : null),
    ]));
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

    // Все оплаты по лицевому счёту: платежи из реестров и введённые вручную.
    const paymentsBody = el('div', { class: 'account-payments' });
    paymentsBody.hidden = true;
    const paymentsToggle = el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', 'aria-expanded': 'false',
      onclick: () => {
        paymentsBody.hidden = !paymentsBody.hidden;
        paymentsToggle.setAttribute('aria-expanded', String(!paymentsBody.hidden));
        paymentsToggle.textContent = paymentsBody.hidden ? 'Оплаты' : 'Скрыть оплаты';
        if (!paymentsBody.hidden) loadPayments(account, paymentsBody);
      },
    }, 'Оплаты');

    // Услуги, по которым выставляется квитанция этого счёта.
    const servicesBody = el('div', { class: 'account-payments' });
    servicesBody.hidden = true;
    let servicesLoaded = false;
    const servicesToggle = el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', 'aria-expanded': 'false',
      onclick: async () => {
        servicesBody.hidden = !servicesBody.hidden;
        servicesToggle.setAttribute('aria-expanded', String(!servicesBody.hidden));
        servicesToggle.textContent = servicesBody.hidden ? 'Услуги' : 'Скрыть услуги';
        if (!servicesBody.hidden && !servicesLoaded) {
          servicesLoaded = true;
          servicesBody.replaceChildren(await createAccountServices({ account, premises }));
        }
      },
    }, 'Услуги');

    const calculationButton = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => openCalculationDialog({ account }) }, 'Расчёт');

    return el('div', { class: 'card account-card' }, [
      el('div', { class: 'account-card-header' }, [
        el('div', {}, [
          el('div', { class: 'account-number' }, `№ ${account.number}`),
          el('div', { class: 'account-meta' }, [
            label(accountPurposes, account.purpose), ' · ',
            el('span', { class: account.status === 'active' ? 'badge badge-success' : 'badge badge-neutral' }, label(accountStatuses, account.status)), ' · ',
            account.closed_at ? `${formatDate(account.opened_at)} — ${formatDate(account.closed_at)}` : `открыт ${formatDate(account.opened_at)}`,
          ]),
          el('div', { class: 'account-holder' }, holdersLine(account.holder_names)),
        ]),
        el('div', { class: 'row-actions' }, [
          servicesToggle,
          calculationButton,
          paymentsToggle,
          toggle,
          canWrite() ? editButton(() => accountForm(account)) : null,
          canWrite() ? deleteButton(() => removeRow(`Удалить лицевой счёт № ${account.number}? Удалить можно только счёт без плательщиков.`, () => accountsApi.remove(account.id), loadAccounts)) : null,
        ]),
      ]),
      servicesBody,
      paymentsBody,
      holdersBody,
    ]);
  }

  const PAYMENTS_LIMIT = 200;

  async function loadPayments(account, host) {
    host.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
    try {
      const { items } = await incomingPaymentsApi.list({ personal_account_id: account.id, limit: PAYMENTS_LIMIT });
      const total = Math.round(items.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
      // el() пропускает null-детей; прямой replaceChildren(null) нарисовал бы текст «null».
      host.replaceChildren(el('div', {}, [
        el('p', { class: 'field-help' }, items.length === 0
          ? 'Оплат по этому лицевому счёту нет'
          : `Оплат: ${items.length}${items.length === PAYMENTS_LIMIT ? '+ (показаны последние)' : ''}, на сумму ${formatMoney(total)}`),
        items.length === 0 ? null : renderTable({
          columns: [
            { key: 'date', label: 'Дата', primary: true, render: (p) => [formatDate(p.payment_date), p.payment_time ? ` ${formatTime(p.payment_time)}` : ''].join('') },
            { key: 'amount', label: 'Сумма', render: (p) => formatMoney(p.amount) },
            { key: 'payer_name', label: 'Оплатил' },
            { key: 'source', label: 'Источник', render: (p) => (p.registry_id
              ? el('a', { href: `/payment-registries/${p.registry_id}` }, registryLabel(p))
              : 'Вручную') },
            { key: 'purpose', label: 'Назначение' },
          ],
          rows: items,
        }),
      ]));
    } catch (err) {
      host.replaceChildren(errorStatus(err));
    }
  }

  async function loadHolders(account, host) {
    host.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
    const deleted = host.dataset.deleted === 'true';
    const reload = () => { loadHolders(account, host); loadAccounts(); };
    try {
      const { items } = await accountHoldersApi.list({ account_id: account.id, deleted: deleted ? 'only' : undefined, limit: 200 });
      await names.preload(items.map((h) => (h.person_id ? ['person', h.person_id] : ['legal_entity', h.legal_entity_id])));
      const toggle = deletedToggle((checked) => {
        host.dataset.deleted = String(checked);
        loadHolders(account, host);
      });
      toggle.querySelector('input').checked = deleted;
      host.replaceChildren(...[
        canWrite() ? el('div', { class: 'holders-tools' }, toggle) : null,
        el('div', { class: deleted ? 'crud-table--deleted' : null }, renderTable({
          columns: [
            { key: 'holder', label: 'Плательщик', primary: true, render: (h) => (h.person_id ? personLink(h.person_id, holderName(h)) : holderName(h)) },
            { key: 'period', label: 'Период', render: (h) => periodCell(h.valid_from, h.valid_to) },
          ],
          rows: items,
          emptyMessage: deleted ? 'Удалённых записей нет' : 'Плательщики не указаны',
          rowActions: !canWrite() ? null : deleted
            ? (h) => [restoreButton(() => restoreRow(() => accountHoldersApi.restore(h.id), reload))]
            : (h) => [
              editButton(() => holderForm(account, h, reload)),
              deleteButton(() => removeRow(`Удалить плательщика «${holderName(h)}»?`, () => accountHoldersApi.remove(h.id), reload)),
            ],
        })),
        deleted || !canWrite() ? null : el('div', { class: 'form-actions' }, el('button', { type: 'button', class: 'btn btn-sm', onclick: () => holderForm(account, null, reload) }, '+ Добавить плательщика')),
      ].filter(Boolean));
    } catch (err) {
      host.replaceChildren(errorStatus(err));
    }
  }

  function holdersLine(names = []) {
    if (names.length === 0) return 'Плательщик не указан';
    return `${names.length > 1 ? 'Плательщики' : 'Плательщик'}: ${names.join(', ')}`;
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

  function peopleSection() {
    return el('section', { class: 'page-section' }, [
      el('div', { class: 'section-header section-header--sub' }, [
        el('h2', {}, hasResidents ? 'Собственники и жители' : 'Собственники'),
        canWrite() ? el('div', { class: 'section-tools' }, el('button', { type: 'button', class: 'btn btn-primary btn-add', onclick: addPerson }, hasResidents ? 'Добавить' : 'Добавить собственника')) : null,
      ]),
      tabsBar,
      peopleBody,
    ]);
  }

  renderInfo();
  container.replaceChildren(el('div', { class: 'page' }, [
    el('nav', { class: 'breadcrumbs' }, [
      el('a', { href: '/buildings' }, 'Дома'), ' / ',
      el('a', { href: `/buildings/${building.id}` }, buildingLabel(building)), ' /',
    ]),
    el('div', { class: 'section-header' }, [
      title,
      canWrite() ? el('div', { class: 'header-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: editPremises }, 'Изменить'),
        el('button', { type: 'button', class: 'btn btn-ghost btn-danger-text', onclick: removePremises }, 'Удалить'),
      ]) : null,
    ]),
    info,
    peopleSection(),
    section('Лицевые счета', 'Открыть счёт', () => accountForm(null), accountsBody, (on) => { showDeleted.accounts = on; loadAccounts(); }),
    el('section', { class: 'page-section' }, [
      el('div', { class: 'section-header section-header--sub' }, el('h2', {}, 'Счётчики')),
      createMetersList({
        fixedQuery: { premises_id: premises.id },
        fixed: { premises_id: premises.id },
        showLocation: false,
        emptyMessage: 'Счётчиков в помещении пока нет',
      }).element,
    ]),
  ]));

  renderTabs();
  loadPeople();
  loadAccounts();
}

function section(titleText, addLabel, onAdd, body, onDeletedChange) {
  if (!canWrite()) {
    return el('section', { class: 'page-section' }, [el('div', { class: 'section-header section-header--sub' }, el('h2', {}, titleText)), body]);
  }
  const addButton = el('button', { type: 'button', class: 'btn btn-primary btn-add', onclick: onAdd }, addLabel);
  const toggle = deletedToggle((checked) => {
    addButton.hidden = checked;
    onDeletedChange(checked);
  });
  return el('section', { class: 'page-section' }, [
    el('div', { class: 'section-header section-header--sub' }, [
      el('h2', {}, titleText),
      el('div', { class: 'section-tools' }, [toggle, addButton]),
    ]),
    body,
  ]);
}

function editButton(onclick) {
  return el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick }, 'Изменить');
}

function restoreButton(onclick) {
  return el('button', { type: 'button', class: 'btn btn-sm', onclick }, 'Восстановить');
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
  const ok = await confirmDialog({ title: 'Удаление', message: `${message} Запись попадёт в «Удалённые», её можно будет восстановить.`, confirmLabel: 'Удалить', danger: true });
  if (ok && (await removeWithToast(call, 'Удалено. Восстановить можно в «Удалённые»'))) reload();
}

async function restoreWithToast(call) {
  try {
    await call();
    toast.success('Восстановлено');
    return true;
  } catch (err) {
    if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
    return false;
  }
}

async function restoreRow(call, reload) {
  if (await restoreWithToast(call)) reload();
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

  return {
    preload,
    set: (kind, id, name) => cache.set(`${kind}:${id}`, name),
    get: (kind, id) => cache.get(`${kind}:${id}`) || `#${id}`,
  };
}
