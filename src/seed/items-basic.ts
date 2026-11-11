/** Run from server root. Writes only the items collection. */
import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Item } from '../modules/items/model.js';

async function main(): Promise<void> {
  let check = false;
  let update = false;
  let file = resolve('data/items-basic.json');
  let onlyId: number | undefined;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') check = true;
    else if (args[i] === '--update') update = true;
    else if (args[i] === '--id') {
      onlyId = Number(args[++i]);
      if (!Number.isSafeInteger(onlyId) || onlyId <= 0) throw new Error('--id requires a positive item ID');
    } else if (args[i] === '--file') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error('--file requires a path');
      file = resolve(value);
    } else throw new Error(`Unknown argument: ${args[i]}`);
  }
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Expected a non-empty JSON array');
  const ids = new Set<number>();
  const documents = [];
  // Validate the entire file BEFORE connecting to MongoDB.
  for (const [index, value] of raw.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error(`Item at index ${index} must be an object`);
    if ('_id' in value || '__v' in value) throw new Error(`Do not supply MongoDB internals at index ${index}`);
    if (!Number.isInteger(value.id) || value.id < 1 || value.id > 2147483647)
      throw new Error(`Invalid integer id at index ${index}`);
    if (ids.has(value.id)) throw new Error(`Duplicate item id: ${value.id}`);
    ids.add(value.id);
    if (onlyId !== undefined && value.id !== onlyId) continue;
    const document = new Item(value);
    await document.validate();
    const { _id, ...data } = document.toObject();
    documents.push(data);
  }
  const counts: Record<string, number> = {};
  if (!documents.length) throw new Error('Requested item is missing from the catalogue');
  for (const item of documents) counts[item.inventoryTab] = (counts[item.inventoryTab] ?? 0) + 1;
  console.log(`Validated ${documents.length} items: ${JSON.stringify(counts)}`);
  if (check) {
    console.log('Check only: no database connection or writes.');
    return;
  }
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env');
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await Item.init();
    const result = await Item.bulkWrite(documents.map(document => ({
      updateOne: {
        filter: { id: document.id },
        update: update ? { $set: document } : { $setOnInsert: document },
        upsert: true
      }
    })), { ordered: true });
    console.log(`items: inserted=${result.upsertedCount}, matched=${result.matchedCount}, modified=${result.modifiedCount}; mode=${update ? 'update' : 'insert missing'}. No records deleted.`);
  } finally {
    await mongoose.disconnect();
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
