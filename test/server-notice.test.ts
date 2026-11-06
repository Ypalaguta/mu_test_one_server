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
test('notice is read independently of Mongo and missing file disables presentation', async () => {
  const example = await loadServerNotice();
  assert.equal(example.id, 'welcome-2026-11');
  assert.equal(example.enabled, true);
  const missing = await loadServerNotice(new URL('./nonexistent-notice.json', import.meta.url));
  assert.equal(missing.enabled, false);
  assert.deepEqual(missing.news, []);
});
