import { itemTypes, itemSlots } from './types.js';
import { Schema, model } from 'mongoose';
import { documentOptions, embedded, gameId, nameField, statsField, integer, idList } from '../../shared/schemas.js';
const requirements = new Schema({ level: integer(1, 1), classIds: idList }, embedded);
export const itemSchema = new Schema({
  id: gameId, name: nameField,
  itemLevel: integer(1,1),
  type: { type: String, enum: itemTypes, required: true },
  slot: { type: String, enum: itemSlots, default: 'None', required: true },
  requirements: { type: requirements, default: () => ({}), required: true },
  description: { type: String, default: '' },
  iconName: { type: String, default: '' },
  executionId: { type: String, default: '' },
  inventoryTab: { type: String, enum: ['Equipment','SuppliesMaterials','Misc','Temporary','Quest','Artifact'], default: 'Misc' },
  maxStack: integer(1,1),
  modifierIcon: { type: String, default: '' },
  weight: { type: Number, default: 0, min: 0, validate: Number.isFinite },
  autoUsageAvailable: { type: Boolean, default: false },
  border: { type: String, enum: ["None", "White", "Green", "Blue", "Purple", "Yellow", "Orange", "Red"], default: "None" },
  rarity: { type: String, enum: ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"], default: "Common" },
  wearRestrictions: { type: [String], enum: ["CannotEquip", "CannotEquipInCombat", "CannotUnequipInCombat"], default: () => [] },
  storageRestrictions: { type: [String], enum: ["NoPersonalWarehouse", "NoAccountStorage", "NoGuildStorage"], default: () => [] },
  tradeRestrictions: { type: [String], enum: ["NoPlayerTrade", "NoAuction", "NoVendorSale", "NoMail", "NoDrop"], default: () => [] },
  stats: statsField
}, documentOptions);
export const Item = model('Item', itemSchema, 'items');
