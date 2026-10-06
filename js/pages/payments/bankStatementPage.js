import { el } from '../../lib/dom.js';
import { bankStatementsApi } from '../../api/resources.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { notFoundView, definitionList } from '../common.js';
import { loadPaymentRefs } from './common.js';
import { createIncomingList, assignActions } from './incomingPaymentsPage.js';
import { createOutgoingList } from './outgoingPaymentsPage.js';

// Выписка: сводка по файлу и её платежи (поступления и списания).
export async function bankStatementPage(container, { id }) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let statement;
  let refs;
  try {
    [statement, refs] = await Promise.all([bankStatementsApi.get(id), loadPaymentRefs()]);
  } catch (err) {
    container.replaceChildren(notFoundView(describeApiError(err).message, '/bank-statements', 'К списку выписок'));
    return;
  }

  const fixedQuery = { statement_id: statement.id };
  const incoming = createIncomingList(refs, { fixedQuery, showRegistry: false });
  const outgoing = createOutgoingList(refs, { fixedQuery, showSource: false });
  const period = statement.period_from && statement.period_to ? `${formatDate(statement.period_from)} — ${formatDate(statement.period_to)}` : '';
  container.replaceChildren(el('div', { class: 'page' }, [
    el('nav', { class: 'breadcrumbs' }, [el('a', { href: '/bank-statements' }, 'Выписки'), ' / ']),
    el('div', { class: 'section-header' }, [
      el('h1', {}, `Выписка ${period || `№ ${statement.id}`}`),
      el('div', { class: 'header-actions' }, el('a', { class: 'btn', href: bankStatementsApi.fileUrl(statement.id), download: statement.file_name }, 'Скачать файл')),
    ]),
    el('div', { class: 'card' }, definitionList([
      ['Файл', statement.file_name],
      ['Счёт', refs.bankName(statement.bank_account_id)],
      ['Период', period],
      ['Остаток на начало', formatMoney(statement.opening_balance)],
      ['Остаток на конец', formatMoney(statement.closing_balance)],
      ['Поступлений', `${statement.credit_count} на ${formatMoney(statement.credit_total)}`],
      ['Списаний', `${statement.debit_count} на ${formatMoney(statement.debit_total)}`],
      ['Загружена', formatDate(statement.created_at)],
    ])),
    el('div', { class: 'section-header section-header--sub' }, [el('h2', { class: 'section-title' }, 'Поступления'), assignActions(incoming)]),
    incoming.element,
    el('h2', { class: 'section-title' }, 'Списания'),
    outgoing.element,
  ]));
}
