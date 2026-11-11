import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadServerNotice, parseServerNotice } from '../src/modules/accounts/server-notice.js';

const notice = { id: 'welcome', enabled: true, title: 'Welcome', message: 'Hello', news: [' News ', ' '], upcomingEvents: [] };
test('notice keeps structured sections and removes empty entries', () => {
  assert.deepEqual(parseServerNotice(notice), { ...notice, news: ['News'] });
  assert.equal(parseServerNotice({ ...notice, enabled: false }).enabled, false);
});
test('invalid or unbounded notices are rejected', () => {
  for (const value of [null, [], { ...notice, id: '' }, { ...notice, enabled: 'true' },
    { ...notice, message: 'x'.repeat(4097) }, { ...notice, news: [1] }, { ...notice, upcomingEvents: Array(21).fill('event') }])
    assert.throws(() => parseServerNotice(value));
});
test('login reads the repository notice; no active notice disables presentation', async () => {
  const example = await loadServerNotice({serverNotice:async()=>notice});
  assert.equal(example.id, 'welcome');
  assert.equal(example.enabled, true);
  const missing = await loadServerNotice({serverNotice:async()=>null});
  assert.equal(missing.enabled, false);
  assert.deepEqual(missing.news, []);
});
