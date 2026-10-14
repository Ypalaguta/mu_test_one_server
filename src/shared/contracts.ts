import type { InferSchemaType } from 'mongoose';
import type { infoSchema } from './schemas.js';
import type { Stats } from './statFields.js';
import type { classSchema } from '../modules/classes/model.js';
import type { itemSchema } from '../modules/items/model.js';
import type { skillSchema } from '../modules/skills/model.js';
import type { ActionBarSlot } from '../modules/action-bar/model.js';
export type Info = InferSchemaType<typeof infoSchema>;
export interface EntityRecord { id: number; info: Info }
export interface InventoryStack { slot: number; itemId: number; quantity: number }
export interface Progress { inventoryCapacity: number; inventory: InventoryStack[]; achievements: number[]; accessible: number[]; learned: number[]; selectedModifiers: {familyId:number;skillId:number}[] }
export interface CharacterRecord extends EntityRecord { revision: number; progress: Progress; actionBarSlots: ActionBarSlot[] }
export interface ActionBarRecord { actionBarSlots: ActionBarSlot[] }
export interface StatsResponse { baseStats: Stats; growthStats: Stats }
export interface MonsterRecord extends EntityRecord, StatsResponse {}
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
  saveState(id: number, expectedRevision: number, value: CharacterRecord): Promise<CharacterRecord | null>;
  items(): Promise<ItemRecord[]>;
  character(id: number): Promise<CharacterRecord | null>;
  actionBar(id: number): Promise<ActionBarRecord | null>;
  saveActionBar(id: number, slots: ActionBarSlot[]): Promise<ActionBarRecord | null>;
  monster(id: number): Promise<MonsterRecord | null>;
  characterClass(id: number): Promise<ClassRecord | null>;
  item(id: number): Promise<ItemRecord | null>;
  skills(): Promise<SkillRecord[]>;
  skill(id: number): Promise<SkillRecord | null>;
  location(id: string): Promise<LocationRecord | null>;
}
