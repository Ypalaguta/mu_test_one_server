import { Schema, model } from 'mongoose';
import { progressSchema } from '../progression/model.js';
import { documentOptions, embedded, gameId, infoSchema, integer } from '../../shared/schemas.js';
import { actionBarSlotsField } from '../action-bar/model.js';
export const characterSchema = new Schema({
  id: gameId,
  accountId: { ...integer(0,1), index: true },
  isActive: { type: Boolean, default: false },
  isMain: { type: Boolean, default: false },
  aiSettings: { type: new Schema({ allowedSkillIds: { type: [Number], default: [], validate: (v: number[]) => v.every(n => Number.isInteger(n) && n>0) } }, embedded), required:true, default:()=>({}) },
  info: { type: infoSchema, required: true, default: () => ({}) },
  revision: integer(),
  progress: { type: progressSchema, default: () => ({}), required: true },
  actionBarSlots: actionBarSlotsField
}, documentOptions);
// Stats are resolved through info.classId. Legacy stored stats are not read by the API.
characterSchema.index({ accountId: 1 }, { name:'one_main_per_account', unique: true, partialFilterExpression: { isMain: true } });
characterSchema.pre('validate', function () { if (this.isMain && !this.isActive) this.invalidate('isMain', 'Main character must be active'); });
export const Character = model('Character', characterSchema, 'characters');
