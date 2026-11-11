import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { connectDatabase } from '../shared/database.js';
import { Account, Counter } from '../modules/accounts/model.js';
import { hashPassword } from '../modules/accounts/password.js';
import { credentials } from '../modules/accounts/service.js';
import { CharacterClass } from '../modules/classes/model.js';
import { loadData } from './data.js';
import { createOperations, applyOperations } from './operations.js';
const mode = process.argv[2];
if (process.argv.length !== 3) throw new Error('Unexpected seed arguments. For one item use npm run seed:item -- <id>.');
if (mode !== 'static' && mode !== 'dev' && mode !== 'skills' && mode !== 'items' && mode !== 'catalog-meta') throw new Error('Unknown seed mode');
// Complete validation, including cross-file references, before any data mutation.
const devCredentials = mode === 'dev' ? credentials({login:process.env.DEV_LOGIN,password:process.env.DEV_PASSWORD}) : null;
const data = await loadData(resolve(process.env.SEED_DIR || 'data'));
try {
  if (mode === 'catalog-meta') {
    if (!process.env.MONGODB_URI) throw new Error('MongoDB connection is not configured');
    await mongoose.connect(process.env.MONGODB_URI, {serverSelectionTimeoutMS:5000});
  } else await connectDatabase();
  if (mode === 'catalog-meta' || mode === 'static') {
    for (const collection of ['itemSets','serverNotices'])
      await mongoose.connection.collection(collection).createIndex({id:1},{unique:true});
  }
  if (mode === 'dev') {
    for (const character of data.characters) {
      if (!await CharacterClass.exists({ id: character.info.classId }))
        throw new Error('Character class missing in database. Run seed:static first.');
    }
  }
  if (devCredentials) {
    const existing=await Account.findOne({$or:[{id:1},{login:devCredentials.login}]});
    if(existing && (existing.id!==1 || existing.login!==devCredentials.login))throw new Error('Dev account collision; use a clean database');
    if(!existing)await Account.create({id:1,login:devCredentials.login,passwordHash:await hashPassword(devCredentials.password),role:'admin',notes:'Development account'});
    await Counter.updateOne({_id:'accounts'},{$max:{value:1}},{upsert:true});
    await Counter.updateOne({_id:'characters'},{$max:{value:Math.max(0,...data.characters.map(c=>c.id))}},{upsert:true});
  }
  const operations = createOperations(data, mode);
  await applyOperations(operations, { write: async op => {
    // Documents have already passed Mongoose validation. Use the normalized payload.
    await mongoose.connection.collection(op.collection).updateOne(op.filter, op.update, { upsert: true });
  } });
  console.log(`${mode}: applied ${operations.length} upserts; no records deleted.`);
} finally { await mongoose.disconnect(); }
