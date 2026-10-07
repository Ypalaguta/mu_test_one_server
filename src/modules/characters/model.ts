import { Schema, model } from 'mongoose';
import { documentOptions, gameId, infoSchema } from '../../shared/schemas.js';
import { actionBarSlotsField } from '../action-bar/model.js';
export const characterSchema = new Schema({
  id: gameId,
  info: { type: infoSchema, required: true, default: () => ({}) },
  actionBarSlots: actionBarSlotsField
}, documentOptions);
// Stats are resolved through info.classId. Legacy stored stats are not read by the API.
export const Character = model('Character', characterSchema, 'characters');
