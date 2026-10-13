import assert from 'node:assert/strict';
import { handleRequest } from './handler.ts';
const userId = '11111111-1111-4111-8111-111111111111';
const fileId = '22222222-2222-4222-8222-222222222222';
const attemptId = '33333333-3333-4333-8333-333333333333';
const content = { title: 'Cells', kind: 'notes', summary: 'Cell structure', sections: [], key_terms: [] };
function request(token = 'test-token') {
  return new Request('http://localhost/process-study-material', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });
}
Deno.test('function authenticates, checks ownership, saves structured output, and persists failures', async () => {
  for (const [key, value] of Object.entries({ SUPABASE_URL: 'http://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'test-key', OPENAI_API_KEY: 'test-openai-key' })) Deno.env.set(key, value);
  const originalFetch = globalThis.fetch;
  let mode = 'success';
  let openaiCalls = 0;
  const writes: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/auth/v1/user')) return mode === 'unauthorized' ? respond({ message: 'Invalid token' }, 401) : respond({ id: userId, app_metadata: {}, user_metadata: {} });
    if (url.includes('/rest/v1/files')) {
      assert.ok(url.includes(`user_id=eq.${userId}`));
      return respond(mode === 'wrong-owner' ? null : {
      id: fileId, user_id: userId, file_name: 'notes.pdf', mime_type: 'application/pdf', size_bytes: 5,
      storage_path: `${userId}/${fileId}/source.pdf`,
    });
    }
    if (url.includes('/rest/v1/rpc/claim_file_extraction')) return respond(mode === 'cached' ? [] : [{ attempt_id: attemptId }]);
    if (url.includes('/storage/v1/object/')) return new Response(new Uint8Array(mode === 'invalid-file' ? [1, 2, 3, 4, 5] : [37, 80, 68, 70, 45]));
    if (url === 'https://api.openai.com/v1/responses') {
      openaiCalls++;
      const body = JSON.parse(init?.body as string);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.store, false);
      assert.equal(body.input[0].content[1].type, 'input_file');
      if (mode === 'provider-error') return respond({ error: 'test' }, 429);
      return respond({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(content) }] }] });
    }
    if (url.includes('/rest/v1/file_extractions')) {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(init.body as string);
        assert.ok(url.includes(`attempt_id=eq.${attemptId}`));
        writes.push(body);
        return respond({ ...body, attempts: 1 });
      }
      return respond({ status: 'ready', content, attempts: 1 });
    }
    throw new Error(`Unexpected test request: ${url}`);
  }) as typeof fetch;
  try {
    assert.equal((await handleRequest(new Request('http://localhost', { method: 'OPTIONS' }))).status, 200);
    assert.equal((await handleRequest(new Request('http://localhost', { method: 'POST' }))).status, 401);
    assert.equal((await handleRequest(new Request('http://localhost', { method: 'GET' }))).status, 405);
    assert.equal((await handleRequest(new Request('http://localhost', { method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: '{' }))).status, 400);
    assert.equal((await handleRequest(new Request('http://localhost', { method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: JSON.stringify({ file_id: 'invalid' }) }))).status, 400);
    mode = 'unauthorized';
    assert.equal((await handleRequest(request())).status, 401);
    mode = 'wrong-owner';
    assert.equal((await handleRequest(request())).status, 404);
    assert.equal(openaiCalls, 0);
    mode = 'success';
    const response = await handleRequest(request());
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).extraction.content, content);
    assert.equal(writes.at(-1)?.status, 'ready');
    mode = 'cached';
    assert.equal((await handleRequest(request())).status, 200);
    assert.equal(openaiCalls, 1);
    mode = 'invalid-file';
    assert.equal((await handleRequest(request())).status, 502);
    assert.equal(writes.at(-1)?.status, 'failed');
    assert.equal(openaiCalls, 1);
    mode = 'provider-error';
    assert.equal((await handleRequest(request())).status, 502);
    assert.equal(writes.at(-1)?.status, 'failed');
    assert.equal(openaiCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']) Deno.env.delete(key);
  }
});
