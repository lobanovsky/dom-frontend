import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { openAssignDialog } from '../../ui/assignDialog.js';
import { toast } from '../../ui/toast.js';
import { paymentRulesApi, premisesApi, buildingsApi, accountsApi } from '../../api/resources.js';
import { paymentRuleFields } from '../fields.js';
import { premisesKinds, accountPurposes, label } from '../../lib/labels.js';
import { describeConditions, describeAction, DEFAULT_ACTION } from '../../lib/rules.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { loadPaymentRefs } from './common.js';

// Правила определения лицевых счетов: список по порядку применения; первое подошедшее правило определяет платёж.
export async function paymentRulesPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let refs;
  try {
    refs = await loadPaymentRefs();
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }

  // Подписи помещений и лицевых счетов из действий правил: подгружаются вместе со списком.
  const premisesLabels = new Map();
  const accountLabels = new Map();
  let addresses = null;
  async function warm(rules) {
    if (!addresses) {
      const { items } = await buildingsApi.list({ limit: 200 });
      addresses = new Map(items.map((b) => [b.id, b.address]));
    }
    const jobs = [];
    for (const r of rules) {
      const { premises_id: pid, personal_account_id: aid } = r.action || {};
      if (pid && !premisesLabels.has(pid)) {
        premisesLabels.set(pid, `помещение #${pid}`);
        jobs.push(premisesApi.get(pid).then((p) => premisesLabels.set(pid, `${label(premisesKinds, p.kind)} № ${p.number}, ${addresses.get(p.building_id) || ''}`), () => {}));
      }
      if (aid && !accountLabels.has(aid)) {
        accountLabels.set(aid, `#${aid}`);
        jobs.push(accountsApi.get(aid).then((a) => accountLabels.set(aid, `№ ${a.number} (${label(accountPurposes, a.purpose)})`), () => {}));
      }
    }
    await Promise.all(jobs);
  }

  let shown = []; // правила на текущей странице списка в порядке применения
  const api = {
    ...paymentRulesApi,
    list: async (query) => {
      const res = await paymentRulesApi.list(query);
      await warm(res.items);
      shown = res.items;
      return res;
    },
  };
  const ctx = {
    bankName: (id) => refs.bankName(id) || `#${id}`,
    categoryName: (id) => refs.categoryName(id) || `#${id}`,
    premisesLabel: (id) => premisesLabels.get(id) || `помещение #${id}`,
    accountLabel: (id) => accountLabels.get(id) || `#${id}`,
  };

  async function move(rule, delta) {
    const ids = shown.map((r) => r.id);
    const i = ids.indexOf(rule.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await paymentRulesApi.reorder(ids);
      list.reload();
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
    }
  }

  const list = createCrudList({
    api,
    entityTitle: 'Правило',
    addLabel: 'Добавить правило',
    fields: paymentRuleFields({ banks: refs.banks, categories: refs.incomingCategories }),
    newDefaults: { enabled: true, match_mode: 'all', action: DEFAULT_ACTION },
    columns: [
      { key: 'position', label: '№', primary: true, render: (r) => `${shown.indexOf(r) + 1}. ${r.name}` },
      { key: 'conditions', label: 'Если', render: (r) => describeConditions(r, ctx) },
      { key: 'action', label: 'То', render: (r) => describeAction(r.action, ctx) },
      { key: 'enabled', label: 'Статус', render: (r) => el('span', { class: r.enabled ? 'badge badge-success' : 'badge badge-neutral' }, r.enabled ? 'Включено' : 'Выключено') },
    ],
    extraActions: (r) => [
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Выше', title: 'Выше', onclick: () => move(r, -1) }, '↑'),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Ниже', title: 'Ниже', onclick: () => move(r, 1) }, '↓'),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => openAssignDialog({ ruleId: r.id, title: `Проверка правила «${r.name}»` }) }, 'Проверить'),
    ],
    emptyMessage: 'Правил пока нет',
    deleteMessage: (r) => `Удалить правило «${r.name}»? Привязки, которые оно уже сделало, останутся.`,
  });

  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Правила определения лицевых счетов')),
    el('p', { class: 'field-help' }, 'Правила применяются сверху вниз; платёж определяет первое подошедшее правило. Если у правила условия подошли, но лицевой счёт найти не удалось, проверяется следующее правило. Кнопка «Определить лицевые счета» находится на странице «Входящие платежи»: там сначала показывается предпросмотр, а запуск можно откатить.'),
    list.element,
  ]));
}
