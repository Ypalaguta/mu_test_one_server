import { Schema, model } from 'mongoose';
import { documentOptions, embedded, gameId, nameField, finite } from '../../shared/schemas.js';
const cost = new Schema({
  resource: { type: String, enum: ['none','hp','mp','cp','energy','rage'], default: 'none', required: true },
  amount: { ...finite(), min: 0 }
}, embedded);
export const skillSchema = new Schema({
  id: gameId, name: nameField,
  targeting: { type: String, enum: ['self','unit','point'], default: 'unit', required: true },
  cost: { type: cost, required: true, default: () => ({}) },
  cooldown: { ...finite(), min: 0 }, range: { ...finite(), min: 0 }
}, documentOptions);
export const Skill = model('Skill', skillSchema, 'skills');
