import { electricityApi, metersApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { formatMoney } from '../../lib/format.js';
import { canWrite } from '../../lib/permissions.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { createMonthPicker } from '../../ui/monthPicker.js';

const currentMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit' }).format(new Date());
const input = (type, value = '', attrs = {}) => el('input', { type, value: value ?? '', ...attrs });
const value = (node) => node.value.trim();
const shown = (v) => v == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(v);
const rate = (v) => v == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 }).format(v);
const statusText = (s) => ({ no_reading: 'Нет показания за месяц', no_tariff: 'Не задана цена по всем зонам' })[s] || s;

async function listElectricityMeters() {
  const all = [];
  for (let offset = 0; ; offset += 200) {
    const { items } = await metersApi.list({ scope: 'common', resource: 'electricity', active: 'true', limit: 200, offset });
    all.push(...items);
    if (items.length < 200) return all;
  }
}

function priceEditor(contract, onChange) {
  const list = el('div', { class: 'electricity-prices' });
  const render = () => {
    list.replaceChildren(...contract.prices.map((p, index) => {
      const from = input('date', p.valid_from?.slice(0, 10), { required: true, 'aria-label': 'Действует с' });
      const to = input('date', p.valid_to?.slice(0, 10), { 'aria-label': 'Действует по' });
      const rates = [1, 2, 3].map((i) => input('number', p[`t${i}`], { min: 0, step: '0.0001', ...(i === 1 ? { required: true } : {}), placeholder: `Т${i}, ₽/кВт·ч`, 'aria-label': `Цена Т${i}` }));
      const row = el('div', { class: 'electricity-price-row' }, [
        from, to, ...rates,
        el('button', { type: 'button', class: 'text-button', onclick: () => { contract.prices.splice(index, 1); render(); onChange(); } }, 'Убрать'),
      ]);
      row._priceFields = { from, to, rates };
      return row;
    }));
    if (!contract.prices.length) list.append(el('p', { class: 'muted' }, 'Цены не настроены. Добавьте период, чтобы рассчитать стоимость.'));
  };
  render();
  return {
    element: el('div', {}, [list, el('button', { type: 'button', class: 'text-button', onclick: () => { contract.prices.push({ valid_from: `${currentMonth()}-01`, t1: '', t2: '', t3: '' }); render(); onChange(); } }, '+ Добавить период цен')]),
    collect() {
      const rows = [...list.querySelectorAll('.electricity-price-row')];
      return rows.map((row) => {
        const f = row._priceFields;
        const result = { valid_from: value(f.from), valid_to: value(f.to) || null };
        for (let i = 1; i <= 3; i++) result[`t${i}`] = value(f.rates[i - 1]) === '' ? null : Number(value(f.rates[i - 1]));
        return result;
      }).filter((p) => p.valid_from && p.t1 !== null);
    },
  };
}

function contractSettings(contract, meters, reload) {
  const selected = new Set(contract.meter_ids || []);
  const checks = meters.map((meter) => {
    const check = el('input', { type: 'checkbox', value: meter.id, ...(selected.has(meter.id) ? { checked: true } : {}) });
    return el('label', { class: 'electricity-meter-choice' }, [check, el('span', {}, `${meter.name || 'Счётчик'} № ${meter.serial_number} · коэф. ${meter.coefficient} · ${meter.tariffs} тарифа`)]);
  });
  const checkHost = el('div', { class: 'electricity-meter-choices' }, checks.length ? checks : el('p', { class: 'muted' }, 'Нет общедомовых электросчётчиков.'));
  const editor = priceEditor(contract, () => {});
  const message = el('p', { class: 'muted', role: 'status' });
  const form = el('form', { class: 'electricity-settings', onsubmit: async (event) => {
    event.preventDefault();
    const save = form.querySelector('[type="submit"]'); save.disabled = true; message.textContent = 'Сохраняю…';
    try {
      const meterIDs = [...checkHost.querySelectorAll('input:checked')].map((c) => Number(c.value));
      await electricityApi.updateContract(contract.id, { meter_ids: meterIDs, prices: editor.collect() });
      message.textContent = 'Настройки сохранены'; await reload();
    } catch (err) { message.textContent = describeApiError(err).message; }
    finally { save.disabled = false; }
  } }, [
    el('h3', {}, 'Счётчики контракта'), checkHost,
    el('h3', {}, 'Цены по зонам, ₽ за кВт·ч'),
    el('p', { class: 'muted' }, 'Укажите даты действия и цену Т1–Т3. Пустая дата окончания означает, что цена действует дальше.'),
    editor.element,
    el('div', { class: 'electricity-save' }, [el('button', { type: 'submit', class: 'btn' }, 'Сохранить настройки'), message]),
  ]);
  return el('details', { class: 'card electricity-settings-card' }, [el('summary', {}, 'Состав контракта и цены'), form]);
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
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let contracts; let meters;
  try {
    const [contractResult, meterResult] = await Promise.all([electricityApi.listContracts(), listElectricityMeters()]);
    contracts = contractResult.items; meters = meterResult;
  } catch (err) {
    container.replaceChildren(el('div', { class: 'page' }, el('div', { class: 'card empty-state' }, describeApiError(err).message)));
    return;
  }
  let period = currentMonth();
  const picker = createMonthPicker({ value: period, onChange: (month) => { period = month; load(); } });
  const output = el('div', { class: 'electricity-output' });
  const settings = el('div', { class: 'electricity-settings-list' });
  const load = async () => {
    output.replaceChildren(el('p', { class: 'muted' }, 'Считаю…'));
    try { output.replaceChildren(resultView(await electricityApi.calculation(period))); }
    catch (err) { output.replaceChildren(el('div', { class: 'card empty-state' }, describeApiError(err).message)); }
  };
  const renderSettings = () => settings.replaceChildren(...contracts.map((contract) => contractSettings(contract, meters, async () => {
    ({ items: contracts } = await electricityApi.listContracts()); renderSettings(); await load();
  })));
  renderSettings(); await load();
  container.replaceChildren(el('div', { class: 'page electricity-page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Электроэнергия Мосэнергосбыта')),
    el('p', { class: 'muted' }, 'Расход уже учитывает коэффициент трансформации счётчика; стоимость рассчитывается по ценам тарифных зон.'),
    el('div', { class: 'card electricity-period' }, picker.element), output,
    canWrite() ? el('section', {}, [el('h2', {}, 'Настройки контрактов'), settings]) : null,
  ]));
}
