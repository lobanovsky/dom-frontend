import { formatMoney } from './format.js';
import { payments } from './registryImport.js';

// «Мы платили / нам платили»: оборот с контрагентом одной ячейкой, пусто, если платежей в эту сторону не было.
export function turnover(count, total) {
  return count ? `${payments(count)} · ${formatMoney(total)}` : '';
}

// Счета контрагента: первый целиком и «+N», если их больше одного (бэкенд отдаёт до пяти).
export function accountsText(accounts) {
  if (!accounts?.length) return '';
  return accounts.length > 1 ? `${accounts[0]} (+${accounts.length - 1})` : accounts[0];
}
