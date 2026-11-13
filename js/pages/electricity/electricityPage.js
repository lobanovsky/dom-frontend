import { electricityApi, metersApi, tariffsApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { formatMoney } from '../../lib/format.js';
import { canWrite } from '../../lib/permissions.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { openModal } from '../../ui/modal.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { yearMonths, monthLabel, annualElectricityTotal } from '../../lib/electricity.js';

const currentMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit' }).format(new Date());
const input = (type, value = '', attrs = {}) => el('input', { type, value: value ?? '', ...attrs });
const shown = (v) => v == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(v);
const rate = (v) => v == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 }).format(v);
const statusText = (s) => ({ no_reading: 'Нет показания за месяц', no_tariff: 'Не задана цена по всем зонам' })[s] || s;

async function listElectricityMeters() {
  const all = [];
  for (let offset = 0; ; offset += 200) {
    const { items } = await metersApi.list({ scope: 'common', resource: 'electricity', limit: 200, offset });
    all.push(...items);
    if (items.length < 200) return all;
  }
}

async function listElectricityTariffs() {
  const all = [];
  for (let offset = 0; ; offset += 200) {
    const { items } = await tariffsApi.list({ unit: 'kwh', limit: 200, offset });
    all.push(...items);
    if (items.length < 200) return all;
  }
}

function contractSettings(original, meters, contracts, tariffs, reload) {
  const contract = structuredClone(original || { meter_ids: [], prices: [] });
  const name = input('text', contract.name, { required: true, maxlength: 200, 'aria-label': 'Название договора' });
  const number = input('text', contract.number, { maxlength: 200, 'aria-label': 'Номер договора' });
  let modal;

  const selected = new Set(contract.meter_ids || []);
  const checks = meters.filter((meter) => selected.has(meter.id) || !contracts.some((c) => c.id !== contract.id && c.meter_ids.includes(meter.id))).map((meter) => {
    const check = el('input', { type: 'checkbox', value: meter.id, ...(selected.has(meter.id) ? { checked: true } : {}) });
    return el('label', { class: 'electricity-meter-choice' }, [check, el('span', {}, `${meter.name || 'Счётчик'} № ${meter.serial_number} · коэф. ${meter.coefficient} · ${meter.tariffs} тарифа`)]);
  });
  const checkHost = el('div', { class: 'electricity-meter-choices' }, checks.length ? checks : el('p', { class: 'muted' }, 'Нет общедомовых электросчётчиков.'));
  const tariffFields = [1, 2, 3].map((zone) => {
    const selectedID = contract[`tariff_t${zone}_id`];
    const select = el('select', { 'aria-label': `Тариф Т${zone}` }, [
      el('option', { value: '' }, 'Выберите тариф'),
      ...tariffs.map((tariff) => el('option', { value: tariff.id, selected: tariff.id === selectedID }, `${tariff.name} · ${tariff.organization_name}`)),
      selectedID && !tariffs.some((t) => t.id === selectedID) ? el('option', { value: selectedID, selected: true }, `Тариф № ${selectedID} (недоступен)`) : null,
    ]);
    const label = el('span', {}, `Тариф Т${zone}`);
    return { select, label, field: el('label', { class: 'field' }, [label, select]) };
  });
  const updateZones = () => {
    const ids = [...checkHost.querySelectorAll('input:checked')].map((check) => Number(check.value));
    const count = Math.max(1, ...meters.filter((m) => ids.includes(m.id)).map((m) => m.tariffs));
    tariffFields.forEach(({ field, select, label }, index) => {
      field.hidden = index >= count; select.disabled = index >= count; select.required = ids.length > 0 && index < count;
      label.textContent = count === 1 ? 'Тариф' : `Тариф Т${index + 1}`;
      select.setAttribute('aria-label', label.textContent);
    });
  };
  checkHost.addEventListener('change', updateZones);
  updateZones();
  const message = el('p', { class: 'muted', role: 'status' });
  const form = el('form', { class: 'electricity-settings', onsubmit: async (event) => {
    event.preventDefault();
    const save = form.querySelector('[type="submit"]'); save.disabled = true; message.textContent = 'Сохраняю…';
    try {
      const meterIDs = [...checkHost.querySelectorAll('input:checked')].map((c) => Number(c.value));
      const body = { name: name.value.trim(), number: number.value.trim() || null, meter_ids: meterIDs,
        ...Object.fromEntries(tariffFields.map(({ select }, index) => [`tariff_t${index + 1}_id`, select.disabled || !select.value ? null : Number(select.value)])),
      };
      if (contract.id) await electricityApi.updateContract(contract.id, body);
      else await electricityApi.createContract(body);
      modal.close(); await reload();
    } catch (err) { message.textContent = describeApiError(err).message; }
    finally { save.disabled = false; }
  } }, [
    el('label', { class: 'field' }, ['Название договора', name]),
    el('label', { class: 'field' }, ['Номер договора (необязательно)', number]),
    el('h3', {}, 'Счётчики контракта'), checkHost,
    el('h3', {}, 'Тарифы электроэнергии'),
    el('p', { class: 'muted' }, ['Выберите тариф для каждой зоны. Цены и периоды действия задаются в ', el('a', { href: '/tariffs', target: '_blank', rel: 'noopener' }, 'справочнике тарифов'), '.']),
    ...tariffFields.map(({ field }) => field),
    el('div', { class: 'electricity-save' }, [el('button', { type: 'submit', class: 'btn' }, 'Сохранить настройки'), message]),
  ]);
  modal = openModal({ title: contract.id ? `Договор: ${contract.name}` : 'Добавить договор', content: form, wide: true });
  return modal;
}

