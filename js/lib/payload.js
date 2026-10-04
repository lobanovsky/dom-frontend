// Перевод между значениями формы (строки из input) и телом запроса к API.
// Бэкенд принимает PUT целиком, поэтому в тело попадают все поля формы:
// пустые — как null (списки — как []), скрытые (visible() === false) — тоже.

function convert(def, value) {
  if (def.type === 'checkbox') return !!value;
  // Список строк: пустые убираем, остальные обрезаем; пусто — пустой список, не null
  // (бэкенд хранит списки NOT NULL).
  if (def.type === 'list') {
    return (Array.isArray(value) ? value : []).map((v) => String(v).trim()).filter(Boolean);
  }
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (def.type === 'number' || def.numeric) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (def.type === 'picker') return value;
  return typeof value === 'string' ? value.trim() : value;
}

export function toPayload(defs, values, fixed = {}) {
  const body = {};
  for (const def of defs) {
    if (def.virtual) continue;
    const visible = !def.visible || def.visible(values);
    body[def.name] = visible ? convert(def, values[def.name]) : (def.type === 'list' ? [] : null);
  }
  return { ...body, ...fixed };
}

export function toFormValues(defs, entity = {}) {
  const values = {};
  for (const def of defs) {
    const v = entity[def.name];
    if (def.type === 'checkbox') values[def.name] = !!v;
    else if (def.type === 'picker') values[def.name] = v ?? null;
    else if (def.type === 'list') values[def.name] = Array.isArray(v) ? [...v] : [];
    else values[def.name] = v === null || v === undefined ? '' : String(v);
  }
  return values;
}
