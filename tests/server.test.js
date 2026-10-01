const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createService, validateInput, validateOutput } = require('../server/server');
const draft = { title: 'Water basil', note: '', reason: 'You asked for every three days.', intervalDays: 3 };

async function service(t, options = {}) {
  const calls = [];
  const config = Object.assign({ apiKey: 'test-provider-key', accessCode: 'test-access-code', sessionSecret: 'test-signing-secret', origins: ['https://avrit.test'], dailyLimit: 100 }, options.config);
  const server = createService(config, async (url, request) => {
    calls.push({ url, request });
    return options.response || { ok: true, json: async () => ({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(draft) }] }] }) };
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = 'http://127.0.0.1:' + server.address().port;
  async function post(route, body, token, headers = {}) {
    const response = await fetch(origin + route, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Origin: 'https://avrit.test' }, token ? { Authorization: 'Bearer ' + token } : {}, headers), body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  const login = async () => (await post('/api/session', { code: config.accessCode })).body.token;
  return { post, login, calls, config };
}

test('paid API requires a valid session and allowed browser origin', async t => {
  const app = await service(t);
  assert.equal((await app.post('/api/suggest', { task: 'create', text: 'test' })).status, 401);
  assert.equal((await app.post('/api/session', { code: 'wrong' })).status, 401);
  assert.equal((await app.post('/api/session', { code: app.config.accessCode }, null, { Origin: 'https://other.test' })).status, 403);
  const token = await app.login();
  assert.equal((await app.post('/api/suggest', { task: 'create', text: 'test' }, token + 'x')).status, 401);
  assert.equal(app.calls.length, 0);
});

test('draft is structured and provider credentials stay only in the upstream header', async t => {
  const app = await service(t);
  const result = await app.post('/api/suggest', { task: 'create', text: 'Water basil every three days' }, await app.login());
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, draft);
  assert.ok(!JSON.stringify(result).includes(app.config.apiKey));
  const call = app.calls[0];
  assert.ok(!call.url.includes(app.config.apiKey));
  assert.equal(call.request.headers['x-goog-api-key'], app.config.apiKey);
  const payload = JSON.parse(call.request.body);
  assert.equal(payload.store, false);
  assert.equal(payload.response_format.mime_type, 'application/json');
});

test('photo upload is explicit, bounded, and cannot fetch arbitrary URLs', async t => {
  const app = await service(t);
  const token = await app.login();
  assert.equal((await app.post('/api/suggest', { task: 'photo', text: 'Filter', image: 'https://private.test/', mimeType: 'image/jpeg' }, token)).status, 400);
  assert.equal((await app.post('/api/suggest', { task: 'photo', text: 'Filter', image: Buffer.from('not an image').toString('base64'), mimeType: 'image/jpeg' }, token)).status, 400);
  const image = Buffer.from([255, 216, 255, 217]).toString('base64');
  assert.equal((await app.post('/api/suggest', { task: 'photo', text: 'Filter', image, mimeType: 'image/jpeg' }, token)).status, 200);
  assert.equal(JSON.parse(app.calls[0].request.body).input[1].data, image);
});

test('global daily cap blocks paid requests even after a new session', async t => {
  const app = await service(t, { config: { dailyLimit: 1 } });
  const request = { task: 'create', text: 'Water basil every three days' };
  assert.equal((await app.post('/api/suggest', request, await app.login())).status, 200);
  assert.equal((await app.post('/api/suggest', request, await app.login())).status, 429);
  assert.equal(app.calls.length, 1);
});

