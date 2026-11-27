import assert from 'node:assert/strict';
import site from '../dist/server/index.js';

const origin = 'https://talentalign.example';
const homepage = await site.fetch(new Request(origin + '/jobs'));
assert.equal(homepage.status, 200);
const html = await homepage.text();
assert.match(html, /TalentAlign \| Career Intelligence/);
for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
  const asset = await site.fetch(new Request(origin + match[1]));
  assert.equal(asset.status, 200, match[1]);
  assert.ok((await asset.arrayBuffer()).byteLength > 0, match[1]);
}
assert.equal((await site.fetch(new Request(origin + '/roles/ROLE_1001'))).status, 200);
assert.equal((await site.fetch(new Request(origin + '/missing.png'))).status, 404);
assert.equal((await site.fetch(new Request(origin + '/api/workspace/jobs', { method: 'POST' }))).status, 405);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => Response.json({ jobs: [{
    id: 456, internal_job_id: 1, title: 'Software Engineer', location: { name: 'Bengaluru, India' },
    absolute_url: 'https://example.com/careers/456',
    content: '<h3>Minimum qualifications</h3><ul><li>3+ years of experience with Python and PostgreSQL</li></ul>' +
      '<h3>Preferred qualifications</h3><ul><li>Docker</li></ul><h3>Benefits</h3><p>Our Terraform workshop</p>',
  }] });
  const live = await (await site.fetch(new Request(origin + '/api/workspace/jobs?refresh=1'))).json();
  assert.equal(live.status, 'live');
  assert.equal(live.sources.length, 8);
  assert.ok(live.jobs[0].skills.includes('Python'));
  assert.ok(live.jobs[0].skills.includes('PostgreSQL'));
  assert.deepEqual(live.jobs[0].preferred, ['Docker']);
  assert.ok(!live.jobs[0].skills.includes('Terraform'));
  assert.equal(live.jobs[0].level, 'Mid Level');

  globalThis.fetch = async () => new Response(null, { status: 503 });
  const fallback = await (await site.fetch(new Request(origin + '/api/workspace/jobs?refresh=1'))).json();
  assert.equal(fallback.status, 'snapshot');
  assert.equal(fallback.unavailable.length, 8);
  assert.equal(fallback.jobs[0].title, 'Software Engineer');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Worker asset, route, primary feed, extraction, and fallback checks passed.');

const { DatabaseSync } = await import('node:sqlite');
const { readFile } = await import('node:fs/promises');
const database = new DatabaseSync(':memory:');
database.exec(await readFile('drizzle/0000_saved_assessments.sql', 'utf8'));
const env = { DB: {
  prepare(sql) {
    const statement = database.prepare(sql);
    return { bind: (...values) => ({
      first: async () => statement.get(...values) ?? null,
      run: async () => statement.run(...values),
    }) };
  },
} };
const path = origin + '/api/workspace/assessment';
const user = id => ({ 'oai-authenticated-user-id': id });
const put = (id, result, extraHeaders = {}) => site.fetch(new Request(path, {
  method: 'PUT',
  headers: { ...user(id), 'Content-Type': 'application/json', ...extraHeaders },
  body: JSON.stringify(result),
}), env);
const get = id => site.fetch(new Request(path, { headers: user(id) }), env);
const earlier = { completedAt: 1720000000000, vector: [.4, .3, .2, .1], interests: [], workStyles: [] };
const later = { ...earlier, completedAt: earlier.completedAt + 1, vector: [.2, .5, .2, .1] };

assert.equal((await site.fetch(new Request(path), env)).status, 401);
assert.equal((await site.fetch(new Request(path, { headers: user('alice') }))).status, 503);
assert.equal((await put('alice', earlier, { Origin: 'https://example.org' })).status, 403);
assert.equal((await put('alice', { ...earlier, vector: [] })).status, 400);
assert.deepEqual((await (await put('alice', earlier)).json()).result, earlier);
assert.equal((await get('alice')).headers.get('cache-control'), 'private, no-store');
assert.deepEqual((await (await get('alice')).json()).result, earlier);
assert.equal((await (await get('bob')).json()).result, null);
assert.deepEqual((await (await put('alice', later)).json()).result, later);
assert.deepEqual((await (await put('alice', earlier)).json()).result, later);
database.close();
console.log('Assessment account persistence, isolation, and retake updates passed.');
