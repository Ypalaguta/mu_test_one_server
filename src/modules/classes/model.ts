import { Schema, model } from 'mongoose';
import { documentOptions, gameId, nameField, statsField, idList } from '../../shared/schemas.js';
export const classSchema = new Schema({
  id: gameId, name: nameField, baseStats: statsField, growthStats: statsField, skillIds: idList
}, documentOptions);
export const CharacterClass = model('CharacterClass', classSchema, 'classes');
