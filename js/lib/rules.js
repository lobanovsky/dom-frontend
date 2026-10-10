// Правила определения лицевых счетов: подписи, заготовки и описания условий/действий. Без DOM, покрыто тестами.

export const CONDITION_FIELDS = {
  payer_name: 'ФИО или название плательщика',
  payer_inn: 'ИНН плательщика',
  payer_account: 'Счёт плательщика',
  payer_bank: 'Банк плательщика',
  purpose: 'Назначение платежа',
  doc_number: 'Номер документа',
  comment: 'Комментарий',
  operation_type: 'ВО (вид операции)',
  amount: 'Сумма',
  bank_account_id: 'Банковский счёт (получатель)',
};

// У исходящих платежей контрагент — получатель, поля называются recipient_*.
export const CONDITION_FIELDS_OUTGOING = {
  recipient_name: 'Название или ФИО получателя',
  recipient_inn: 'ИНН получателя',
  recipient_account: 'Счёт получателя',
  recipient_bank: 'Банк получателя',
  purpose: 'Назначение платежа',
  doc_number: 'Номер документа',
  comment: 'Комментарий',
  operation_type: 'ВО (вид операции)',
  amount: 'Сумма',
  bank_account_id: 'Банковский счёт (с которого списано)',
};

export const conditionFields = (direction) => (direction === 'outgoing' ? CONDITION_FIELDS_OUTGOING : CONDITION_FIELDS);

const fieldLabel = (field) => CONDITION_FIELDS[field] || CONDITION_FIELDS_OUTGOING[field] || field;

export const TEXT_OPS = {
  contains: 'содержит',
  not_contains: 'не содержит',
  equals: 'равно',
  starts_with: 'начинается с',
  regex: 'подходит под выражение',
};

export const AMOUNT_OPS = { equals: 'равна', gt: 'больше', lt: 'меньше', between: 'между' };

export const MATCH_MODES = { all: 'Все условия', any: 'Любое из условий' };

export const ACTION_TYPES = {
  link_by_owner: 'Найти по ФИО плательщика среди собственников и плательщиков счетов',
  account_from_text: 'Взять номер лицевого счёта из текста',
  link_premises: 'Привязать к помещению',
  link_account: 'Привязать к конкретному лицевому счёту',
  premises_from_text: 'Взять номер помещения из текста',
  set_category: 'Поставить категорию (платёж не за лицевой счёт)',
};

const textFields = (fields) => Object.keys(fields).filter((f) => f !== 'amount' && f !== 'bank_account_id');
export const TEXT_FIELD_NAMES = textFields(CONDITION_FIELDS);
export const textFieldNames = (direction) => textFields(conditionFields(direction));

// Исходящим платежам правила ставят только категорию.
export const actionTypes = (direction) => (direction === 'outgoing' ? { set_category: 'Поставить категорию' } : ACTION_TYPES);

// Тексты интерфейса по направлению платежей.
export const DIRECTION_TEXTS = {
  incoming: {
    assign: 'Определить лицевые счета',
    assignTitle: 'Определить лицевые счета',
    historyTitle: 'История определения лицевых счетов',
    rulesTitle: 'Правила определения лицевых счетов',
    counterparty: 'Плательщик',
    target: 'Лицевой счёт / категория',
    noun: 'привязку',
    unassigned: 'Только платежи без привязки',
  },
  outgoing: {
    assign: 'Определить категории',
    assignTitle: 'Определить категории',
    historyTitle: 'История определения категорий',
    rulesTitle: 'Правила определения категорий исходящих платежей',
    counterparty: 'Получатель',
    target: 'Категория',
    noun: 'категорию',
    unassigned: 'Только платежи без категории',
  },
};
export const directionTexts = (direction) => DIRECTION_TEXTS[direction] || DIRECTION_TEXTS.incoming;

export function opsFor(field) {
  if (field === 'amount') return AMOUNT_OPS;
  if (field === 'bank_account_id') return { equals: 'равен' };
  return TEXT_OPS;
}

export const newCondition = () => ({ field: 'purpose', op: 'contains', values: [''], ignore_spaces: false });

// Приводит условия формы к виду для API: пустые значения убираются, условия без значений отбрасываются.
export function normalizeConditions(list) {
  return (Array.isArray(list) ? list : [])
    .map((c) => {
      const out = { field: c.field, op: c.op, values: (c.values || []).map((v) => String(v).trim()).filter(Boolean) };
      if (c.ignore_spaces && c.field !== 'amount' && c.field !== 'bank_account_id' && c.op !== 'regex') out.ignore_spaces = true;
      return out;
    })
    .filter((c) => c.values.length > 0);
}

// Смена поля сбрасывает операцию и значения, если они не подходят к новому полю.
export function changeField(condition, field) {
  const ops = opsFor(field);
  const op = ops[condition.op] ? condition.op : Object.keys(ops)[0];
  const wasNumeric = condition.field === 'amount' || condition.field === 'bank_account_id';
  const isNumeric = field === 'amount' || field === 'bank_account_id';
  return { ...condition, field, op, values: wasNumeric !== isNumeric ? [''] : condition.values };
}

export function describeCondition(c, { bankName = (id) => `#${id}`, direction } = {}) {
  const field = conditionFields(direction)[c.field] || fieldLabel(c.field);
  const values = c.values || [];
  if (c.field === 'amount') {
    const op = AMOUNT_OPS[c.op] || c.op;
    return c.op === 'between' ? `${field} ${op} ${values[0]} и ${values[1]}` : `${field} ${op} ${values[0]}`;
  }
  if (c.field === 'bank_account_id') return `${field} — ${values.map((v) => bankName(Number(v))).join(' или ')}`;
  const op = TEXT_OPS[c.op] || c.op;
  const quoted = values.map((v) => `«${v}»`).join(' или ');
  return `${field} ${op} ${quoted}${c.ignore_spaces ? ' (без пробелов)' : ''}`;
}

