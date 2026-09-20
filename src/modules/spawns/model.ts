import { Schema, model } from 'mongoose';
import { embedded, documentOptions, finite, integer } from '../../shared/schemas.js';
const vector = new Schema({ x: finite(), y: finite(), z: finite() }, embedded);
const member = new Schema({
  // String on the wire because the existing Unreal structure uses FName.
  enemyId: { type: String, required: true, validate: (v: string) => /^[1-9]\d*$/.test(v) && Number(v) <= 2147483647 },
  level: integer(1, 1), offset: { type: vector, default: () => ({}) }, yaw: finite()
}, embedded);
const camp = new Schema({
  campId: { type: String, required: true, maxlength: 128 },
  position: { type: vector, required: true }, yaw: finite(),
  mode: { type: String, enum: ['AfterCampDeath','PeriodicIfAreaEmpty'], default: 'AfterCampDeath' },
  spawnOnStart: { type: Boolean, default: true },
  respawnDelay: { ...finite(30), min: 0.001 }, interval: { ...finite(60), min: 0.001 },
  phaseOffset: { ...finite(), min: 0 }, clearanceRadius: { ...finite(700), min: 0.001 },
  clearanceHalfHeight: { ...finite(300), min: 0.001 }, maxAlive: integer(15),
  monsters: { type: [member], required: true, validate: (v: unknown[]) => v.length > 0 }
}, embedded);
camp.pre('validate', function () {
  if (this.phaseOffset >= this.interval) this.invalidate('phaseOffset', 'Must be less than interval');
  if (this.maxAlive > 0 && this.maxAlive < this.monsters.length) this.invalidate('maxAlive', 'Must fit a whole wave');
});
const locationSchema = new Schema({
  locationId: { type: String, required: true, unique: true, match: /^[a-zA-Z0-9_-]{1,64}$/ },
  camps: { type: [camp], default: [], validate: (v: { campId: string }[]) => new Set(v.map(c => c.campId.toLowerCase())).size === v.length }
}, documentOptions);
export const MonsterSpawns = model('MonsterSpawns', locationSchema, 'monsterSpawns');
