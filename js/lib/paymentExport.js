// Выбор платежей для выгрузки в реестр и тексты окна выгрузки. Без DOM, покрыто тестами.
//
// Выбор хранится как {all, ids}: при all=false ids — отмеченные платежи; при all=true выбраны все подходящие
// по фильтру платежи на всех страницах, а ids — снятые с выбора (исключения). Так «выбрать всё» не требует id тысяч платежей.

export const emptySelection = () => ({ all: false, ids: new Set() });
export const selectAllMatching = () => ({ all: true, ids: new Set() });

export const isSelected = (sel, id) => (sel.all ? !sel.ids.has(id) : sel.ids.has(id));
export const isEmptySelection = (sel) => !sel.all && sel.ids.size === 0;

// Отметить или снять отметку у платежей ids. В режиме «все» снятие отметки заносит платёж в исключения.
export function setSelected(sel, ids, on) {
  const ids2 = new Set(sel.ids);
  const add = on !== sel.all;
  for (const id of ids) {
    if (add) ids2.add(id);
    else ids2.delete(id);
  }
  return { all: sel.all, ids: ids2 };
}

// Тело запроса preview/create. expected — сколько платежей пользователь видел в предпросмотре.
export function exportBody(sel, expected) {
  const body = { mode: sel.all ? 'filter' : 'ids', ids: [...sel.ids] };
  if (expected !== undefined) body.expected_count = expected;
  return body;
}

// Платёж можно выгрузить, если он из выписки (не строка реестра), привязан к лицевому счёту и ещё не выгружен.
export const canExport = (row) => !row.registry_id && !!row.personal_account_id && !row.export_id && !row.deleted_at;

export function selectionText(sel, preview, plural) {
  if (isEmptySelection(sel)) return 'Отметьте платежи галочками или выберите все невыгруженные по фильтру.';
  if (!sel.all) return `Отмечено платежей: ${sel.ids.size}.`;
  if (!preview) return 'Выбраны все невыгруженные платежи по фильтру…';
  const excluded = sel.ids.size ? `, снято с выбора: ${sel.ids.size}` : '';
  return `Выбраны все невыгруженные по фильтру: ${preview.count} ${plural(preview.count, 'платёж', 'платежа', 'платежей')}${excluded}.`;
}
