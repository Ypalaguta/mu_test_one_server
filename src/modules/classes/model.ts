import { Schema, model } from 'mongoose';
import { statsSchema } from '../../shared/schemas.js';
import { documentOptions, gameId, nameField, statsField, idList } from '../../shared/schemas.js';
const characterBaseStatsSchema = statsSchema.clone();
characterBaseStatsSchema.path('maxWeight').default(40000);
characterBaseStatsSchema.path('inventorySlots').default(64);
characterBaseStatsSchema.path('auctionSlots').default(10);
export const classSchema = new Schema({
  id: gameId, name: nameField, baseStats: { ...statsField, type: characterBaseStatsSchema }, growthStats: statsField, skillIds: idList
}, documentOptions);
export const CharacterClass = model('CharacterClass', classSchema, 'classes');
