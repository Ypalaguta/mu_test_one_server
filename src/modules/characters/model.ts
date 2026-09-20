import { Schema, model } from 'mongoose';
import { documentOptions, gameId, infoSchema } from '../../shared/schemas.js';
export const characterSchema = new Schema({
  id: gameId,
  info: { type: infoSchema, required: true, default: () => ({}) }
}, documentOptions);
// Stats are resolved through info.classId. Legacy stored stats are not read by the API.
export const Character = model('Character', characterSchema, 'characters');
