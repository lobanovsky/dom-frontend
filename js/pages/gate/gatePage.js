import { gateApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { formatPhone, formatDate, formatDateTime } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { openModal } from '../../ui/modal.js';
import { isAdmin } from '../../lib/permissions.js';
import { editGateVehicle } from './editGateVehicle.js';
import { renderTable } from '../../ui/table.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { copyPhoneCell } from '../../ui/copyPhone.js';
import { toast } from '../../ui/toast.js';
import { PAGE_SIZES, loadPageSize, savePageSize } from '../../lib/pageSize.js';
import {
  GATE_STATUSES,
  GATE_ZONES,
  GATE_RELATIONS,
  gatePropertyLabel,
  gateZoneLabel,
  gateStatusLabel,
  groupGateRequests,
  gateAccessNote,
  gateVehicles,
  gateVehicleLabel,
} from '../../lib/gate.js';

const badge = (r) =>
  el(
    'span',
    {
      class: `badge ${r.display_status === 'approved' ? 'badge-success' : ['pending', 'revoke_requested'].includes(r.display_status) ? 'badge-warning' : 'badge-danger'}`,
    },
    gateStatusLabel(r.display_status),
  );
export async function gatePage(container) {
  let offset = 0,
    version = 0,
    pageItemCount = 0,
    pageSize = loadPageSize();
  const recipient = el('input', { type:'search', placeholder:'Кому', 'aria-label':'Кому', maxlength:120 });
  const phone = el('input', { type:'search', placeholder:'Телефон', 'aria-label':'Телефон', maxlength:32 });
  const vehicle = el('input', { type:'search', placeholder:'Авто', 'aria-label':'Авто', maxlength:80 });
  const premises = el('input', { type:'search', placeholder:'Номер помещения', 'aria-label':'Номер помещения', maxlength:80 });
  const allStatuses = el('input', { type: 'checkbox', checked: false });
  const statusCheckboxes = Object.entries(GATE_STATUSES).map(([value, label]) => ({
    value,
    input: el('input', { type: 'checkbox', checked: ['pending', 'revoke_requested'].includes(value) }),
    label,
  }));
  const statusFilter = el('fieldset', { class: 'gate-status-filters' }, [
    el('legend', {}, 'Статусы'),
    el('label', { class: 'gate-status-option' }, [allStatuses, 'Все статусы']),
    ...statusCheckboxes.map(({ input, label }) => el('label', { class: 'gate-status-option' }, [input, label])),
  ]);
  const zone = el('select', { 'aria-label': 'Куда доступ' }, [
    el('option', { value: '' }, 'Двор и паркинг'),
    ...Object.entries(GATE_ZONES).map(([value, label]) => el('option', { value }, label)),
  ]);
  const host = el('div', { class: 'crud-table' });
  const prev = el(
    'button',
    {
      class: 'btn',
      type: 'button',
      onclick: () => {
        offset = Math.max(0, offset - pageSize);
        load();
      },
    },
    '← Назад',
  );
  const next = el(
    'button',
    {
      class: 'btn',
      type: 'button',
      onclick: () => {
        offset += pageSize;
        load();
      },
    },
    'Вперёд →',
  );
  const page = el('span', { class: 'pager-info', 'aria-live': 'polite' });
  const sizeSelect = el('select', { 'aria-label': 'Строк на странице' }, PAGE_SIZES.map((size) => el('option', { value: String(size) }, String(size))));
  sizeSelect.value = String(pageSize);
  sizeSelect.addEventListener('change', () => {
    pageSize = Number(sizeSelect.value);
    savePageSize(pageSize);
    offset = 0;
    load();
  });
  const pager = el('div', { class: 'pager' }, [prev, page, next, el('label', { class: 'pager-size' }, ['На странице: ', sizeSelect])]);
  const filters = el(
    'form',
    {
      class: 'gate-filters',
      onsubmit: (e) => {
        e.preventDefault();
        offset = 0;
        load();
      },
    },
    [recipient, phone, vehicle, premises, statusFilter, zone, el('button', { type: 'submit', class: 'btn' }, 'Найти / обновить')],
  );
  allStatuses.addEventListener('change', () => {
    if (allStatuses.checked) statusCheckboxes.forEach(({ input }) => { input.checked = false; });
    offset = 0;
    load();
  });
  for (const { input } of statusCheckboxes) input.addEventListener('change', () => {
    if (input.checked) allStatuses.checked = false;
    if (!statusCheckboxes.some(({ input: checkbox }) => checkbox.checked)) allStatuses.checked = true;
    offset = 0;
    load();
  });
  zone.addEventListener('change', () => {
    offset = 0;
    load();
  });
  container.replaceChildren(
    el('div', { class: 'page' }, [
      el('h1', {}, 'Доступ во двор и паркинг'),
      el(
        'p',
        { class: 'field-help' },
        'Отзыв жителем скрывает доступ в кабинете сразу. Администратор завершает удаление номера на устройствах ELDES из заявки.',
      ),
      filters,
      host,
      pager,
    ]),
  );
  async function load() {
    const request = ++version;
    prev.disabled = true;
    next.disabled = true;
    host.replaceChildren(el('p', { role: 'status' }, 'Загрузка…'));
    try {
      const result = await gateApi.list({
        display_status: allStatuses.checked ? '' : statusCheckboxes.filter(({ input }) => input.checked).map(({ value }) => value).join(','),
        zone: zone.value,
        recipient: recipient.value.trim(), phone: phone.value.trim(), vehicle: vehicle.value.trim(), premises: premises.value.trim(),
        limit: pageSize,
        offset,
      });
      const items = groupGateRequests(result.items);
      if (request !== version) return;
      pageItemCount = items.length;
      host.replaceChildren(
        renderTable({
          columns: [
            { key: 'id', label: '№ заявки', render: (r) => `№ ${r.id}` },
            {
              key: 'recipient_name',
              label: 'Кому',
              primary: true,
              render: (r) =>
                el('div', {}, [
                  el('strong', {}, r.recipient_name),
                  el('p', { class: 'muted' }, GATE_RELATIONS[r.relation]),
                ]),
            },
            { key: 'phone', label: 'Телефон', render: (r) => copyPhoneCell(r.phone, formatPhone) },
            { key: 'zone', label: 'Куда', render: (r) => gateZoneLabel(r) },
            {
              key: 'premises_number',
              label: 'Объекты и заявитель',
              render: (r) => el('div', {}, [gatePropertyLabel(r), el('p', { class: 'muted' }, r.applicant_name)]),
            },
            {
              key: 'vehicle_plate',
              label: 'Автомобили',
              render: (r) =>
                r.no_personal_vehicle
                  ? 'Нет личного автомобиля'
                  : gateVehicles(r).length
                    ? el(
                        'div',
                        {},
                        gateVehicles(r).map((car) => el('div', {}, gateVehicleLabel(car))),
                      )
                    : '—',
            },
            { key: 'effective_status', label: 'Статус', render: badge },
            { key: 'created_at', label: 'Подана', render: (r) => formatDateTime(r.created_at) },
          ],
          rows: items,
          emptyMessage: 'Заявок с такими условиями нет',
          rowActions: (r) => [
            el('button', { class: 'btn btn-sm', type: 'button', onclick: () => detail(r) }, 'Открыть'),
            ...(isAdmin() && r.display_status === 'rejected'
              ? [el('button', {
                  class: 'btn btn-ghost btn-sm btn-danger-text',
                  type: 'button',
                  title: 'Удалить заявку со статусом «Отклонено»',
                  onclick: () => removeRejected(r),
                }, 'Удалить')]
              : []),
          ],
        }),
      );
      prev.disabled = offset === 0;
      next.disabled = items.length < pageSize;
      pager.hidden = offset === 0 && items.length < pageSize && pageSize === PAGE_SIZES[0];
      page.textContent = items.length ? `${offset + 1}–${offset + items.length}` : 'Нет заявок';
    } catch (e) {
      if (request === version) {
        host.replaceChildren(el('p', { class: 'form-error', role: 'alert' }, describeApiError(e).message));
        prev.disabled = true;
        next.disabled = true;
      }
    }
  }
  async function detail(r) {
    const history = el('div', {}, 'Загрузка истории…');
    const actions = [];
    let detailModal;
    if (r.status === 'pending') {
      if (r.effective_status === 'pending') {
        const approveButton = el('button', {
          class: 'btn btn-primary',
          type: 'button',
          onclick: () => approve(r, detailModal, approveButton),
        }, 'Одобрить');
        actions.push(approveButton);
      }
      actions.push(el('button', { class: 'btn', type: 'button', onclick: () => decide(r, 'reject') }, 'Отклонить'));
    }
    if (r.status === 'approved')
      actions.push(
        el('button', { class: 'btn', type: 'button', onclick: () => decide(r, 'revoke') }, 'Отозвать доступ'),
      );
    if (isAdmin() && r.status === 'revoke_requested')
      actions.push(el('button', { class: 'btn btn-primary', type: 'button', onclick: () => decide(r, 'revoke_device') }, 'Отозвать доступ с устройства'));
    if (isAdmin() && ['pending', 'approved'].includes(r.display_status))
      actions.push(el('button', { class: 'btn', type: 'button', onclick: () => edit(r) }, 'Редактировать данные'));
    const facts = (entries) =>
      el(
        'dl',
        { class: 'gate-detail-facts' },
        entries
          .filter(([, value]) => value != null && value !== '')
          .map(([label, value]) => [el('dt', {}, label), el('dd', {}, value)]),
      );
    const section = (title, children) =>
      el('section', { class: 'gate-detail-section' }, [el('h3', {}, title), ...children]);
    const addresses = [...new Set(r.items.map((item) => item.address).filter(Boolean))];
    detailModal = openModal({
      title: `Заявка № ${r.id}`,
      wide: true,
      content: el('div', { class: 'gate-detail' }, [
        el('div', { class: 'gate-detail-status' }, badge(r)),
        el('div', { class: 'gate-detail-sections' }, [
          section('Получатель доступа', [
            el('strong', { class: 'gate-recipient-name' }, r.recipient_name),
            facts([
              ['Телефон', el('a', { href: `tel:+${r.phone}`, class: 'gate-detail-phone' }, formatPhone(r.phone))],
              ['Кто пользуется', GATE_RELATIONS[r.relation]],
            ]),
          ]),
          section(
            'Куда нужен доступ',
            [
              el(
                'ul',
                { class: 'gate-object-list' },
                r.items.map((item) =>
                  el('li', {}, [
                    el('strong', {}, GATE_ZONES[item.zone]),
                    el('span', {}, gatePropertyLabel(item)),
                    gateAccessNote(item) ? el('small', {}, gateAccessNote(item)) : null,
                  ]),
                ),
              ),
              ...addresses.map((address) => el('p', { class: 'muted gate-detail-address' }, address)),
              r.valid_until ? facts([['Действует до', formatDate(r.valid_until)]]) : null,
            ].filter(Boolean),
          ),
          section(
            'Автомобили',
            [
              ...(r.no_personal_vehicle
                ? [el('p', {}, 'Нет личного автомобиля')]
                : gateVehicles(r).length
                  ? gateVehicles(r).map((car, index) =>
                      el('div', { class: 'gate-vehicle-detail' }, [
                        gateVehicles(r).length > 1 ? el('strong', {}, `Автомобиль ${index + 1}`) : null,
                        facts([
                          ['Номер', car.plate_number],
                          ['Марка', car.brand],
                        ]),
                        isAdmin() && car.id ? el('button', { type: 'button', class: 'btn btn-sm', onclick: () => editGateVehicle(car, load) }, 'Редактировать в реестре') : null,
                      ]),
                    )
                  : [el('p', { class: 'muted' }, 'Не указаны')]),
            ].filter(Boolean),
          ),
          section('Заявитель', [el('p', {}, r.applicant_name), facts([['Подана', formatDateTime(r.created_at)]])]),
        ]),
        r.comment ? section('Комментарий заявителя', [el('p', {}, r.comment)]) : null,
        r.review_note
          ? section(r.status === 'rejected' ? 'Причина отказа' : 'Комментарий к решению', [el('p', {}, r.review_note)])
          : null,
        el('div', { class: 'gate-detail-actions' }, actions),
        el('details', { class: 'gate-detail-history' }, [el('summary', {}, 'История заявки'), history]),
      ]),
    });
    try {
      const { items } = await gateApi.events(r.id);
      history.replaceChildren(
        ...items.map((e) =>
          el(
            'p',
            {},
            `${formatDateTime(e.created_at)} · ${{ submitted: 'Заявка подана', created: 'Доступ добавлен администратором', approved: 'Одобрено', rejected: 'Отклонено', revoked: 'Доступ отозван', revoke_requested: 'Пользователь запросил отзыв доступа', cancelled: 'Отменено', updated: 'Данные заявки изменены' }[e.action] || e.action} · ${e.actor_role === 'resident' ? 'Собственник' : e.actor_role === 'guard' ? 'Охрана' : 'Администратор'}${e.note ? `: ${e.note}` : ''}`,
          ),
        ),
      );
    } catch (e) {
      history.textContent = describeApiError(e).message;
    }
  }
  async function removeRejected(r) {
    const confirmed = await confirmDialog({
      title: 'Удалить заявку со статусом «Отклонено»',
      message: `Удалить заявку № ${r.id} вместе со всеми объектами группы и её историей? Восстановить её будет нельзя.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await gateApi.remove(r.id);
      toast.success('Заявка удалена.');
      if (pageItemCount === 1 && offset > 0) offset = Math.max(0, offset - pageSize);
      await load();
    } catch (e) {
      toast.error(describeApiError(e).message);
    }
  }
  async function approve(r, modal, button) {
    button.disabled = true;
    try {
      await gateApi.decision(r.id, { action: 'approve', note: '' });
      modal.close();
      await load();
    } catch (err) {
      toast.error(describeApiError(err).message);
    } finally {
      button.disabled = false;
    }
  }
  function edit(r) {
    const name = el('input', { class: 'input', required: true, maxlength: 120, value: r.recipient_name });
    const relation = el('select', { class: 'input' }, Object.entries(GATE_RELATIONS).map(([value, label]) => el('option', { value, selected: r.relation === value || (r.relation === 'service' && value === 'guest') }, label)));
    const noCar = el('input', { type: 'checkbox', checked: r.no_personal_vehicle });
    const cars = el('div', { class: 'gate-car-rows' });
    const rows = [];
    const refreshCars = () => rows.forEach((row) => { row.plate.disabled = noCar.checked; row.brand.disabled = noCar.checked; });
    const addCar = (car = {}) => {
      const plate = el('input', { class: 'input', maxlength: 24, placeholder: 'Номер автомобиля', value: car.plate_number || '' });
      const brand = el('input', { class: 'input', maxlength: 80, placeholder: 'Марка автомобиля', value: car.brand || '' });
      const row = { plate, brand };
      rows.push(row);
      cars.append(el('div', { class: 'gate-vehicle-detail' }, [plate, brand]));
      refreshCars();
    };
    for (const car of gateVehicles(r)) addCar(car);
    if (!rows.length) addCar();
    noCar.addEventListener('change', refreshCars);
    const message = el('p', { role: 'alert', class: 'form-error' });
    const submit = el('button', { class: 'btn btn-primary', type: 'submit' }, 'Сохранить');
    const form = el('form', { class: 'form', onsubmit: async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      try {
        await gateApi.update(r.id, { recipient_name: name.value.trim(), relation: relation.value, no_personal_vehicle: noCar.checked, vehicles: noCar.checked ? [] : rows.map(({ plate, brand }) => ({ plate_number: plate.value.trim(), brand: brand.value.trim() })).filter((car) => car.plate_number || car.brand) });
        modal.close();
        await load();
      } catch (error) { message.textContent = describeApiError(error).message; }
      finally { submit.disabled = false; }
    } }, [el('label', { class: 'field' }, ['Имя', name]), el('label', { class: 'field' }, ['Кто пользуется', relation]), el('fieldset', { class: 'field' }, [el('legend', {}, 'Автомобили'), cars, el('button', { type: 'button', class: 'btn', onclick: () => addCar() }, 'Добавить автомобиль'), el('label', {}, [noCar, ' Нет личного автомобиля'])]), message, submit]);
    const modal = openModal({ title: 'Редактировать данные заявки', content: form });
  }
  function decide(r, action) {
    const label = { approve: 'Одобрить', reject: 'Отклонить', revoke: 'Отозвать доступ', revoke_device: 'Отозвать доступ с устройства' }[action];
    const requestSummary = el('dl', { class: 'gate-decision-summary' }, [
      el('div', {}, [el('dt', {}, 'ФИО'), el('dd', {}, r.recipient_name)]),
      el('div', {}, [el('dt', {}, 'Телефон'), el('dd', {}, formatPhone(r.phone))]),
      el('div', {}, [el('dt', {}, 'Зона'), el('dd', {}, gateZoneLabel(r))]),
      ...r.items.map((item) => el('div', {}, [el('dt', {}, 'Помещение'), el('dd', {}, gatePropertyLabel(item))])),
    ]);
    const note = el('textarea', {
      maxlength: 500,
      required: false,
      rows: 3,
      'aria-label': action === 'approve' ? 'Комментарий к решению' : action === 'reject' ? 'Причина отказа' : 'Причина отзыва',
    });
    const message = el('p', { role: 'alert', class: 'form-error' });
    const submit = el('button', { type: 'submit', class: 'btn btn-primary' }, label);
    let modal;
    const form = el(
      'form',
      {
        class: 'gate-detail',
        onsubmit: async (e) => {
          e.preventDefault();
          submit.disabled = true;
          try {
            await gateApi.decision(r.id, { action, note: note.value.trim() });
            modal.close();
            await load();
          } catch (err) {
            message.textContent = describeApiError(err).message;
          } finally {
            submit.disabled = false;
          }
        },
      },
      [
        requestSummary,
        el('label', { class: 'field' }, [
          action === 'approve'
            ? 'Комментарий (необязательно)'
            : action === 'reject'
              ? 'Причина отказа (необязательно)'
              : 'Причина отзыва (необязательно)',
          note,
        ]),
        message,
        submit,
      ],
    );
    modal = openModal({ title: label, content: form });
  }
  await load();
  const poll = setInterval(() => {
    if (!host.isConnected) {
      clearInterval(poll);
      return;
    }
    if (!document.hidden && host.isConnected && !document.querySelector('[role="dialog"]')) load();
  }, 30000);
  return () => {
    clearInterval(poll);
    version++;
  };
}