function meterResult(meter) {
  const row = el('div', { class: `electricity-result-row${meter.status === 'ok' ? '' : ' is-incomplete'}` });
  const data = [
    el('strong', {}, `${meter.name !== meter.serial_number ? `${meter.name} · ` : ''}№ ${meter.serial_number} · коэф. ${shown(meter.coefficient)}`),
    meter.status === 'ok'
      ? el('span', {}, Array.from({ length: meter.tariffs }, (_, i) => `Т${i + 1}: ${shown(meter[`delta_t${i + 1}`])} кВт·ч × ${rate(meter[`price_t${i + 1}`])} ₽`).join(' · '))
      : el('span', {}, statusText(meter.status)),
    el('strong', {}, meter.status === 'ok' ? formatMoney(meter.amount) : '—'),
  ];
  row.append(...data);
  return row;
}

function resultView(result) {
  return el('div', {}, [
    el('div', { class: `electricity-total${result.complete ? '' : ' is-incomplete'}` }, [
      el('span', {}, result.complete ? 'Ориентировочно к оплате' : 'Промежуточная сумма · расчёт неполный'),
      el('strong', {}, formatMoney(result.total)),
    ]),
    ...result.contracts.map((contract) => el('section', { class: 'card electricity-contract-result' }, [
      el('div', { class: 'section-header' }, [el('h2', {}, contract.name), el('strong', {}, contract.complete ? formatMoney(contract.total) : `Частично · ${formatMoney(contract.total)}`)]),
      ...contract.meters.map(meterResult),
      contract.meters.length ? null : el('p', { class: 'muted' }, 'К контракту пока не привязаны счётчики.'),
    ])),
  ]);
}

