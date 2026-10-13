import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExtraction, readOutput, validateFile, MAX_FILE_BYTES } from './extraction.ts';
const content = { title: 'Cells', kind: 'notes', summary: 'Cell structure', sections: [{ heading: 'ATP', content: 'Energy carrier' }], key_terms: [{ term: 'ATP', definition: 'Energy carrier' }] };
test('accepts the agreed extraction shape', () => assert.deepEqual(parseExtraction(content), content));
test('rejects invented classifications, extra fields, malformed nested content', () => {
  for (const value of [{ ...content, kind: 'quiz' }, { ...content, user_id: 'invented' }, { ...content, sections: [{}] }, { ...content, key_terms: [{ term: 12 }] }, { ...content, title: '' }, null]) {
    assert.throws(() => parseExtraction(value));
  }
});
test('rejects incomplete and refused model responses', () => {
  assert.throws(() => readOutput({ status: 'incomplete', output: [] }));
  assert.throws(() => readOutput({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }));
  assert.deepEqual(readOutput({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(content) }] }] }), content);
});
test('checks file signature, MIME, size and supported formats', () => {
  validateFile('notes.PDF', 'application/pdf', new Uint8Array([37, 80, 68, 70, 45]));
  validateFile('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', new Uint8Array([80, 75, 3, 4]));
  assert.throws(() => validateFile('notes.pdf', 'application/pdf', new Uint8Array([80, 75, 3, 4])));
  assert.throws(() => validateFile('notes.exe', 'application/pdf', new Uint8Array([37, 80, 68, 70, 45])));
  assert.throws(() => validateFile('notes.pdf', 'image/png', new Uint8Array([37, 80, 68, 70, 45])));
  assert.throws(() => validateFile('notes.pdf', 'application/pdf', new Uint8Array(MAX_FILE_BYTES + 1)));
  assert.throws(() => validateFile('notes.pdf', 'application/pdf', new Uint8Array()));
});
