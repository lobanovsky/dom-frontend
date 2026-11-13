import { gateApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { formatPhone, formatDate, formatDateTime } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { openModal } from '../../ui/modal.js';
import { renderTable } from '../../ui/table.js';
import { GATE_STATUSES, GATE_ZONES, GATE_RELATIONS, gatePropertyLabel } from '../../lib/gate.js';

const badge = (r) =>
  el(
    'span',
    {
      class: `badge ${r.active ? 'badge-success' : r.effective_status === 'pending' ? 'badge-warning' : 'badge-neutral'}`,
    },
    GATE_STATUSES[r.effective_status] || r.effective_status,
  );
export async function gatePage(container) {
  let offset = 0,
    version = 0;
  const input = el('input', {
    type: 'search',
    placeholder: 'Телефон, имя, авто, помещение',
    'aria-label': 'Поиск заявок',
    maxlength: 120,
  });
  const status = el('select', { 'aria-label': 'Статус заявки' }, [
    el('option', { value: '' }, 'Все статусы'),
    ...Object.entries(GATE_STATUSES).map(([value, label]) =>
      el('option', { value, selected: value === 'pending' }, label),
    ),
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
        offset = Math.max(0, offset - 50);
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
        offset += 50;
        load();
      },
    },
    'Далее →',
  );
  const page = el('span', { class: 'muted', 'aria-live': 'polite' });
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
    [input, status, zone, el('button', { type: 'submit', class: 'btn' }, 'Найти / обновить')],
  );
  for (const select of [status, zone])
    select.addEventListener('change', () => {
      offset = 0;
      load();
    });
  container.replaceChildren(
    el('div', { class: 'page' }, [
      el('h1', {}, 'Доступ во двор и паркинг'),
      el(
        'p',
        { class: 'field-help' },
        'Одобрение пока фиксируется в сервисе. Автоматическое открытие ворот и шлагбаумов ещё не подключено.',
      ),
      filters,
      host,
      el('div', { class: 'gate-pagination' }, [prev, page, next]),
    ]),
  );
  async function load() {
    const request = ++version;
    prev.disabled = true;
    next.disabled = true;
    host.replaceChildren(el('p', { role: 'status' }, 'Загрузка…'));
    try {
      const { items } = await gateApi.list({
        status: status.value,
        zone: zone.value,
        q: input.value.trim(),
        limit: 50,
        offset,
      });
      if (request !== version) return;
      host.replaceChildren(
        renderTable({
          columns: [
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
            { key: 'phone', label: 'Телефон', render: (r) => formatPhone(r.phone) },
            { key: 'zone', label: 'Куда', render: (r) => GATE_ZONES[r.zone] },
            {
              key: 'premises_number',
              label: 'Объект и заявитель',
              render: (r) => el('div', {}, [gatePropertyLabel(r), el('p', { class: 'muted' }, r.applicant_name)]),
            },
            {
              key: 'vehicle_plate',
              label: 'Автомобиль',
              render: (r) =>
                [r.vehicle_plate, r.vehicle_brand, r.occasional_vehicle ? 'Редкие заезды' : '']
                  .filter(Boolean)
                  .join(' · ') || '—',
            },
            { key: 'effective_status', label: 'Статус', render: badge },
            { key: 'created_at', label: 'Подана', render: (r) => formatDateTime(r.created_at) },
          ],
          rows: items,
          emptyMessage: 'Заявок с такими условиями нет',
          rowActions: (r) => [
            el('button', { class: 'btn btn-sm', type: 'button', onclick: () => detail(r) }, 'Открыть'),
          ],
        }),
      );
      prev.disabled = offset === 0;
      next.disabled = items.length < 50;
      page.textContent = items.length ? `${offset + 1}–${offset + items.length}` : 'Нет заявок';
    } catch (e) {
      if (request === version)
        host.replaceChildren(el('p', { class: 'form-error', role: 'alert' }, describeApiError(e).message));
    }
  }
  async function detail(r) {
    const history = el('div', {}, 'Загрузка истории…');
    const actions = [];
    if (r.status === 'pending') {
      if (r.effective_status === 'pending')
        actions.push(
          el('button', { class: 'btn btn-primary', type: 'button', onclick: () => decide(r, 'approve') }, 'Одобрить'),
        );
      actions.push(el('button', { class: 'btn', type: 'button', onclick: () => decide(r, 'reject') }, 'Отклонить'));
    }
    if (r.status === 'approved')
      actions.push(
        el('button', { class: 'btn', type: 'button', onclick: () => decide(r, 'revoke') }, 'Отозвать доступ'),
      );
    openModal({
      title: `Заявка № ${r.id}`,
      wide: true,
      content: el('div', { class: 'gate-detail' }, [
        badge(r),
        el('h3', {}, r.recipient_name),
        el('p', {}, `${formatPhone(r.phone)} · ${GATE_RELATIONS[r.relation]}`),
        el('p', {}, `${GATE_ZONES[r.zone]} · ${gatePropertyLabel(r)}`),
        el('p', { class: 'muted' }, r.address),
        el('p', {}, `Заявитель: ${r.applicant_name}`),
        el('p', {}, `Срок: ${r.valid_until ? `до ${formatDate(r.valid_until)} включительно` : 'без ограничения'}`),
        el(
          'p',
          {},
          [r.vehicle_plate, r.vehicle_brand, r.occasional_vehicle ? 'Редкие заезды (такси, доставка)' : '']
            .filter(Boolean)
            .join(' · ') || 'Автомобиль не указан',
        ),
        r.comment ? el('p', {}, `Комментарий заявителя: ${r.comment}`) : null,
        r.review_note ? el('p', {}, `Решение: ${r.review_note}`) : null,
        r.effective_status === 'ineligible'
          ? el(
              'p',
              { class: 'form-error' },
              'Действующее право собственности на этот объект не подтверждено. Одобрение недоступно.',
            )
          : null,
        el('div', { class: 'header-actions' }, actions),
        el('h3', {}, 'История'),
        history,
      ]),
    });
    try {
      const { items } = await gateApi.events(r.id);
      history.replaceChildren(
        ...items.map((e) =>
          el(
            'p',
            {},
            `${formatDateTime(e.created_at)} · ${{ submitted: 'Заявка подана', approved: 'Одобрено', rejected: 'Отклонено', revoked: 'Отозвано', cancelled: 'Отменено' }[e.action]} · ${e.actor_role === 'resident' ? 'Собственник' : e.actor_role === 'guard' ? 'Охрана' : 'Администратор'}${e.note ? `: ${e.note}` : ''}`,
          ),
        ),
      );
    } catch (e) {
      history.textContent = describeApiError(e).message;
    }
  }
  function decide(r, action) {
    const label = { approve: 'Одобрить', reject: 'Отклонить', revoke: 'Отозвать доступ' }[action];
    const note = el('textarea', {
      maxlength: 500,
      required: action !== 'approve',
      rows: 3,
      'aria-label': action === 'approve' ? 'Комментарий к решению' : 'Причина решения',
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
        el('p', {}, `${r.recipient_name} · ${formatPhone(r.phone)} · ${GATE_ZONES[r.zone]} · ${gatePropertyLabel(r)}`),
        el('label', { class: 'field' }, [
          action === 'approve' ? 'Комментарий (необязательно)' : 'Причина (обязательно)',
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
