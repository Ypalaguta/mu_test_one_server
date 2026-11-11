// Explicit catalog-only migration. Run with node --env-file=.env tools/migrate-defense-stats.mjs
import mongoose from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const added = ['spellDamageFlat', 'armorInc', 'evasionInc', 'magicEvasionInc', 'magicResistInc',
  'fireResInc', 'coldResInc', 'lightningResInc', 'chaosResInc'];
const removed = ['quantity', 'rarity', 'exp', 'gold'];
const targets = { items: ['stats'], skills: ['stats'], classes: ['baseStats', 'growthStats'], monsters: ['baseStats', 'growthStats'] };
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false, autoCreate: false });
  const snapshot = {};
  for (const name of Object.keys(targets))
    snapshot[name] = await mongoose.connection.db.collection(name).find({}).toArray();
  await mkdir('backups', { recursive: true });
  const backup = `backups/defense-stats-${Date.now()}.json`;
  await writeFile(backup, mongoose.mongo.BSON.EJSON.stringify(snapshot, null, 2), { flag: 'wx' });
  console.log(`Catalog backup: ${backup}`);

  // Validate every block before starting writes. Preserve existing nonzero values.
  for (const [name, blocks] of Object.entries(targets)) for (const doc of snapshot[name])
    for (const block of blocks) {
      assert.ok(doc[block] && typeof doc[block] === 'object' && !Array.isArray(doc[block]), `${name}: invalid ${block}`);
      for (const field of added) if (Object.hasOwn(doc[block], field))
        assert.ok(Number.isFinite(doc[block][field]), `${name}: invalid ${field}`);
    }
  for (const [name, blocks] of Object.entries(targets)) {
    const collection = mongoose.connection.db.collection(name);
    let changed = 0;
    for (const doc of snapshot[name]) {
      const set = {}, unset = {}, filter = { _id: doc._id }, expected = { ...doc };
      for (const block of blocks) {
        filter[block] = doc[block]; // Abort on concurrent stat edits instead of overwriting them.
        expected[block] = { ...doc[block] };
        for (const field of added) if (!Object.hasOwn(doc[block], field)) {
          set[`${block}.${field}`] = 0; expected[block][field] = 0;
        }
        for (const field of removed) if (Object.hasOwn(doc[block], field)) {
          unset[`${block}.${field}`] = ''; delete expected[block][field];
        }
      }
      const update = { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) };
      if (Object.keys(update).length) {
        const result = await collection.updateOne(filter, update);
        assert.equal(result.matchedCount, 1, `${name}: concurrent change; migration stopped, rerun after review`);
        changed += result.modifiedCount;
      }
      assert.deepStrictEqual(await collection.findOne({ _id: doc._id }), expected);
    }
    console.log(`${name}: verified ${snapshot[name].length}, changed ${changed}`);
  }
} catch (error) {
  // Do not print connection strings or document contents on failure.
  console.error(`Migration failed (${error.name}). Review backup before retrying.`);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
