import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadData } from '../src/seed/data.js';
import { createOperations, applyOperations } from '../src/seed/operations.js';
import { createApp } from '../src/app.js';
import type { Repository } from '../src/shared/contracts.js';
import { statFields } from '../src/shared/statFields.js';
import { Monster } from '../src/modules/monsters/model.js';
const data = await loadData('data');
const repo: Repository = {
  character: async id => data.characters.find(v => v.id === id) ?? null,
  monster: async id => data.monsters.find(v => v.id === id) ?? null,
  characterClass: async id => data.classes.find(v => v.id === id) ?? null,
  item: async id => data.items.find(v => v.id === id) ?? null,
  skill: async id => data.skills.find(v => v.id === id) ?? null,
  location: async id => data.spawns.find(v => v.locationId === id) ?? null
};
async function withApi(repository: Repository, run: (base: string) => Promise<void>, ready = () => true) {
  const server = createApp(repository, ready).listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}
test('six seed files validate and stat groups contain all 70 fields', () => {
  assert.equal(statFields.length, 70); assert.equal(data.characters[0]?.info.characterName, 'Admin');
  for (const d of [...data.classes, ...data.monsters]) {
    assert.deepEqual(Object.keys(d.baseStats).sort(), [...statFields].sort());
    assert.deepEqual(Object.keys(d.growthStats).sort(), [...statFields].sort());
  }
});
test('Unreal HTTP contracts and class-based stats are preserved', async () => {
  await withApi(repo, async base => {
    const info = await (await fetch(`${base}/api/characters/1/info`)).json();
    assert.deepEqual(Object.keys(info).sort(), ['id','level','experience','classId','skillPoints','gold','reputation','characterName','characterTitle','staff','clan','alliance','race','faction'].sort());
    const stats = await (await fetch(`${base}/api/characters/1/stats`)).json();
    assert.deepEqual(Object.keys(stats).sort(), ['baseStats','growthStats']);
    assert.equal(stats.baseStats.hp, 150); assert.equal(stats.growthStats.hp, 15);
    const m = await (await fetch(`${base}/api/monsters/101/stats`)).json(); assert.equal(m.baseStats.hp, 100);
    const mi = await (await fetch(`${base}/api/monsters/101/info`)).json(); assert.equal(mi.characterName, 'Wolf');
    const camps = await (await fetch(`${base}/api/locations/forest/monster-spawns`)).json();
    assert.deepEqual(Object.keys(camps), ['camps']); assert.equal(camps.camps[0].monsters[0].enemyId, '101');
    for (const path of ['items/1','classes/1','skills/1']) {
      const res = await fetch(`${base}/api/${path}`); assert.equal(res.status, 200);
      const d = await res.json(); assert.equal(d.id, 1); assert.equal(JSON.stringify(d).includes('"_id"'), false);
    }
  });
});
test('missing class, invalid ID, absent record and DB offline give explicit errors', async () => {
  await withApi({ ...repo, characterClass: async () => null }, async base => {
    const r = await fetch(`${base}/api/characters/1/stats`); assert.equal(r.status, 409);
    assert.equal((await r.json()).error, 'CLASS_NOT_FOUND');
    for (const id of ['0','-1','1.5','2147483648','abc','01']) assert.equal((await fetch(`${base}/api/items/${id}`)).status, 400);
    assert.equal((await fetch(`${base}/api/characters/999/info`)).status, 404);
    assert.equal((await fetch(`${base}/api/locations/missing/monster-spawns`)).status, 404);
  });
  await withApi(repo, async base => { assert.equal((await fetch(`${base}/api/items/1`)).status, 503); }, () => false);
});
test('seed replay updates static records, keeps progress and does not delete other IDs', async () => {
  const store = new Map<string, Record<string, unknown>>([['items:999', { id: 999 }]]);
  const writer = { write: async (op: ReturnType<typeof createOperations>[number]) => {
    const key = `${op.collection}:${Object.values(op.filter)[0]}`; const old = store.get(key);
    if (op.update.$set) store.set(key, { ...old, ...op.update.$set });
    else if (!old) store.set(key, structuredClone(op.update.$setOnInsert!));
  } };
  await applyOperations(createOperations(data, 'static'), writer);
  await applyOperations(createOperations(data, 'dev'), writer);
  const edited = { id: 1, info: { level: 99, gold: 10000 } }; store.set('characters:1', edited);
  const changed = structuredClone(data); changed.items[0]!.name = 'Changed Sword';
  await applyOperations(createOperations(changed, 'static'), writer);
  await applyOperations(createOperations(changed, 'dev'), writer);
  assert.deepEqual(store.get('characters:1'), edited);
  assert.equal(store.get('items:1')?.name, 'Changed Sword'); assert.ok(store.has('items:999'));
});
test('broken references and duplicate IDs fail preflight', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mu-seeds-'));
  try {
    await cp('data', dir, { recursive: true }); const path = join(dir, 'characters.json');
    const chars = JSON.parse(await readFile(path, 'utf8')); chars[0].info.classId = 999;
    await writeFile(path, JSON.stringify(chars)); await assert.rejects(loadData(dir), /Unknown reference/);
    chars[0].info.classId = 1; chars.push(chars[0]); await writeFile(path, JSON.stringify(chars));
    await assert.rejects(loadData(dir), /Duplicate IDs/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('unknown stat names and non-finite values are rejected', async () => {
  await assert.rejects(new Monster({ id: 1, baseStats: { typo: 2 } }).validate());
  await assert.rejects(new Monster({ id: 1, baseStats: { hp: Infinity } }).validate());
});
