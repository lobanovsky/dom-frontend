import { waterApi, metersApi, tariffsApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { formatMoney, formatDate } from '../../lib/format.js';
import { canWrite } from '../../lib/permissions.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { openModal } from '../../ui/modal.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { yearMonths, monthLabel, annualElectricityTotal } from '../../lib/electricity.js';

const currentMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit' }).format(new Date());
const input = (type, value = '', attrs = {}) => el('input', { type, value: value ?? '', ...attrs });
const shown = (v) => v == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(v);
const rate = (v) => v == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 }).format(v);
const statusText = (s) => ({ no_reading: 'Нет показания за месяц', no_previous: 'Нет предыдущего показания или начального показания для первого расчёта', no_tariff: 'Нет цены на воду или водоотведение за этот месяц', negative: 'Показание меньше предыдущего' })[s] || s;

async function listWaterMeters() {
  const all = [];
  for (let offset = 0; ; offset += 200) {
    const { items } = await metersApi.list({ scope: 'common', resource: 'cold_water', limit: 200, offset });
    all.push(...items);
    if (items.length < 200) return all;
  }
}

async function listWaterTariffs() {
  const all = [];
  for (let offset = 0; ; offset += 200) {
    const { items } = await tariffsApi.list({ unit: 'm3', limit: 200, offset });
    all.push(...items);
    if (items.length < 200) return all;
  }
}

function contractSettings(original, meters, contracts, tariffs, reload) {
  const contract = structuredClone(original || { meter_ids: [] });
  const name = input('text', contract.name, { required: true, maxlength: 200, 'aria-label': 'Название договора' });
  const number = input('text', contract.number, { maxlength: 200, 'aria-label': 'Номер договора' });
  let modal;

  const selected = new Set(contract.meter_ids || []);
  const checks = meters.filter((meter) => selected.has(meter.id) || !contracts.some((c) => c.id !== contract.id && c.meter_ids.includes(meter.id))).map((meter) => {
    const check = el('input', { type: 'checkbox', value: meter.id, ...(selected.has(meter.id) ? { checked: true } : {}) });
    return el('label', { class: 'electricity-meter-choice' }, [check, el('span', {}, `${meter.name || 'Счётчик'} № ${meter.serial_number}${meter.removed_at ? ` · снят ${meter.removed_at}` : ''}`)]);
  });
  const checkHost = el('div', { class: 'electricity-meter-choices' }, checks.length ? checks : el('p', { class: 'muted' }, 'Нет доступных общедомовых счётчиков холодной воды.'));
  const tariffFields = [
    { key: 'water_tariff_id', title: 'Тариф на воду' },
    { key: 'sewer_tariff_id', title: 'Тариф на водоотведение' },
  ].map(({ key, title }) => {
    const selectedID = contract[key];
    const select = el('select', { required: true, 'aria-label': title }, [
      el('option', { value: '' }, 'Выберите тариф'),
      ...tariffs.map((tariff) => el('option', { value: tariff.id, selected: tariff.id === selectedID }, `${tariff.name} · ${tariff.organization_name}`)),
      selectedID && !tariffs.some((t) => t.id === selectedID) ? el('option', { value: selectedID, selected: true }, `Тариф № ${selectedID} (недоступен)`) : null,
    ]);
    return { key, select, field: el('label', { class: 'field' }, [title, select]) };
  });
  const message = el('p', { class: 'muted', role: 'status' });
  const form = el('form', { class: 'electricity-settings', onsubmit: async (event) => {
    event.preventDefault();
    const save = form.querySelector('[type="submit"]'); save.disabled = true; message.textContent = 'Сохраняю…';
    try {
      const meterIDs = [...checkHost.querySelectorAll('input:checked')].map((c) => Number(c.value));
      if (!meterIDs.length) throw new Error('Выберите хотя бы один общедомовой счётчик воды');
      const body = { name: name.value.trim(), number: number.value.trim() || null, meter_ids: meterIDs,
        ...Object.fromEntries(tariffFields.map(({ key, select }) => [key, Number(select.value)])),
      };
      if (contract.id) await waterApi.updateContract(contract.id, body);
      else await waterApi.createContract(body);
      modal.close(); await reload();
    } catch (err) { message.textContent = describeApiError(err).message; }
    finally { save.disabled = false; }
  } }, [
    el('label', { class: 'field' }, ['Название договора', name]),
    el('label', { class: 'field' }, ['Номер договора (необязательно)', number]),
    el('h3', {}, 'Вводные счётчики договора'), checkHost,
    el('h3', {}, 'Тарифы воды и водоотведения'),
    el('p', { class: 'muted' }, ['Оба тарифа должны относиться к организации выбранных счётчиков. Цены и периоды действия задаются в ', el('a', { href: '/tariffs', target: '_blank', rel: 'noopener' }, 'справочнике тарифов'), '.']),
    ...tariffFields.map(({ field }) => field),
    el('div', { class: 'electricity-save' }, [el('button', { type: 'submit', class: 'btn' }, 'Сохранить настройки'), message]),
  ]);
  modal = openModal({ title: contract.id ? `Договор: ${contract.name}` : 'Добавить договор', content: form, wide: true });
  return modal;
}

