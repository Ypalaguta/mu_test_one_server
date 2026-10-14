import { Schema, model } from 'mongoose';
import { documentOptions, embedded, gameId, nameField, statsField, integer, idList } from '../../shared/schemas.js';
const requirements = new Schema({ level: integer(1, 1), classIds: idList }, embedded);
export const itemSchema = new Schema({
  id: gameId, name: nameField,
  type: { type: String, enum: ['weapon','armor','accessory','consumable','material'], required: true },
  slot: { type: String, enum: ['none','mainHand','offHand','head','body','hands','legs','feet','ring','neck'], default: 'none', required: true },
  requirements: { type: requirements, default: () => ({}), required: true },
  description: { type: String, default: '' },
  iconName: { type: String, default: '' },
  executionId: { type: String, default: '' },
  inventoryTab: { type: String, enum: ['Equipment','SuppliesMaterials','Misc','Temporary','Quest','Artifact'], default: 'Misc' },
  maxStack: integer(1,1),
  stats: statsField
}, documentOptions);
export const Item = model('Item', itemSchema, 'items');
