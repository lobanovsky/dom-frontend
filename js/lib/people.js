import { isActiveOn } from './format.js';

// Люди помещения: записи о собственности и проживании сводятся в одну строку на человека (юрлицо — на юрлицо).
// tab: 'current' — действующие на day, 'history' — уже закончившиеся или ещё не начавшиеся, 'deleted' — все переданные
// (вызывающий загрузил только удалённые). Собственники идут первыми, остальные в порядке записей (по nameOf, если он задан).
export function groupPeople(ownerships, residencies, { tab, day, nameOf }) {
  const keep = (r) => tab === 'deleted' || (tab === 'current') === isActiveOn(r.valid_from, r.valid_to, day);
  const rows = new Map();
  const rowOf = (key, base) => {
    if (!rows.has(key)) rows.set(key, { key, ...base, ownerships: [], residencies: [] });
    return rows.get(key);
  };
  for (const o of ownerships.filter(keep)) {
    const row = o.person_id
      ? rowOf(`p${o.person_id}`, { personId: o.person_id, legalEntityId: null })
      : rowOf(`l${o.legal_entity_id}`, { personId: null, legalEntityId: o.legal_entity_id });
    row.ownerName = o.owner_name;
    row.ownerKind = o.owner_kind;
    row.ownerships.push(o);
  }
  for (const r of residencies.filter(keep)) rowOf(`p${r.person_id}`, { personId: r.person_id, legalEntityId: null }).residencies.push(r);
  const list = [...rows.values()].map((row) => ({ ...row, isOwner: row.ownerships.length > 0 }));
  const byName = nameOf ? (a, b) => nameOf(a).localeCompare(nameOf(b), 'ru') : () => 0;
  return list.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || byName(a, b));
}