export async function electricityPage(container) {
  let contracts = []; let meters = []; let tariffs = []; let request = 0;
  let selectedYear = Number(currentMonth().slice(0, 4));
  const description = el('p', { class: 'muted' }, 'Расход учитывает коэффициенты счётчиков; стоимость рассчитана по ценам тарифных зон.');
  const yearLabel = el('strong', { class: 'month-picker-year', 'aria-live': 'polite' }, selectedYear);
  const selectYear = (year) => {
    if (year < 1 || year > 9999) return;
    selectedYear = year; yearLabel.textContent = String(year);
    prev.disabled = year === 1; next.disabled = year === 9999;
    reload();
  };
  const prev = el('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Предыдущий год', onclick: () => selectYear(selectedYear - 1) }, '‹');
  const next = el('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Следующий год', onclick: () => selectYear(selectedYear + 1) }, '›');
  const rangeControls = el('div', { class: 'electricity-range-controls' },
    el('div', { class: 'month-picker-year-row', role: 'group', 'aria-label': 'Выбор года' }, [prev, yearLabel, next]));
  const output = el('div', { class: 'electricity-output' });
  const reload = async () => {
    const version = ++request;
    output.replaceChildren(el('p', { class: 'muted' }, `Загрузка расчётов за ${selectedYear} год…`));
    try {
      const [contractResult, meterList, tariffList] = await Promise.all([electricityApi.listContracts(), listElectricityMeters(), listElectricityTariffs()]);
      if (version !== request) return;
      contracts = contractResult.items; meters = meterList; tariffs = tariffList;
      const periods = yearMonths(selectedYear);
      const rows = await Promise.all(periods.map(async (period) => {
        try { return { period, result: await electricityApi.calculation(period) }; }
        catch (error) { return { period, error }; }
      }));
      if (version !== request) return;
      const visible = contracts.filter((c) => !c.archived_at || rows.some((r) => r.result?.contracts.some((item) => item.id === c.id)));
      const annual = annualElectricityTotal(rows);
      const total = el('div', { class: `electricity-total${annual.complete ? '' : ' is-incomplete'}` }, [
        el('div', {}, [
          el('span', {}, `${annual.complete ? 'Итого' : 'Промежуточный итог'} за ${selectedYear} год`),
          !annual.complete ? el('small', {}, `Учтены только полностью рассчитанные месяцы: ${annual.monthsCount} из 12.`) : null,
        ]),
        el('strong', {}, annual.total === null ? '—' : formatMoney(annual.total)),
      ]);
      const amount = (item) => item ? (item.complete ? formatMoney(item.total) : 'Неполный расчёт') : '—';
      const table = el('table', { class: 'electricity-overview' }, [
        el('thead', {}, el('tr', {}, [el('th', {}, 'Месяц'), ...visible.map((c) => el('th', {}, c.name)), el('th', {}, 'Всего')])),
        el('tbody', {}, rows.map(({ period, result, error }) => el('tr', {}, [
          el('th', { scope: 'row' }, el('button', { type: 'button', class: 'btn btn-ghost', disabled: !result,
            onclick: () => openModal({ title: monthLabel(period), content: resultView(result), wide: true }),
          }, monthLabel(period))),
          ...visible.map((c) => el('td', {}, error ? 'Ошибка загрузки' : amount(result.contracts.find((item) => item.id === c.id)))),
          el('td', {}, el('strong', {}, error ? 'Ошибка загрузки' : amount(result))),
        ]))),
      ]);
      output.replaceChildren(...[total, el('div', { class: 'card electricity-table-scroll' }, table),
        el('p', { class: 'muted' }, 'Нажмите на месяц, чтобы посмотреть счётчики, расход и применённые цены. Неполный расчёт означает, что не хватает показаний или тарифов.'),
      ].filter(Boolean));
    } catch (err) { if (version === request) output.replaceChildren(el('div', { class: 'card empty-state' }, describeApiError(err).message)); }
  };
  function manageContracts() {
    const host = el('div');
    const show = () => {
      host.replaceChildren(
        el('button', { class: 'btn btn-primary', type: 'button', onclick: () => contractSettings(null, meters, contracts, tariffs, async () => { await reload(); manageContracts(); }) }, 'Добавить договор'),
        ...contracts.map((contract) => el('div', { class: 'electricity-contract-management' }, [
          el('div', {}, [el('strong', {}, contract.name), el('p', { class: 'muted' }, contract.archived_at ? `В архиве с ${contract.archived_at}` : contract.number || `${contract.meter_ids.length} счётчиков`)]),
          !contract.archived_at ? el('div', { class: 'header-actions' }, [
            el('button', { class: 'btn', type: 'button', onclick: () => contractSettings(contract, meters, contracts, tariffs, async () => { await reload(); manageContracts(); }) }, 'Изменить'),
            el('button', { class: 'btn btn-ghost', type: 'button', onclick: async () => {
              const ok = await confirmDialog({ title: 'Архивировать договор', message: `Договор «${contract.name}» останется в расчётах прошлых месяцев. Архивировать?`, confirmLabel: 'В архив' });
              if (!ok) { manageContracts(); return; }
              try { await electricityApi.archiveContract(contract.id); await reload(); manageContracts(); }
              catch (err) { openModal({ title: 'Ошибка', content: el('p', {}, describeApiError(err).message) }); }
            } }, 'В архив'),
          ]) : null,
        ])),
      );
    };
    show(); openModal({ title: 'Договоры Мосэнергосбыта', content: host, wide: true });
  }
  container.replaceChildren(el('div', { class: 'page electricity-page' }, [
    el('div', { class: 'section-header' }, [el('h1', {}, 'Мосэнергосбыт'),
      canWrite() ? el('button', { class: 'btn', type: 'button', onclick: manageContracts }, 'Контракты') : null]),
    description, rangeControls, output,
  ]));
  await reload();
}
