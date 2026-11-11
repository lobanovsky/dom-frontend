import { electricityApi, metersApi } from '../../api/resources.js';
import { el } from '../../lib/dom.js';
import { formatMoney } from '../../lib/format.js';
import { canWrite } from '../../lib/permissions.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { openModal } from '../../ui/modal.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { recentMonths, monthLabel } from '../../lib/electricity.js';

const currentMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit' }).format(new Date());
const input = (type, value = '', attrs = {}) => el('input', { type, value: value ?? '', ...attrs });
const value = (node) => node.value.trim();
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

function priceEditor(contract, onChange) {
  const list = el('div', { class: 'electricity-prices' });
  const sync = () => {
    for (const [index, row] of [...list.querySelectorAll('.electricity-price-row')].entries()) {
      const f = row._priceFields;
      Object.assign(contract.prices[index], { valid_from: f.from.value, valid_to: f.to.value || null,
        ...Object.fromEntries(f.rates.map((field, i) => [`t${i + 1}`, field.value])) });
    }
  };
  const render = () => {
    list.replaceChildren(...contract.prices.map((p, index) => {
      const from = input('date', p.valid_from?.slice(0, 10), { required: true, 'aria-label': 'Действует с' });
      const to = input('date', p.valid_to?.slice(0, 10), { 'aria-label': 'Действует по' });
      const rates = [1, 2, 3].map((i) => input('number', p[`t${i}`], { min: 0, step: '0.0001', ...(i === 1 ? { required: true } : {}), placeholder: `Т${i}, ₽/кВт·ч`, 'aria-label': `Цена Т${i}` }));
      const row = el('div', { class: 'electricity-price-row' }, [
        from, to, ...rates,
        el('button', { type: 'button', class: 'text-button', onclick: () => { sync(); contract.prices.splice(index, 1); render(); onChange(); } }, 'Убрать'),
      ]);
      row._priceFields = { from, to, rates };
      return row;
    }));
    if (!contract.prices.length) list.append(el('p', { class: 'muted' }, 'Цены не настроены. Добавьте период, чтобы рассчитать стоимость.'));
  };
  render();
  return {
    element: el('div', {}, [list, el('button', { type: 'button', class: 'text-button', onclick: () => { sync(); contract.prices.push({ valid_from: `${currentMonth()}-01`, t1: '', t2: '', t3: '' }); render(); onChange(); } }, '+ Добавить период цен')]),
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

function contractSettings(original, meters, contracts, reload) {
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
  const editor = priceEditor(contract, () => {});
  const message = el('p', { class: 'muted', role: 'status' });
  const form = el('form', { class: 'electricity-settings', onsubmit: async (event) => {
    event.preventDefault();
    const save = form.querySelector('[type="submit"]'); save.disabled = true; message.textContent = 'Сохраняю…';
    try {
      const meterIDs = [...checkHost.querySelectorAll('input:checked')].map((c) => Number(c.value));
      const body = { name: name.value.trim(), number: number.value.trim() || null, meter_ids: meterIDs, prices: editor.collect() };
      if (contract.id) await electricityApi.updateContract(contract.id, body);
      else await electricityApi.createContract(body);
      modal.close(); await reload();
    } catch (err) { message.textContent = describeApiError(err).message; }
    finally { save.disabled = false; }
  } }, [
    el('label', { class: 'field' }, ['Название договора', name]),
    el('label', { class: 'field' }, ['Номер договора (необязательно)', number]),
    el('h3', {}, 'Счётчики контракта'), checkHost,
    el('h3', {}, 'Цены по зонам, ₽ за кВт·ч'),
    el('p', { class: 'muted' }, 'Укажите даты действия и цену Т1–Т3. Пустая дата окончания означает, что цена действует дальше.'),
    editor.element,
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
  let contracts = []; let meters = []; let request = 0;
  const output = el('div', { class: 'electricity-output' });
  const reload = async () => {
    const version = ++request;
    output.replaceChildren(el('p', { class: 'muted' }, 'Загрузка расчётов за 12 месяцев…'));
    try {
      const [contractResult, meterList] = await Promise.all([electricityApi.listContracts(), listElectricityMeters()]);
      if (version !== request) return;
      contracts = contractResult.items; meters = meterList;
      const periods = recentMonths(currentMonth());
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
        el('button', { class: 'btn btn-primary', type: 'button', onclick: () => contractSettings(null, meters, contracts, async () => { await reload(); manageContracts(); }) }, 'Добавить договор'),
        ...contracts.map((contract) => el('div', { class: 'electricity-contract-management' }, [
          el('div', {}, [el('strong', {}, contract.name), el('p', { class: 'muted' }, contract.archived_at ? `В архиве с ${contract.archived_at}` : contract.number || `${contract.meter_ids.length} счётчиков`)]),
          !contract.archived_at ? el('div', { class: 'header-actions' }, [
            el('button', { class: 'btn', type: 'button', onclick: () => contractSettings(contract, meters, contracts, async () => { await reload(); manageContracts(); }) }, 'Изменить'),
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
    el('p', { class: 'muted' }, 'Последние 12 месяцев. Расход учитывает коэффициенты счётчиков; стоимость рассчитана по ценам тарифных зон.'), output,
  ]));
  await reload();
}
