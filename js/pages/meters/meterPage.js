import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { openEntityForm } from '../../ui/entityForm.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { toast } from '../../ui/toast.js';
import { goTo } from '../../state/nav.js';
import { metersApi, meterReadingsApi } from '../../api/resources.js';
import { meterFields, meterReadingFields } from '../fields.js';
import { meterTariffs, premisesKinds, label } from '../../lib/labels.js';
import { formatDate, monthLabel, todayIso } from '../../lib/format.js';
import { consumption, formatDelta, formatReading, meterStatus, meterTitle, resourceUnit, tariffColumns, verificationState } from '../../lib/meters.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { canWrite } from '../../lib/permissions.js';
import { notFoundView, definitionList, deletedBanner } from '../common.js';

// Карточка счётчика: сведения и история показаний с расходом.
export async function meterPage(container, { id }) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let meter;
  try {
    meter = await metersApi.get(id);
  } catch (err) {
    container.replaceChildren(notFoundView(describeApiError(err).message, '/meters', 'К списку счётчиков'));
    return;
  }

  const today = todayIso();
  const info = el('div', { class: 'card' });
  const title = el('h1', {});
  const unit = () => resourceUnit(meter.resource);

  const breadcrumbs = () => el('nav', { class: 'breadcrumbs' }, meter.premises_id
    ? [el('a', { href: '/meters' }, 'Счётчики'), ' / ', el('a', { href: `/buildings/${meter.location_building_id}` }, meter.building_address), ' / ',
      el('a', { href: `/premises/${meter.premises_id}` }, `${label(premisesKinds, meter.premises_kind)} № ${meter.premises_number}`), ' /']
    : [el('a', { href: '/meters' }, 'Счётчики'), ' / ', el('a', { href: `/buildings/${meter.location_building_id}` }, meter.building_address), ' /']);

  function renderInfo() {
    title.textContent = meterTitle(meter);
    const status = meterStatus(meter);
    const verification = verificationState(meter, today);
    info.replaceChildren(definitionList([
      ['Где', meter.premises_id ? `${label(premisesKinds, meter.premises_kind)} № ${meter.premises_number}, ${meter.building_address}` : `Общедомовой, ${meter.building_address}`],
      ['Состояние', el('span', { class: `badge badge-${status.kind}` }, status.text)],
      ['Тарифность', meter.resource === 'electricity' ? label(meterTariffs, meter.tariffs) : null],
      ['Модель', meter.model],
      ['Введён в эксплуатацию', formatDate(meter.installed_at)],
      ['Окончание работы', formatDate(meter.removed_at)],
      ['Последняя поверка', formatDate(meter.verified_at)],
      ['Следующая поверка', meter.next_verification_at ? el('span', {}, [formatDate(meter.next_verification_at), verification ? [' ', el('span', { class: `badge badge-${verification === 'overdue' ? 'danger' : 'warning'}` }, verification === 'overdue' ? 'Просрочена' : 'Скоро')] : null]) : null],
      ['Начальные показания', tariffColumns(meter.tariffs).map((c) => `${meter.tariffs > 1 ? `${c.label} ` : ''}${formatReading(meter[`initial_${c.key}`])}`).join(' · ') + ` ${unit()}`],
      ['Коэффициент', meter.coefficient !== 1 ? formatReading(meter.coefficient) : null],
      ['Комментарий', meter.comment],
    ]));
  }

  if (meter.deleted_at) {
    renderInfo();
    container.replaceChildren(el('div', { class: 'page' }, [
      breadcrumbs(),
      el('div', { class: 'section-header' }, title),
      deletedBanner({
        deletedAt: meter.deleted_at,
        onRestore: async () => {
          try {
            await metersApi.restore(meter.id);
            toast.success('Восстановлено');
            meterPage(container, { id });
          } catch (err) {
            if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
          }
        },
      }),
      info,
    ]));
    return;
  }

  // После любых изменений показаний обновляем счётчик: от него зависят «последнее показание» и подсказка в форме.
  async function refreshMeter() {
    try {
      meter = await metersApi.get(id);
      renderInfo();
    } catch {
      // не страшно: карточка обновится при следующем открытии
    }
  }
  const readingsApi = {
    ...meterReadingsApi,
    create: async (body) => { const r = await meterReadingsApi.create(body); refreshMeter(); return r; },
    update: async (rid, body) => { const r = await meterReadingsApi.update(rid, body); refreshMeter(); return r; },
    remove: async (rid) => { await meterReadingsApi.remove(rid); refreshMeter(); },
    restore: async (rid) => { const r = await meterReadingsApi.restore(rid); refreshMeter(); return r; },
  };

  function edit() {
    openEntityForm({
      title: 'Счётчик: редактирование',
      fields: meterFields({ target: 'fixed' }),
      watch: ['resource', 'tariffs'],
      entity: meter,
      fixed: { building_id: meter.building_id, premises_id: meter.premises_id },
      save: (body) => metersApi.update(meter.id, body),
      onSaved: (saved) => { meter = saved; renderInfo(); readings.reload(); },
    });
  }

  async function remove() {
    const ok = await confirmDialog({ title: 'Удаление', message: `Удалить счётчик ${meterTitle(meter)}? Удалить можно только счётчик без показаний; обычно счётчик выводят из работы датой окончания. Счётчик попадёт в «Удалённые», его можно будет восстановить.`, confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    try {
      await metersApi.remove(meter.id);
      toast.success('Счётчик удалён');
      goTo('/meters');
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err, { action: 'delete' }).message);
    }
  }

  const cols = tariffColumns(meter.tariffs);
  const readings = createCrudList({
    entityTitle: 'Показание',
    addLabel: 'Добавить показание',
    api: readingsApi,
    fields: () => meterReadingFields(meter),
    fixedQuery: { meter_id: meter.id },
    fixed: { meter_id: meter.id },
    newDefaults: { reading_date: today },
    filters: [
      { name: 'date_from', label: 'С', type: 'date' },
      { name: 'date_to', label: 'По', type: 'date' },
    ],
    columns: [
      { key: 'reading_date', label: 'Дата', primary: true, render: (r) => formatDate(r.reading_date) },
      { key: 'period', label: 'За месяц', render: (r) => monthLabel(r.period) },
      ...cols.map((c) => ({ key: c.key, label: c.label, render: (r) => el('span', { class: 'nowrap' }, formatReading(r[c.key])) })),
      { key: 'delta', label: `Расход, ${unit()}`, render: (r) => consumptionCell(r) },
      { key: 'source', label: 'Источник', render: (r) => (r.source === 'import' ? 'Из файла' : 'Вручную') },
      { key: 'comment', label: 'Комментарий' },
    ],
    emptyMessage: 'Показаний пока нет',
    deleteMessage: (r) => `Удалить показание от ${formatDate(r.reading_date)}?`,
  });

  function consumptionCell(r) {
    const c = consumption(r, meter.tariffs);
    if (c.total === null) return '';
    return el('div', {}, [el('span', { class: 'nowrap' }, formatDelta(c.total)), c.parts.length ? el('div', { class: 'text-muted' }, c.parts.join(' · ')) : null]);
  }

  renderInfo();
  container.replaceChildren(el('div', { class: 'page' }, [
    breadcrumbs(),
    el('div', { class: 'section-header' }, [
      title,
      canWrite() ? el('div', { class: 'header-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: edit }, 'Изменить'),
        el('button', { type: 'button', class: 'btn btn-ghost btn-danger-text', onclick: remove }, 'Удалить'),
      ]) : null,
    ]),
    info,
    el('h2', { class: 'section-title' }, 'Показания'),
    readings.element,
  ]));
}
