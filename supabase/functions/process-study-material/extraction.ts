export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
};
export const kinds = ['notes', 'coursework', 'course_outline', 'other'] as const;
export type Extraction = {
  title: string;
  kind: typeof kinds[number];
  summary: string;
  sections: { heading: string; content: string }[];
  key_terms: { term: string; definition: string }[];
};
const text = { type: 'string' };
export const extractionSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: text, kind: { type: 'string', enum: kinds }, summary: text,
    sections: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: { heading: text, content: text }, required: ['heading', 'content'],
    } },
    key_terms: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: { term: text, definition: text }, required: ['term', 'definition'],
    } },
  },
  required: ['title', 'kind', 'summary', 'sections', 'key_terms'],
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => key in value);
}
export function parseExtraction(value: unknown): Extraction {
  if (!record(value) || !exactKeys(value, ['title', 'kind', 'summary', 'sections', 'key_terms']) ||
    typeof value.title !== 'string' || !value.title.trim() || typeof value.summary !== 'string' ||
    !kinds.includes(value.kind as Extraction['kind']) ||
    !Array.isArray(value.sections) || !value.sections.every(s => record(s) &&
      exactKeys(s, ['heading', 'content']) && typeof s.heading === 'string' && typeof s.content === 'string') ||
    !Array.isArray(value.key_terms) || !value.key_terms.every(t => record(t) &&
      exactKeys(t, ['term', 'definition']) && typeof t.term === 'string' && typeof t.definition === 'string')) {
    throw new Error('The model returned invalid study material. Please retry.');
  }
  return value as Extraction;
}
export function validateFile(name: string, mime: string, bytes: Uint8Array) {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (!MIME_TYPES[extension] || MIME_TYPES[extension] !== mime || bytes.length === 0 || bytes.length > MAX_FILE_BYTES) {
    throw new Error('Use a PDF, DOCX, DOC, JPEG, or PNG file up to 2 MB.');
  }
  const matches = (signature: number[]) => signature.every((b, i) => bytes[i] === b);
  const valid = extension === 'pdf' ? matches([37, 80, 68, 70, 45]) :
    extension === 'docx' ? matches([80, 75, 3, 4]) :
    extension === 'doc' ? matches([208, 207, 17, 224, 161, 177, 26, 225]) :
    extension === 'png' ? matches([137, 80, 78, 71, 13, 10, 26, 10]) : matches([255, 216, 255]);
  if (!valid) throw new Error('The file contents do not match its file type.');
}
export function readOutput(response: { status?: string; output?: { content?: { type: string; text?: string }[] }[] }) {
  if (response.status !== 'completed') throw new Error('The model could not finish this document. Try a smaller file.');
  const parts = response.output?.flatMap(item => item.content ?? []) ?? [];
  if (parts.some(part => part.type === 'refusal')) throw new Error('The model could not process this document.');
  const output = parts.filter(part => part.type === 'output_text').map(part => part.text ?? '').join('');
  return parseExtraction(JSON.parse(output));
}
