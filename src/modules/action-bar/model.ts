import { Schema } from 'mongoose';
import { embedded } from '../../shared/schemas.js';

export const actionBarItemTypes = ['Action', 'Skill', 'Item'] as const;
export type ActionBarItemType = typeof actionBarItemTypes[number];

export interface ActionBarSlot {
  slotNum: number;
  id: number;
  type: ActionBarItemType;
}

export const actionBarSlotSchema = new Schema<ActionBarSlot>({
  slotNum: { type: Number, required: true, min: 0, max: 35, validate: Number.isInteger },
  id: { type: Number, required: true, min: 1, max: 2147483647, validate: Number.isInteger },
  type: { type: String, required: true, enum: actionBarItemTypes }
}, embedded);

export const actionBarSlotsField = {
  type: [actionBarSlotSchema],
  required: true,
  default: () => [],
  validate: {
    validator: (slots: ActionBarSlot[]) => slots.length <= 36 &&
      new Set(slots.map(slot => slot.slotNum)).size === slots.length,
    message: 'Action bar must contain at most 36 unique slots'
  }
};