function meterResult(meter) {
  const row = el('div', { class: `electricity-result-row${meter.status === 'ok' ? '' : ' is-incomplete'}` });
  row.append(
    el('a', { href: `/meters/${meter.meter_id}` }, `${meter.name !== meter.serial_number ? `${meter.name} · ` : ''}№ ${meter.serial_number}`),
    el('div', { class: 'water-meter-detail' }, [
      meter.previous_date && meter.current_date ? el('p', { class: 'muted' }, `Замеры: ${formatDate(meter.previous_date)} — ${formatDate(meter.current_date)}`) : null,
      meter.reading_gap ? el('p', { class: 'water-reading-warning', role: 'note' }, 'Между замерами пропущены месяцы. Весь расход за этот интервал включён в выбранный месяц по его тарифам.') : null,
      el('p', {}, `Показания: ${shown(meter.previous)} → ${shown(meter.current)} м³. Расход: ${shown(meter.volume)} м³.`),
      el('p', {}, `Вода: ${shown(meter.volume)} м³ × ${rate(meter.water_price)} ₽ = ${meter.volume != null && meter.water_price != null ? formatMoney(meter.water_amount) : '—'}`),
      el('p', {}, `Водоотведение: ${shown(meter.volume)} м³ × ${rate(meter.sewer_price)} ₽ = ${meter.volume != null && meter.sewer_price != null ? formatMoney(meter.sewer_amount) : '—'}`),
      meter.status !== 'ok' ? el('p', {}, statusText(meter.status)) : null,
    ]),
    el('strong', {}, meter.status === 'ok' ? formatMoney(meter.amount) : 'Неполный расчёт'),
  );
  return row;
}

function resultView(result) {
  return el('div', {}, [
    el('div', { class: `electricity-total${result.complete ? '' : ' is-incomplete'}` }, [
      el('span', {}, result.complete ? 'Ориентировочно к оплате' : 'Промежуточная сумма · расчёт неполный'),
      el('strong', {}, formatMoney(result.total)),
    ]),
    el('p', {}, `Вода: ${formatMoney(result.water_amount)} · Водоотведение: ${formatMoney(result.sewer_amount)}`),
    ...result.contracts.map((contract) => el('section', { class: 'card electricity-contract-result' }, [
      el('div', { class: 'section-header' }, [el('h2', {}, contract.name), el('strong', {}, contract.complete ? formatMoney(contract.total) : `Частично · ${formatMoney(contract.total)}`)]),
      el('p', { class: 'muted' }, `Объём: ${shown(contract.volume)} м³ · Вода: ${formatMoney(contract.water_amount)} · Водоотведение: ${formatMoney(contract.sewer_amount)}`),
      ...contract.meters.map(meterResult),
      contract.meters.length ? null : el('p', { class: 'muted' }, 'В этом месяце нет работающих счётчиков договора.'),
    ])),
  ]);
}

