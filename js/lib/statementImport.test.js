import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryText, summaryTone, isProblem, problemFiles } from './statementImport.js';

const base = { files_imported: 0, files_failed: 0, files_ignored: 0, incoming_created: 0, outgoing_created: 0, operations_skipped: 0 };

test('statement summary', () => {
  const ok = { ...base, files_imported: 2, incoming_created: 54, outgoing_created: 23, operations_skipped: 5, files_ignored: 1 };
  assert.equal(
    summaryText(ok),
    'Загружено: 2 файла. Поступлений: 54, списаний: 23. Пропущено операций, которые уже были загружены раньше: 5. Пропущено файлов, не похожих на выписки: 1.',
  );
  assert.equal(summaryTone(ok), 'success');
  assert.equal(summaryTone({ ...ok, files_failed: 1 }), 'warning');
  assert.equal(summaryText(base), 'Ни одна выписка не загружена.');
  assert.equal(summaryTone(base), 'error');
});

test('overlapping statements are not a problem, failed files are', () => {
  const imported = { file_name: 'ok', status: 'imported', result: { skipped: [{}] } };
  assert.equal(isProblem(imported), false);
  const files = [imported, { file_name: 'dup', status: 'duplicate_file' }, { file_name: 'bad', status: 'invalid' }, { file_name: 'unk', status: 'unknown_account' }];
  assert.deepEqual(problemFiles(files).map((f) => f.file_name), ['bad', 'unk', 'dup']);
});
