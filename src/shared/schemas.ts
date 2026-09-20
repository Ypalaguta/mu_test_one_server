import { Schema } from 'mongoose';
import { statFields } from './statFields.js';
import type { Stats } from './statFields.js';
export const embedded = { _id: false, id: false, strict: 'throw' } as const;
export const documentOptions = { id: false, versionKey: false, strict: 'throw' } as const;
export const finite = (value = 0) => ({ type: Number, default: value, required: true, validate: Number.isFinite });
export const integer = (value = 0, min = 0) => ({ type: Number, default: value, required: true, min, max: 2147483647, validate: Number.isInteger });
export const gameId = { type: Number, required: true, unique: true, min: 1, max: 2147483647, validate: Number.isInteger } as const;
export const nameField = { type: String, required: true, maxlength: 128 } as const;
const statDefinition = Object.fromEntries(statFields.map(key => [key, finite()]));
export const statsSchema = new Schema<Stats>(statDefinition, embedded);
export const statsField = { type: statsSchema, required: true, default: () => ({}) };
export const infoSchema = new Schema({
  level: integer(1, 1), experience: integer(), classId: integer(), skillPoints: integer(),
  gold: integer(), reputation: integer(0, -2147483648),
  characterName: { type: String, default: '', maxlength: 256 },
  characterTitle: { type: String, default: '', maxlength: 256 },
  staff: { type: String, default: '', maxlength: 256 }, clan: { type: String, default: '', maxlength: 256 },
  alliance: { type: String, default: '', maxlength: 256 }, race: { type: String, default: '', maxlength: 256 },
  faction: { type: String, default: '', maxlength: 256 }
}, embedded);
export const idList = { type: [Number], default: () => [], validate: (values: number[]) =>
  new Set(values).size === values.length && values.every(id => Number.isInteger(id) && id > 0 && id <= 2147483647) };
