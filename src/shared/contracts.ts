import type { InferSchemaType } from 'mongoose';
import type { infoSchema } from './schemas.js';
import type { Stats } from './statFields.js';
import type { classSchema } from '../modules/classes/model.js';
import type { itemSchema } from '../modules/items/model.js';
import type { skillSchema } from '../modules/skills/model.js';
export type Info = InferSchemaType<typeof infoSchema>;
export interface CharacterRecord { id: number; info: Info }
export interface StatsResponse { baseStats: Stats; growthStats: Stats }
export interface MonsterRecord extends CharacterRecord, StatsResponse {}
export type ClassRecord = InferSchemaType<typeof classSchema>;
export type ItemRecord = InferSchemaType<typeof itemSchema>;
export type SkillRecord = InferSchemaType<typeof skillSchema>;
export interface CampMember { enemyId: string; level: number; offset: { x: number; y: number; z: number }; yaw: number }
export interface Camp {
  campId: string; position: { x: number; y: number; z: number }; yaw: number;
  mode: string; spawnOnStart: boolean; respawnDelay: number; interval: number; phaseOffset: number;
  clearanceRadius: number; clearanceHalfHeight: number; maxAlive: number; monsters: CampMember[];
}
export interface LocationRecord { locationId: string; camps: Camp[] }
export interface Repository {
  character(id: number): Promise<CharacterRecord | null>;
  monster(id: number): Promise<MonsterRecord | null>;
  characterClass(id: number): Promise<ClassRecord | null>;
  item(id: number): Promise<ItemRecord | null>;
  skill(id: number): Promise<SkillRecord | null>;
  location(id: string): Promise<LocationRecord | null>;
}
