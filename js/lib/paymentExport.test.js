import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptySelection, selectAllMatching, isSelected, isEmptySelection, setSelected, exportBody, canExport, selectionText,
} from './paymentExport.js';
import { plural } from './registryImport.js';

test('отметка и снятие в обычном режиме', () => {
  let sel = setSelected(emptySelection(), [1, 2, 3], true);
  assert.deepEqual([...sel.ids], [1, 2, 3]);
  assert.ok(isSelected(sel, 2));
  sel = setSelected(sel, [2], false);
  assert.ok(!isSelected(sel, 2) && isSelected(sel, 3));
  assert.ok(isEmptySelection(setSelected(sel, [1, 3], false)));
});

test('в режиме «все» снятые платежи становятся исключениями', () => {
  let sel = selectAllMatching();
  assert.ok(isSelected(sel, 10) && !isEmptySelection(sel));
  sel = setSelected(sel, [10, 11], false);
  assert.ok(!isSelected(sel, 10) && isSelected(sel, 12));
  assert.deepEqual([...sel.ids], [10, 11]);
  sel = setSelected(sel, [10], true);
  assert.ok(isSelected(sel, 10) && !isSelected(sel, 11));
});

test('состояние не мутируется', () => {
  const a = emptySelection();
  setSelected(a, [1], true);
  assert.equal(a.ids.size, 0);
});

test('тело запроса', () => {
  assert.deepEqual(exportBody(setSelected(emptySelection(), [5, 6], true)), { mode: 'ids', ids: [5, 6] });
  assert.deepEqual(exportBody(setSelected(selectAllMatching(), [7], false), 40), { mode: 'filter', ids: [7], expected_count: 40 });
});

test('какие платежи можно выгрузить', () => {
  assert.ok(canExport({ personal_account_id: 1 }));
  assert.ok(!canExport({ personal_account_id: null }));
  assert.ok(!canExport({ personal_account_id: 1, registry_id: 3 }));
  assert.ok(!canExport({ personal_account_id: 1, export_id: 9 }));
  assert.ok(!canExport({ personal_account_id: 1, deleted_at: '2026-01-01T00:00:00Z' }));
});

test('тексты выбора', () => {
  assert.match(selectionText(emptySelection(), null, plural), /Отметьте платежи/);
  assert.equal(selectionText(setSelected(emptySelection(), [1, 2], true), null, plural), 'Отмечено платежей: 2.');
  assert.match(selectionText(selectAllMatching(), null, plural), /…$/);
  assert.equal(selectionText(setSelected(selectAllMatching(), [1], false), { count: 21 }, plural), 'Выбраны все невыгруженные по фильтру: 21 платёж, снято с выбора: 1.');
});
