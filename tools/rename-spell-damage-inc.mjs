import mongoose from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const targets = { items: ['stats'], skills: ['stats'], classes: ['baseStats', 'growthStats'], monsters: ['baseStats', 'growthStats'] };
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false, autoCreate: false });
  const snapshot = {};
  for (const name of Object.keys(targets)) snapshot[name] = await mongoose.connection.db.collection(name).find({}).toArray();
  await mkdir('backups', { recursive: true });
  const backup = `backups/spell-damage-inc-${Date.now()}.json`;
  await writeFile(backup, mongoose.mongo.BSON.EJSON.stringify(snapshot, null, 2), { flag: 'wx' });
  console.log(`Catalog backup: ${backup}`);
  // Refuse conflicting names before any writes; never silently discard an authored value.
  for (const [name, blocks] of Object.entries(targets)) for (const doc of snapshot[name]) for (const key of blocks) {
    const s = doc[key]; assert.ok(s && typeof s === 'object');
    for (const field of ['spellDamage', 'spellDamageInc']) if (Object.hasOwn(s, field)) assert.ok(Number.isFinite(s[field]));
    if (Object.hasOwn(s, 'spellDamage') && Object.hasOwn(s, 'spellDamageInc')) assert.equal(s.spellDamage, s.spellDamageInc);
  }
  for (const [name, blocks] of Object.entries(targets)) {
    const c = mongoose.connection.db.collection(name); let changed = 0;
    for (const doc of snapshot[name]) {
      const set = {}, unset = {}, filter = { _id: doc._id }, expected = { ...doc };
      for (const key of blocks) {
        const s = doc[key]; filter[key] = s; expected[key] = { ...s };
        if (!Object.hasOwn(s, 'spellDamageInc')) {
          set[`${key}.spellDamageInc`] = s.spellDamage ?? 0;
          expected[key].spellDamageInc = s.spellDamage ?? 0;
        }
        if (Object.hasOwn(s, 'spellDamage')) { unset[`${key}.spellDamage`] = ''; delete expected[key].spellDamage; }
      }
      const update = { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) };
      if (Object.keys(update).length) {
        const r = await c.updateOne(filter, update); assert.equal(r.matchedCount, 1); changed += r.modifiedCount;
      }
      assert.deepStrictEqual(await c.findOne({ _id: doc._id }), expected);
    }
    console.log(`${name}: verified ${snapshot[name].length}, changed ${changed}`);
  }
} catch (e) { console.error(`Migration failed (${e.name}); review backup before retrying.`); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