export async function waterPage(container) {
  let contracts = []; let meters = []; let tariffs = []; let request = 0;
  let selectedYear = Number(currentMonth().slice(0, 4));
  const description = el('p', { class: 'muted' }, 'Вода и водоотведение по общедомовым вводным счётчикам. Объём стоков равен расходу воды; цены берутся из справочника за выбранный месяц.');
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
  const settingsButton = canWrite() ? el('button', { class: 'btn', type: 'button', disabled: true, onclick: manageContracts }, 'Договоры') : null;
  const reload = async () => {
    const version = ++request;
    output.replaceChildren(el('p', { class: 'muted' }, `Загрузка расчётов за ${selectedYear} год…`));
    try {
      const [contractResult, meterList, tariffList] = await Promise.all([waterApi.listContracts(), listWaterMeters(), listWaterTariffs()]);
      if (version !== request) return;
      contracts = contractResult.items; meters = meterList; tariffs = tariffList;
      if (settingsButton) settingsButton.disabled = false;
      if (!contracts.length) {
        output.replaceChildren(el('div', { class: 'card empty-state' }, 'Добавьте договор: выберите вводные счётчики и тарифы на воду и водоотведение.'));
        return;
      }
      const periods = yearMonths(selectedYear);
      const rows = await Promise.all(periods.map(async (period) => {
        try { return { period, result: await waterApi.calculation(period) }; }
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
        el('thead', {}, el('tr', {}, [el('th', {}, 'Месяц'), ...(visible.length > 1 ? visible.map((c) => el('th', {}, c.name)) : []), el('th', {}, 'Вода'), el('th', {}, 'Водоотведение'), el('th', {}, 'Всего')])),
        el('tbody', {}, rows.map(({ period, result, error }) => el('tr', {}, [
          el('th', { scope: 'row' }, el('button', { type: 'button', class: 'btn btn-ghost', disabled: !result,
            onclick: () => openModal({ title: monthLabel(period), content: resultView(result), wide: true }),
          }, [monthLabel(period), result?.contracts.some((c) => c.meters.some((m) => m.reading_gap)) ? el('span', { class: 'badge badge-warning water-gap-badge', title: 'Есть пропуски месяцев: в расчёт включён весь расход между замерами' }, 'Есть пропуски') : null])),
          ...(visible.length > 1 ? visible.map((c) => el('td', {}, error ? 'Ошибка загрузки' : amount(result.contracts.find((item) => item.id === c.id)))) : []),
          ...['water_amount', 'sewer_amount'].map((key) => el('td', {}, error ? 'Ошибка загрузки' : result.complete ? formatMoney(result[key]) : '—')),
          el('td', {}, el('strong', {}, error ? 'Ошибка загрузки' : amount(result))),
        ]))),
      ]);
      output.replaceChildren(...[total, el('div', { class: 'card electricity-table-scroll' }, table),
        el('p', { class: 'muted' }, 'Нажмите на месяц, чтобы посмотреть счётчики, расход и применённые цены. Неполный расчёт означает, что не хватает текущих показаний, исходного показания или цен в справочнике. При пропуске месяцев расход считается между доступными замерами; даты видны в детализации.'),
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
              try { await waterApi.archiveContract(contract.id); await reload(); manageContracts(); }
              catch (err) { openModal({ title: 'Ошибка', content: el('p', {}, describeApiError(err).message) }); }
            } }, 'В архив'),
          ]) : null,
        ])),
      );
    };
    show(); openModal({ title: 'Договоры Мосводоканала', content: host, wide: true });
  }
  container.replaceChildren(el('div', { class: 'page electricity-page' }, [
    el('div', { class: 'section-header' }, [el('h1', {}, 'Мосводоканал'),
      settingsButton]),
    description, rangeControls, output,
  ]));
  await reload();
}
