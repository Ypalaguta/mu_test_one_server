import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { connectDatabase } from '../shared/database.js';
import { CharacterClass } from '../modules/classes/model.js';
import { loadData } from './data.js';
import { createOperations, applyOperations } from './operations.js';
const mode = process.argv[2];
if (mode !== 'static' && mode !== 'dev' && mode !== 'skills') throw new Error('Expected static, dev or skills');
// Complete validation, including cross-file references, before any data mutation.
const data = await loadData(resolve(process.env.SEED_DIR || 'data'));
try {
  await connectDatabase();
  if (mode === 'dev') {
    for (const character of data.characters) {
      if (!await CharacterClass.exists({ id: character.info.classId }))
        throw new Error('Character class missing in database. Run seed:static first.');
    }
  }
  const operations = createOperations(data, mode);
  await applyOperations(operations, { write: async op => {
    // Documents have already passed Mongoose validation. Use the normalized payload.
    await mongoose.connection.collection(op.collection).updateOne(op.filter, op.update, { upsert: true });
  } });
  console.log(`${mode}: applied ${operations.length} upserts; no records deleted.`);
} finally { await mongoose.disconnect(); }