test('persisted global allowance survives a service restart', async t => {
  const dir = path.join(__dirname, '../.avrit-data/test-' + require('node:crypto').randomUUID());
  const usageFile = path.join(dir, 'usage.json');
  t.after(() => { if (fs.existsSync(usageFile)) fs.unlinkSync(usageFile); if (fs.existsSync(dir)) fs.rmdirSync(dir); });
  const config = { dailyLimit: 1, usageFile };
  const first = await service(t, { config });
  const request = { task: 'create', text: 'Water basil every three days' };
  assert.equal((await first.post('/api/suggest', request, await first.login())).status, 200);
  const restarted = await service(t, { config });
  assert.equal((await restarted.post('/api/suggest', request, await restarted.login())).status, 429);
  assert.equal(restarted.calls.length, 0);
  const stored = fs.readFileSync(usageFile, 'utf8');
  assert.ok(!stored.includes('basil'));
  assert.ok(!stored.includes(first.config.apiKey));
});

test('provider errors and invalid output never leak provider payloads', async t => {
  const failed = await service(t, { response: { ok: false, status: 403, json: async () => ({ error: 'private provider details' }) } });
  const result = await failed.post('/api/suggest', { task: 'create', text: 'Water basil' }, await failed.login());
  assert.equal(result.status, 502);
  assert.ok(!JSON.stringify(result).includes('private provider'));
  const invalid = await service(t, { response: { ok: true, json: async () => ({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"intervalDays":0}' }] }] }) } });
  assert.equal((await invalid.post('/api/suggest', { task: 'create', text: 'Water basil' }, await invalid.login())).status, 502);
});

test('missing provider setup fails closed', async t => {
  const app = await service(t, { config: { apiKey: '' } });
  assert.equal((await app.post('/api/session', { code: 'anything' })).status, 503);
  assert.equal(app.calls.length, 0);
});

test('input and output validation reject out-of-range timing and oversized text', () => {
  assert.throws(() => validateInput({ task: 'create', text: 'a'.repeat(801) }));
  assert.throws(() => validateOutput({ ...draft, intervalDays: 0 }));
  assert.throws(() => validateOutput({ ...draft, intervalDays: '3' }));
  assert.throws(() => validateOutput({ ...draft, intervalDays: 3651 }));
  assert.equal(validateOutput({ ...draft, intervalDays: null }).intervalDays, null);
});

test('schedule estimates forward only bounded routine context and request a friendly practical suggestion', async t => {
  const app = await service(t);
  const result = await app.post('/api/suggest', { task: 'schedule', text: 'Shoe cleaning', templateId: 'shoes', category: 'wardrobe', context: 'Worn daily', profile: { name: 'Private' }, gender: 'private', photos: ['private-photo'] }, await app.login());
  assert.equal(result.status, 200);
  const upstream = JSON.parse(app.calls[0].request.body);
  const data = JSON.parse(upstream.input[0].text);
  assert.deepEqual(data, { task: 'schedule', description: 'Shoe cleaning', category: 'wardrobe', context: 'Worn daily' });
  assert.match(upstream.system_instruction, /warm, specific, achievable suggestion/);
  assert.ok(!JSON.stringify(upstream).includes('Private'));
  assert.ok(!JSON.stringify(upstream).includes('private-photo'));
});

test('health template protection cannot be bypassed by relabelling the category and never invokes the provider', async t => {
  const app = await service(t), token = await app.login();
  for (const body of [
    { task: 'schedule', text: 'Eye checkup', templateId: 'eye-checkup', category: 'self', context: 'Guess the ideal gap' },
    { task: 'schedule', text: 'My medication reminder', category: 'custom', context: '' }
  ]) {
    const result = await app.post('/api/suggest', body, token);
    assert.equal(result.status, 200); assert.equal(result.body.intervalDays, null); assert.match(result.body.reason, /clinician/);
  }
  assert.equal(app.calls.length, 0);
});

test('schedule requests reject oversized context, unknown templates and photo payloads', () => {
  const body = { task: 'schedule', text: 'Hair cutting', category: 'self', context: '' };
  assert.throws(() => validateInput({ ...body, context: 'x'.repeat(501) }));
  assert.throws(() => validateInput({ ...body, templateId: 'not-real' }));
  assert.throws(() => validateInput({ ...body, category: 'not-real' }));
  assert.throws(() => validateInput({ ...body, image: 'not-allowed' }));
});
