import { Schema, model } from 'mongoose';
import { documentOptions, embedded, gameId, integer, finite, statsField, idList } from '../../shared/schemas.js';
export const skillTags = ["None", "Skill", "Melee", "Ranged", "Spell", "AoE", "Target", "Projectile", "Passive", "Attack", "Warcry", "Aura", "Herald", "Curse", "Minion", "Golem", "Totem", "Trap", "Mine", "Physical", "Lightning", "Cold", "Fire", "Chaos", "Bow", "Chaining", "Channeling", "Duration", "Movement", "Trigger", "OneHanded", "TwoHanded", "Sword", "Shield", "Heal", "Buff", "Debuff", "Cursed"] as const;
export const conditionTypes = ['CharacterLevel','Gold','SkillPoints','Achievement','Item','Skill'] as const;
const condition = new Schema({
  type: { type: String, enum: conditionTypes, required: true },
  id: integer(), amount: integer(1, 1)
}, embedded);
const conditions = { type: [condition], default: () => [], validate: (v: {type:string;id:number;amount:number}[]) =>
  new Set(v.map(c => `${c.type}:${c.id}`)).size === v.length && v.every(c =>
    ['Achievement','Item','Skill'].includes(c.type) ? c.id > 0 && (c.type === 'Item' || c.amount === 1) : c.id === 0) };
const amount = { ...integer(), default: undefined, required: false };
const resource = new Schema({ None: amount, Hp: amount, Mp: amount, Cp: amount, Energy: amount, Rage: amount, EnergyShield: amount }, embedded);
const activationRequirements = new Schema({
  requiresShield: {type:Boolean,default:false}, requiresOneHandWeapon: {type:Boolean,default:false},
  requiresSword: {type:Boolean,default:false}, healthBelowPercent: {...finite(),min:0,max:100}
}, embedded);
export const skillSchema = new Schema({
  id: gameId, familyId: integer(), level: integer(), prev: integer(), replaces: idList,
  modifierOfSkill: integer(), name: { type: String, default: '' }, description: { type: String, default: '' },
  executionId: { type: String, default: '' },
  upgradeDescription: { type: String, default: '' },
  activationRequirements: {type:activationRequirements,default:()=>({})},
  duration: {...finite(),min:0},
  effectParameters: {type:Map,of:{type:Number,validate:Number.isFinite},default:()=>({})},
  requirements: conditions, cost: { ...conditions, validate: (v: {type:string;id:number;amount:number}[]) => conditions.validate(v) && v.every(c => ['Gold','SkillPoints','Item'].includes(c.type)) },
  needTargetSelected: { type: Boolean, default: false },
  allowedTarget: { type: String, enum: ['None','Self','Enemy','Ally','Any'], default: 'None' },
  tags: { type: [{ type: String, enum: skillTags }], default: () => [] },
  aggro: integer(0, -2147483648), useRange: integer(), canBeInterrupted: { type: Boolean, default: false },
  canWalkDuringActivation: { type: Boolean, default: false }, useTime: { ...finite(), min: 0 },
  hasGCd: { type: Boolean, default: false }, cooldown: { ...finite(), min: 0 }, buffApply: idList, debuffApply: idList,
  skillUseType: { type: String, enum: ['None','Active','Passive','Toggle','Channel'], default: 'None' },
  resource: { type: resource, default: () => ({}) }, stats: statsField,
  iconName: { type: String, default: '' }
}, { ...documentOptions, minimize: false });
export const Skill = model('Skill', skillSchema, 'skills');
