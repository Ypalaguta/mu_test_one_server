import { Schema, model } from 'mongoose';
import { documentOptions, gameId, infoSchema, statsField, idList } from '../../shared/schemas.js';
export const monsterSchema = new Schema({
  id: gameId, info: { type: infoSchema, required: true, default: () => ({}) },
  baseStats: statsField, growthStats: statsField, skillIds: idList
}, documentOptions);
export const Monster = model('Monster', monsterSchema, 'monsters');
