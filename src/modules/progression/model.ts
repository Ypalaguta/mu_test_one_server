import { Schema } from 'mongoose';
import { embedded, integer, idList } from '../../shared/schemas.js';
const stack = new Schema({ slot: integer(), itemId: integer(1,1), quantity: integer(1,1) }, embedded);
const modifier = new Schema({ familyId: integer(1,1), skillId: integer(1,1) }, embedded);
export const progressSchema = new Schema({
  inventoryCapacity: { ...integer(64,64), max: 500 },
  inventory: { type: [stack], default: () => [] },
  achievements: idList, accessible: idList, learned: idList,
  selectedModifiers: { type: [modifier], default: () => [] }
}, { ...embedded, minimize: false });
