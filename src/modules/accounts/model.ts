import { Schema, model } from 'mongoose';
import { documentOptions, embedded, gameId, integer } from '../../shared/schemas.js';
const banSchema = new Schema({
  startedAt: { type: Date, default: null }, expiresAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null }, reason: { type: String, default: '', maxlength: 2000 },
  issuedBy: integer(), revokedBy: integer()
}, embedded);
export const accountSchema = new Schema({
  id: gameId,
  login: { type: String, required: true, unique: true, match: /^[a-z0-9_\-.]{3,64}$/ },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','gm','player'], default: 'player', required: true },
  status: { type: String, enum: ['provisioning','active'], default: 'active', required: true },
  notes: { type: String, default: '', maxlength: 10000 },
  characterLimit: { ...integer(7,1), max: 7 },
  ban: { type: banSchema, default: () => ({}) },
  banHistory: { type: [banSchema], default: [] },
  lastLoginAt: { type: Date, default: null }
}, { ...documentOptions, timestamps: true });
export const Account = model('Account', accountSchema, 'accounts');
const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  accountId: { ...integer(0,1), unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { ...documentOptions, timestamps: true });
export const AccountSession = model('AccountSession', sessionSchema, 'accountSessions');
const counterSchema = new Schema({ _id: String, value: integer() }, documentOptions);
export const Counter = model('Counter', counterSchema, 'counters');