export function describeConditions(rule, ctx) {
  const conds = rule.conditions || [];
  if (conds.length === 0) return 'Любой платёж';
  const sep = rule.match_mode === 'any' ? ' ИЛИ ' : ' И ';
  return conds.map((c) => describeCondition(c, { ...ctx, direction: rule.direction })).join(sep);
}

// ctx: {categoryName(id), premisesLabel(id), accountLabel(id)}
export function describeAction(a, ctx = {}) {
  const premises = (id) => (ctx.premisesLabel ? ctx.premisesLabel(id) : `помещение #${id}`);
  const account = (id) => (ctx.accountLabel ? ctx.accountLabel(id) : `ЛС #${id}`);
  const category = (id) => (ctx.categoryName ? ctx.categoryName(id) : `категория #${id}`);
  switch (a.type) {
    case 'link_by_owner': return 'Найти по ФИО (собственник/плательщик счёта)';
    case 'account_from_text': return `Номер ЛС из поля «${fieldLabel(a.field || 'purpose')}»${a.ignore_spaces ? ' (без пробелов)' : ''}: ${a.pattern}`;
    case 'link_premises': return `Помещение: ${premises(a.premises_id)}`;
    case 'link_account': return `Лицевой счёт: ${account(a.personal_account_id)}`;
    case 'premises_from_text': return `Номер помещения из поля «${fieldLabel(a.field || 'purpose')}»: ${a.pattern}`;
    case 'set_category': return `Категория: ${category(a.category_id)}`;
    default: return a.type;
  }
}

export const DEFAULT_ACTION = { type: 'link_by_owner' };
export const defaultAction = (direction) => (direction === 'outgoing' ? { type: 'set_category' } : DEFAULT_ACTION);

// Очистка действия перед отправкой: оставляются только поля выбранного типа.
export function normalizeAction(a) {
  const out = { type: a.type };
  switch (a.type) {
    case 'link_premises': out.premises_id = a.premises_id ?? null; break;
    case 'link_account': out.personal_account_id = a.personal_account_id ?? null; break;
    case 'set_category': out.category_id = a.category_id ?? null; break;
    case 'account_from_text':
    case 'premises_from_text':
      out.field = a.field || 'purpose';
      out.pattern = (a.pattern || '').trim();
      if (a.ignore_spaces) out.ignore_spaces = true;
      if (a.type === 'premises_from_text') {
        out.premises_kind = a.premises_kind || 'apartment';
        if (a.building_id) out.building_id = a.building_id;
      }
      break;
    default: break;
  }
  return out;
}

// Подписи результата предпросмотра/определения.
export const CHANGE_LABELS = {
  new: 'Новая привязка',
  changed: 'Привязка изменится',
  same: 'Без изменений',
  cleared: 'Привязка снимется',
  unresolved: 'Не определён',
};

export const CHANGE_LABELS_OUTGOING = {
  ...CHANGE_LABELS,
  new: 'Новая категория',
  changed: 'Категория изменится',
  cleared: 'Категория снимется',
};

export const changeLabels = (direction) => (direction === 'outgoing' ? CHANGE_LABELS_OUTGOING : CHANGE_LABELS);

export function previewSummary(p, direction = 'incoming') {
  const outgoing = direction === 'outgoing';
  const parts = [`Проверено платежей: ${p.candidates}.`];
  if (p.new) parts.push(`Получат ${outgoing ? 'категорию' : 'привязку'}: ${p.new}.`);
  if (p.changed) parts.push(`${outgoing ? 'Категория изменится' : 'Привязка изменится'}: ${p.changed}.`);
  if (p.cleared) parts.push(`${outgoing ? 'Категория снимется' : 'Привязка снимется'}: ${p.cleared}.`);
  if (p.same) parts.push(`Без изменений: ${p.same}.`);
  parts.push(`Останутся ${outgoing ? 'без категории' : 'без привязки'}: ${p.unresolved}.`);
  return parts.join(' ');
}

// Есть ли что применять.
export const hasChanges = (p) => p.new + p.changed + p.cleared > 0;

export const MODE_LABELS = {
  unassigned: 'Только платежи без привязки',
  recompute: 'Пересчитать и то, что раньше определили правила',
};

// Фильтры списка платежей -> область определения лицевых счетов (scope для API).
export function scopeFromQuery(query = {}) {
  const scope = {};
  for (const key of ['bank_account_id', 'registry_id', 'statement_id', 'category_id']) {
    const n = Number(query[key]);
    if (query[key] !== undefined && query[key] !== '' && Number.isFinite(n)) scope[key] = n;
  }
  for (const key of ['amount_from', 'amount_to']) {
    const n = Number(query[key]);
    if (query[key] !== undefined && query[key] !== '' && Number.isFinite(n)) scope[key] = n;
  }
  for (const key of ['date_from', 'date_to', 'q']) {
    if (typeof query[key] === 'string' && query[key].trim() !== '') scope[key] = query[key].trim();
  }
  return scope;
}

export const originLabel = (p) => {
  switch (p.assigned_by) {
    case 'registry': return 'из реестра';
    case 'manual': return 'вручную';
    case 'rule': return p.rule_name ? `по правилу «${p.rule_name}»` : 'по правилу';
    default: return '';
  }
};
