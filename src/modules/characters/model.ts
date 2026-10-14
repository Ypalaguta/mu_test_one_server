import { Schema, model } from 'mongoose';
import { progressSchema } from '../progression/model.js';
import { documentOptions, gameId, infoSchema, integer } from '../../shared/schemas.js';
import { actionBarSlotsField } from '../action-bar/model.js';
export const characterSchema = new Schema({
  id: gameId,
  info: { type: infoSchema, required: true, default: () => ({}) },
  revision: integer(),
  progress: { type: progressSchema, default: () => ({}), required: true },
  actionBarSlots: actionBarSlotsField
}, documentOptions);
// Stats are resolved through info.classId. Legacy stored stats are not read by the API.
export const Character = model('Character', characterSchema, 'characters');
