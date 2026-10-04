import { isActiveOn } from './format.js';

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// Сумма долей владений, действующих на дату day, в виде несократимой дроби.
export function activeShareSum(ownerships, day) {
  let num = 0;
  let den = 1;
  for (const o of ownerships) {
    if (!isActiveOn(o.valid_from, o.valid_to, day)) continue;
    num = num * o.share_den + o.share_num * den;
    den *= o.share_den;
    const g = gcd(num, den);
    num /= g;
    den /= g;
  }
  return { num, den };
}

// Подпись для суммы долей: «1/2 из 1», «полностью», «нет действующих».
export function describeShareSum({ num, den }) {
  if (num === 0) return 'нет действующих собственников';
  if (num === den) return 'распределено полностью';
  if (num > den) return `превышает 1 (${num}/${den})`;
  return `распределено ${num}/${den}`;
}
