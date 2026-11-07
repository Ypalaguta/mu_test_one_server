import { equipmentSlots } from '../items/types.js';
import { Schema } from 'mongoose';
import { embedded, integer, idList } from '../../shared/schemas.js';
const stack = new Schema({ slot: integer(), itemId: integer(1,1), quantity: integer(1,1) }, embedded);
const equipped = new Schema({ slot: { type: String, enum: equipmentSlots, required: true }, itemId: integer(1,1) }, embedded);
const modifier = new Schema({ familyId: integer(1,1), skillId: integer(1,1) }, embedded);
export const progressSchema = new Schema({
  inventoryCapacity: { ...integer(64,64), max: 500 },
  lastLootReceipt: { type: String, maxlength: 32, match: /^[a-fA-F0-9]{32}$/ },
  inventory: { type: [stack], default: () => [] },
  equipment: { type: [equipped], default: () => [], validate: (v: unknown[]) => v.length <= 17 },
  achievements: idList, accessible: idList, learned: idList,
  selectedModifiers: { type: [modifier], default: () => [] }
}, { ...embedded, minimize: false });
