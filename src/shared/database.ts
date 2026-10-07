import mongoose from 'mongoose';
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
  await Promise.all([Character.init(), Monster.init(), CharacterClass.init(), Item.init(), Skill.init(), MonsterSpawns.init()]);
}
export const repository: Repository = {
  character: id => Character.findOne({ id }).lean().maxTimeMS(5000).exec(),
  actionBar: id => Character.findOne({ id })
    .select({ actionBarSlots: 1, _id: 0 }).lean().maxTimeMS(5000).exec(),
  saveActionBar: (id, slots) => Character.findOneAndUpdate(
    { id },
    { $set: { actionBarSlots: slots } },
    { new: true, runValidators: true }
  ).select({ actionBarSlots: 1, _id: 0 }).lean().maxTimeMS(5000).exec(),
  monster: id => Monster.findOne({ id }).lean().maxTimeMS(5000).exec(),
  characterClass: id => CharacterClass.findOne({ id }).lean().maxTimeMS(5000).exec(),
  item: id => Item.findOne({ id }).lean().maxTimeMS(5000).exec(),
  skill: id => Skill.findOne({ id }).lean().maxTimeMS(5000).exec(),
  location: locationId => MonsterSpawns.findOne({ locationId }).lean().maxTimeMS(5000).exec()
};
