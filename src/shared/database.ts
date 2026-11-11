import mongoose from 'mongoose';
import type { ItemSet } from '../modules/items/catalog.js';
import type { ServerNotice } from '../modules/accounts/server-notice.js';
import { Account, AccountSession, Counter } from '../modules/accounts/model.js';
import { Character } from '../modules/characters/model.js';
import { Monster } from '../modules/monsters/model.js';
import { CharacterClass } from '../modules/classes/model.js';
import { Item } from '../modules/items/model.js';
import { Skill } from '../modules/skills/model.js';
import { MonsterSpawns } from '../modules/spawns/model.js';
import type { Repository } from './contracts.js';
mongoose.set('bufferCommands', false);
export async function connectDatabase(): Promise<void> {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([Account.init(), AccountSession.init(), Counter.init(), Character.init(), Monster.init(), CharacterClass.init(), Item.init(), Skill.init(), MonsterSpawns.init()]);
}
async function nextId(key: string) {
  const c=await Counter.findOneAndUpdate({_id:key},{$inc:{value:1}},{upsert:true,new:true});
  if(c.value>2147483647)throw new Error('ID range exhausted');return c.value;
}
export const repository: Repository = {
  itemSets: () => mongoose.connection.db!.collection<ItemSet>('itemSets').find({}, {projection:{_id:0}}).sort({id:1}).toArray(),
  serverNotice: () => mongoose.connection.db!.collection<ServerNotice>('serverNotices').findOne({enabled:true}, {projection:{_id:0}, sort:{_id:-1}}),
  account: id => Account.findOne({id}).lean().exec(),
  accountByLogin: login => Account.findOne({login}).lean().exec(),
  accountCharacters: accountId => Character.find({accountId}).sort({id:1}).lean().exec(),
  createSession: async value => {
    await AccountSession.findOneAndUpdate({accountId:value.accountId},{$set:value},{upsert:true,runValidators:true});
    await Account.updateOne({id:value.accountId},{$set:{lastLoginAt:new Date()}});
  },
  sessionByHash: tokenHash => AccountSession.findOne({tokenHash}).lean().exec(),
  deleteSession: async tokenHash => { await AccountSession.deleteOne({tokenHash}); },
  createAccountWithCharacter: async (login,passwordHash,characterName,classId) => {
    const a=await Account.create({id:await nextId('accounts'),login,passwordHash,role:'player',status:'provisioning'});
    try {
      const cls=await CharacterClass.findOne({id:classId}).lean();
      const skills=await Skill.find({id:{$in:cls?.skillIds??[]},modifierOfSkill:0}).lean();
      await Character.create({id:await nextId('characters'),accountId:a.id,isActive:true,isMain:true,
        info:{characterName,classId},progress:{accessible:[...new Set(skills.map(s=>s.familyId))]}});
      a.status='active';await a.save();
      return a.toObject();
    } catch(e) {await Character.deleteMany({accountId:a.id});await Account.deleteOne({_id:a._id});throw e;}
  },
  items: () => Item.find().sort({ id: 1 }).lean().maxTimeMS(5000).exec(),
  saveState: (id, revision, value) => Character.findOneAndUpdate({ id, revision }, { $set: { info: value.info, progress: value.progress, actionBarSlots: value.actionBarSlots }, $inc: { revision: 1 } }, { new: true, runValidators: true }).lean().maxTimeMS(5000).exec(),
  character: id => Character.findOne({ id }).lean().maxTimeMS(5000).exec(),
  actionBar: id => Character.findOne({ id })
    .select({ actionBarSlots: 1, _id: 0 }).lean().maxTimeMS(5000).exec(),
  saveActionBar: (id, slots) => Character.findOneAndUpdate(
    { id },
    { $set: { actionBarSlots: slots }, $inc: { revision: 1 } },
    { new: true, runValidators: true }
  ).select({ actionBarSlots: 1, _id: 0 }).lean().maxTimeMS(5000).exec(),
  monster: id => Monster.findOne({ id }).lean().maxTimeMS(5000).exec(),
  characterClass: id => CharacterClass.findOne({ id }).lean().maxTimeMS(5000).exec(),
  item: id => Item.findOne({ id }).lean().maxTimeMS(5000).exec(),
  skills: () => Skill.find().sort({ id: 1 }).lean().maxTimeMS(5000).exec(),
  skill: id => Skill.findOne({ id }).lean().maxTimeMS(5000).exec(),
  location: locationId => MonsterSpawns.findOne({ locationId }).lean().maxTimeMS(5000).exec()
};
