import { electricityApi, metersApi, tariffsApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { formatMoney } from '../../lib/format.js';
import { canWrite } from '../../lib/permissions.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { openModal } from '../../ui/modal.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { recentMonths, yearMonths, monthLabel } from '../../lib/electricity.js';

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
  let selectedYear = null;
  const initialYear = Number(currentMonth().slice(0, 4));
  const description = el('p', { class: 'muted' });
  const yearInput = input('number', initialYear, { min: 1, max: 9999, step: 1, inputmode: 'numeric', class: 'electricity-year-input', 'aria-label': 'Год расчёта' });
  const recentButton = el('button', { type: 'button', class: 'btn btn-primary', 'aria-pressed': 'true', onclick: () => { selectedYear = null; yearInput.value = String(initialYear); refreshRange(); reload(); } }, 'Последние 12 месяцев');
  const selectYear = (year) => {
    if (!Number.isInteger(year) || year < 1 || year > 9999) { yearInput.reportValidity(); return; }
    selectedYear = year; yearInput.value = String(year); refreshRange(); reload();
  };
  const prev = el('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Предыдущий год', onclick: () => selectYear((selectedYear ?? initialYear) - 1) }, '‹');
  const next = el('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Следующий год', onclick: () => selectYear((selectedYear ?? initialYear) + 1) }, '›');
  const refreshRange = () => {
    recentButton.classList.toggle('btn-primary', selectedYear === null);
    recentButton.setAttribute('aria-pressed', String(selectedYear === null));
    prev.disabled = selectedYear === 1; next.disabled = selectedYear === 9999;
    description.textContent = `${selectedYear === null ? 'Последние 12 месяцев' : `Расчёт за ${selectedYear} год`}. Расход учитывает коэффициенты счётчиков; стоимость рассчитана по ценам тарифных зон.`;
  };
  yearInput.addEventListener('change', () => selectYear(yearInput.valueAsNumber));
  yearInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); selectYear(yearInput.valueAsNumber); } });
  const rangeControls = el('div', { class: 'electricity-range-controls' }, [recentButton,
    el('div', { class: 'month-picker-year-row', role: 'group', 'aria-label': 'Выбор года' }, [prev, el('label', { class: 'electricity-year-label' }, ['Год', yearInput]), next]),
  ]);
  refreshRange();
  const output = el('div', { class: 'electricity-output' });
  const reload = async () => {
    const version = ++request;
    output.replaceChildren(el('p', { class: 'muted' }, selectedYear === null ? 'Загрузка расчётов за 12 месяцев…' : `Загрузка расчётов за ${selectedYear} год…`));
    try {
      const [contractResult, meterList, tariffList] = await Promise.all([electricityApi.listContracts(), listElectricityMeters(), listElectricityTariffs()]);
      if (version !== request) return;
      contracts = contractResult.items; meters = meterList; tariffs = tariffList;
      const periods = selectedYear === null ? recentMonths(currentMonth()) : yearMonths(selectedYear);
      const rows = await Promise.all(periods.map(async (period) => {
        try { return { period, result: await electricityApi.calculation(period) }; }
        catch (error) { return { period, error }; }
      }));
      if (version !== request) return;
      const visible = contracts.filter((c) => !c.archived_at || rows.some((r) => r.result?.contracts.some((item) => item.id === c.id)));
      const newest = rows[0].result;
      const total = newest ? el('div', { class: `electricity-total${newest.complete ? '' : ' is-incomplete'}` }, [
        el('span', {}, `${monthLabel(rows[0].period)} · ${newest.complete ? 'Ориентировочно к оплате' : 'Неполный расчёт'}`),
        el('strong', {}, newest.complete ? formatMoney(newest.total) : '—'),
      ]) : null;
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
    el('div', { class: 'section-header' }, [el('h1', {}, 'Электроэнергия Мосэнергосбыта'),
      canWrite() ? el('button', { class: 'btn', type: 'button', onclick: manageContracts }, 'Контракты') : null]),
    description, rangeControls, output,
  ]));
  await reload();
}
